import type { EnvLike } from "@/lib/automation/channels";
import { payfastParamString, payfastSignature } from "@/lib/billing/signature";
import { payfastCredentials, payfastValidateUrl, type PayfastMode } from "@/lib/payfast/config";

/**
 * PayFast ITN source ranges published in their developer docs.
 * 197.97.145.144/28, 41.74.179.192/27, 102.216.36.0/28, 102.216.36.128/28, and 144.126.193.139.
 */
const CIDRS: Array<[string, number]> = [
  ["197.97.145.144", 28],
  ["41.74.179.192", 27],
  ["102.216.36.0", 28],
  ["102.216.36.128", 28],
];

const EXACT_IPS = new Set(["144.126.193.139"]);

export type ItnVerdict = {
  ok: boolean;
  error: string;
  signatureValid: boolean;
  sourceIpAllowed: boolean;
  amountMatches: boolean;
  serverConfirmed: boolean;
  mode: PayfastMode;
};

function ipv4ToInt(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value * 256 + octet) >>> 0;
  }
  return value;
}

export function isPayfastSourceIp(ip: string) {
  const cleaned = ip.trim();
  if (EXACT_IPS.has(cleaned)) return true;
  const value = ipv4ToInt(cleaned);
  if (value == null) return false;
  for (const [base, bits] of CIDRS) {
    const network = ipv4ToInt(base);
    if (network == null) continue;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    if ((value & mask) === (network & mask)) return true;
  }
  return false;
}

export function requestSourceIp(headers: Headers) {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

export function randsToCents(value: string) {
  const [whole, frac = ""] = value.trim().split(".");
  if (!/^\d+$/.test(whole || "0")) return null;
  if (frac && !/^\d{1,2}$/.test(frac)) return null;
  const cents = `${frac}00`.slice(0, 2);
  return Number(whole || "0") * 100 + Number(cents);
}

export function signatureMatches(fields: Record<string, string>, order: string[], passphrase: string) {
  const provided = String(fields.signature ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(provided)) return false;
  const expected = payfastSignature(fields, order, passphrase);
  return expected === provided;
}

function failed(partial: Omit<ItnVerdict, "ok" | "error">, error: string): ItnVerdict {
  return { ok: false, error, ...partial };
}

/**
 * Signature, source IP, amount, then a server-side confirm against PayFast.
 * The passphrase is used only for the local signature. It is not posted to PayFast.
 */
export async function validateIncomeItn(input: {
  fields: Record<string, string>;
  order: string[];
  sourceIp: string;
  expectedAmountCents: number;
  env?: EnvLike;
  fetchImpl?: typeof fetch;
}): Promise<ItnVerdict> {
  const env = input.env ?? process.env;
  const credentials = payfastCredentials(env);
  const mode = credentials.mode;
  const base = {
    signatureValid: false,
    sourceIpAllowed: false,
    amountMatches: false,
    serverConfirmed: false,
    mode,
  };
  if (!signatureMatches(input.fields, input.order, credentials.passphrase)) {
    return failed(base, "PayFast signature was rejected.");
  }
  base.signatureValid = true;
  if (!isPayfastSourceIp(input.sourceIp)) {
    return failed(base, "PayFast ITN source IP was rejected.");
  }
  base.sourceIpAllowed = true;
  const gross = randsToCents(input.fields.amount_gross || input.fields.amount || "");
  if (gross == null || Math.abs(gross - input.expectedAmountCents) > 1) {
    return failed(base, "PayFast amount does not match the quote or membership.");
  }
  base.amountMatches = true;
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = payfastParamString(input.fields, input.order, "");
  let confirmed = "";
  try {
    const response = await fetchImpl(payfastValidateUrl(mode), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    confirmed = (await response.text()).trim().toUpperCase();
  } catch {
    return failed(base, "PayFast server confirmation could not be completed.");
  }
  if (confirmed !== "VALID") {
    return failed(base, "PayFast server confirmation was not VALID.");
  }
  base.serverConfirmed = true;
  return { ok: true, error: "", ...base };
}

import type { EnvLike } from "@/lib/automation/channels";

export type PayfastMode = "sandbox" | "live";

const SANDBOX_PROCESS = "https://sandbox.payfast.co.za/eng/process";
const LIVE_PROCESS = "https://www.payfast.co.za/eng/process";
const SANDBOX_VALIDATE = "https://sandbox.payfast.co.za/eng/query/validate";
const LIVE_VALIDATE = "https://www.payfast.co.za/eng/query/validate";

/** Sandbox unless PAYFAST_MODE is exactly "live". Any other value stays on the sandbox host. */
export function payfastMode(env: EnvLike = process.env): PayfastMode {
  return String(env.PAYFAST_MODE ?? "").trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export function payfastProcessUrl(mode: PayfastMode) {
  return mode === "live" ? LIVE_PROCESS : SANDBOX_PROCESS;
}

export function payfastValidateUrl(mode: PayfastMode) {
  return mode === "live" ? LIVE_VALIDATE : SANDBOX_VALIDATE;
}

/**
 * Merchant id, key, and passphrase come only from the environment.
 * This module does not embed a key, a passphrase, or a fallback merchant id.
 */
export function payfastCredentials(env: EnvLike = process.env) {
  return {
    merchantId: String(env.PAYFAST_MERCHANT_ID ?? "").trim(),
    merchantKey: String(env.PAYFAST_MERCHANT_KEY ?? "").trim(),
    passphrase: String(env.PAYFAST_PASSPHRASE ?? ""),
    mode: payfastMode(env),
  };
}

export function payfastCheckoutReady(env: EnvLike = process.env) {
  const credentials = payfastCredentials(env);
  return Boolean(credentials.merchantId && credentials.merchantKey);
}

export function siteOrigin(env: EnvLike = process.env) {
  return String(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

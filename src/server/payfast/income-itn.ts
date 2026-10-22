import { parsePayfastBody } from "@/lib/billing/signature";
import type { EnvLike } from "@/lib/automation/channels";
import { payfastMode } from "@/lib/payfast/config";
import { requestSourceIp, randsToCents, validateIncomeItn } from "@/lib/payfast/itn";
import { callServiceRpc } from "@/server/workers/with-org";
import { createClient } from "@supabase/supabase-js";
import { authOnlyRealtime } from "@/lib/supabase/realtime";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Expected = { kind: "service" | "membership"; amountCents: number };

export type IncomeItnDeps = {
  loadExpected: (kind: "service" | "membership", id: string) => Promise<Expected | null | "unconfigured">;
  apply: (args: Record<string, unknown>) => Promise<{ configured: boolean; error: string | null; data: unknown }>;
  fetchImpl?: typeof fetch;
};

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: authOnlyRealtime,
  });
}

async function loadExpected(kind: Expected["kind"], id: string): Promise<Expected | null | "unconfigured"> {
  const client = service();
  if (!client) return "unconfigured";
  const table = kind === "service" ? "service_quotes" : "aios_memberships";
  const found = await client.from(table).select("amount_cents").eq("id", id).maybeSingle();
  if (found.error) {
    if (/does not exist|schema cache/i.test(found.error.message)) return null;
    return null;
  }
  if (!found.data) return null;
  const amount = Number((found.data as { amount_cents?: number }).amount_cents);
  if (!Number.isFinite(amount)) return null;
  return { kind, amountCents: amount };
}

function safePayload(fields: Record<string, string>) {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "merchant_key" || key === "passphrase" || key === "signature") continue;
    payload[key] = value;
  }
  return payload;
}

export async function receiveIncomeItn(
  raw: string,
  headers: Headers,
  env: EnvLike = process.env,
  deps: IncomeItnDeps = {
    loadExpected,
    apply: async (args) => {
      const saved = await callServiceRpc("apply_income_payment", args);
      return { configured: saved.configured, error: saved.error?.message ?? null, data: saved.data };
    },
  },
) {
  const { fields, order } = parsePayfastBody(raw);
  const mode = payfastMode(env);
  if ((fields.custom_str3 || "") !== mode) {
    return { status: 400, body: { ok: false, charged: false, error: "PayFast ITN mode does not match PAYFAST_MODE." } };
  }
  const kind: Expected["kind"] = fields.m_payment_id?.startsWith("mem_") ? "membership" : "service";
  const reference = fields.custom_str1 || "";
  if (!UUID.test(reference) || !fields.pf_payment_id) {
    return { status: 400, body: { ok: false, charged: false, error: "PayFast ITN is missing the payment reference." } };
  }
  const expected = await deps.loadExpected(kind, reference);
  if (expected === "unconfigured") {
    return { status: 503, body: { ok: false, charged: false, error: "Supabase service role is not configured. The ITN was not stored." } };
  }
  if (!expected) {
    return { status: 400, body: { ok: false, charged: false, error: "The quote or membership for this ITN was not found." } };
  }
  const verdict = await validateIncomeItn({
    fields,
    order,
    sourceIp: requestSourceIp(headers),
    expectedAmountCents: expected.amountCents,
    env,
    fetchImpl: deps.fetchImpl,
  });
  if (!verdict.ok) {
    return { status: 400, body: { ok: false, charged: false, error: verdict.error, signatureValid: verdict.signatureValid, sourceIpAllowed: verdict.sourceIpAllowed, serverConfirmed: verdict.serverConfirmed } };
  }
  const gross = randsToCents(fields.amount_gross || fields.amount || "");
  const saved = await deps.apply({
    p_kind: kind,
    p_pf_payment_id: fields.pf_payment_id,
    p_payment_status: fields.payment_status || "",
    p_amount_cents: gross,
    p_reference: reference,
    p_source_ip: requestSourceIp(headers),
    p_sandbox: mode !== "live",
    p_token: fields.token || "",
    p_payload: safePayload(fields),
  });
  if (!saved.configured) {
    return { status: 503, body: { ok: false, charged: false, error: "Supabase service role is not configured. The ITN was not stored." } };
  }
  if (saved.error) {
    return { status: 400, body: { ok: false, charged: false, error: saved.error } };
  }
  return { status: 200, body: { ok: true, charged: false, sandbox: mode !== "live", result: saved.data } };
}

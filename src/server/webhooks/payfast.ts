import type { EnvLike } from "@/lib/automation/channels";
import { parsePayfastBody } from "@/lib/billing/signature";
import { verifyPayfastItn } from "@/lib/billing/payfast";
import { callServiceRpc } from "@/server/workers/with-org";

export async function receivePayfastItn(request: Request, env: EnvLike = process.env) {
  const raw = await request.text();
  const { fields, order } = parsePayfastBody(raw);
  const verified = verifyPayfastItn(fields, order, env);
  if (!verified.ok) {
    return { status: 400, body: { ok: false, charged: false, error: verified.error } };
  }
  if (!fields.custom_str1 || !fields.pf_payment_id) {
    return { status: 400, body: { ok: false, charged: false, error: "PayFast ITN is missing the workspace or payment id." } };
  }
  const saved = await callServiceRpc("apply_billing_event", {
    p_org: fields.custom_str1,
    p_provider: "payfast",
    p_event_id: fields.pf_payment_id,
    p_type: "itn",
    p_payload: {
      sandbox: "true",
      payment_status: fields.payment_status || "",
      plan_code: fields.custom_str2 || "",
      amount_gross: fields.amount_gross || "",
      token: fields.token || "",
      occurred_at: new Date().toISOString(),
    },
  });
  if (!saved.configured) {
    return {
      status: 503,
      body: { ok: false, charged: false, error: "Supabase service role is not configured. The ITN was not stored. No charge was sent." },
    };
  }
  if (saved.error) {
    return { status: 400, body: { ok: false, charged: false, error: saved.error.message } };
  }
  return { status: 200, body: { ok: true, charged: false, sandbox: true, result: saved.data } };
}

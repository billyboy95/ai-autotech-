import { callServiceRpc } from "@/server/workers/with-org";

/** Dunning and the monthly usage invoice. Never calls PayFast, Paystack, or Yoco. */
export async function runBillingCron(now = new Date()) {
  const result = await callServiceRpc("run_billing_cycle", { p_now: now.toISOString() });
  if (!result.configured) {
    return {
      ok: true as const,
      skipped: true,
      charged: false as const,
      sandbox: true as const,
      reason: "Supabase service role is not configured. No charge was sent.",
    };
  }
  if (result.error) {
    return {
      ok: false as const,
      skipped: false,
      charged: false as const,
      sandbox: true as const,
      error: result.error.message,
    };
  }
  return {
    ok: true as const,
    skipped: false,
    charged: false as const,
    sandbox: true as const,
    result: result.data,
  };
}

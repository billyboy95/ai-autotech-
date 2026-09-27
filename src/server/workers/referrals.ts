import { createClient } from "@supabase/supabase-js";
import { readReferralCode, type ReferralClickSource } from "@/lib/referrals/codes";
import { authOnlyRealtime } from "@/lib/supabase/realtime";

export async function recordReferralClick(
  raw: string | null | undefined,
  source: ReferralClickSource,
  leadId?: string | null,
) {
  const code = readReferralCode(raw);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!code || !url || !key) return;
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: authOnlyRealtime,
  });
  const { error } = await client.rpc("record_referral_click", {
    p_code: code,
    p_source: source,
    p_lead_id: leadId || null,
  });
  if (error) console.error("referral click skipped", error.message);
}

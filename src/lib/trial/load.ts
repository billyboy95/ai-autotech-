import { createSupabaseServerClient } from "@/lib/supabase/server";
import { freeTrialEnabled, trialBanner, type TrialBanner } from "@/lib/trial/trial";
import type { EnvLike } from "@/lib/automation/channels";

export async function loadTrialNote(orgId: string, env: EnvLike = process.env): Promise<TrialBanner | null> {
  if (!freeTrialEnabled(env)) return null;
  if (!orgId || orgId.startsWith("preview-")) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("workspace_trials").select("status, ends_at").eq("org_id", orgId).maybeSingle();
    if (error || !data?.status || !data.ends_at) return null;
    return trialBanner({ status: String(data.status), endsAt: String(data.ends_at) });
  } catch {
    return null;
  }
}

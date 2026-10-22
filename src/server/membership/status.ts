import { createClient } from "@supabase/supabase-js";
import { isMembershipStatus, type MembershipStatus } from "@/lib/membership/access";
import { authOnlyRealtime } from "@/lib/supabase/realtime";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: authOnlyRealtime,
  });
}

/** Null when no membership is on file, or when the table is not applied yet. */
export async function readOrgMembershipStatus(orgId: string): Promise<MembershipStatus | null> {
  const supabase = client();
  if (!supabase || !orgId) return null;
  const found = await supabase
    .from("aios_memberships")
    .select("status")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (found.error || !found.data) return null;
  const status = String((found.data as { status?: string }).status ?? "");
  return isMembershipStatus(status) ? status : null;
}

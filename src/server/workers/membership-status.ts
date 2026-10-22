import { isMembershipStatus, type MembershipStatus } from "@/lib/membership/access";
import { openServiceDatabase } from "@/server/workers/service-db";

/**
 * Latest membership for an organisation. Client users are not on the
 * authenticated read policy, so the platform gate reads through the worker client.
 * Null when no membership is on file, or when the table is not available.
 */
export async function readOrgMembershipStatus(orgId: string): Promise<MembershipStatus | null> {
  const supabase = openServiceDatabase();
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

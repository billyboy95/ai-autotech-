import { AGENCY_SLUG } from "@/lib/tenant/types";
import { ownerEmailList, shouldAttachOwner } from "@/lib/auth/owners";
import { openServiceDatabase } from "@/server/workers/service-db";

/**
 * Lock-out safety. A listed OWNER_EMAILS address with no membership is attached
 * as agency_owner of the AI AutoTech organisation. Existing memberships are left
 * as they are. The insert is idempotent (unique user_id, org_id). Nothing is deleted.
 */
export async function ensureOwnerMembership(user: { id: string; email?: string | null }) {
  const listed = ownerEmailList();
  if (!user.email || !listed.includes(user.email.trim().toLowerCase())) {
    return { attached: false as const, reason: "not-listed" as const };
  }

  const admin = openServiceDatabase();
  if (!admin) return { attached: false as const, reason: "no-service-role" as const };

  const existing = await admin.from("memberships").select("id").eq("user_id", user.id).limit(1);
  if (existing.error) return { attached: false as const, reason: "lookup-failed" as const };
  const membershipCount = existing.data?.length ?? 0;
  if (!shouldAttachOwner({ email: user.email, listed, membershipCount })) {
    return { attached: false as const, reason: "already-member" as const };
  }

  const org = await admin.from("organizations").select("id").eq("slug", AGENCY_SLUG).maybeSingle();
  if (org.error || !org.data?.id) return { attached: false as const, reason: "no-org" as const };

  const saved = await admin.from("memberships").upsert(
    { user_id: user.id, org_id: org.data.id, role: "agency_owner" },
    { onConflict: "user_id,org_id", ignoreDuplicates: true },
  );
  if (saved.error) return { attached: false as const, reason: "insert-failed" as const };
  return { attached: true as const, reason: "attached" as const };
}

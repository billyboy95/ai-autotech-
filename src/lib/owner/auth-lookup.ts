import { DEFAULT_OWNER_EMAIL } from "@/lib/auth/owners";
import { matchDocumentedOwner, type DocumentedOwnerAuth } from "@/lib/owner/bootstrap";
import { openServiceDatabase } from "@/server/workers/service-db";
import { AGENCY_SLUG } from "@/lib/tenant/types";

const UNREAD: DocumentedOwnerAuth = { authUser: "unread", membership: "unread" };

/**
 * Reads whether the documented owner exists in Supabase Auth.
 * Other addresses in the response are ignored and are not returned.
 * This function does not create a user.
 */
export async function loadDocumentedOwnerAuth(tenantMode: string): Promise<DocumentedOwnerAuth> {
  if (tenantMode !== "member") return UNREAD;
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return UNREAD;

  try {
    const endpoint = new URL("/auth/v1/admin/users", url);
    endpoint.searchParams.set("filter", DEFAULT_OWNER_EMAIL);
    endpoint.searchParams.set("page", "1");
    endpoint.searchParams.set("per_page", "20");
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) return UNREAD;
    const body = await response.json() as { users?: Array<{ id?: string | null; email?: string | null }> };
    if (!body || !Array.isArray(body.users)) return UNREAD;
    const match = matchDocumentedOwner(body.users);
    if (!match.found || !match.userId) return { authUser: "absent", membership: "none" };

    const admin = openServiceDatabase();
    if (!admin) return { authUser: "present", membership: "unread" };
    const org = await admin.from("organizations").select("id").eq("slug", AGENCY_SLUG).maybeSingle();
    if (org.error || !org.data?.id) return { authUser: "present", membership: "unread" };
    const membership = await admin
      .from("memberships")
      .select("role")
      .eq("user_id", match.userId)
      .eq("org_id", org.data.id)
      .maybeSingle();
    if (membership.error) return { authUser: "present", membership: "unread" };
    if (!membership.data) return { authUser: "present", membership: "none" };
    if (membership.data.role === "agency_owner") return { authUser: "present", membership: "agency_owner" };
    return { authUser: "present", membership: "other" };
  } catch {
    return UNREAD;
  }
}

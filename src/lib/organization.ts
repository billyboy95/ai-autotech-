import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ACTIVE_ORGANIZATION_COOKIE = "active_organization_id";

export type OrganizationMembership = {
  organization_id: string;
  role: string;
};

export async function getOrganizationContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      activeOrganizationId: null,
      memberships: [] as OrganizationMembership[],
    };
  }

  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const memberships = (data ?? []) as OrganizationMembership[];
  const store = await cookies();
  const requestedOrganizationId = store.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null;
  const activeOrganizationId = memberships.some((membership) => membership.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : memberships[0]?.organization_id ?? null;

  return {
    user,
    activeOrganizationId,
    memberships,
  };
}

export async function getCurrentOrganizationId() {
  const context = await getOrganizationContext();
  return context.activeOrganizationId;
}

export async function getCurrentUserId() {
  const context = await getOrganizationContext();
  return context.user?.id ?? null;
}

export function applyOrganizationFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  organizationId: string | null,
) {
  return organizationId ? query.eq("organization_id", organizationId) : query;
}

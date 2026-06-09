import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentOrganizationId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return membership?.organization_id ?? null;
}

export function applyOrganizationFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  organizationId: string | null,
) {
  return organizationId ? query.eq("organization_id", organizationId) : query;
}

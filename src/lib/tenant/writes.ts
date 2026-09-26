import type { SupabaseClient } from "@supabase/supabase-js";
import { missingOrgColumn } from "@/lib/tenant/rows";
import { AGENCY_SLUG } from "@/lib/tenant/types";

export async function lookupAgencyOrgId(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("organizations").select("id, slug").eq("slug", AGENCY_SLUG).maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}

export async function insertPreferringOrg(
  supabase: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  orgId: string | null,
) {
  if (!orgId) {
    return supabase.from(table).insert(row).select("id").single();
  }
  const withOrg = await supabase.from(table).insert({ ...row, org_id: orgId }).select("id").single();
  if (!withOrg.error || !missingOrgColumn(withOrg.error)) return withOrg;
  return supabase.from(table).insert(row).select("id").single();
}

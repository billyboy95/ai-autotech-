import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Unscoped service client for the single agency book.
 * Use this only when organisation tables or org_id are not migrated yet.
 * Workers that know an organisation id should use withOrg instead.
 */
export function openServiceDatabase(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

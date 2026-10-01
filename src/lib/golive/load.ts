import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Read-only. A missing table or a hidden row stays not applied. This does not click Apply. */
export async function loadPackApplied(tenantMode: string): Promise<{ education: boolean; zentrix: boolean }> {
  if (tenantMode !== "member") return { education: false, zentrix: false };
  try {
    const supabase = await createSupabaseServerClient();
    const [education, zentrix] = await Promise.all([
      supabase.from("org_activity").select("id").eq("action", "snapshot.education_applied").limit(1),
      supabase.from("org_activity").select("id").eq("action", "zentrix.pack_applied").limit(1),
    ]);
    return {
      education: !education.error && (education.data?.length ?? 0) > 0,
      zentrix: !zentrix.error && (zentrix.data?.length ?? 0) > 0,
    };
  } catch {
    return { education: false, zentrix: false };
  }
}

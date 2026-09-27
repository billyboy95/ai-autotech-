import { createSupabaseServerClient } from "@/lib/supabase/server";
import { presentBrand, type PublicBrand } from "@/lib/brand/present";
import { TEST_BRAND_HOSTS } from "@/lib/brand/host";
import { previewWorkspaces } from "@/lib/tenant/blueprints";
import { currentBrandHost } from "@/lib/tenant/context";
import type { WorkspaceBranding } from "@/lib/tenant/types";

export async function resolveRequestBrand(): Promise<PublicBrand | null> {
  const host = await currentBrandHost();
  if (!host) return null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc("resolve_custom_domain", { p_host: host });
      if (!error && data && typeof data === "object") {
        const row = data as Record<string, unknown>;
        if (row.slug) {
          const branding = row.branding && typeof row.branding === "object" ? (row.branding as Partial<WorkspaceBranding>) : {};
          return presentBrand({
            slug: String(row.slug),
            name: String(row.name || row.slug),
            orgType: row.org_type === "agency" ? "agency" : "client",
            senderName: String(row.sender_name || ""),
            logoUrl: String(row.logo_url || ""),
            primaryColor: String(row.primary_color || ""),
            accentColor: String(row.accent_color || ""),
            customDomain: String(row.custom_domain || host),
            branding,
          });
        }
      }
    } catch {
      // Step 14 is not applied yet. Reserved .test hosts still brand the login page.
    }
  }

  const slug = TEST_BRAND_HOSTS[host];
  const org = slug ? previewWorkspaces().find((item) => item.slug === slug) : undefined;
  return org ? presentBrand(org) : null;
}

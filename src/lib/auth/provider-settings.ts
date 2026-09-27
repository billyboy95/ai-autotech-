import { supabaseAuthConfigured } from "@/lib/auth/gate";
import { parseAuthProviders, providerEnabled, type AuthProviderId } from "@/lib/auth/providers";

/**
 * Buttons to render. A provider is included only when it is listed in
 * NEXT_PUBLIC_AUTH_PROVIDERS and GoTrue reports it enabled. Any failure hides
 * the social buttons; email sign-in still works.
 */
export async function enabledAuthProviders(fetcher: typeof fetch = fetch): Promise<AuthProviderId[]> {
  const listed = parseAuthProviders();
  if (!listed.length || !supabaseAuthConfigured()) return [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  try {
    const response = await fetcher(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const settings = await response.json();
    return listed.filter((id) => providerEnabled(settings, id));
  } catch {
    return [];
  }
}

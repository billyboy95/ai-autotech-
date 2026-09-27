import { supabaseAuthConfigured } from "@/lib/auth/gate";

export function googleProviderEnabled(settings: unknown) {
  if (!settings || typeof settings !== "object") return false;
  const external = (settings as { external?: { google?: unknown } }).external;
  return external?.google === true;
}

/** True only when this Supabase project has the Google provider turned on. */
export async function googleSignInAvailable(fetcher: typeof fetch = fetch) {
  if (!supabaseAuthConfigured()) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  try {
    const response = await fetcher(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    return googleProviderEnabled(await response.json());
  } catch {
    return false;
  }
}

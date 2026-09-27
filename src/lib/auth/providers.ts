import type { Provider } from "@supabase/supabase-js";

/** Display order. Google is first. Ids match Supabase Auth provider names. */
export const AUTH_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "github", label: "GitHub" },
  { id: "apple", label: "Apple" },
  { id: "azure", label: "Microsoft" },
  { id: "linkedin_oidc", label: "LinkedIn" },
  { id: "x", label: "X" },
  { id: "discord", label: "Discord" },
] as const satisfies readonly { id: Provider; label: string }[];

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]["id"];

const BY_ID = new Map(AUTH_PROVIDERS.map((provider) => [provider.id, provider]));

/** Legacy Twitter OAuth 1.0a is not offered. `twitter` means the OAuth 2.0 provider `x`. */
const ALIASES: Record<string, AuthProviderId> = {
  twitter: "x",
};

export function isAuthProviderId(value: string): value is AuthProviderId {
  return BY_ID.has(value as AuthProviderId);
}

export function authProviderLabel(id: AuthProviderId) {
  return BY_ID.get(id)?.label ?? id;
}

/**
 * Providers named in NEXT_PUBLIC_AUTH_PROVIDERS, in display order.
 * Unknown names are ignored. Google stays first when it is listed.
 */
export function parseAuthProviders(raw: string | null | undefined = process.env.NEXT_PUBLIC_AUTH_PROVIDERS) {
  const wanted = new Set<AuthProviderId>();
  for (const item of String(raw ?? "").split(",")) {
    const token = item.trim().toLowerCase();
    if (!token) continue;
    const id = ALIASES[token] ?? token;
    if (isAuthProviderId(id)) wanted.add(id);
  }
  return AUTH_PROVIDERS.filter((provider) => wanted.has(provider.id)).map((provider) => provider.id);
}

export function providerEnabled(settings: unknown, id: AuthProviderId) {
  if (!settings || typeof settings !== "object") return false;
  const external = (settings as { external?: Record<string, unknown> }).external;
  return external?.[id] === true;
}

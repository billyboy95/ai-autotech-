"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAuthConfigured } from "@/lib/auth/gate";
import { enabledAuthProviders } from "@/lib/auth/provider-settings";
import { authProviderLabel, isAuthProviderId } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/auth/redirect";
import { BRAND_HOST_COOKIE } from "@/lib/brand/host";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOwnerMembership } from "@/server/workers/owner-bootstrap";

export type AuthActionState = {
  ok: boolean;
  message: string;
};

const initialFailure = "Sign-in is not configured on this deployment yet.";

async function redirectOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function callbackUrl(origin: string, next: string) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

async function afterPasswordSession(email: string | undefined, userId: string, nextRaw: string) {
  await ensureOwnerMembership({ id: userId, email });
  const next = safeNextPath(nextRaw, "");
  if (next) redirect(next);

  const brandHost = (await cookies()).get(BRAND_HOST_COOKIE)?.value;
  if (brandHost) redirect("/command-centre");

  const supabase = await createSupabaseServerClient();
  const memberships = await supabase.from("memberships").select("role");
  const agency = (memberships.data ?? []).some(
    (row) => row.role === "agency_owner" || row.role === "agency_staff",
  );
  redirect(agency ? "/agency" : "/command-centre");
}

export async function signIn(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Email and password are required." };
  }
  if (!supabaseAuthConfigured()) return { ok: false, message: initialFailure };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { ok: false, message: error?.message || "Could not sign in." };
  }

  await afterPasswordSession(data.user.email, data.user.id, String(formData.get("next") ?? ""));
  return { ok: true, message: "" };
}

export async function signInWithProvider(formData: FormData) {
  const requested = String(formData.get("provider") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? "") || "/command-centre");
  const back = `/login?next=${encodeURIComponent(next)}`;
  const enabled = await enabledAuthProviders();
  if (!isAuthProviderId(requested) || !enabled.includes(requested)) {
    redirect(`${back}&error=${encodeURIComponent("That sign-in provider is not configured.")}`);
  }
  const label = authProviderLabel(requested);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: requested,
    options: {
      redirectTo: callbackUrl(await redirectOrigin(), next),
      skipBrowserRedirect: true,
      ...(requested === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data.url) {
    redirect(`${back}&error=${encodeURIComponent(error?.message || `${label} sign-in could not start.`)}`);
  }
  redirect(data.url);
}

export async function sendMagicLink(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Email is required." };
  if (!supabaseAuthConfigured()) return { ok: false, message: initialFailure };

  const supabase = await createSupabaseServerClient();
  const next = safeNextPath(String(formData.get("next") ?? "") || "/command-centre");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl(await redirectOrigin(), next),
      shouldCreateUser: false,
    },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Check your email for a sign-in link. It brings you back to the page you asked for." };
}

export async function sendPasswordReset(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Email is required." };
  if (!supabaseAuthConfigured()) return { ok: false, message: initialFailure };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl(await redirectOrigin(), "/login/reset"),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "If that email can sign in, a reset link is on its way." };
}

export async function updatePassword(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "Those passwords do not match." };
  if (!supabaseAuthConfigured()) return { ok: false, message: initialFailure };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false, message: "Open the reset link from your email, then choose a new password." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };
  await ensureOwnerMembership({ id: data.user.id, email: data.user.email });
  redirect("/command-centre");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

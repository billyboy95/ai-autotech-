import { redirect } from "next/navigation";
import { authGateEnabled, supabaseAuthConfigured } from "@/lib/auth/gate";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOwnerMembership } from "@/server/workers/owner-bootstrap";

export async function requireCrmSession(fallback: string) {
  if (!authGateEnabled()) return null;
  if (!supabaseAuthConfigured()) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(fallback))}`);
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(fallback))}`);
  }
  await ensureOwnerMembership({ id: user.id, email: user.email });
  return user;
}

export async function requireCrmApiUser() {
  if (!authGateEnabled()) return { ok: true as const, userId: null as string | null };
  if (!supabaseAuthConfigured()) {
    return { ok: false as const, status: 401 as const, error: "Sign in required." };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, status: 401 as const, error: "Sign in required." };
  await ensureOwnerMembership({ id: data.user.id, email: data.user.email });
  return { ok: true as const, userId: data.user.id, supabase };
}

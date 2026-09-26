"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  ok: boolean;
  message: string;
};

export async function signIn(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: error.message };
  }

  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }

  const memberships = await supabase.from("memberships").select("role");
  const agency = (memberships.data ?? []).some(
    (row) => row.role === "agency_owner" || row.role === "agency_staff",
  );
  redirect(agency ? "/agency" : "/command-centre");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

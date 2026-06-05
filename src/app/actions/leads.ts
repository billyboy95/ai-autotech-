"use server";

import { leadSchema } from "@/lib/validators";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LeadActionState = {
  ok: boolean;
  message: string;
};

export async function createLead(
  _state: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("leads").insert({
    ...parsed.data,
    lead_status: "New Lead",
    source_page: parsed.data.source_page || "website",
  });

  if (error) {
    return {
      ok: false,
      message:
        "Lead capture is configured, but Supabase returned an error. Check your project URL, anon key, and leads table.",
    };
  }

  return {
    ok: true,
    message: "Thanks. Your discovery call request has been captured.",
  };
}

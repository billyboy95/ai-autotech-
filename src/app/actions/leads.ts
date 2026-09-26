"use server";

import { marketingConsentText, serviceConsentText } from "@/lib/compliance/consent-copy";
import { leadSchema } from "@/lib/validators";
import { recordConsent } from "@/server/webhooks/compliance";
import { agencyOrgId } from "@/server/workers/with-org";
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
  const { consent_service: consentService, consent_marketing: consentMarketing, ...lead } = parsed.data;
  const { error } = await supabase.from("leads").insert({
    ...lead,
    lead_status: "New Lead",
    source_page: lead.source_page || "website",
  });

  if (error) {
    return {
      ok: false,
      message:
        "Lead capture is configured, but Supabase returned an error. Check your project URL, anon key, and leads table.",
    };
  }

  const sender = "AI AutoTech Pty Ltd";
  try {
    const orgId = await agencyOrgId();
    if (orgId && checked(consentService)) {
      await recordConsent({
        orgId,
        channel: "email",
        purpose: "service",
        status: "opted_in",
        basis: "consent",
        address: lead.email,
        source: lead.source_page || "website",
        evidence: { consent_text: serviceConsentText(sender) },
      });
    }
    if (orgId && checked(consentMarketing)) {
      await recordConsent({
        orgId,
        channel: "email",
        purpose: "marketing",
        status: "opted_in",
        basis: "consent",
        address: lead.email,
        source: lead.source_page || "website",
        evidence: { consent_text: marketingConsentText(sender) },
      });
    }
  } catch {
    // The lead is already stored. Consent recording waits until the phase 2b tables exist.
  }

  return {
    ok: true,
    message: "Thanks. Your discovery call request has been captured.",
  };
}

function checked(value: string | undefined) {
  return value === "on" || value === "true";
}

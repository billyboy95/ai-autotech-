"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  FIXTURE_OPS_COPY,
  SECRET_REFUSAL_COPY,
  buildOpsSecrets,
  formCarriesSecret,
  missingOpsSecrets,
  noteAccepted,
  planOpsSecretsNote,
  type OpsSecretsMode,
} from "@/lib/ops/secrets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type OpsNoteState = {
  stored: boolean;
  write: boolean;
  mode: OpsSecretsMode;
  message: string;
};

function canManage(role: string | null) {
  return isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

export async function recordOpsSecretsNote(
  _state: OpsNoteState,
  formData: FormData,
): Promise<OpsNoteState> {
  if (formCarriesSecret(formData)) {
    return { stored: false, write: false, mode: "fixture", message: SECRET_REFUSAL_COPY };
  }

  const { tenant } = await loadCommandData();
  const plan = planOpsSecretsNote({ tenantMode: tenant.mode });
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;

  if (!plan.write || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      stored: false,
      write: false,
      mode: plan.mode,
      message: plan.write ? "Nothing was written. A cron was not registered." : plan.message || FIXTURE_OPS_COPY,
    };
  }

  const model = buildOpsSecrets({ tenantMode: tenant.mode });
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("record_ops_secrets_note", {
    p_org: tenant.active.id,
    p_cron: model.cron,
    p_email_provider: model.email,
    p_whatsapp: model.whatsapp,
    p_sms: model.sms,
    p_payfast: model.payfast,
  });
  if (saved.error) {
    const message = missingOpsSecrets(saved.error.message)
      ? "Apply step 35 before a sandbox note is stored. Nothing was written. A cron was not registered."
      : "The note was not stored. Nothing was written. A cron was not registered.";
    return { stored: false, write: false, mode: "sandbox", message };
  }

  const payload = saved.data as {
    stored?: boolean;
    sandbox?: boolean;
    charged?: boolean;
    status?: string;
    cron_presence?: string;
    email_provider?: string;
    whatsapp_meta?: string;
    sms_provider?: string;
    payfast_sandbox?: string;
    cron_jobs?: unknown;
    registered?: boolean;
    scheduled?: boolean;
    applied?: boolean;
    sending_enabled?: boolean;
    secret?: unknown;
    value?: unknown;
    token?: unknown;
    api_key?: unknown;
    merchant_key?: unknown;
  } | null;
  if (!noteAccepted(payload)) {
    return {
      stored: false,
      write: false,
      mode: "sandbox",
      message: "The note was refused. Nothing was written. A cron was not registered.",
    };
  }

  revalidatePath("/command-centre");
  revalidatePath("/command-centre/ops-secrets");
  revalidatePath("/command-centre/setup");
  revalidatePath("/agency");
  return {
    stored: true,
    write: true,
    mode: "sandbox",
    message: "Sandbox note stored. Secret values were not stored. A cron was not registered. Nothing is sent.",
  };
}

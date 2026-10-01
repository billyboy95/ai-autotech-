"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import { isSendEnabled } from "@/lib/automation/channels";
import {
  FIXTURE_GOLIVE_COPY,
  SECRET_REFUSAL_COPY,
  buildGoliveChecklist,
  formCarriesSecret,
  missingGoliveChecklist,
  noteAccepted,
  planGoliveNote,
  type GoliveMode,
} from "@/lib/golive/checklist";
import { loadPackApplied } from "@/lib/golive/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type GoliveNoteState = {
  stored: boolean;
  write: boolean;
  mode: GoliveMode;
  message: string;
};

function canManage(role: string | null) {
  return isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

export async function recordGoliveChecklistNote(
  _state: GoliveNoteState,
  formData: FormData,
): Promise<GoliveNoteState> {
  if (formCarriesSecret(formData)) {
    return { stored: false, write: false, mode: "fixture", message: SECRET_REFUSAL_COPY };
  }

  const { tenant, sendingEnabled } = await loadCommandData();
  const plan = planGoliveNote({ tenantMode: tenant.mode });
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;

  if (!plan.write || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      stored: false,
      write: false,
      mode: plan.mode,
      message: plan.write ? "Nothing was written. SQL was not applied. A pack was not applied." : plan.message || FIXTURE_GOLIVE_COPY,
    };
  }

  const packs = await loadPackApplied(tenant.mode);
  const model = buildGoliveChecklist({
    tenantMode: tenant.mode,
    workspaceSendingEnabled: tenant.active.sendingEnabled || sendingEnabled,
    automationSendEnabled: isSendEnabled(),
    educationApplied: packs.education,
    zentrixApplied: packs.zentrix,
  });
  if (model.snapshot.sending !== "blocked") {
    return { stored: false, write: false, mode: "sandbox", message: SECRET_REFUSAL_COPY };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("record_golive_checklist_note", {
    p_org: tenant.active.id,
    p_migrations: model.snapshot.migrations,
    p_setup_wizard: model.snapshot.setup_wizard,
    p_owner_bootstrap: model.snapshot.owner_bootstrap,
    p_ops_secrets: model.snapshot.ops_secrets,
    p_education_pack: model.snapshot.education_pack,
    p_zentrix_pack: model.snapshot.zentrix_pack,
    p_pwa_install: model.snapshot.pwa_install,
    p_sending: model.snapshot.sending,
  });
  if (saved.error) {
    const message = missingGoliveChecklist(saved.error.message)
      ? "Apply step 36 before a sandbox note is stored. Nothing was written. SQL was not applied."
      : "The note was not stored. Nothing was written. SQL was not applied.";
    return { stored: false, write: false, mode: "sandbox", message };
  }

  const payload = saved.data as Parameters<typeof noteAccepted>[0];
  if (!noteAccepted(payload)) {
    return {
      stored: false,
      write: false,
      mode: "sandbox",
      message: "The note was refused. Nothing was written. SQL was not applied. A pack was not applied.",
    };
  }

  revalidatePath("/command-centre");
  revalidatePath("/command-centre/go-live");
  revalidatePath("/command-centre/setup");
  revalidatePath("/agency");
  return {
    stored: true,
    write: true,
    mode: "sandbox",
    message: "Sandbox note stored. Status enums only. Secret values were not stored. SQL was not applied. A pack was not applied. Nothing is sent.",
  };
}

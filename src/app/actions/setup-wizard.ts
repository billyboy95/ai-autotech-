"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import { isBillingSandboxEnabled } from "@/lib/billing/flag";
import { loadConnectAccounts } from "@/lib/connect/load";
import { cronSecretPresent, loadAgencyOwnerClaim, ownerEmailsSet, payfastMerchantState } from "@/lib/ops/readiness";
import {
  buildSetupWizard,
  channelsFromConnect,
  checklistEventAccepted,
  FIXTURE_WIZARD_COPY,
  formCarriesSecret,
  missingSetupWizardMigration,
  planSetupChecklistEvent,
  SECRET_REFUSAL_COPY,
  type SetupWizardMode,
} from "@/lib/setup/wizard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type SetupChecklistState = {
  stored: boolean;
  write: boolean;
  mode: SetupWizardMode;
  message: string;
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

export async function recordSetupChecklistEvent(
  _state: SetupChecklistState,
  formData: FormData,
): Promise<SetupChecklistState> {
  const { tenant } = await loadCommandData();
  if (formCarriesSecret(formData)) {
    return { stored: false, write: false, mode: "fixture", message: SECRET_REFUSAL_COPY };
  }

  const connect = await loadConnectAccounts({ mode: tenant.mode, orgId: tenant.active.id });
  const model = buildSetupWizard({
    tenantMode: tenant.mode,
    ownerEmailsSet: ownerEmailsSet(),
    ownerClaim: await loadAgencyOwnerClaim(tenant.mode),
    cronConfigured: cronSecretPresent(),
    billingSandbox: isBillingSandboxEnabled(),
    payfastMerchant: payfastMerchantState(),
    channels: channelsFromConnect(connect),
  });
  const requested = String(formData.get("step_key") ?? "");
  const item = model.items.find((row) => row.stepKey === requested) ?? model.items[0];
  const plan = planSetupChecklistEvent({
    tenantMode: tenant.mode,
    stepKey: item?.stepKey ?? "",
    status: item?.status ?? "",
    secretFieldPresent: false,
  });
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;

  if (!plan.write || !plan.stepKey || !plan.status || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      stored: false,
      write: false,
      mode: "fixture",
      message: plan.write ? "Nothing was written." : plan.message || FIXTURE_WIZARD_COPY,
    };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("record_setup_checklist_event", {
    p_org: tenant.active.id,
    p_step_key: plan.stepKey,
    p_status: plan.status,
  });
  if (saved.error) {
    const message = missingSetupWizardMigration(saved.error.message)
      ? "Apply step 32 before a checklist event is stored. Nothing was written."
      : "The checklist event was not stored. Nothing was written.";
    return { stored: false, write: false, mode: "sandbox", message };
  }

  const payload = saved.data as {
    stored?: boolean;
    sandbox?: boolean;
    charged?: boolean;
    step_key?: string;
    status?: string;
    sending_enabled?: boolean;
    secret?: unknown;
    value?: unknown;
  } | null;
  if (!checklistEventAccepted(payload)) {
    return { stored: false, write: false, mode: "sandbox", message: "The checklist event was refused. Nothing was written." };
  }

  revalidatePath("/command-centre/setup");
  return {
    stored: true,
    write: true,
    mode: "sandbox",
    message: "Sandbox checklist event stored. No secret was stored. Nothing is sent.",
  };
}

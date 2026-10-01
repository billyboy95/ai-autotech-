"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  installEventAccepted,
  missingInstallEventMigration,
  planInstallIntent,
  type PwaInstallMode,
} from "@/lib/pwa/install";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type InstallIntentState = {
  stored: boolean;
  mode: PwaInstallMode;
  message: string;
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

export async function recordInstallIntent(_state: InstallIntentState, formData: FormData): Promise<InstallIntentState> {
  const { tenant } = await loadCommandData();
  const plan = planInstallIntent({
    tenantMode: tenant.mode,
    platform: String(formData.get("platform") ?? ""),
  });
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;

  if (!plan.write || !plan.platform || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      stored: false,
      mode: "fixture",
      message: plan.write ? "Nothing was written." : plan.message,
    };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("record_install_intent", {
    p_org: tenant.active.id,
    p_platform: plan.platform,
  });
  if (saved.error) {
    const message = missingInstallEventMigration(saved.error.message)
      ? "Apply step 31 before an install intent is stored. Nothing was written."
      : "The install intent was not stored. Nothing was written.";
    return { stored: false, mode: "sandbox", message };
  }

  const payload = saved.data as {
    stored?: boolean;
    sandbox?: boolean;
    charged?: boolean;
    intent?: string;
    surface?: string;
    sending_enabled?: boolean;
  } | null;
  if (!installEventAccepted(payload)) {
    return { stored: false, mode: "sandbox", message: "The install intent was refused. Nothing was written." };
  }

  revalidatePath("/command-centre/install");
  return { stored: true, mode: "sandbox", message: "Sandbox install intent stored. Nothing is sent. No store was contacted." };
}

"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  CONNECTION_REQUIRED_COPY,
  dryRunAccepted,
  FIXTURE_RUNNER_COPY,
  formCarriesSecret,
  loadMigrationCatalog,
  missingMigrationRunner,
  planMigrationDryRun,
  SECRET_REFUSAL_COPY,
  type MigrationRunnerMode,
} from "@/lib/migrations/runner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type MigrationDryRunState = {
  stored: boolean;
  write: boolean;
  mode: MigrationRunnerMode;
  message: string;
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

export async function recordMigrationDryRun(
  _state: MigrationDryRunState,
  formData: FormData,
): Promise<MigrationDryRunState> {
  if (formCarriesSecret(formData)) {
    return { stored: false, write: false, mode: "fixture", message: SECRET_REFUSAL_COPY };
  }

  const { tenant } = await loadCommandData();
  const plan = planMigrationDryRun({ tenantMode: tenant.mode });
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;

  if (!plan.write || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      stored: false,
      write: false,
      mode: plan.mode,
      message: plan.write ? "Nothing was written. SQL was not applied." : plan.message || FIXTURE_RUNNER_COPY,
    };
  }

  const steps = loadMigrationCatalog().map((step) => ({
    step: step.step,
    filename: step.file,
    checksum: step.checksum,
  }));
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("record_migration_dry_run", {
    p_org: tenant.active.id,
    p_steps: steps,
  });
  if (saved.error) {
    const message = missingMigrationRunner(saved.error.message)
      ? "Apply step 33 before a dry-run is stored. Nothing was written. SQL was not applied."
      : saved.error.message.includes("SUPABASE_DB_URL")
        ? CONNECTION_REQUIRED_COPY
        : "The dry-run was not stored. Nothing was written. SQL was not applied.";
    return { stored: false, write: false, mode: "sandbox", message };
  }

  const payload = saved.data as {
    stored?: boolean;
    sandbox?: boolean;
    charged?: boolean;
    status?: string;
    count?: number;
    applied?: boolean;
    sending_enabled?: boolean;
    secret?: unknown;
    value?: unknown;
    sql?: unknown;
  } | null;
  if (!dryRunAccepted(payload)) {
    return { stored: false, write: false, mode: "sandbox", message: "The dry-run was refused. Nothing was written. SQL was not applied." };
  }

  revalidatePath("/command-centre");
  revalidatePath("/command-centre/migrations");
  revalidatePath("/agency");
  return {
    stored: true,
    write: true,
    mode: "sandbox",
    message: "Sandbox dry-run stored. Status stays pending. No secret was stored. SQL was not applied. Nothing is sent.",
  };
}

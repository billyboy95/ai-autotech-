"use server";

import { revalidatePath } from "next/cache";
import { educationPackConfirmationOk } from "@/lib/snapshots/eastc-pack";
import type { PushReportRow } from "@/app/actions/provision";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/tenant/context";

export type ApplyEducationState = {
  ok: boolean;
  message: string;
  report: PushReportRow[];
};

const empty: PushReportRow[] = [];

export async function applyEducationPackToEastc(
  _state: ApplyEducationState,
  formData: FormData,
): Promise<ApplyEducationState> {
  const workspace = await resolveWorkspace();
  if (workspace.mode === "preview") {
    return {
      ok: false,
      report: empty,
      message:
        "Apply supabase/migrations/20261027120000_phase4d_eastc_education.sql, then sign in as an agency owner or staff member. Sending stays off.",
    };
  }
  if (!workspace.canManageAgency) {
    return {
      ok: false,
      report: empty,
      message: "Sign in as an agency owner or staff member to apply the Education pack to EASTC.",
    };
  }
  if (!educationPackConfirmationOk(formData.get("confirm"))) {
    return {
      ok: false,
      report: empty,
      message: "Confirm that this applies the Education pack to EASTC only.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("apply_education_pack_to_eastc");
  if (error) return { ok: false, report: empty, message: error.message };

  const applied = data as {
    slug?: string;
    sending_enabled?: boolean;
    report?: PushReportRow[];
  } | null;
  if (applied?.slug !== "eastc") {
    return { ok: false, report: empty, message: "EASTC was not updated." };
  }
  if (applied.sending_enabled !== false) {
    return { ok: false, report: empty, message: "Sending was turned on. That is not allowed." };
  }

  const report = Array.isArray(applied.report) ? applied.report : empty;
  const created = report.filter((row) => row.result === "created").length;
  const unchanged = report.filter((row) => row.result === "unchanged").length;
  revalidatePath("/agency");
  revalidatePath("/agency/eastc/settings");
  revalidatePath("/agency/snapshots");
  return {
    ok: true,
    report,
    message: `Education pack applied to EASTC. ${created} new, ${unchanged} unchanged. Nothing was sent, and sending stays off.`,
  };
}

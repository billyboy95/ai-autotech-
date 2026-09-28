"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  csvImportPayload,
  planCampaignCsvImport,
  type CsvImportPlan,
} from "@/lib/campaigns/csv-import";
import { isLiveSendIntent, type CampaignDryRunReport } from "@/lib/campaigns/dry-run";
import { campaignCsvImportDisplayMode, missingCampaignCsvImportMigration } from "@/lib/campaigns/flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type CsvImportActionState = CsvImportPlan & {
  id: string;
  stored: boolean;
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

async function csvText(formData: FormData) {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) return file.text();
  return String(formData.get("csv") ?? "");
}

type SavedImport = {
  sandbox?: boolean;
  charged?: boolean;
  queued?: number;
  sent?: number;
  sending_enabled?: boolean;
  status?: string;
  campaign_status?: string;
  imported?: number;
  skipped?: number;
  would_receive?: number;
  blocked?: number;
  report?: CampaignDryRunReport["lines"];
  consent_breakdown?: CampaignDryRunReport["breakdown"];
};

export async function submitCampaignCsvImport(_state: CsvImportActionState, formData: FormData): Promise<CsvImportActionState> {
  const intent = String(formData.get("intent") ?? "dry_load");
  const { tenant, sendingEnabled } = await loadCommandData();
  const mode = campaignCsvImportDisplayMode({ tenantMode: tenant.mode });
  const csv = await csvText(formData);
  const planned = planCampaignCsvImport({
    csv,
    campaignName: String(formData.get("campaignName") ?? ""),
    intent,
    sendingEnabled,
    source: mode,
  });
  const base: CsvImportActionState = {
    ...planned,
    id: crypto.randomUUID(),
    stored: false,
    queued: 0,
    sent: 0,
    charged: false,
  };

  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;
  if (planned.refused || isLiveSendIntent(intent)) {
    const message = sendingEnabled
      ? "This dry-load does not send. Nothing was queued."
      : "Sending stays off. Send now is refused. Nothing was queued.";
    if (mode === "sandbox" && tenant.mode === "member" && canManage(tenant.role) && sameWorkspace && isLiveSendIntent(intent)) {
      const supabase = await createSupabaseServerClient();
      const saved = await supabase.rpc("refuse_campaign_csv_send", {
        p_org: tenant.active.id,
        p_intent: intent.trim().toLowerCase().replace(/[_-]+/g, " ") === "go live" ? "go_live" : "send_now",
      });
      const payload = saved.data as { refused?: boolean; queued?: number; sent?: number; sending_enabled?: boolean } | null;
      if (!saved.error && (!payload || payload.refused !== true || Number(payload.queued ?? 0) !== 0 || Number(payload.sent ?? 0) !== 0 || payload.sending_enabled === true)) {
        return { ...base, refused: true, stored: false, report: null, message: "Send now is refused. Nothing was queued." };
      }
    }
    return { ...base, refused: true, stored: false, report: null, message };
  }

  if (planned.error || !planned.report) {
    return { ...base, stored: false, message: planned.message || planned.error };
  }

  if (mode !== "sandbox" || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      ...base,
      stored: false,
      message: `${planned.message} Fixture only. This dry-load is not stored.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("save_campaign_csv_import", {
    p_org: tenant.active.id,
    p_campaign_name: planned.campaignName,
    p_rows: csvImportPayload(planned.rows),
  });
  if (saved.error) {
    const message = missingCampaignCsvImportMigration(saved.error.message)
      ? "Apply step 27 before a CSV dry-load is stored. Nothing was queued."
      : `${saved.error.message} Nothing was queued.`;
    return { ...base, stored: false, message };
  }

  const payload = saved.data as SavedImport | null;
  if (
    !payload
    || payload.sandbox !== true
    || payload.charged === true
    || payload.status !== "sandbox"
    || payload.campaign_status !== "draft"
    || Number(payload.queued ?? 0) !== 0
    || Number(payload.sent ?? 0) !== 0
    || payload.sending_enabled === true
  ) {
    return { ...base, stored: false, message: "The dry-load was refused. Nothing was queued." };
  }

  const report = planned.report
    ? {
        ...planned.report,
        wouldReceive: Number(payload.would_receive ?? planned.report.wouldReceive),
        blocked: Number(payload.blocked ?? planned.report.blocked),
        breakdown: payload.consent_breakdown ?? planned.report.breakdown,
        lines: Array.isArray(payload.report) ? payload.report : planned.report.lines,
        charged: false as const,
        queued: 0 as const,
        sent: 0 as const,
      }
    : null;

  revalidatePath("/command-centre/campaigns");
  revalidatePath("/command-centre/outbox");
  return {
    ...base,
    stored: true,
    imported: Number(payload.imported ?? planned.imported),
    skippedMissingConsent: Number(payload.skipped ?? planned.skippedMissingConsent),
    report,
    message: `${planned.message} Stored as a draft campaign. Nothing was queued.`,
  };
}

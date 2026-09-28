"use server";

import { revalidatePath } from "next/cache";
import { loadDryRunPreview } from "@/lib/campaigns/load";
import {
  isLiveSendIntent,
  planCampaignAction,
  recipientPayload,
  type CampaignActionPlan,
  type CampaignDryRunReport,
} from "@/lib/campaigns/dry-run";
import { campaignDryRunDisplayMode, missingCampaignDryRunMigration } from "@/lib/campaigns/flag";
import { loadCommandData } from "@/lib/automation/page-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type DryRunActionState = CampaignActionPlan & {
  id: string;
  stored: boolean;
};

export const EMPTY_DRY_RUN: DryRunActionState = {
  id: "",
  stored: false,
  refused: false,
  queued: 0,
  sent: 0,
  message: "",
  report: null,
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

type SavedReport = {
  sandbox?: boolean;
  charged?: boolean;
  queued?: number;
  sent?: number;
  sending_enabled?: boolean;
  status?: string;
  recipient_count?: number;
  would_receive?: number;
  blocked?: number;
  estimated_cost_cents?: number;
  report?: CampaignDryRunReport["lines"];
  consent_breakdown?: CampaignDryRunReport["breakdown"];
};

function reportFromPayload(base: CampaignDryRunReport, payload: SavedReport): CampaignDryRunReport {
  const lines = Array.isArray(payload.report) ? payload.report : base.lines;
  return {
    ...base,
    recipientCount: Number(payload.recipient_count ?? base.recipientCount),
    wouldReceive: Number(payload.would_receive ?? base.wouldReceive),
    blocked: Number(payload.blocked ?? base.blocked),
    estimatedCostCents: Number(payload.estimated_cost_cents ?? base.estimatedCostCents),
    breakdown: payload.consent_breakdown ?? base.breakdown,
    lines,
    charged: false,
    queued: 0,
    sent: 0,
  };
}

export async function runCampaignDryRun(_state: DryRunActionState, formData: FormData): Promise<DryRunActionState> {
  const intent = String(formData.get("intent") ?? "dry_run");
  const { workspace, tenant, sendingEnabled } = await loadCommandData();
  const preview = await loadDryRunPreview({
    tenantMode: tenant.mode,
    orgId: tenant.active.id,
    prospects: workspace.state.prospects,
  });
  const planned = planCampaignAction({
    intent,
    sendingEnabled,
    campaignName: preview.campaignName,
    source: preview.mode,
    recipients: preview.recipients,
  });
  const base: DryRunActionState = {
    ...planned,
    id: crypto.randomUUID(),
    stored: false,
  };

  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;
  const mode = campaignDryRunDisplayMode({ tenantMode: tenant.mode });
  if (planned.refused) {
    const message = sendingEnabled
      ? planned.message
      : "Sending stays off. Send now is refused. Nothing was queued.";
    if (mode === "sandbox" && tenant.mode === "member" && canManage(tenant.role) && sameWorkspace && isLiveSendIntent(intent)) {
      const supabase = await createSupabaseServerClient();
      const saved = await supabase.rpc("refuse_campaign_send", {
        p_org: tenant.active.id,
        p_intent: intent.trim().toLowerCase().replace(/[_-]+/g, " ") === "go live" ? "go_live" : "send_now",
      });
      const payload = saved.data as { refused?: boolean; queued?: number; sent?: number; sending_enabled?: boolean } | null;
      if (!saved.error && (!payload || payload.refused !== true || Number(payload.queued ?? 0) !== 0 || Number(payload.sent ?? 0) !== 0)) {
        return { ...base, message: "Send now is refused. Nothing was queued." };
      }
    }
    return { ...base, message };
  }

  if (mode !== "sandbox" || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      ...base,
      message: `${planned.message} Fixture only. This report is not stored.`,
    };
  }

  if (!planned.report || planned.report.recipientCount < 1) {
    return {
      ...base,
      message: `${planned.message} No sandbox contacts yet. Nothing was stored.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("save_campaign_dry_run", {
    p_org: tenant.active.id,
    p_campaign_name: preview.campaignName,
    p_recipients: recipientPayload(preview.recipients),
  });
  if (saved.error) {
    const message = missingCampaignDryRunMigration(saved.error.message)
      ? "Apply step 26 before a dry-run report is stored. Nothing was queued."
      : `${saved.error.message} Nothing was queued.`;
    return { ...base, message };
  }

  const payload = saved.data as SavedReport | null;
  if (
    !payload
    || payload.sandbox !== true
    || payload.charged === true
    || payload.status !== "sandbox"
    || Number(payload.queued ?? 0) !== 0
    || Number(payload.sent ?? 0) !== 0
    || payload.sending_enabled === true
  ) {
    return { ...base, message: "The dry run was refused. Nothing was queued." };
  }

  revalidatePath("/command-centre/campaigns");
  revalidatePath("/command-centre/outbox");
  return {
    ...base,
    stored: true,
    report: planned.report ? reportFromPayload(planned.report, payload) : null,
    message: `${planned.message} Stored as a sandbox report.`,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  EAST_RAND_SANDBOX_CAMPAIGN_NAME,
  EAST_RAND_SANDBOX_LABEL,
  eastRandSeedDisplayMode,
  eastRandSeedPayload,
  missingEastRandSeedMigration,
  planEastRandSandboxSeed,
} from "@/lib/campaigns/east-rand-seed";
import { readEastRandSandboxCsv } from "@/lib/campaigns/east-rand-fixture";
import type { CsvImportPlan } from "@/lib/campaigns/csv-import";
import { isLiveSendIntent, type CampaignDryRunReport } from "@/lib/campaigns/dry-run";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AGENCY_SLUG, isAgencyRole } from "@/lib/tenant/types";

export type EastRandSeedState = CsvImportPlan & {
  id: string;
  stored: boolean;
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

type SavedSeed = {
  sandbox?: boolean;
  charged?: boolean;
  queued?: number;
  sent?: number;
  sending_enabled?: boolean;
  status?: string;
  campaign_status?: string;
  campaign_name?: string;
  imported?: number;
  skipped?: number;
  would_receive?: number;
  blocked?: number;
  report?: CampaignDryRunReport["lines"];
  consent_breakdown?: CampaignDryRunReport["breakdown"];
  label?: string;
  seed?: string;
  reused?: boolean;
  refused?: boolean;
};

export async function submitEastRandSandboxSeed(_state: EastRandSeedState, formData: FormData): Promise<EastRandSeedState> {
  const intent = String(formData.get("intent") ?? "seed");
  const { tenant, sendingEnabled } = await loadCommandData();
  const mode = eastRandSeedDisplayMode({ tenantMode: tenant.mode });
  const planned = planEastRandSandboxSeed({
    csv: readEastRandSandboxCsv(),
    intent,
    sendingEnabled,
    source: mode,
  });
  const base: EastRandSeedState = {
    ...planned,
    id: crypto.randomUUID(),
    stored: false,
    queued: 0,
    sent: 0,
    charged: false,
    campaignName: EAST_RAND_SANDBOX_CAMPAIGN_NAME,
  };

  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;
  const agencyWorkspace = tenant.active.slug === AGENCY_SLUG;

  if (planned.refused || isLiveSendIntent(intent)) {
    const message = sendingEnabled
      ? "This sandbox seed does not send. Outbox queued: 0."
      : "Sending stays off. Send now is refused. Outbox queued: 0.";
    if (mode === "sandbox" && tenant.mode === "member" && canManage(tenant.role) && sameWorkspace && agencyWorkspace && isLiveSendIntent(intent)) {
      const supabase = await createSupabaseServerClient();
      const saved = await supabase.rpc("refuse_east_rand_seed_send", {
        p_org: tenant.active.id,
        p_intent: intent.trim().toLowerCase().replace(/[_-]+/g, " ") === "go live" ? "go_live" : "send_now",
      });
      const payload = saved.data as { refused?: boolean; queued?: number; sent?: number; sending_enabled?: boolean } | null;
      if (
        !saved.error
        && (!payload
          || payload.refused !== true
          || Number(payload.queued ?? 0) !== 0
          || Number(payload.sent ?? 0) !== 0
          || payload.sending_enabled === true)
      ) {
        return { ...base, refused: true, stored: false, report: null, message: "Send now is refused. Outbox queued: 0." };
      }
    }
    return { ...base, refused: true, stored: false, report: null, message };
  }

  if (planned.error || !planned.report) {
    return { ...base, stored: false, message: planned.message || planned.error };
  }

  if (mode !== "sandbox" || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace || !agencyWorkspace) {
    return {
      ...base,
      stored: false,
      message: "Fixture only. This seed is not stored until EAST_RAND_CAMPAIGN_SEED_ENABLED is true and step 30 is applied. Outbox queued: 0.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("seed_east_rand_sandbox_campaign", {
    p_org: tenant.active.id,
    p_rows: eastRandSeedPayload(planned),
  });
  if (saved.error) {
    const message = missingEastRandSeedMigration(saved.error.message)
      ? "Apply step 30 before the East Rand sandbox seed is stored. Outbox queued: 0."
      : `${saved.error.message} Outbox queued: 0.`;
    return { ...base, stored: false, message };
  }

  const payload = saved.data as SavedSeed | null;
  if (
    !payload
    || payload.refused === true
    || payload.sandbox !== true
    || payload.charged === true
    || payload.status !== "sandbox"
    || payload.campaign_status !== "draft"
    || payload.campaign_name !== EAST_RAND_SANDBOX_CAMPAIGN_NAME
    || payload.label !== EAST_RAND_SANDBOX_LABEL
    || payload.seed !== "east_rand"
    || Number(payload.queued ?? 0) !== 0
    || Number(payload.sent ?? 0) !== 0
    || payload.sending_enabled === true
  ) {
    return { ...base, stored: false, refused: true, message: "The sandbox seed was refused. Outbox queued: 0." };
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
    message: payload.reused
      ? "Already stored as a sandbox draft. Outbox queued: 0."
      : "Stored as a sandbox draft. Outbox queued: 0.",
  };
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fixtureProspects } from "@/lib/outreach/fixture";
import { prospectFromRow, summariseFunnel, type FunnelSummary, type OutreachProspect } from "@/lib/outreach/funnel";

export type StaleMarketingRow = {
  id: string;
  toAddress: string;
  subject: string;
  createdAt: string;
  purpose: string;
  category: string;
};

export type StaleMarketingPreview = {
  ready: boolean;
  notice: string;
  count: number;
  rows: StaleMarketingRow[];
};

const OPENER_MIGRATION = "supabase/migrations/20261114120000_outreach_queue_opener.sql";

export type OutreachDesk = {
  mode: "fixture" | "live";
  notice: string;
  campaign: string;
  campaigns: string[];
  prospects: OutreachProspect[];
  summary: FunnelSummary;
};

const COLUMNS =
  "id, campaign, business, fsp_number, area, website, email, phone, contact_name, source_url, hook, priority, channel, stage, do_not_contact, dnc_reason, sent_at, replied_at, booked_call1_at, showed_at, call2_at, closed_at, lost_at, stage_changed_at, notes";

export function outreachLiveMode(tenant: { mode: string; requiresLogin: boolean; role: string | null }) {
  return tenant.mode !== "preview" && !tenant.requiresLogin && Boolean(tenant.role);
}

export async function loadOutreachDesk(input: {
  live: boolean;
  orgId: string;
  campaign?: string | null;
}): Promise<OutreachDesk> {
  if (!input.live || input.orgId.startsWith("preview-")) {
    const prospects = fixtureProspects();
    return {
      mode: "fixture",
      notice: "Sample data. Sign in to see your real outreach list.",
      campaign: "sample",
      campaigns: ["sample"],
      prospects,
      summary: summariseFunnel(prospects),
    };
  }
  const empty = (notice: string): OutreachDesk => ({
    mode: "live",
    notice,
    campaign: input.campaign || "",
    campaigns: [],
    prospects: [],
    summary: summariseFunnel([]),
  });
  try {
    const supabase = await createSupabaseServerClient();
    const campaigns = await supabase
      .from("crm_outreach_prospects")
      .select("campaign")
      .eq("org_id", input.orgId)
      .limit(2000);
    if (campaigns.error) {
      const missing = /crm_outreach_prospects|schema cache|does not exist/i.test(campaigns.error.message);
      return empty(
        missing
          ? "The outreach table is not in the database yet. Apply supabase/migrations/20261113120000_outreach_funnel.sql."
          : `Could not load outreach: ${campaigns.error.message}`,
      );
    }
    const names = [...new Set((campaigns.data ?? []).map((row) => String(row.campaign)))].sort();
    const campaign = input.campaign && names.includes(input.campaign) ? input.campaign : names[0] || "";
    if (!campaign) return { ...empty("No prospects yet. Import a list to start."), campaigns: names };
    const listed = await supabase
      .from("crm_outreach_prospects")
      .select(COLUMNS)
      .eq("org_id", input.orgId)
      .eq("campaign", campaign)
      .order("priority", { ascending: true })
      .order("business", { ascending: true })
      .limit(1000);
    if (listed.error) return { ...empty(`Could not load outreach: ${listed.error.message}`), campaigns: names };
    const prospects = (listed.data ?? []).map((row) => prospectFromRow(row as Record<string, unknown>));
    return {
      mode: "live",
      notice: "Queue opener writes a draft only. Nothing is sent from this page. Do-not-contact prospects can never be queued or moved to Sent.",
      campaign,
      campaigns: names,
      prospects,
      summary: summariseFunnel(prospects),
    };
  } catch (error) {
    return empty(`Could not load outreach: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/** Dry-run list of queued marketing outbox rows. Does not update them and does not send. */
export async function loadStaleMarketingOutbox(orgId: string): Promise<StaleMarketingPreview> {
  const missing = `Queue opener is not in the database yet. Apply ${OPENER_MIGRATION}.`;
  const blank = (notice: string): StaleMarketingPreview => ({ ready: false, notice, count: 0, rows: [] });
  try {
    const supabase = await createSupabaseServerClient();
    const listed = await supabase.rpc("preview_stale_marketing_outbox", { p_org: orgId });
    if (listed.error) {
      const unavailable = /preview_stale_marketing_outbox|schema cache|does not exist/i.test(listed.error.message);
      return blank(unavailable ? missing : `Could not load the outbox: ${listed.error.message}`);
    }
    const payload = listed.data as { count?: number; rows?: Record<string, unknown>[] } | null;
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    return {
      ready: true,
      notice: "",
      count: Number(payload?.count ?? rows.length) || 0,
      rows: rows.map((row) => ({
        id: String(row.id || ""),
        toAddress: String(row.to_address || ""),
        subject: String(row.subject || ""),
        createdAt: String(row.created_at || ""),
        purpose: String(row.purpose || ""),
        category: String(row.message_category || ""),
      })),
    };
  } catch (error) {
    return blank(`Could not load the outbox: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

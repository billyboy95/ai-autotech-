import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fixtureProspects } from "@/lib/outreach/fixture";
import { prospectFromRow, summariseFunnel, type FunnelSummary, type OutreachProspect } from "@/lib/outreach/funnel";

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
      notice: "Manual outreach log. Nothing is sent from this page. Do-not-contact prospects can never be moved to Sent.",
      campaign,
      campaigns: names,
      prospects,
      summary: summariseFunnel(prospects),
    };
  } catch (error) {
    return empty(`Could not load outreach: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

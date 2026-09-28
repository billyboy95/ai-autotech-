import { missingConnectMigration } from "@/lib/connect/accounts";
import {
  buildCampaignDryRun,
  dedupeRecipients,
  FIXTURE_CAMPAIGN_NAME,
  fixtureRecipients,
  recipientsFromImport,
  recipientsFromProspects,
  type DryRunRecipient,
} from "@/lib/campaigns/dry-run";
import { campaignDryRunDisplayMode, type CampaignDryRunMode } from "@/lib/campaigns/flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DryRunPreview = {
  mode: CampaignDryRunMode;
  notice: string | null;
  campaignName: string;
  recipients: DryRunRecipient[];
};

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function loadImportRecipients(orgId: string): Promise<{ recipients: DryRunRecipient[]; notice: string | null }> {
  if (!configured() || orgId.startsWith("preview-")) return { recipients: [], notice: null };
  const supabase = await createSupabaseServerClient();
  const loaded = await supabase
    .from("contact_import_drafts")
    .select("rows")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (loaded.error) {
    return {
      recipients: [],
      notice: missingConnectMigration(loaded.error.message)
        ? "Apply step 24 before imported contacts are included in a dry run. Nothing is sent."
        : loaded.error.message,
    };
  }
  const rows = loaded.data?.[0]?.rows;
  return { recipients: recipientsFromImport(rows), notice: null };
}

/** Flag off uses the fixture. Flag on reads imported drafts and draft prospects, and does not write. */
export async function loadDryRunPreview(input: {
  tenantMode: string;
  orgId: string;
  prospects: Array<{
    name: string;
    phone?: string;
    email?: string;
    consentBasis?: string;
    status?: string;
  }>;
}): Promise<DryRunPreview> {
  const mode = campaignDryRunDisplayMode({ tenantMode: input.tenantMode });
  if (mode === "fixture") {
    return {
      mode,
      notice: null,
      campaignName: FIXTURE_CAMPAIGN_NAME,
      recipients: fixtureRecipients(),
    };
  }

  const imported = await loadImportRecipients(input.orgId);
  const recipients = dedupeRecipients([
    ...recipientsFromProspects(input.prospects),
    ...imported.recipients,
  ]);
  return {
    mode,
    notice: imported.notice,
    campaignName: "Sandbox campaign",
    recipients,
  };
}

export function previewReport(preview: DryRunPreview) {
  return buildCampaignDryRun({
    campaignName: preview.campaignName,
    source: preview.mode,
    recipients: preview.recipients,
  });
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { eastcPeriodFixture, parsePeriodMetrics, periodMetrics, zentrixPeriodFixture, type PeriodMetrics } from "@/lib/agency/metrics";
import { previewWorkspaces } from "@/lib/tenant/blueprints";

export type RollupClient = {
  orgId: string;
  slug: string;
  name: string;
  customDomain: string;
  primaryColor: string;
  metrics: PeriodMetrics;
  sample: boolean;
};

export async function loadAgencyRollup(agencyId: string, from: string, to: string): Promise<RollupClient[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("agency_rollup", {
      agency_id: agencyId,
      from_ts: from,
      to_ts: to,
    });
    if (error || !Array.isArray(data)) return null;
    return data.flatMap((row) => {
      const record = row as Record<string, unknown>;
      const metrics = parsePeriodMetrics(record.metrics);
      if (!metrics || !record.slug) return [];
      return [{
        orgId: String(record.org_id),
        slug: String(record.slug),
        name: String(record.name || record.slug),
        customDomain: String(record.custom_domain || ""),
        primaryColor: String(record.primary_color || "#0B1F3A"),
        metrics,
        sample: false,
      }];
    });
  } catch {
    return null;
  }
}

export async function loadWorkspacePeriod(orgId: string, from: string, to: string): Promise<PeriodMetrics | null> {
  if (!orgId || orgId.startsWith("preview-")) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("workspace_period_metrics", {
      org_id: orgId,
      from_ts: from,
      to_ts: to,
    });
    if (error) return null;
    return parsePeriodMetrics(data);
  } catch {
    return null;
  }
}

export function sampleRollup(): RollupClient[] {
  const [, eastc, zentrix] = previewWorkspaces();
  return [
    {
      orgId: eastc.id,
      slug: eastc.slug,
      name: eastc.name,
      customDomain: eastc.customDomain,
      primaryColor: eastc.primaryColor,
      metrics: periodMetrics(eastcPeriodFixture),
      sample: true,
    },
    {
      orgId: zentrix.id,
      slug: zentrix.slug,
      name: zentrix.name,
      customDomain: zentrix.customDomain,
      primaryColor: zentrix.primaryColor,
      metrics: periodMetrics(zentrixPeriodFixture),
      sample: true,
    },
  ];
}

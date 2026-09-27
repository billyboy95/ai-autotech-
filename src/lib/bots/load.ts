import { BOT_CATEGORIES, botBySlug, type BotConfig } from "@/lib/bots/catalog";
import {
  previewAgencyBots,
  previewBotDetail,
  previewBotStore,
  type AgencyBotData,
  type BotDetailData,
  type BotStoreData,
} from "@/lib/bots/preview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole, type MembershipRole } from "@/lib/tenant/types";

function connected() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function canManageRole(role: MembershipRole | null) {
  return role === "client_admin" || isAgencyRole(role);
}

function missingBotTable(message: string) {
  return /does not exist|schema cache|could not find|bot_catalog|org_bots|bot_runs/i.test(message);
}

function asConfig(value: unknown, fallback: BotConfig): BotConfig {
  const row = value && typeof value === "object" ? value as Partial<BotConfig> : {};
  const hours = row.workingHours && typeof row.workingHours === "object" ? row.workingHours : fallback.workingHours;
  return {
    tone: typeof row.tone === "string" && row.tone ? row.tone : fallback.tone,
    workingHours: {
      timezone: typeof hours.timezone === "string" ? hours.timezone : fallback.workingHours.timezone,
      start: typeof hours.start === "string" ? hours.start : fallback.workingHours.start,
      end: typeof hours.end === "string" ? hours.end : fallback.workingHours.end,
      days: Array.isArray(hours.days) ? hours.days.map((day) => Number(day)) : fallback.workingHours.days,
    },
    pipeline: typeof row.pipeline === "string" && row.pipeline ? row.pipeline : fallback.pipeline,
    stage: typeof row.stage === "string" && row.stage ? row.stage : fallback.stage,
    channel: typeof row.channel === "string" && row.channel ? row.channel : fallback.channel,
  };
}

export async function loadBotStore(input: { org?: string | null; notice?: string | null }): Promise<BotStoreData> {
  const tenant = await safeResolveWorkspace(input.org);
  const preview = previewBotStore(tenant.active.slug, input.notice ?? null, tenant.canManageAgency);
  if (!connected() || tenant.mode !== "member" || !tenant.scoped || tenant.active.id.startsWith("preview-")) {
    return preview;
  }
  const supabase = await createSupabaseServerClient();
  const [catalog, bundles, items, templates, installed, savings] = await Promise.all([
    supabase.from("bot_catalog").select("slug, name, category, description, monthly_price_cents, price_placeholder, engine, active").eq("active", true),
    supabase.from("bot_bundles").select("slug, name, description, price_placeholder").eq("active", true),
    supabase.from("bot_bundle_items").select("bot_slug, bot_bundles(slug)"),
    supabase.from("bot_templates").select("slug, name, description"),
    supabase.from("org_bots").select("bot_slug, status").eq("org_id", tenant.active.id),
    supabase.from("bot_bundle_savings").select("slug, separate_total_cents, bundle_price_cents, saving_percent"),
  ]);
  const failed = [catalog.error, bundles.error, items.error, templates.error, installed.error, savings.error].find(Boolean);
  if (failed) {
    return {
      ...preview,
      preview: false,
      canManage: false,
      notice: missingBotTable(failed.message)
        ? "Bot Store tables are not in this database yet. Apply phase 4a before saving. Nothing was stored and nothing was sent."
        : failed.message,
    };
  }
  const installedStatus = new Map((installed.data ?? []).map((row) => [String(row.bot_slug), String(row.status)]));
  const bots = (catalog.data ?? []).map((row) => ({
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category),
    description: String(row.description ?? ""),
    monthlyPriceCents: Number(row.monthly_price_cents),
    pricePlaceholder: true as const,
    engine: String(row.engine),
    installedStatus: installedStatus.get(String(row.slug)) ?? null,
  }));
  const names = new Map(bots.map((bot) => [bot.slug, bot.name]));
  const byBundle = new Map<string, string[]>();
  for (const row of items.data ?? []) {
    const nested = row.bot_bundles as { slug?: string } | { slug?: string }[] | null;
    const slug = Array.isArray(nested) ? nested[0]?.slug : nested?.slug;
    if (!slug) continue;
    const list = byBundle.get(slug) ?? [];
    list.push(names.get(String(row.bot_slug)) || String(row.bot_slug));
    byBundle.set(slug, list);
  }
  const savingBySlug = new Map((savings.data ?? []).map((row) => [String(row.slug), row]));
  return {
    preview: false,
    notice: input.notice ?? null,
    canManage: canManageRole(tenant.role),
    canSeeAgency: tenant.canManageAgency,
    orgSlug: tenant.active.slug,
    categories: BOT_CATEGORIES.filter((category) => bots.some((bot) => bot.category === category)),
    bots,
    bundles: (bundles.data ?? []).map((row) => {
      const saving = savingBySlug.get(String(row.slug));
      const fallback = preview.bundles.find((bundle) => bundle.slug === String(row.slug));
      return {
        slug: String(row.slug),
        name: String(row.name),
        description: String(row.description ?? ""),
        botNames: byBundle.get(String(row.slug)) ?? [],
        separateTotalCents: Number(saving?.separate_total_cents ?? fallback?.separateTotalCents ?? 0),
        bundlePriceCents: Number(saving?.bundle_price_cents ?? fallback?.bundlePriceCents ?? 0),
        savingPercent: Number(saving?.saving_percent ?? fallback?.savingPercent ?? 0),
        pricePlaceholder: true as const,
      };
    }),
    templates: (templates.data ?? []).map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description ?? ""),
    })),
  };
}

export async function loadBotDetail(input: { org?: string | null; slug: string; notice?: string | null }): Promise<BotDetailData> {
  const tenant = await safeResolveWorkspace(input.org);
  const preview = previewBotDetail(tenant.active.slug, input.slug, input.notice ?? null);
  if (!connected() || tenant.mode !== "member" || !tenant.scoped || tenant.active.id.startsWith("preview-")) {
    return preview;
  }
  const supabase = await createSupabaseServerClient();
  const catalog = await supabase.from("bot_catalog").select("slug, name, description, monthly_price_cents, engine, default_config").eq("slug", input.slug).maybeSingle();
  if (catalog.error || !catalog.data) {
    return {
      ...preview,
      preview: false,
      found: false,
      notice: catalog.error
        ? (missingBotTable(catalog.error.message)
          ? "Bot Store tables are not in this database yet. Apply phase 4a before saving. Nothing was stored and nothing was sent."
          : catalog.error.message)
        : "That bot is not in the catalogue.",
    };
  }
  const [installed, runs] = await Promise.all([
    supabase.from("org_bots").select("status, config").eq("org_id", tenant.active.id).eq("bot_slug", input.slug).maybeSingle(),
    supabase.from("bot_runs").select("id, kind, status, summary, created_at").eq("org_id", tenant.active.id).eq("bot_slug", input.slug).order("created_at", { ascending: false }).limit(20),
  ]);
  const fallback = botBySlug(input.slug).defaultConfig;
  return {
    preview: false,
    notice: input.notice ?? null,
    canManage: canManageRole(tenant.role),
    found: true,
    orgSlug: tenant.active.slug,
    slug: String(catalog.data.slug),
    name: String(catalog.data.name),
    description: String(catalog.data.description ?? ""),
    status: installed.data ? String(installed.data.status) : "Not installed",
    engine: String(catalog.data.engine),
    pricePlaceholder: true,
    monthlyPriceCents: Number(catalog.data.monthly_price_cents),
    config: asConfig(installed.data?.config ?? catalog.data.default_config, fallback),
    runs: (runs.data ?? []).map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      status: String(row.status),
      summary: String(row.summary ?? ""),
      createdAt: String(row.created_at),
    })),
  };
}

export async function loadAgencyBots(input: { org?: string | null }): Promise<AgencyBotData> {
  const tenant = await safeResolveWorkspace(input.org);
  if (!tenant.canManageAgency && tenant.mode === "member") {
    return { allowed: false, preview: false, notice: "Agency roles can see which workspaces run each bot.", rows: [], totalMrrCents: 0 };
  }
  const preview = previewAgencyBots();
  if (!connected() || tenant.mode !== "member" || !tenant.scoped) return preview;
  const supabase = await createSupabaseServerClient();
  const [bots, lines, orgs] = await Promise.all([
    supabase.from("org_bots").select("org_id, bot_slug, status, sandbox"),
    supabase.from("org_bot_billing_lines").select("org_id, bot_slug, amount_cents, status, sandbox, charged"),
    supabase.from("organizations").select("id, name, slug, org_type"),
  ]);
  const failed = [bots.error, lines.error, orgs.error].find(Boolean);
  if (failed) {
    return { ...preview, preview: false, notice: failed.message };
  }
  const orgById = new Map((orgs.data ?? []).map((row) => [String(row.id), row]));
  const mrr = new Map<string, number>();
  for (const line of lines.data ?? []) {
    if (line.sandbox !== true || line.charged !== false) continue;
    if (line.status !== "trial" && line.status !== "active") continue;
    const key = `${line.org_id}:${line.bot_slug}`;
    mrr.set(key, (mrr.get(key) ?? 0) + Number(line.amount_cents));
  }
  const rows = (bots.data ?? [])
    .map((row) => {
      const org = orgById.get(String(row.org_id));
      if (!org || org.org_type === "agency") return null;
      const slug = String(row.bot_slug);
      return {
        orgName: String(org.name),
        orgSlug: String(org.slug),
        botName: safeName(slug),
        botSlug: slug,
        status: String(row.status),
        mrrCents: mrr.get(`${row.org_id}:${slug}`) ?? 0,
        sandbox: true as const,
      };
    })
    .filter((row): row is AgencyBotData["rows"][number] => Boolean(row))
    .sort((left, right) => left.orgName.localeCompare(right.orgName) || left.botName.localeCompare(right.botName));
  return {
    allowed: true,
    preview: false,
    notice: "Sandbox MRR. Nothing is charged.",
    rows,
    totalMrrCents: rows.reduce((sum, row) => sum + row.mrrCents, 0),
  };
}

function safeName(slug: string) {
  try {
    return botBySlug(slug).name;
  } catch {
    return slug;
  }
}

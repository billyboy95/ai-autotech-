import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EDUCATION_BLUEPRINT, BLUEPRINTS } from "@/lib/tenant/blueprints";
import { slugify } from "@/lib/tenant/access";
import { missingOrgColumn, missingTenantTable, toWorkspace, type OrganizationRow } from "@/lib/tenant/rows";
import type { ClientMetric, MembershipRole, WorkspaceBlueprint, WorkspaceSummary } from "@/lib/tenant/types";
import { AGENCY_SLUG, emptyChannels, emptyShopify, type ShopifyStoreRecord } from "@/lib/tenant/types";

const ORG_COLUMNS =
  "id, name, slug, org_type, parent_id, legal_name, location, industry, logo_url, primary_color, accent_color, domain, form_key, settings";

function admin() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Supabase service role is not configured.");
  return client;
}

export async function findOrgBySlug(slug: string) {
  const { data, error } = await admin().from("organizations").select(ORG_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) {
    if (missingTenantTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? toWorkspace(data as OrganizationRow) : null;
}

export async function findOrgByFormKey(formKey: string) {
  const { data, error } = await admin().from("organizations").select(ORG_COLUMNS).eq("form_key", formKey).maybeSingle();
  if (error) {
    if (missingTenantTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? toWorkspace(data as OrganizationRow) : null;
}

export async function agencyOrgId() {
  const org = await findOrgBySlug(AGENCY_SLUG);
  return org?.id ?? null;
}

async function countLeads(orgId: string) {
  const { data, error } = await admin().from("crm_leads").select("stage").eq("org_id", orgId);
  if (error) {
    if (missingOrgColumn(error) || missingTenantTable(error)) return { total: 0, won: 0 };
    throw new Error(error.message);
  }
  const rows = data ?? [];
  const won = rows.filter((row) => row.stage === "Won").length;
  return { total: rows.length, won };
}

async function pipelineValue(orgId: string) {
  const invoices = await admin().from("crm_invoices").select("amount, status").eq("org_id", orgId);
  let invoiceTotal = 0;
  if (!invoices.error) {
    invoiceTotal = (invoices.data ?? [])
      .filter((row) => row.status === "Unpaid")
      .reduce((sum, row) => sum + (Number(String(row.amount).replace(/[^0-9.]/g, "")) || 0), 0);
  } else if (!missingOrgColumn(invoices.error)) {
    throw new Error(invoices.error.message);
  }

  const deals = await admin().from("workspace_deals").select("amount_cents, status").eq("org_id", orgId);
  let dealTotal = 0;
  if (!deals.error) {
    dealTotal = (deals.data ?? [])
      .filter((row) => row.status === "open")
      .reduce((sum, row) => sum + Number(row.amount_cents ?? 0) / 100, 0);
  } else if (!missingTenantTable(deals.error)) {
    throw new Error(deals.error.message);
  }

  const wonDeals = !deals.error ? (deals.data ?? []).filter((row) => row.status === "won").length : 0;
  return { value: invoiceTotal + dealTotal, wonDeals };
}

async function shopifyFigures(orgId: string) {
  const orders = await admin().from("workspace_shopify_orders").select("total_cents, counts_as_revenue").eq("org_id", orgId);
  const carts = await admin().from("workspace_shopify_checkouts").select("total_cents, abandoned").eq("org_id", orgId);
  const stores = await admin().from("workspace_shopify_stores").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  if (orders.error && !missingTenantTable(orders.error) && !missingOrgColumn(orders.error)) throw new Error(orders.error.message);
  if (carts.error && !missingTenantTable(carts.error) && !missingOrgColumn(carts.error)) throw new Error(carts.error.message);
  const revenue = (orders.data ?? [])
    .filter((row) => row.counts_as_revenue)
    .reduce((sum, row) => sum + Number(row.total_cents ?? 0), 0) / 100;
  const abandoned = (carts.data ?? [])
    .filter((row) => row.abandoned)
    .reduce((sum, row) => sum + Number(row.total_cents ?? 0), 0) / 100;
  return { revenue, abandoned, stores: stores.count ?? 0 };
}

export async function listStages(orgId: string) {
  const { data, error } = await admin()
    .from("workspace_pipeline_stages")
    .select("name, position")
    .eq("org_id", orgId)
    .order("position", { ascending: true });
  if (error) {
    if (missingTenantTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => String(row.name));
}

export async function clientMetrics(clients: WorkspaceSummary[]): Promise<ClientMetric[]> {
  return Promise.all(
    clients.map(async (workspace) => {
      const [leads, money, stages, shopify] = await Promise.all([
        countLeads(workspace.id),
        pipelineValue(workspace.id),
        listStages(workspace.id),
        shopifyFigures(workspace.id),
      ]);
      const won = leads.won + money.wonDeals;
      const conversions = leads.total ? Math.round((leads.won / leads.total) * 100) : money.wonDeals ? 100 : 0;
      return {
        workspace,
        leads: leads.total,
        pipelineValue: money.value + shopify.abandoned,
        revenue: shopify.revenue,
        stores: shopify.stores,
        conversions,
        won,
        stages,
      };
    }),
  );
}

export async function listMembers(orgId: string) {
  const { data, error } = await admin().from("memberships").select("user_id, role, created_at").eq("org_id", orgId);
  if (error) {
    if (missingTenantTable(error)) return [];
    throw new Error(error.message);
  }
  const rows = data ?? [];
  const emails = new Map<string, string>();
  const authAdmin = admin().auth.admin;
  if (rows.length && authAdmin) {
    const listed = await authAdmin.listUsers({ page: 1, perPage: 200 });
    for (const user of listed.data?.users ?? []) {
      if (user.email) emails.set(user.id, user.email);
    }
  }
  return rows.map((row) => ({
    userId: String(row.user_id),
    email: emails.get(String(row.user_id)) ?? "User",
    role: String(row.role) as MembershipRole,
  }));
}

async function cloneBlueprint(orgId: string, blueprint: WorkspaceBlueprint) {
  const supabase = admin();
  const pipeline = await supabase
    .from("workspace_pipelines")
    .insert({ org_id: orgId, name: blueprint.pipelineName, is_default: true })
    .select("id")
    .single();
  if (pipeline.error || !pipeline.data) throw new Error(pipeline.error?.message ?? "Could not create pipeline.");

  const stages = await supabase.from("workspace_pipeline_stages").insert(
    blueprint.stages.map((stage) => ({
      org_id: orgId,
      pipeline_id: pipeline.data.id,
      name: stage.name,
      position: stage.position,
      is_won: stage.isWon,
      is_lost: stage.isLost,
    })),
  );
  if (stages.error) throw new Error(stages.error.message);

  const templates = await supabase.from("workspace_templates").insert(
    blueprint.templates.map((template) => ({
      org_id: orgId,
      name: template.name,
      channel: template.channel,
      body: template.body,
    })),
  );
  if (templates.error) throw new Error(templates.error.message);

  const sequence = await supabase
    .from("workspace_sequences")
    .insert({ org_id: orgId, name: blueprint.sequenceName })
    .select("id")
    .single();
  if (sequence.error || !sequence.data) throw new Error(sequence.error?.message ?? "Could not create sequence.");

  const steps = await supabase.from("workspace_sequence_steps").insert(
    blueprint.steps.map((step) => ({
      org_id: orgId,
      sequence_id: sequence.data.id,
      position: step.position,
      delay_hours: step.delayHours,
      channel: step.channel,
      template_name: step.templateName,
    })),
  );
  if (steps.error) throw new Error(steps.error.message);
}

export async function createClientWorkspace(input: {
  name: string;
  slug?: string;
  location?: string;
  domain?: string;
  blueprintKey: "agency" | "education" | "ecommerce";
  parentId: string;
}) {
  const supabase = admin();
  const base = slugify(input.slug || input.name);
  let slug = base;
  for (let attempt = 1; attempt < 20; attempt += 1) {
    const existing = await findOrgBySlug(slug);
    if (!existing) break;
    slug = `${base}-${attempt + 1}`;
  }

  const blueprint = BLUEPRINTS.find((item) => item.key === input.blueprintKey) ?? EDUCATION_BLUEPRINT;
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: input.name.trim(),
      slug,
      org_type: "client",
      parent_id: input.parentId,
      legal_name: input.name.trim(),
      location: input.location?.trim() || "",
      industry: blueprint.key === "education" ? "Education" : blueprint.key === "ecommerce" ? "Ecommerce" : "",
      domain: input.domain?.trim() || "",
      form_key: slug,
      primary_color: blueprint.key === "ecommerce" ? "#111827" : blueprint.key === "education" ? "#0F3D4C" : "#0B1F3A",
      accent_color: blueprint.key === "ecommerce" ? "#16A34A" : blueprint.key === "education" ? "#C4A35A" : "#2563EB",
      settings: { channels: emptyChannels(), shopify: emptyShopify() },
    })
    .select(ORG_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create workspace.");
  const workspace = toWorkspace(data as OrganizationRow);
  if (!workspace) throw new Error("Could not create workspace.");
  await cloneBlueprint(workspace.id, blueprint);
  return workspace;
}

export async function listShopifyStores(orgId: string): Promise<ShopifyStoreRecord[]> {
  const { data, error } = await admin()
    .from("workspace_shopify_stores")
    .select("niche, name, myshopify_domain, public_domain, plan_status")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (error) {
    if (missingTenantTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    niche: String(row.niche),
    name: String(row.name),
    myshopifyDomain: String(row.myshopify_domain),
    publicDomain: String(row.public_domain),
    planStatus: String(row.plan_status),
  }));
}

export async function setShopifyPlanStatus(orgId: string, planStatus: "not_connected" | "credentials_saved") {
  const { error } = await admin().from("workspace_shopify_stores").update({ plan_status: planStatus }).eq("org_id", orgId);
  if (error && !missingTenantTable(error)) throw new Error(error.message);
}

export async function updateWorkspace(orgId: string, patch: Record<string, unknown>) {
  const { error } = await admin().from("organizations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function addMembership(orgId: string, email: string, role: MembershipRole) {
  const supabase = admin();
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw new Error(listed.error.message);
  const user = listed.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error("No Supabase Auth user with that email yet. Create the user under Authentication → Users, then add them here.");
  }
  const { error } = await supabase.from("memberships").upsert(
    { user_id: user.id, org_id: orgId, role },
    { onConflict: "user_id,org_id" },
  );
  if (error) throw new Error(error.message);
}

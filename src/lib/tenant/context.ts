import { cookies, headers } from "next/headers";
import { supabaseAuthConfigured } from "@/lib/auth/gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOwnerMembership } from "@/server/workers/owner-bootstrap";
import { BRAND_HOST_COOKIE, BRAND_HOST_HEADER, TEST_BRAND_HOSTS, brandHostFrom } from "@/lib/brand/host";
import { expandAccessibleOrgs, roleForOrg, toOptions, visibleWorkspace } from "@/lib/tenant/access";
import { previewWorkspaces } from "@/lib/tenant/blueprints";
import { missingTenantTable, toWorkspace, type OrganizationRow } from "@/lib/tenant/rows";
import {
  AGENCY_SLUG,
  isAgencyRole,
  ORG_COOKIE,
  WORKSPACE_COOKIE,
  type Membership,
  type MembershipRole,
  type WorkspaceResolution,
  type WorkspaceSummary,
} from "@/lib/tenant/types";

const ORG_COLUMNS =
  "id, name, slug, org_type, parent_id, legal_name, location, industry, logo_url, primary_color, accent_color, domain, custom_domain, form_key, settings, branding, sending_enabled, sender_name, timezone, currency";
const ORG_COLUMNS_BASE =
  "id, name, slug, org_type, parent_id, legal_name, location, industry, logo_url, primary_color, accent_color, domain, form_key, settings";

function phase2ColumnMissing(error: { message: string } | null) {
  return Boolean(error && /sending_enabled|sender_name|timezone|currency|custom_domain|branding/.test(error.message));
}

function resolution(
  input: Omit<WorkspaceResolution, "requiresLogin" | "requestedSlug" | "brandLocked" | "brandHost"> &
    Partial<Pick<WorkspaceResolution, "requiresLogin" | "requestedSlug" | "brandLocked" | "brandHost">>,
): WorkspaceResolution {
  return {
    requiresLogin: false,
    requestedSlug: null,
    brandLocked: false,
    brandHost: null,
    ...input,
  };
}

export function applyBrandLock(
  current: WorkspaceResolution,
  brandSlug: string,
  orgs: WorkspaceSummary[],
  role: MembershipRole | null,
): WorkspaceResolution {
  const branded = orgs.find((org) => org.slug === brandSlug);
  if (!branded) {
    return resolution({
      mode: current.mode === "preview" ? "preview" : "member",
      active: current.active,
      workspaces: [],
      role: null,
      userEmail: current.userEmail,
      canManageAgency: false,
      scoped: true,
      requiresLogin: true,
      requestedSlug: brandSlug,
      brandLocked: true,
      brandHost: current.brandHost,
    });
  }

  if (current.mode === "preview") {
    return resolution({
      mode: "preview",
      active: branded,
      workspaces: toOptions([branded]),
      role: null,
      userEmail: null,
      canManageAgency: false,
      scoped: true,
      requiresLogin: false,
      requestedSlug: brandSlug,
      brandLocked: true,
      brandHost: current.brandHost,
    });
  }

  if (current.mode === "owner" || !role) {
    return resolution({
      mode: "member",
      active: branded,
      workspaces: [],
      role: null,
      userEmail: current.userEmail,
      canManageAgency: false,
      scoped: true,
      requiresLogin: true,
      requestedSlug: brandSlug,
      brandLocked: true,
      brandHost: current.brandHost,
    });
  }

  return resolution({
    mode: "member",
    active: branded,
    workspaces: toOptions([branded]),
    role,
    userEmail: current.userEmail,
    canManageAgency: false,
    scoped: true,
    requiresLogin: false,
    requestedSlug: brandSlug,
    brandLocked: true,
    brandHost: current.brandHost,
  });
}

export async function currentBrandHost() {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return brandHostFrom({
    header: headerStore.get(BRAND_HOST_HEADER),
    cookie: cookieStore.get(BRAND_HOST_COOKIE)?.value,
    forwardedHost: headerStore.get("x-forwarded-host"),
    host: headerStore.get("host"),
  });
}

export async function slugForBrandHost(host: string | null) {
  if (!host) return null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc("resolve_custom_domain", { p_host: host });
      const slug = data && typeof data === "object" && "slug" in data ? String((data as { slug?: string }).slug || "") : "";
      if (!error && slug) return slug;
    } catch {
      // The phase 2g function is not applied yet. Test hosts still resolve.
    }
  }
  return TEST_BRAND_HOSTS[host] ?? null;
}

function mapOrgs(data: OrganizationRow[] | null) {
  return (data ?? []).map(toWorkspace).filter((org): org is WorkspaceSummary => Boolean(org));
}

function signedOutResolution(asked: string | null | undefined): WorkspaceResolution {
  const fallback = previewWorkspaces()[0];
  return resolution({
    mode: "member",
    active: fallback,
    workspaces: [],
    role: null,
    userEmail: null,
    canManageAgency: false,
    scoped: true,
    requiresLogin: true,
    requestedSlug: asked ?? null,
  });
}

export async function loadOrganizations(): Promise<WorkspaceSummary[] | null> {
  if (!supabaseAuthConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser().then((result) => result.data.user).catch(() => null);
  if (!user) return null;
  const first = await supabase.from("organizations").select(ORG_COLUMNS);
  const listed = phase2ColumnMissing(first.error)
    ? await supabase.from("organizations").select(ORG_COLUMNS_BASE)
    : first;
  if (listed.error) {
    if (missingTenantTable(listed.error)) return null;
    throw new Error(listed.error.message);
  }
  return mapOrgs((listed.data ?? []) as unknown as OrganizationRow[]);
}

async function sessionUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

async function loadMemberships(userId: string): Promise<Membership[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("memberships").select("id, user_id, org_id, role").eq("user_id", userId);
  if (error) {
    if (missingTenantTable(error)) return [];
    throw new Error(error.message);
  }
  const access = await supabase.from("member_org_access").select("member_id, org_id");
  const restricted = new Map<string, string[]>();
  if (!access.error) {
    for (const row of access.data ?? []) {
      const memberId = String(row.member_id);
      const list = restricted.get(memberId) ?? [];
      list.push(String(row.org_id));
      restricted.set(memberId, list);
    }
  }
  return (data ?? []).flatMap((row) => {
    const role = String(row.role);
    if (role !== "agency_owner" && role !== "agency_staff" && role !== "client_admin" && role !== "client_user") {
      return [];
    }
    const id = String(row.id);
    return [{
      id,
      userId: String(row.user_id),
      orgId: String(row.org_id),
      role,
      restrictedOrgIds: restricted.get(id),
    }];
  });
}

export async function resolveWorkspace(requestedSlug?: string | null): Promise<WorkspaceResolution> {
  const brandHost = await currentBrandHost();
  const brandSlug = await slugForBrandHost(brandHost);
  const cookieStore = await cookies();
  const cookieSlug = cookieStore.get(ORG_COOKIE)?.value ?? cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const asked = brandSlug || requestedSlug || cookieSlug;

  const lock = (current: WorkspaceResolution, catalog: WorkspaceSummary[], role: MembershipRole | null = null) => {
    const hosted = { ...current, brandHost };
    if (!brandSlug) return hosted;
    return applyBrandLock(hosted, brandSlug, catalog, role);
  };

  if (!supabaseAuthConfigured()) {
    const previews = previewWorkspaces();
    const active = previews.find((org) => org.slug === asked) ?? previews[0];
    return lock(resolution({
      mode: "preview",
      active,
      workspaces: toOptions(previews),
      role: "agency_owner",
      userEmail: null,
      canManageAgency: true,
      scoped: false,
    }), previews);
  }

  const user = await sessionUser();
  if (!user) return lock(signedOutResolution(asked), previewWorkspaces());

  await ensureOwnerMembership({ id: user.id, email: user.email });

  const orgs = await loadOrganizations();
  const agency = orgs?.find((org) => org.slug === AGENCY_SLUG) ?? orgs?.find((org) => org.orgType === "agency") ?? null;

  if (!orgs || !agency) {
    return lock(resolution({
      mode: "member",
      active: previewWorkspaces()[0],
      workspaces: [],
      role: null,
      userEmail: user.email ?? null,
      canManageAgency: false,
      scoped: true,
      requiresLogin: false,
      requestedSlug: asked,
    }), previewWorkspaces());
  }

  const memberships = await loadMemberships(user.id);
  const accessible = expandAccessibleOrgs(orgs, memberships);
  const branded = brandSlug ? orgs.find((org) => org.slug === brandSlug) ?? null : null;
  const brandedRole = branded ? roleForOrg(branded, memberships, orgs) : null;

  if (!accessible.length) {
    return lock(resolution({
      mode: "member",
      active: agency,
      workspaces: [],
      role: null,
      userEmail: user.email ?? null,
      canManageAgency: false,
      scoped: true,
      requiresLogin: false,
      requestedSlug: asked,
    }), orgs, brandedRole);
  }

  const requested = visibleWorkspace(accessible, asked);
  const denied = Boolean(asked && !requested);
  const active = requested ?? visibleWorkspace(accessible, null) ?? accessible[0];
  const role = roleForOrg(active, memberships, orgs);
  return lock(resolution({
    mode: "member",
    active,
    workspaces: toOptions(accessible),
    role,
    userEmail: user.email ?? null,
    canManageAgency: memberships.some((membership) => isAgencyRole(membership.role)),
    scoped: true,
    requiresLogin: false,
    requestedSlug: denied ? asked : null,
  }), orgs, brandedRole);
}

export async function rememberActiveOrg(orgId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;
    await supabase.from("user_prefs").upsert({
      user_id: user.data.user.id,
      active_org_id: orgId,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Preference storage is optional until the phase 2a migration is applied.
  }
}

export async function recordAgencyView(orgId: string, name: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;
    await supabase.from("org_activity").insert({
      org_id: orgId,
      actor_id: user.data.user.id,
      action: "workspace.view",
      entity: "organization",
      entity_id: orgId,
      meta: { name },
      acting_as_agency: true,
    });
  } catch {
    // A failed activity row must not block the workspace.
  }
}

export async function safeResolveWorkspace(requestedSlug?: string | null): Promise<WorkspaceResolution> {
  try {
    return await resolveWorkspace(requestedSlug);
  } catch (error) {
    console.error("workspace resolution failed", error);
    if (supabaseAuthConfigured()) return signedOutResolution(requestedSlug);
    const fallback = previewWorkspaces()[0];
    return resolution({
      mode: "preview",
      active: fallback,
      workspaces: toOptions(previewWorkspaces()),
      role: "agency_owner",
      userEmail: null,
      canManageAgency: true,
      scoped: false,
    });
  }
}

export async function resolveActiveOrgId() {
  const workspace = await resolveWorkspace();
  if (workspace.mode === "member" && !workspace.role) {
    throw new Error("This login is not on a workspace yet. Add a membership, then sign in again.");
  }
  if (!workspace.scoped) return null;
  return workspace.active.id;
}

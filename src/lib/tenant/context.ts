import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { agencyOrgId, serviceConfigured, withOrg } from "@/server/workers/with-org";
import { expandAccessibleOrgs, roleForOrg, toOptions } from "@/lib/tenant/access";
import { previewWorkspaces } from "@/lib/tenant/blueprints";
import { missingTenantTable, toWorkspace, type OrganizationRow } from "@/lib/tenant/rows";
import {
  AGENCY_SLUG,
  isAgencyRole,
  ORG_COOKIE,
  WORKSPACE_COOKIE,
  type Membership,
  type WorkspaceResolution,
  type WorkspaceSummary,
} from "@/lib/tenant/types";

const ORG_COLUMNS =
  "id, name, slug, org_type, parent_id, legal_name, location, industry, logo_url, primary_color, accent_color, domain, form_key, settings, sending_enabled, sender_name, timezone, currency";
const ORG_COLUMNS_BASE =
  "id, name, slug, org_type, parent_id, legal_name, location, industry, logo_url, primary_color, accent_color, domain, form_key, settings";

function phase2ColumnMissing(error: { message: string } | null) {
  return Boolean(error && /sending_enabled|sender_name|timezone|currency/.test(error.message));
}

function resolution(input: Omit<WorkspaceResolution, "requiresLogin" | "requestedSlug"> & Partial<Pick<WorkspaceResolution, "requiresLogin" | "requestedSlug">>): WorkspaceResolution {
  return {
    requiresLogin: false,
    requestedSlug: null,
    ...input,
  };
}

function ownerShell(active: WorkspaceSummary, scoped: boolean): WorkspaceResolution {
  return resolution({
    mode: "owner",
    active,
    workspaces: [{ slug: active.slug, name: active.name, orgType: active.orgType }],
    role: null,
    userEmail: null,
    canManageAgency: false,
    scoped,
  });
}

function mapOrgs(data: OrganizationRow[] | null) {
  return (data ?? []).map(toWorkspace).filter((org): org is WorkspaceSummary => Boolean(org));
}

export async function loadOrganizations(): Promise<WorkspaceSummary[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser().then((result) => result.data.user).catch(() => null);
  if (!user) {
    if (!serviceConfigured()) return null;
    const id = await agencyOrgId();
    if (!id) return null;
    let { data, error } = await withOrg(id, "id").from("organizations").select(ORG_COLUMNS).maybeSingle();
    if (phase2ColumnMissing(error)) {
      const retry = await withOrg(id, "id").from("organizations").select(ORG_COLUMNS_BASE).maybeSingle();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      if (missingTenantTable(error)) return null;
      throw new Error(error.message);
    }
    return data ? mapOrgs([data as unknown as OrganizationRow]) : null;
  }
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
  const cookieStore = await cookies();
  const cookieSlug = cookieStore.get(ORG_COOKIE)?.value ?? cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const asked = requestedSlug || cookieSlug;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const previews = previewWorkspaces();
    const active = previews.find((org) => org.slug === asked) ?? previews[0];
    return resolution({
      mode: "preview",
      active,
      workspaces: toOptions(previews),
      role: "agency_owner",
      userEmail: null,
      canManageAgency: true,
      scoped: false,
    });
  }

  const orgs = await loadOrganizations();
  const agency = orgs?.find((org) => org.slug === AGENCY_SLUG) ?? orgs?.find((org) => org.orgType === "agency") ?? null;

  if (!orgs || !agency) {
    const fallback = previewWorkspaces()[0];
    return ownerShell(fallback, false);
  }

  const user = await sessionUser();
  if (!user) {
    if (asked && asked !== agency.slug) {
      return resolution({
        ...ownerShell(agency, true),
        requiresLogin: true,
        requestedSlug: asked,
      });
    }
    return ownerShell(agency, true);
  }

  const memberships = await loadMemberships(user.id);
  const accessible = expandAccessibleOrgs(orgs, memberships);
  if (!accessible.length) {
    return resolution({
      mode: "member",
      active: agency,
      workspaces: [],
      role: null,
      userEmail: user.email ?? null,
      canManageAgency: false,
      scoped: true,
      requiresLogin: false,
      requestedSlug: asked,
    });
  }

  const requested = asked ? accessible.find((org) => org.slug === asked) : undefined;
  if (asked && !requested) {
    const fallback = accessible.find((org) => org.slug === AGENCY_SLUG) ?? accessible[0];
    return resolution({
      mode: "member",
      active: fallback,
      workspaces: toOptions(accessible),
      role: roleForOrg(fallback, memberships, orgs),
      userEmail: user.email ?? null,
      canManageAgency: memberships.some((membership) => isAgencyRole(membership.role)),
      scoped: true,
      requiresLogin: false,
      requestedSlug: asked,
    });
  }

  const active = requested ?? accessible.find((org) => org.orgType === "agency") ?? accessible[0];
  const role = roleForOrg(active, memberships, orgs);
  return resolution({
    mode: "member",
    active,
    workspaces: toOptions(accessible),
    role,
    userEmail: user.email ?? null,
    canManageAgency: memberships.some((membership) => isAgencyRole(membership.role)),
    scoped: true,
  });
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
    const fallback = previewWorkspaces()[0];
    return ownerShell(fallback, false);
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

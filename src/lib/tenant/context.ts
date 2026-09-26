import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { expandAccessibleOrgs, roleForOrg, toOptions } from "@/lib/tenant/access";
import { previewWorkspaces } from "@/lib/tenant/blueprints";
import { missingTenantTable, toWorkspace, type OrganizationRow } from "@/lib/tenant/rows";
import {
  AGENCY_SLUG,
  isAgencyRole,
  WORKSPACE_COOKIE,
  type Membership,
  type WorkspaceResolution,
  type WorkspaceSummary,
} from "@/lib/tenant/types";

const ORG_COLUMNS =
  "id, name, slug, org_type, parent_id, legal_name, location, industry, logo_url, primary_color, accent_color, domain, form_key, settings";

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

export async function loadOrganizations(): Promise<WorkspaceSummary[] | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("organizations").select(ORG_COLUMNS);
  if (error) {
    if (missingTenantTable(error)) return null;
    throw new Error(error.message);
  }
  return ((data ?? []) as OrganizationRow[]).map(toWorkspace).filter((org): org is WorkspaceSummary => Boolean(org));
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
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("memberships").select("user_id, org_id, role").eq("user_id", userId);
  if (error) {
    if (missingTenantTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).flatMap((row) => {
    const role = String(row.role);
    if (role !== "agency_owner" && role !== "agency_staff" && role !== "client_admin" && role !== "client_user") {
      return [];
    }
    return [{ userId: String(row.user_id), orgId: String(row.org_id), role }];
  });
}

export async function resolveWorkspace(requestedSlug?: string | null): Promise<WorkspaceResolution> {
  const cookieStore = await cookies();
  const cookieSlug = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const asked = requestedSlug || cookieSlug;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

export async function resolveActiveOrgId() {
  const workspace = await resolveWorkspace();
  if (workspace.mode === "member" && !workspace.role) {
    throw new Error("This login is not on a workspace yet. Add a membership, then sign in again.");
  }
  if (!workspace.scoped) return null;
  return workspace.active.id;
}

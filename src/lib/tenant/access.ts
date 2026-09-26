import { isAgencyRole, type Membership, type MembershipRole, type WorkspaceOption, type WorkspaceSummary } from "./types";

export function expandAccessibleOrgs(orgs: WorkspaceSummary[], memberships: Membership[]): WorkspaceSummary[] {
  const byId = new Map(orgs.map((org) => [org.id, org]));
  const allowed = new Map<string, WorkspaceSummary>();

  for (const membership of memberships) {
    const org = byId.get(membership.orgId);
    if (!org) continue;
    allowed.set(org.id, org);
    if (!isAgencyRole(membership.role)) continue;
    const restricted = membership.restrictedOrgIds ?? [];
    for (const child of orgs) {
      if (child.orgType !== "client" || child.parentId !== org.id) continue;
      if (membership.role === "agency_staff" && restricted.length > 0 && !restricted.includes(child.id)) continue;
      allowed.set(child.id, child);
    }
  }

  return [...allowed.values()].sort((a, b) => {
    if (a.orgType !== b.orgType) return a.orgType === "agency" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function roleForOrg(org: WorkspaceSummary, memberships: Membership[], orgs: WorkspaceSummary[]): MembershipRole | null {
  const direct = memberships.find((membership) => membership.orgId === org.id);
  if (direct) return direct.role;
  if (!org.parentId) return null;
  const parent = orgs.find((item) => item.id === org.parentId);
  if (!parent) return null;
  const viaParent = memberships.find((membership) => membership.orgId === parent.id && isAgencyRole(membership.role));
  return viaParent?.role ?? null;
}

export function toOptions(orgs: WorkspaceSummary[]): WorkspaceOption[] {
  return orgs.map((org) => ({ slug: org.slug, name: org.name, orgType: org.orgType }));
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "workspace";
}

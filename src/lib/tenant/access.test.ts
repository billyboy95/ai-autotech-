import assert from "node:assert/strict";
import test from "node:test";
import { expandAccessibleOrgs, roleForOrg } from "./access";
import { previewWorkspaces } from "./blueprints";
import type { Membership, WorkspaceSummary } from "./types";

const [agency, eastc] = previewWorkspaces();
const outsider: WorkspaceSummary = {
  ...eastc,
  id: "other-client",
  slug: "other-client",
  name: "Other School",
  parentId: "other-agency",
};
const otherAgency: WorkspaceSummary = {
  ...agency,
  id: "other-agency",
  slug: "other-agency",
  name: "Other Agency",
};
const orgs = [agency, eastc, otherAgency, outsider];

test("agency owner can open the agency and its child workspaces only", () => {
  const memberships: Membership[] = [{ userId: "owner", orgId: agency.id, role: "agency_owner" }];
  const allowed = expandAccessibleOrgs(orgs, memberships).map((org) => org.slug);
  assert.deepEqual(allowed, ["ai-autotech", "eastc"]);
  assert.equal(roleForOrg(eastc, memberships, orgs), "agency_owner");
});

test("client user cannot see another organisation", () => {
  const memberships: Membership[] = [{ userId: "student-admin", orgId: eastc.id, role: "client_user" }];
  const allowed = expandAccessibleOrgs(orgs, memberships).map((org) => org.slug);
  assert.deepEqual(allowed, ["eastc"]);
  assert.equal(roleForOrg(agency, memberships, orgs), null);
  assert.equal(roleForOrg(outsider, memberships, orgs), null);
});

test("restricted agency staff see only the listed client workspaces", () => {
  const zentrix = previewWorkspaces()[2];
  const memberships: Membership[] = [{
    userId: "staff",
    orgId: agency.id,
    role: "agency_staff",
    restrictedOrgIds: [eastc.id],
  }];
  const allowed = expandAccessibleOrgs([agency, eastc, zentrix], memberships).map((org) => org.slug);
  assert.deepEqual(allowed, ["ai-autotech", "eastc"]);
});

test("agency staff do not inherit a different agency's clients", () => {
  const memberships: Membership[] = [{ userId: "staff", orgId: agency.id, role: "agency_staff" }];
  const allowed = expandAccessibleOrgs(orgs, memberships).map((org) => org.slug);
  assert.equal(allowed.includes("other-client"), false);
  assert.equal(allowed.includes("eastc"), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { EDUCATION_PAYLOAD, EDUCATION_SNAPSHOT_ID } from "@/lib/snapshots/catalog";
import {
  EASTC_ORG_ID,
  EDUCATION_PACK_BUTTON,
  EDUCATION_PACK_CONFIRM,
  educationPackConfirmationOk,
  educationPackTouchesOnlyCatalogue,
  showEducationPack,
} from "@/lib/snapshots/eastc-pack";
import { collectPayloadIssues } from "@/lib/snapshots/payload";

test("education pack button is agency-only and EASTC settings only", () => {
  assert.equal(showEducationPack({ surface: "agency", canManageAgency: true }), true);
  assert.equal(showEducationPack({ surface: "agency", canManageAgency: false }), false);
  assert.equal(showEducationPack({ surface: "settings", canManageAgency: true, slug: "eastc" }), true);
  assert.equal(showEducationPack({ surface: "settings", canManageAgency: true, slug: "zentrix" }), false);
  assert.equal(showEducationPack({ surface: "settings", canManageAgency: false, slug: "eastc" }), false);
  assert.equal(EDUCATION_PACK_BUTTON, "Apply Education pack to EASTC");
});

test("education pack confirmation is an explicit yes", () => {
  assert.equal(educationPackConfirmationOk(EDUCATION_PACK_CONFIRM), true);
  assert.equal(educationPackConfirmationOk("no"), false);
  assert.equal(educationPackConfirmationOk(null), false);
});

test("education pack catalogue stays free of contacts and stays inactive", () => {
  const pack = educationPackTouchesOnlyCatalogue();
  assert.equal(pack.snapshotId, EDUCATION_SNAPSHOT_ID);
  assert.equal(pack.orgId, EASTC_ORG_ID);
  assert.equal(pack.slug, "eastc");
  assert.equal(pack.workflowKey, "workflow:admissions-enquiry");
  assert.equal(pack.workflowActive, false);
  assert.equal(pack.sequenceActive, false);
  assert.equal(pack.hasContactsKey, false);
  assert.equal(pack.hasSecrets, false);
  assert.deepEqual(collectPayloadIssues(EDUCATION_PAYLOAD), []);
  assert.equal(EDUCATION_PAYLOAD.workflows[0].trigger_type, "form.submitted");
});

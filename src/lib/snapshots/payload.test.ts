import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TEMPLATES } from "@/lib/automation/templates";
import { PIPELINE_STAGES } from "@/lib/automation/types";
import {
  AGENCY_DEFAULT_PAYLOAD,
  EDUCATION_PAYLOAD,
  EDUCATION_STAGES,
  SEEDED_SNAPSHOTS,
} from "@/lib/snapshots/catalog";
import { checksum, collectPayloadIssues, planPush, SNAPSHOT_TOP_LEVEL_KEYS, templateContent } from "@/lib/snapshots/payload";

test("seeded snapshots contain catalogue data only", () => {
  for (const snapshot of SEEDED_SNAPSHOTS) {
    assert.deepEqual(Object.keys(snapshot.payload).sort(), [...SNAPSHOT_TOP_LEVEL_KEYS].sort());
    assert.deepEqual(collectPayloadIssues(snapshot.payload), []);
    const encoded = JSON.stringify(snapshot.payload);
    assert.equal(encoded.includes("@"), false);
    assert.equal(/secret|token|password|credential/i.test(encoded), false);
  }
});

test("agency default carries the live pipeline and templates", () => {
  assert.deepEqual(
    AGENCY_DEFAULT_PAYLOAD.pipelines[0].stages.map((stage) => stage.name),
    [...PIPELINE_STAGES],
  );
  assert.deepEqual(
    AGENCY_DEFAULT_PAYLOAD.message_templates.map((template) => template.asset_key),
    DEFAULT_TEMPLATES.map((template) => `template:${template.key}`),
  );
  const templateKeys = new Set(AGENCY_DEFAULT_PAYLOAD.message_templates.map((template) => template.asset_key));
  for (const sequence of AGENCY_DEFAULT_PAYLOAD.sequences) {
    for (const step of sequence.steps) {
      assert.equal(templateKeys.has(step.template_asset_key), true);
    }
  }
});

test("education admissions snapshot is templates only", () => {
  assert.deepEqual(
    EDUCATION_PAYLOAD.pipelines[0].stages.map((stage) => stage.name),
    [...EDUCATION_STAGES],
  );
  assert.equal(EDUCATION_PAYLOAD.sequences[0].active, false);
  assert.deepEqual(
    [...new Set(EDUCATION_PAYLOAD.message_templates.map((template) => template.channel))],
    ["whatsapp"],
  );
  for (const template of EDUCATION_PAYLOAD.message_templates) {
    assert.match(template.body, /not sent/i);
  }
});

test("uuid asset keys are not phone numbers", () => {
  const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-123456789012";
  assert.deepEqual(
    collectPayloadIssues({
      asset_key: `sequence:${uuid}`,
      template_asset_key: "123456789012345",
      note: `see ${uuid}`,
      label: `sequence:${uuid}`,
    }),
    [],
  );
  assert.deepEqual(collectPayloadIssues({ body: "Call 0821234567 today" }), ["phone_number"]);
  assert.deepEqual(collectPayloadIssues({ body: `Call 0821234567 about ${uuid}` }), ["phone_number"]);
});

test("push update skips assets a client has edited", () => {
  const original = checksum(templateContent(EDUCATION_PAYLOAD.message_templates[0]));
  const incoming = checksum(templateContent({ ...EDUCATION_PAYLOAD.message_templates[0], body: "Agency rewrite" }));
  const edited = checksum(templateContent({ ...EDUCATION_PAYLOAD.message_templates[2], body: "Client rewrite" }));
  const report = planPush(
    [
      { assetKey: "template:admissions:enquiry", kind: "message_template", checksum: original, sourceChecksum: original },
      { assetKey: "template:admissions:docs", kind: "message_template", checksum: edited, sourceChecksum: original },
    ],
    [
      { assetKey: "template:admissions:enquiry", kind: "message_template", checksum: incoming, sourceChecksum: incoming },
      { assetKey: "template:admissions:docs", kind: "message_template", checksum: incoming, sourceChecksum: incoming },
      { assetKey: "template:admissions:accepted", kind: "message_template", checksum: "new", sourceChecksum: "new" },
    ],
  );
  assert.deepEqual(
    report.map((row) => [row.assetKey, row.result]),
    [
      ["template:admissions:enquiry", "updated"],
      ["template:admissions:docs", "skipped_client_edit"],
      ["template:admissions:accepted", "created"],
    ],
  );
});

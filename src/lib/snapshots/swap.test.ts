import assert from "node:assert/strict";
import test from "node:test";
import { AGENCY_DEFAULT_PAYLOAD, EDUCATION_PAYLOAD } from "@/lib/snapshots/catalog";
import { burgerJointProof, BURGER_BARN_SWAP, SECOND_JOINT_SWAP } from "@/lib/snapshots/fixture";
import { collectPayloadIssues } from "@/lib/snapshots/payload";
import { RESTAURANT_PAYLOAD } from "@/lib/snapshots/templates-v2";
import {
  applyBusinessSwap,
  duplicateIdempotencyKey,
  FIXTURE_DUPLICATE_COPY,
  leftoverBusinessTokens,
  normalizeSwap,
  validateSwap,
  workspaceTemplatesMode,
  WORKSPACE_TEMPLATES_FLAG,
} from "@/lib/snapshots/swap";

test("one restaurant template becomes two burger joints", () => {
  const proof = burgerJointProof();
  assert.equal(proof.barn.businessName, "Burger Barn");
  assert.equal(proof.second.businessName, "Second Joint");
  assert.deepEqual(proof.barn.stages, proof.second.stages);
  assert.deepEqual(
    proof.barn.stages,
    ["Enquiry", "Booking held", "Seated", "Review asked", "Regular", "Lost"],
  );
  assert.equal(proof.barn.services[0]?.name, "Classic burger");
  assert.equal(proof.second.services[0]?.name, "Smash burger");
  assert.equal(proof.barn.phone, BURGER_BARN_SWAP.phone);
  assert.equal(proof.second.email, SECOND_JOINT_SWAP.email);
  assert.match(proof.barn.templateExcerpt, /Burger Barn/);
  assert.match(proof.second.templateExcerpt, /Second Joint/);
  assert.equal(proof.barn.templateExcerpt.includes("{{business."), false);
  assert.equal(leftoverBusinessTokens(proof.barnPayload), false);
  assert.equal(leftoverBusinessTokens(proof.secondPayload), false);
  assert.equal(proof.barnKey === proof.secondKey, false);
  assert.equal(proof.barn.workflows.every((item) => item.active === false), true);
  assert.equal(proof.second.aiMode, "off");
  assert.deepEqual(proof.barn.agents, ["receptionist", "reminder-drafts", "review-replies", "social-posting", "offer-manager"]);
  assert.equal(proof.barnPayload.agent_team.charged, false);
  assert.equal(proof.barnPayload.agent_team.sandbox, true);
  assert.equal(proof.barnPayload.message_templates.every((item) => item.active === false), true);
  assert.equal(proof.barnPayload.message_templates.some((item) => item.channel === "sms"), true);
  assert.equal(proof.barnPayload.message_templates.some((item) => item.channel === "email"), true);
  assert.equal(proof.barnPayload.message_templates.some((item) => item.channel === "whatsapp"), true);
  assert.deepEqual(collectPayloadIssues(proof.barnPayload), []);
  assert.deepEqual(collectPayloadIssues(proof.secondPayload), []);
  assert.deepEqual(
    proof.barnPayload.pipelines[0].stages.map((stage) => stage.asset_key),
    proof.secondPayload.pipelines[0].stages.map((stage) => stage.asset_key),
  );
});

test("swap keeps catalogue asset keys and rejects a key", () => {
  const swapped = applyBusinessSwap(RESTAURANT_PAYLOAD, BURGER_BARN_SWAP);
  assert.equal(swapped.calendars[0].asset_key, "calendar:restaurant:tables");
  assert.equal(swapped.calendars[0].event_types[0].booking.slug_suffix, "table");
  assert.match(swapped.ai_knowledge.entries[2].body, /0100000001/);
  assert.match(swapped.ai_knowledge.entries[2].body, /hello@burger-barn\.example/);
  const bad = normalizeSwap({ ...BURGER_BARN_SWAP, logo_url: "https://example.com/?api_key=sk_live_abc" });
  assert.equal(validateSwap(bad).some((issue) => /key/i.test(issue)), true);
  assert.equal(validateSwap(normalizeSwap(BURGER_BARN_SWAP, RESTAURANT_PAYLOAD)).length, 0);
});

test("the same slug and source build one idempotency key", () => {
  const first = duplicateIdempotencyKey("snapshot", "a2c00000-0000-4000-8000-000000000003", "second-joint");
  const second = duplicateIdempotencyKey("snapshot", "a2c00000-0000-4000-8000-000000000003", "second-joint");
  assert.equal(first, second);
  assert.match(first, /^dup:snapshot:/);
});

test("agency default gains draft workflows and education stays version 1", () => {
  assert.equal(AGENCY_DEFAULT_PAYLOAD.version, 2);
  assert.equal(EDUCATION_PAYLOAD.version, 1);
  const drafts = AGENCY_DEFAULT_PAYLOAD.workflows.filter((item) => item.asset_key.startsWith("workflow:agency:"));
  assert.equal(drafts.length, 3);
  assert.equal(drafts.every((item) => item.active === false), true);
  assert.equal(JSON.stringify(drafts).includes("send_message"), false);
  assert.equal(AGENCY_DEFAULT_PAYLOAD.website.services.length > 0, true);
  assert.equal(AGENCY_DEFAULT_PAYLOAD.agent_team.charged, false);
});

test("the templates flag stays off unless it is the string true", () => {
  assert.equal(workspaceTemplatesMode({ tenantMode: "preview", env: { [WORKSPACE_TEMPLATES_FLAG]: "true" } }), "fixture");
  assert.equal(workspaceTemplatesMode({ tenantMode: "member", env: {} }), "fixture");
  assert.equal(workspaceTemplatesMode({ tenantMode: "member", env: { [WORKSPACE_TEMPLATES_FLAG]: "false" } }), "fixture");
  assert.equal(workspaceTemplatesMode({ tenantMode: "member", env: { [WORKSPACE_TEMPLATES_FLAG]: "true" }, forceFixture: true }), "fixture");
  assert.equal(workspaceTemplatesMode({ tenantMode: "member", env: { [WORKSPACE_TEMPLATES_FLAG]: "true" } }), "sandbox");
  assert.match(FIXTURE_DUPLICATE_COPY, /nothing is created/i);
});

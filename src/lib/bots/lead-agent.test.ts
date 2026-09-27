import assert from "node:assert/strict";
import test from "node:test";
import { AIOS_MENU } from "@/lib/aios-menu";
import { bundleBySlug } from "@/lib/bots/catalog";
import { replyToLeadAgent } from "@/lib/bots/lead-agent";

test("the Lead Agent opens every menu item and does not send", () => {
  for (const item of AIOS_MENU) {
    const reply = replyToLeadAgent(item.label);
    assert.ok(reply.links.some((link) => link.href === item.href), item.label);
    assert.equal(reply.recommendation, null);
    assert.match(reply.message, /Nothing is sent/);
  }
  const inbox = replyToLeadAgent("open the inbox");
  assert.equal(inbox.links[0]?.href, "/command-centre/inbox");
  const send = replyToLeadAgent("send the lead a message");
  assert.equal(send.recommendation, null);
  assert.equal(send.links.some((link) => link.href === "/command-centre/outbox"), true);
  assert.match(send.message, /Nothing is sent/);
});

test("the Lead Agent recommends a team without an API key", () => {
  const clinic = replyToLeadAgent("clinic");
  assert.equal(clinic.recommendation?.templateSlug, "healthcare-clinic");
  assert.equal(clinic.recommendation?.monthlyPriceCents, bundleBySlug("healthcare-clinic").bundlePriceCents);
  assert.deepEqual(clinic.recommendation?.agents.map((agent) => agent.slug), bundleBySlug("healthcare-clinic").botSlugs);
  const youtube = replyToLeadAgent("faceless youtube");
  assert.equal(youtube.recommendation?.templateSlug, "faceless-youtube");
  const clothing = replyToLeadAgent("clothing brand");
  assert.equal(clothing.recommendation?.templateSlug, "fashion-brand");
  const agency = replyToLeadAgent("ai agency");
  assert.equal(agency.recommendation?.templateSlug, "ai-automation-agency");
});

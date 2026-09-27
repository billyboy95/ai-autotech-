import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import { formatZar } from "@/lib/automation/ids";
import { answerHomeChat, emptySnapshot, fixtureSnapshot } from "@/lib/home-chat/engine";
import { homeChatDisplayMode, homeChatMode } from "@/lib/home-chat/flag";

test("home chat stays fixture-only until HOME_CHAT_ENABLED is true", () => {
  assert.equal(homeChatMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(homeChatMode({ HOME_CHAT_ENABLED: "" }), "fixture");
  assert.equal(homeChatMode({ HOME_CHAT_ENABLED: "false" }), "fixture");
  assert.equal(homeChatMode({ HOME_CHAT_ENABLED: "true" }), "sandbox");
  assert.equal(homeChatDisplayMode({ tenantMode: "preview", env: { HOME_CHAT_ENABLED: "true" } }), "fixture");
  assert.equal(homeChatDisplayMode({ tenantMode: "member", env: { HOME_CHAT_ENABLED: "true" } }), "sandbox");
  assert.equal(homeChatDisplayMode({ tenantMode: "member", env: {} }), "fixture");
});

test("the assistant looks up, summarises, drafts, and opens one page", () => {
  const snapshot = fixtureSnapshot();

  const ayesha = answerHomeChat("look up Ayesha Patel", snapshot);
  assert.equal(ayesha.matches[0]?.name, "Ayesha Patel");
  assert.equal(ayesha.matches[0]?.company, "Patel Logistics");
  assert.equal(ayesha.drafts.length, 0);
  assert.equal(ayesha.nextStep.href, "/command-centre/leads/lead-ayesha");
  assert.match(ayesha.message, /Nothing is sent/);

  const phone = answerHomeChat("find 0825550101", snapshot);
  assert.equal(phone.matches[0]?.name, "Thabo Ndlovu");

  const summary = answerHomeChat("summarise the pipeline", snapshot);
  assert.match(summary.message, /Pipeline value is/);
  assert.match(summary.message, new RegExp(formatZar(74500).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(summary.message, /Johan Botha/);
  assert.match(summary.message, /Nothing is sent/);
  assert.equal(summary.drafts.length, 0);
  assert.equal(summary.nextStep.href, "/command-centre/leads/lead-johan");

  const draft = answerHomeChat("draft a follow-up to Ayesha", snapshot);
  assert.equal(draft.drafts.length, 1);
  assert.equal(draft.drafts[0]?.status, "draft");
  assert.equal(draft.drafts[0]?.kind, "follow_up");
  assert.equal(draft.drafts[0]?.channel, "whatsapp");
  assert.match(draft.drafts[0]?.body ?? "", /AI AutoTech/);
  assert.match(draft.drafts[0]?.body ?? "", /Reply STOP to opt out/);
  assert.match(draft.message, /Nothing is sent/);
  assert.equal(draft.nextStep.href, "/command-centre/outbox");
  assert.equal(JSON.stringify(draft).includes('"status":"queued"'), false);
  assert.equal(JSON.stringify(draft).includes('"status":"sent"'), false);

  const email = answerHomeChat("draft an email follow-up to Thabo Ndlovu", snapshot);
  assert.equal(email.drafts[0]?.channel, "email");
  assert.equal(email.drafts[0]?.leadName, "Thabo Ndlovu");

  const unnamed = answerHomeChat("draft a follow-up", snapshot);
  assert.equal(unnamed.drafts[0]?.leadName, "Johan Botha");
  assert.equal(unnamed.drafts[0]?.status, "draft");

  const sendNow = answerHomeChat("send it now", snapshot);
  assert.equal(sendNow.drafts.length, 0);
  assert.match(sendNow.message, /Sending stays off/);
  assert.match(sendNow.message, /Nothing is sent/);

  const sendMessage = answerHomeChat("send a whatsapp to Ayesha Patel", snapshot);
  assert.equal(sendMessage.drafts.length, 1);
  assert.equal(sendMessage.drafts[0]?.status, "draft");
  assert.match(sendMessage.message, /Nothing is sent/);

  const task = answerHomeChat("create a task to call Johan Botha", snapshot);
  assert.equal(task.drafts[0]?.kind, "task");
  assert.equal(task.drafts[0]?.status, "draft");
  assert.equal(task.drafts[0]?.channel, "");
  assert.match(task.drafts[0]?.title ?? "", /Call Johan Botha/);
  assert.equal(task.nextStep.href, "/command-centre/leads/lead-johan");

  const pages: [string, string][] = [
    ["open the lead agent", "/command-centre/lead-agent"],
    ["build the full team for a clinic", "/command-centre/lead-agent"],
    ["connect accounts", "/command-centre/connect-accounts"],
    ["import contacts", "/command-centre/import-contacts"],
    ["open the agent store", "/command-centre/bots"],
    ["open billing", "/command-centre/billing"],
    ["open the pipeline", "/command-centre/pipeline"],
  ];
  for (const [phrase, href] of pages) {
    const reply = answerHomeChat(phrase, snapshot);
    assert.equal(reply.nextStep.href, href, phrase);
    assert.equal(reply.drafts.length, 0, phrase);
    assert.match(reply.message, /Nothing is sent/);
    assert.equal(reply.nextStep.label.length > 0, true);
  }

  const team = answerHomeChat("build the full team", snapshot);
  assert.match(team.message, /full team/i);
  assert.equal(PHASED_TEAM_COPY.test(team.message), false);

  const empty = answerHomeChat("summarise the pipeline", emptySnapshot());
  assert.equal(empty.nextStep.href, "/command-centre/import-contacts");
  assert.match(empty.message, /No leads/);

  const blank = answerHomeChat("  ", snapshot);
  assert.equal(blank.drafts.length, 0);
  assert.equal(blank.nextStep.href, "/command-centre/pipeline");
});

test("home chat copy does not phase the team or turn sending on", () => {
  const files = [
    "src/lib/home-chat/flag.ts",
    "src/lib/home-chat/engine.ts",
    "src/app/actions/home-chat.ts",
    "src/components/home-chat/panel.tsx",
    "src/app/command-centre/assistant/page.tsx",
    "docs/home-chat.md",
    "supabase/migrations/20261031120000_phase5d_home_chat.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
  }
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step24 = order.indexOf("24. `supabase/migrations/20261030120000_phase5c_connect_import.sql`");
  const step25 = order.indexOf("25. `supabase/migrations/20261031120000_phase5d_home_chat.sql`");
  assert.ok(step24 >= 0);
  assert.ok(step25 > step24);
});

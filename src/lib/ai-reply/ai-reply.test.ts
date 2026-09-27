import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { assessReplyConsent, latestChannelConsents } from "@/lib/ai-reply/consent";
import { cronSkipReason, draftEligibleForAutoQueue, planDraftApproval, prepareDraft } from "@/lib/ai-reply/plan";
import { buildReplyMessages } from "@/lib/ai-reply/prompt";
import { createOpenAiCompatibleProvider } from "@/lib/ai-reply/provider";
import { canManageAiReplies, DEFAULT_AI_REPLY_SETTINGS, parseAiReplySettings } from "@/lib/ai-reply/types";
import { windowExpiry } from "@/lib/inbox/rules";

const NOW = new Date("2026-10-15T10:00:00.000Z");

const optedIn = [{ channel: "whatsapp", purpose: "service", status: "opted_in" }];

function approvalBase(overrides: Record<string, unknown> = {}) {
  return {
    settings: { ...DEFAULT_AI_REPLY_SETTINGS, enabled: true, channels: [...DEFAULT_AI_REPLY_SETTINGS.channels] },
    sendingEnabled: false,
    consentOk: true,
    draftStatus: "pending_review",
    body: "Thanks, we can help with that.",
    now: NOW,
    channel: "whatsapp",
    toAddress: "+27825550101",
    conversationId: "conv-1",
    contactId: "contact-1",
    leadId: null,
    connectionId: null,
    userId: "user-1",
    senderName: "EASTC",
    windowExpiresAt: windowExpiry(NOW),
    template: null,
    suppressed: false,
    consent: "opted_in" as const,
    serviceSendsThisMonth: 0,
    ...overrides,
  };
}

test("conversation AI stays off and only an agency owner or client admin can change it", () => {
  const defaults = parseAiReplySettings(null);
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.mode, "draft_only");
  assert.equal(defaults.requireHumanBeforeSend, true);
  const parsed = parseAiReplySettings({
    enabled: false,
    mode: "queue_outbox",
    require_human_before_send: false,
    max_auto_per_hour: 5,
    channels: ["sms", "voice"],
    tone: "warm",
    system_prompt: "Be brief",
  });
  assert.equal(parsed.enabled, false);
  assert.equal(parsed.requireHumanBeforeSend, false);
  assert.deepEqual(parsed.channels, ["sms"]);
  assert.equal(canManageAiReplies("agency_owner"), true);
  assert.equal(canManageAiReplies("client_admin"), true);
  assert.equal(canManageAiReplies("agency_staff"), false);
  assert.equal(canManageAiReplies("client_user"), false);
  assert.equal(canManageAiReplies(null), false);
});

test("consent denial refuses a draft and does not call the provider", async () => {
  const stopped = assessReplyConsent({
    channel: "whatsapp",
    consents: latestChannelConsents(optedIn),
    suppressed: false,
    inboundStop: true,
  });
  assert.equal(stopped.ok, false);
  assert.match(stopped.reason, /STOP/);
  const missing = assessReplyConsent({
    channel: "sms",
    consents: [{ channel: "sms", status: "requested" }],
    suppressed: false,
    inboundStop: false,
  });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /no opt-in/);
  const optedOut = assessReplyConsent({
    channel: "email",
    consents: [
      { channel: "email", status: "opted_in" },
      { channel: "email", status: "opted_out" },
    ],
    suppressed: false,
    inboundStop: false,
  });
  assert.equal(optedOut.ok, false);
  let calls = 0;
  const prepared = await prepareDraft({
    settings: { ...DEFAULT_AI_REPLY_SETTINGS, enabled: true },
    channel: "whatsapp",
    consent: stopped,
    draftsLastHour: 0,
    hasInbound: true,
    provider: {
      model: "test",
      configured: () => true,
      complete: async () => {
        calls += 1;
        return { ok: true, text: "should not be used", model: "test" };
      },
    },
    contextMessages: [],
  });
  assert.equal(calls, 0);
  assert.equal(prepared.persist, true);
  assert.equal(prepared.consentOk, false);
  assert.equal(prepared.status, "failed");
  assert.equal(prepared.modelMeta.failure, "consent_denied");
  const approval = planDraftApproval(approvalBase({ consentOk: false, consent: "opted_out", suppressed: true }));
  assert.equal(approval.ok, false);
  assert.equal(approval.queue, false);
});

test("a missing provider key stores provider_unconfigured and does not call the network", async () => {
  let fetched = false;
  const provider = createOpenAiCompatibleProvider({}, async () => {
    fetched = true;
    throw new Error("network");
  });
  assert.equal(provider.configured(), false);
  const prepared = await prepareDraft({
    settings: { ...DEFAULT_AI_REPLY_SETTINGS, enabled: true },
    channel: "whatsapp",
    consent: { ok: true, reason: "" },
    draftsLastHour: 0,
    hasInbound: true,
    provider,
    contextMessages: [{ role: "user", content: "Hello" }],
  });
  assert.equal(fetched, false);
  assert.equal(prepared.persist, true);
  assert.equal(prepared.status, "failed");
  assert.equal(prepared.consentOk, true);
  assert.equal(prepared.modelMeta.failure, "provider_unconfigured");
  assert.match(prepared.notice, /AI_REPLY_API_KEY/);
});

test("approve queues a held outbox row and does not send when sending is off", () => {
  const queued = planDraftApproval(approvalBase({
    settings: { ...DEFAULT_AI_REPLY_SETTINGS, enabled: true, mode: "queue_outbox" },
    sendingEnabled: false,
  }));
  assert.equal(queued.ok, true);
  if (!queued.ok || !queued.queue) return;
  assert.equal(queued.draftStatus, "queued");
  assert.equal(queued.reply.outbox.status, "held");
  assert.notEqual(queued.reply.outbox.status, "sent");
  assert.notEqual(queued.reply.message.status, "sent");
  assert.match(queued.message, /nothing was delivered/i);

  const draftOnly = planDraftApproval(approvalBase());
  assert.equal(draftOnly.ok, true);
  assert.equal(draftOnly.queue, false);
  if (draftOnly.ok && !draftOnly.queue) assert.equal(draftOnly.draftStatus, "approved");

  const live = planDraftApproval(approvalBase({
    settings: { ...DEFAULT_AI_REPLY_SETTINGS, enabled: true, mode: "queue_outbox" },
    sendingEnabled: true,
  }));
  assert.equal(live.ok, true);
  if (!live.ok || !live.queue) return;
  assert.equal(live.reply.outbox.status, "queued");
  assert.notEqual(live.reply.message.status, "sent");
});

test("the cron stays off unless every gate is open", () => {
  assert.equal(cronSkipReason({}), "flag_off");
  assert.equal(cronSkipReason({ AI_REPLY_CRON_ENABLED: "false" }), "flag_off");
  assert.equal(cronSkipReason({ AI_REPLY_CRON_ENABLED: "true" }), null);
  const open = {
    settings: { ...DEFAULT_AI_REPLY_SETTINGS, enabled: true, mode: "queue_outbox" as const, requireHumanBeforeSend: false },
    draft: { status: "pending_review", consentOk: true },
  };
  assert.equal(draftEligibleForAutoQueue({ ...open, sendingEnabled: false }), false);
  assert.equal(draftEligibleForAutoQueue({ ...open, sendingEnabled: true, draft: { status: "pending_review", consentOk: false } }), false);
  assert.equal(draftEligibleForAutoQueue({
    ...open,
    sendingEnabled: true,
    settings: { ...open.settings, requireHumanBeforeSend: true },
  }), false);
  assert.equal(draftEligibleForAutoQueue({ ...open, sendingEnabled: true }), true);
});

test("the prompt keeps the last 12 messages and the source does not turn sending on", () => {
  const messages = Array.from({ length: 15 }, (_, index) => ({ direction: "in" as const, body: `token-${index}` }));
  const built = buildReplyMessages({
    settings: DEFAULT_AI_REPLY_SETTINGS,
    brandName: "EASTC",
    senderName: "EASTC",
    channel: "whatsapp",
    contactName: "Lerato",
    messages,
  });
  assert.equal(built[1].content.includes("token-2"), false);
  assert.match(built[1].content, /token-3/);
  assert.match(built[1].content, /token-14/);

  const root = new URL("../../..", import.meta.url);
  const files = [
    "supabase/migrations/20261021120000_phase3a_conversation_ai.sql",
    "src/app/actions/ai-reply.ts",
    "src/app/api/cron/ai-replies/route.ts",
    "src/server/workers/ai-reply-cron.ts",
    "src/app/command-centre/ai-replies/page.tsx",
    "src/components/ai-reply-settings-form.tsx",
    "src/components/inbox/ai-draft-panel.tsx",
  ];
  for (const name of readdirSync(new URL(".", import.meta.url))) {
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) files.push(`src/lib/ai-reply/${name}`);
  }
  for (const file of files) {
    const text = readFileSync(new URL(file, root), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/sendingEnabled\s*:\s*true/.test(text), false, file);
  }
});

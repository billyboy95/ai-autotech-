import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ReplyProvider } from "@/lib/ai-reply/provider";
import { agentMonthlyCents } from "@/lib/pricing/price-sheet";
import type { TryLinkState } from "@/lib/try-chat/access";
import { bookingReply, planSandboxBooking } from "@/lib/try-chat/booking";
import { handleTryMessage, tryChatDoesNotSend } from "@/lib/try-chat/handle";
import { guardTryReply, TRY_PRICE_REFUSAL } from "@/lib/try-chat/prices";
import { buildTryPrompt, TRY_BANNER, TRY_GO_LIVE_HREF } from "@/lib/try-chat/prompt";
import { createTryProvider, TRY_MAX_TOKENS, TRY_UNCONFIGURED_MESSAGE } from "@/lib/try-chat/provider";
import { TRY_RATE_MAX } from "@/lib/try-chat/rate";
import { seedBotConfig } from "@/lib/try-chat/seed";
import type { TryGrounding } from "@/lib/try-chat/prompt";
import type { SandboxBookingPlan } from "@/lib/try-chat/booking";
import type { SandboxLeadPlan } from "@/lib/try-chat/lead";
import type { TryStore } from "@/lib/try-chat/store";
import { hashTryToken, newTryToken, tryLinkPath } from "@/lib/try-chat/token";

const NOW = new Date("2026-10-24T10:00:00.000Z");
const ROOT = path.resolve(new URL("../../..", import.meta.url).pathname);

const grounding: TryGrounding = {
  orgName: "EASTC",
  botName: "Inbound Lead",
  botDescription: "Assigns a new lead and saves an AI reply draft. Nothing is sent.",
  config: {
    tone: "warm and plain",
    workingHours: { timezone: "Africa/Johannesburg", start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5] },
    pipeline: "pipeline:bot:sales-team",
    stage: "stage:bot:sales-team:new",
    channel: "whatsapp",
  },
  templateName: "Sales team",
  templateDescription: "Inbound, outbound, and onboarding.",
  industry: "education",
  department: "sales",
  capabilities: ["assign-lead", "ai-draft"],
};

function link(overrides: Partial<TryLinkState> = {}): TryLinkState {
  return {
    id: "link-1",
    orgId: "org-1",
    orgSlug: "eastc",
    tokenHash: hashTryToken("sandbox-token-value-0123456789"),
    expiresAt: "2026-10-31T00:00:00.000Z",
    revokedAt: null,
    maxMessages: 50,
    usedMessages: 0,
    ...overrides,
  };
}

function provider(text: string, configured = true): ReplyProvider & { calls: number } {
  const state = { calls: 0 };
  return {
    model: "test",
    get calls() {
      return state.calls;
    },
    configured: () => configured,
    complete: async () => {
      state.calls += 1;
      return { ok: true, text, model: "test" };
    },
  };
}

function memoryStore(state: TryLinkState) {
  const bookings: SandboxBookingPlan[] = [];
  const leads: SandboxLeadPlan[] = [];
  let current = { ...state };
  const store: TryStore = {
    async load({ tokenHash }) {
      if (tokenHash !== current.tokenHash) return null;
      return { link: current, grounding, history: [] };
    },
    async commit(input) {
      if (current.revokedAt) return { ok: false, code: "revoked", message: "This test link was revoked." };
      if (Date.parse(current.expiresAt) <= input.now.getTime()) {
        return { ok: false, code: "expired", message: "This test link has expired." };
      }
      if (current.usedMessages >= current.maxMessages) {
        return { ok: false, code: "capped", message: "This test chat has reached its message limit." };
      }
      if (input.booking) bookings.push(input.booking);
      if (input.lead) leads.push(input.lead);
      current = { ...current, usedMessages: current.usedMessages + 1 };
      return { ok: true, usedMessages: current.usedMessages };
    },
  };
  return { store, bookings, leads };
}

function ask(input: {
  state?: TryLinkState;
  text?: string;
  configured?: boolean;
  slug?: string;
  token?: string;
  ipHits?: number[];
  linkHits?: number[];
  message?: string;
}) {
  const state = input.state ?? link();
  const token = input.token ?? "sandbox-token-value-0123456789";
  const memory = memoryStore(state);
  const model = provider(input.text ?? "Hello from the test agent.", input.configured ?? true);
  return {
    memory,
    model,
    run: () => handleTryMessage({
      slug: input.slug ?? "eastc",
      token,
      tokenHash: hashTryToken(token),
      message: input.message ?? "Can you help?",
      now: NOW,
      ipHits: input.ipHits ?? [],
      linkHits: input.linkHits ?? [],
      store: memory.store,
      provider: model,
    }),
  };
}

test("a try token is stored as a hash and the public path carries the raw token once", () => {
  const token = newTryToken();
  const hashed = hashTryToken(token);
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, token);
  assert.match(tryLinkPath("eastc", token), /^\/try\/eastc\?t=/);
  assert.equal(tryLinkPath("eastc", token).includes(hashed), false);
});

test("token, expiry, revoke, slug, and the message cap gate the chat", async () => {
  const ok = await ask({}).run();
  assert.equal(ok.status, 200);
  assert.match(ok.body.reply, /Hello from the test agent/);

  const missing = await ask({ token: "different-token-value-0123456789" }).run();
  assert.equal(missing.status, 404);
  assert.match(missing.body.message, /not active/);

  const mismatch = await ask({ slug: "other-workspace" }).run();
  assert.equal(mismatch.status, 404);
  assert.match(mismatch.body.message, /not active/);

  const expired = await ask({ state: link({ expiresAt: "2026-10-01T00:00:00.000Z" }) }).run();
  assert.equal(expired.status, 410);
  assert.match(expired.body.message, /expired/);

  const revoked = await ask({ state: link({ revokedAt: "2026-10-20T00:00:00.000Z" }) }).run();
  assert.equal(revoked.status, 403);
  assert.match(revoked.body.message, /revoked/);

  const capped = ask({ state: link({ usedMessages: 50, maxMessages: 50 }) });
  const blocked = await capped.run();
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /message limit/);
  assert.equal(capped.model.calls, 0);
});

test("the try chat rate limit is 10 a minute per link and per IP", async () => {
  let linkHits: number[] = [];
  for (let index = 0; index < TRY_RATE_MAX; index += 1) {
    const turn = ask({ linkHits, ipHits: [] });
    const handled = await turn.run();
    assert.equal(handled.status, 200, String(index));
    linkHits = handled.linkHits;
  }
  const byLink = await ask({ linkHits, ipHits: [] }).run();
  assert.equal(byLink.status, 429);

  const fullIp = Array.from({ length: TRY_RATE_MAX }, () => NOW.getTime());
  const byIp = await ask({ ipHits: fullIp, linkHits: [] }).run();
  assert.equal(byIp.status, 429);
  assert.equal(byIp.body.reply, "");
});

test("an unconfigured try provider returns a graceful message and does not call the network", async () => {
  let called = false;
  const model = createTryProvider({}, async () => {
    called = true;
    throw new Error("network");
  });
  assert.equal(model.configured(), false);
  const direct = await model.complete([{ role: "user", content: "Hi" }]);
  assert.equal(called, false);
  assert.equal(direct.ok, false);
  if (!direct.ok) assert.equal(direct.message, TRY_UNCONFIGURED_MESSAGE);

  const memory = memoryStore(link());
  const handled = await handleTryMessage({
    slug: "eastc",
    token: "sandbox-token-value-0123456789",
    tokenHash: hashTryToken("sandbox-token-value-0123456789"),
    message: "Hello",
    now: NOW,
    ipHits: [],
    linkHits: [],
    store: memory.store,
    provider: model,
  });
  assert.equal(handled.status, 200);
  assert.equal(handled.body.reply, TRY_UNCONFIGURED_MESSAGE);
  assert.equal(called, false);
});

test("the try provider uses TRY_AI env vars and a max token cap", async () => {
  let captured = "";
  let auth = "";
  let url = "";
  const model = createTryProvider({
    TRY_AI_BASE_URL: "https://try-model.example/v1",
    TRY_AI_API_KEY: "try-key",
    TRY_AI_MODEL: "try-model",
    AI_REPLY_API_KEY: "inbox-key-should-not-be-used",
    AI_REPLY_MODEL: "gpt-4o-mini",
  }, async (input, init) => {
    url = String(input);
    auth = String((init?.headers as { Authorization?: string } | undefined)?.Authorization ?? "");
    captured = String(init?.body ?? "");
    return new Response(JSON.stringify({ choices: [{ message: { content: "Ready." } }] }), { status: 200 });
  });
  const result = await model.complete([{ role: "user", content: "Hi" }]);
  assert.equal(result.ok, true);
  assert.equal(url, "https://try-model.example/v1/chat/completions");
  assert.match(auth, /try-key/);
  assert.equal(auth.includes("inbox-key-should-not-be-used"), false);
  const body = JSON.parse(captured) as { model: string; max_tokens: number };
  assert.equal(body.model, "try-model");
  assert.equal(body.max_tokens, TRY_MAX_TOKENS);
});

test("the prompt is grounded in the template and replies cannot invent prices", () => {
  const prompt = buildTryPrompt({ grounding, history: [], message: "What does this cost?" });
  const text = prompt.map((item) => item.content).join("\n");
  const starterCents = agentMonthlyCents("outbound-sales", "sales");
  assert.match(text, /do not invent prices/i);
  assert.match(text, /Sales team/);
  assert.match(text, /warm and plain/);
  assert.ok(starterCents > 0);
  assert.equal(text.includes(String(starterCents)), false);
  assert.equal(/R\s?\d|ZAR\s?\d|69900|69,?900/.test(text), false);
  assert.equal(guardTryReply("The monthly fee is R699."), TRY_PRICE_REFUSAL);
  assert.equal(/R\s?\d/.test(guardTryReply("The monthly fee is R699.")), false);
  assert.equal(guardTryReply("We are open from 08:00."), "We are open from 08:00.");
});

test("sandbox booking and lead capture are the only tools", async () => {
  const booked = ask({
    text: JSON.stringify({ tool: "book", name: "Lerato", phone: "0825550101", email: "", when: "" }),
  });
  const booking = await booked.run();
  assert.equal(booking.status, 200);
  assert.equal(booking.body.tool, "book");
  assert.equal(booked.memory.bookings.length, 1);
  const plan = booked.memory.bookings[0];
  assert.equal(plan?.sandbox, true);
  assert.equal(plan?.calendarName, "TEST");
  assert.equal(plan?.label, "TEST");
  assert.equal(plan?.locationDetail, "TEST");
  assert.match(booking.body.reply, /TEST/);
  assert.equal(/R\s?\d|ZAR\s?\d/.test(booking.body.reply), false);
  assert.equal(booked.memory.leads.length, 0);

  const captured = ask({
    text: JSON.stringify({ tool: "capture_lead", name: "Lerato", phone: "0825550101", company: "Ndlovu Dental", note: "Wants a callback" }),
  });
  const lead = await captured.run();
  assert.equal(lead.body.tool, "capture_lead");
  assert.equal(captured.memory.leads[0]?.source, "bot-try");
  assert.equal(captured.memory.leads[0]?.marketingConsent, false);
  assert.equal(captured.memory.leads[0]?.enrolled, false);
  assert.equal(captured.memory.leads[0]?.valueZar, 0);
  assert.match(captured.memory.leads[0]?.notes ?? "", /TEST/);

  for (const tool of ["send_whatsapp", "send_email", "send_sms", "payfast"]) {
    const refused = ask({ text: JSON.stringify({ tool, name: "Lerato" }) });
    const handled = await refused.run();
    assert.match(handled.body.reply, /not available in test mode/);
    assert.equal(refused.memory.bookings.length, 0);
    assert.equal(refused.memory.leads.length, 0);
  }

  const direct = planSandboxBooking({ name: "Lerato", phone: "", email: "", when: "", now: NOW });
  assert.equal(direct.ok, true);
  if (direct.ok) {
    assert.equal(direct.plan.sandbox, true);
    assert.match(bookingReply(direct.plan), /No confirmation was sent/);
  }
});

test("a missing channel opt-in still cannot send from the try chat", () => {
  const gate = tryChatDoesNotSend();
  assert.equal(gate.sends, false);
  assert.equal(gate.consentOk, false);
});

test("org bot config is seeded from the template payload", () => {
  const seeded = seedBotConfig({
    botSlug: "inbound-lead",
    templates: [
      { slug: "z-later", payload: { bots: [{ slug: "inbound-lead", config: { tone: "later" } }] } },
      { slug: "a-first", payload: { bots: [{ slug: "inbound-lead", config: { tone: "from template", workingHours: { start: "09:00" } } }] } },
    ],
    fallback: grounding.config,
  });
  assert.equal(seeded.templateSlug, "a-first");
  assert.equal(seeded.config.tone, "from template");
  assert.equal(seeded.config.workingHours.start, "09:00");
  assert.equal(seeded.config.workingHours.end, "17:00");
  const untouched = seedBotConfig({ botSlug: "missing", templates: [], fallback: grounding.config });
  assert.equal(untouched.templateSlug, null);
  assert.equal(untouched.config.tone, "warm and plain");
});

test("the try path does not import senders or PayFast", () => {
  const forbidden = [
    "src/lib/automation/send.ts",
    "src/lib/payfast/",
    "src/lib/billing/payfast.ts",
    "src/server/workers/funnel.ts",
    "api.whatsapp",
    "graph.facebook",
    "api.resend.com",
    "payfast.co.za",
  ];
  const seeds = [
    "src/app/api/public/try/[slug]/route.ts",
    "src/app/try/[slug]/page.tsx",
    "src/components/try-chat/chat.tsx",
    "src/server/workers/try-chat.ts",
    "src/app/actions/try-chat.ts",
    "src/lib/try-chat/handle.ts",
  ];
  const seen = new Set<string>();
  const queue = seeds.map((file) => path.join(ROOT, file));
  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const item of forbidden) assert.equal(text.includes(item), false, `${file} contains ${item}`);
    for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = match[1];
      let resolved = "";
      if (spec.startsWith("@/")) resolved = path.join(ROOT, "src", spec.slice(2));
      else if (spec.startsWith(".")) resolved = path.resolve(path.dirname(file), spec);
      else continue;
      const found = [resolved, `${resolved}.ts`, `${resolved}.tsx`, path.join(resolved, "index.ts"), path.join(resolved, "index.tsx")]
        .find((candidate) => existsSync(candidate));
      if (found) queue.push(found);
    }
  }
  assert.ok(seen.size > 8);
  const page = readFileSync(path.join(ROOT, "src/app/try/[slug]/page.tsx"), "utf8");
  const chat = readFileSync(path.join(ROOT, "src/components/try-chat/chat.tsx"), "utf8");
  assert.match(page, /index: false/);
  assert.match(chat, /TRY_BANNER/);
  assert.equal(TRY_BANNER, "Test mode. No real messages or payments.");
  assert.equal(TRY_GO_LIVE_HREF, "/command-centre/setup");
  const sql = readFileSync(path.join(ROOT, "supabase/migrations/20261116120000_bot_try_links.sql"), "utf8");
  assert.equal(/payfast|crm_outbox|sending_enabled\s*=\s*true/i.test(sql), false);
  assert.match(sql, /purge_bot_try_messages/);
  assert.match(sql, /calendars add column if not exists sandbox/);
  assert.match(sql, /revoke all on table public\.bot_try_links/);
});

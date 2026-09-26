import assert from "node:assert/strict";
import test from "node:test";
import { assignOwner } from "@/lib/automation/assign";
import { deliverMessage } from "@/lib/automation/send";
import { flushOutbox } from "@/lib/automation/flush";
import { captureLead, createInitialState, runCron } from "@/lib/automation/engine";
import { buildReport } from "@/lib/automation/report";
import { proveAutomation } from "@/lib/automation/scenario";
import { scoreLead } from "@/lib/automation/score";
import { DEFAULT_SETTINGS } from "@/lib/automation/types";

test("automation runs from new lead through handover without sending", () => {
  const { log, state } = proveAutomation();
  assert.ok(log.length >= 10);
  const thabo = state.leads.find((lead) => lead.id === "lead-thabo");
  assert.equal(thabo?.stage, "Onboarding/Handover");
  assert.ok(state.activities.some((item) => item.leadId === "lead-thabo" && item.kind === "assigned"));
  assert.ok(state.activities.some((item) => item.leadId === "lead-thabo" && item.kind === "stage"));
});

test("round-robin walks the team when no rule matches", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    strategy: "round_robin" as const,
    team: ["Billy", "Ayesha"],
    rules: [],
    roundRobinIndex: 0,
  };
  const first = assignOwner(settings, { source: "website_contact", qrSource: "" });
  const second = assignOwner(first.settings, { source: "website_contact", qrSource: "" });
  assert.equal(first.owner, "Billy");
  assert.equal(second.owner, "Ayesha");
  assert.match(first.reason, /Round-robin/);
});

test("QR rule outranks round-robin", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    strategy: "round_robin" as const,
    team: ["Ayesha", "Billy"],
    roundRobinIndex: 0,
  };
  const assigned = assignOwner(settings, { source: "highlevel_event", qrSource: "billy_phone_qr" });
  assert.equal(assigned.owner, "Billy");
  assert.equal(assigned.settings.roundRobinIndex, 0);
});

test("score rises for event QR, team size, and audit pain", () => {
  const cold = scoreLead({ source: "website_contact", phone: "0820000000" });
  const hot = scoreLead({
    source: "highlevel_event",
    qrSource: "billy_phone_qr",
    companySize: "80",
    phone: "0820000000",
    website: "https://example.co.za",
    answers: { pain: "manual whatsapp follow-up" },
    recommendations: [{}, {}, {}],
  });
  assert.ok(hot.score > cold.score);
  assert.ok(hot.score >= 60);
});

test("flush does not call the provider while sending is off", async () => {
  let calls = 0;
  const captured = captureLead(
    createInitialState(),
    { id: "lead-1", name: "Amina", phone: "0820000001", email: "amina@example.co.za", source: "website_contact" },
    new Date("2026-09-26T08:00:00.000Z"),
  );
  const flushed = await flushOutbox(captured, new Date("2026-09-26T08:00:00.000Z"), { AUTOMATION_SEND_ENABLED: "false" }, async () => {
    calls += 1;
    return { status: "sent", provider: "resend", providerId: "x", waLink: "", error: "" };
  });
  assert.equal(calls, 0);
  assert.ok(flushed.outbox.every((message) => message.status === "queued"));
});

test("deliverMessage does not call fetch when sending is off", async () => {
  let calls = 0;
  const result = await deliverMessage(
    { channel: "email", to: "person@example.co.za", subject: "Hi", body: "Hello" },
    { AUTOMATION_SEND_ENABLED: "false", RESEND_API_KEY: "re_test" },
    async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.status, "queued");
  assert.equal(result.provider, "outbox");
});

test("daily report counts new leads in Johannesburg", () => {
  const now = new Date("2026-09-26T10:00:00.000Z");
  let state = createInitialState();
  state = captureLead(state, { id: "today", name: "Nomsa", phone: "0820000002", source: "website_contact" }, now);
  state = runCron(state, now);
  const report = buildReport(state, now, false);
  assert.equal(report.date, "2026-09-26");
  assert.equal(report.newToday, 1);
  assert.equal(report.sendingEnabled, false);
  assert.ok(report.perStage.some((row) => row.stage === "Contacted" && row.count === 1));
});

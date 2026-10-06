import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LEAD_ONBOARDING_INTRO } from "@/lib/bots/onboarding";
import { isSalesAgentsEnabled, salesAgentsDisplayMode } from "@/lib/sales-agents/flag";
import {
  RESULT_PLACEHOLDER,
  channelSnapshots,
  decideDraft,
  planAuditFollowUp,
  planBookingReminders,
  planDailySummary,
  planOnboarding,
  planStalledLead,
  planStop,
} from "@/lib/sales-agents/plan";
import { runSalesAgentCron } from "@/server/workers/sales-agents";

const NOW = new Date("2026-10-06T08:00:00.000Z");
const AUDIT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const whatsapp = {
  channel: "whatsapp" as const,
  address: "0820000000",
  status: "opted_in" as const,
  suppressed: false,
  basis: "consent" as const,
  serviceConsent: true,
};
const email = {
  channel: "email" as const,
  address: "lesego@prospect.example",
  status: "none" as const,
  suppressed: false,
  basis: null,
  serviceConsent: false,
};

function followUp() {
  return planAuditFollowUp({
    now: NOW,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego Dlamini",
    company: "Ndlovu Dental",
    leadId: "lead-1",
    auditLeadId: AUDIT,
    reportPath: "/team/preview-audit",
    bookingUrl: "https://aiautotech.co.za/book/",
    channels: [whatsapp, email],
    trigger: "audit_arrived",
  });
}

test("the sales agent flag is off unless it is exactly true", async () => {
  assert.equal(isSalesAgentsEnabled({}), false);
  assert.equal(isSalesAgentsEnabled({ SALES_AGENTS_ENABLED: "false" }), false);
  assert.equal(isSalesAgentsEnabled({ SALES_AGENTS_ENABLED: " true " }), true);
  assert.equal(salesAgentsDisplayMode({ tenantMode: "preview", env: { SALES_AGENTS_ENABLED: "true" } }), "fixture");
  assert.equal(salesAgentsDisplayMode({ tenantMode: "member", env: {} }), "fixture");
  const cron = await runSalesAgentCron(NOW, {});
  assert.equal(cron.stored, 0);
  assert.equal(cron.sent, false);
  assert.equal(cron.skipped, true);
});

test("an audit lead gets a consent-checked draft sequence and never a send", () => {
  const plan = followUp();
  assert.equal(plan.willSend, false);
  assert.equal(plan.sendingEnabled, false);
  const whatsappDrafts = plan.drafts.filter((item) => item.channel === "whatsapp");
  assert.deepEqual(whatsappDrafts.map((item) => item.step), ["day0", "day2", "day5"]);
  assert.equal(whatsappDrafts.every((item) => item.status === "draft"), true);
  assert.match(whatsappDrafts[0]?.body || "", /\/team\/preview-audit/);
  assert.match(whatsappDrafts[0]?.body || "", new RegExp(RESULT_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal((whatsappDrafts[0]?.body || "").split("reply STOP to opt out").length - 1, 1);
  const skipped = plan.drafts.filter((item) => item.channel === "email");
  assert.equal(skipped.every((item) => item.status === "skipped"), true);
  assert.match(skipped[0]?.skipReason || "", /No marketing consent for email|Marketing needs opt-in/);
  const sms = plan.drafts.find((item) => item.channel === "sms");
  assert.match(sms?.skipReason || "", /No SMS address/);
  assert.equal(plan.drafts.some((item) => item.status === "approved"), false);
  assert.equal(plan.notices.some((item) => item.kind === "audit"), true);
  assert.equal(plan.notices.some((item) => item.kind === "approval"), true);
  const banned = /\b\d+\s*%|\bR\s?\d|\btestimonial\b|\bguaranteed\b/i;
  assert.equal(plan.drafts.some((item) => banned.test(item.body)), false);
});

test("a report approval refreshes the day 0 draft with the report link", () => {
  const plan = planAuditFollowUp({
    now: NOW,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego Dlamini",
    company: "Ndlovu Dental",
    leadId: "lead-1",
    auditLeadId: AUDIT,
    reportPath: "/team/approved-token",
    bookingUrl: "https://aiautotech.co.za/book/",
    channels: [whatsapp],
    trigger: "report_approved",
    existingKeys: ["whatsapp", "email", "sms"].flatMap((channel) =>
      ["day0", "day2", "day5"].map((step) => `follow_up:${AUDIT}:${step}:${channel}`),
    ),
  });
  assert.deepEqual(plan.drafts.map((item) => `${item.step}:${item.channel}`), ["day0:whatsapp", "day0:email", "day0:sms"]);
  assert.match(plan.drafts[0]?.body || "", /\/team\/approved-token/);
});

test("booking, reply, and opt-out stop the follow-up", () => {
  for (const stopReason of ["booking", "reply", "opt_out"] as const) {
    const plan = planStop({
      sendingEnabled: false,
      name: "Lesego Dlamini",
      company: "Ndlovu Dental",
      leadId: "lead-1",
      auditLeadId: AUDIT,
      stopReason,
    });
    assert.equal(plan.cancelPending, true);
    assert.equal(plan.sequence?.status, "stopped");
    assert.equal(plan.drafts.length, 0);
    assert.equal(plan.willSend, false);
  }
});

test("booked results calls draft 24h and 1h reminders and skip a missed slot", () => {
  const starts = new Date(NOW.getTime() + 26 * 60 * 60 * 1000);
  const plan = planBookingReminders({
    now: NOW,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego Dlamini",
    company: "Ndlovu Dental",
    leadId: "lead-1",
    appointmentId: "appt-1",
    startsAt: starts.toISOString(),
    channels: [whatsapp, email],
    consentAccepted: true,
  });
  const queued = plan.drafts.filter((item) => item.channel === "whatsapp" && item.status === "draft");
  assert.deepEqual(queued.map((item) => item.step), ["reminder_24h", "reminder_1h"]);
  assert.equal(new Date(queued[0]?.scheduledFor || "").toISOString(), new Date(starts.getTime() - 24 * 60 * 60 * 1000).toISOString());
  assert.equal(new Date(queued[1]?.scheduledFor || "").toISOString(), new Date(starts.getTime() - 60 * 60 * 1000).toISOString());
  const soon = planBookingReminders({
    now: NOW,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego",
    company: "",
    leadId: "lead-1",
    appointmentId: "appt-2",
    startsAt: new Date(NOW.getTime() + 30 * 60 * 1000).toISOString(),
    channels: [whatsapp],
    consentAccepted: true,
  });
  assert.equal(soon.drafts.every((item) => item.status === "skipped"), true);
  assert.match(soon.drafts[0]?.skipReason || "", /passed/);
  const noConsent = planBookingReminders({
    now: NOW,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego",
    company: "",
    leadId: "lead-1",
    appointmentId: "appt-3",
    startsAt: starts.toISOString(),
    channels: [email],
    consentAccepted: false,
  });
  const emailReminder = noConsent.drafts.find((item) => item.channel === "email");
  assert.equal(emailReminder?.status, "skipped");
  assert.match(emailReminder?.skipReason || "", /consent/i);
});

test("a won deal opens the onboarding checklist and a welcome draft", () => {
  const plan = planOnboarding({
    now: NOW,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego Dlamini",
    company: "Ndlovu Dental",
    leadId: "lead-1",
    sourceKey: "deal_won:lead-1",
    trigger: "deal_won",
    bookingUrl: "https://aiautotech.co.za/book/",
    channels: [whatsapp, email],
    profile: { niche: "clinic", goals: ["leads"], channels: ["whatsapp"], hours: "8-5", tools: "WhatsApp" },
  });
  assert.deepEqual(plan.onboarding?.items.map((item) => item.key), ["connect_accounts", "import_contacts", "apply_template", "book_kickoff"]);
  assert.match(plan.onboarding?.items[2]?.detail || "", /healthcare-clinic/);
  const welcome = plan.drafts.find((item) => item.channel === "whatsapp");
  assert.equal(welcome?.status, "draft");
  assert.match(welcome?.body || "", new RegExp(LEAD_ONBOARDING_INTRO.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(welcome?.body || "", /\[ADD REAL RESULT\]/);
  assert.equal(plan.drafts.find((item) => item.channel === "email")?.status, "skipped");
  assert.equal(plan.willSend, false);
});

test("service consent does not unlock a marketing follow-up", () => {
  const channels = channelSnapshots({
    phone: "0820000000",
    email: "lesego@prospect.example",
    consents: [{ channel: "whatsapp", purpose: "service", status: "opted_in", basis: "consent", address: "0820000000" }],
    suppressions: [],
    formConsent: { accepted: true, text: "I agree that this workspace may store my details to book this call." },
  });
  const plan = planAuditFollowUp({
    now: NOW,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego",
    company: "Ndlovu Dental",
    leadId: "lead-1",
    auditLeadId: AUDIT,
    reportPath: "",
    bookingUrl: "https://aiautotech.co.za/book/",
    channels,
    trigger: "audit_arrived",
  });
  assert.equal(plan.drafts.filter((item) => item.channel === "whatsapp").every((item) => item.status === "skipped"), true);
});

test("opt-out blocks every channel", () => {
  const channels = channelSnapshots({
    phone: "0820000000",
    email: "",
    consents: [],
    suppressions: [{ channel: "whatsapp", address: "0820000000" }],
    formConsent: { accepted: true, text: "I consent to marketing by WhatsApp." },
  });
  assert.equal(channels.find((item) => item.channel === "whatsapp")?.status, "opted_out");
});

test("approve queues the outbox and reject or a skipped channel does not", () => {
  const approved = decideDraft({
    status: "draft",
    skipReason: "",
    body: "Hi Lesego",
    action: "approve",
    channel: "whatsapp",
    toAddress: "0820000000",
    subject: "Audit",
    leadId: "lead-1",
    step: "day0",
    scheduledFor: NOW.toISOString(),
    purpose: "marketing",
  });
  assert.equal(approved.status, "approved");
  assert.equal(approved.outbox?.status, "queued");
  assert.equal(approved.outbox?.sentAt, null);
  assert.equal(approved.outbox?.willSend, false);
  const rejected = decideDraft({ ...approved, status: "draft", action: "reject", outbox: undefined } as never);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.outbox, null);
  const skipped = decideDraft({
    status: "skipped",
    skipReason: "No marketing consent for email.",
    body: "",
    action: "approve",
    channel: "email",
    toAddress: "lesego@prospect.example",
    subject: "",
    leadId: "lead-1",
    step: "day0",
    scheduledFor: NOW.toISOString(),
    purpose: "marketing",
  });
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.outbox, null);
});

test("stalled leads and the daily summary are owner notices", () => {
  const stalled = planStalledLead({
    now: NOW,
    name: "Lesego",
    company: "Ndlovu Dental",
    leadId: "lead-1",
    auditLeadId: AUDIT,
    day5DueAt: new Date(NOW.getTime() - 60_000).toISOString(),
    stopped: false,
  });
  assert.equal(stalled?.kind, "stalled");
  assert.equal(planStalledLead({
    now: NOW,
    name: "Lesego",
    company: "",
    leadId: "lead-1",
    auditLeadId: AUDIT,
    day5DueAt: new Date(NOW.getTime() + 60_000).toISOString(),
    stopped: false,
  }), null);
  const summary = planDailySummary({ now: NOW, leadsIn: 2, draftsWaiting: 4, callsBooked: 1, won: 1 });
  assert.match(summary.body, /Leads in: 2/);
  assert.match(summary.body, /Drafts waiting: 4/);
  assert.match(summary.body, /Calls booked: 1/);
  assert.match(summary.body, /Won: 1/);
  assert.equal(summary.kind, "summary");
});

test("the queue, migration, and worker do not turn sending on", () => {
  const files = [
    "src/lib/sales-agents/plan.ts",
    "src/lib/sales-agents/flag.ts",
    "src/lib/sales-agents/load.ts",
    "src/lib/sales-agents/preview.ts",
    "src/server/workers/sales-agents.ts",
    "src/app/actions/sales-agents.ts",
    "src/app/command-centre/approvals/page.tsx",
    "src/components/sales-agents/approval-queue.tsx",
    "src/app/api/cron/sales-agents/route.ts",
    "supabase/migrations/20261112140000_phase5q_sales_agents.sql",
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/deliverMessage|api\.resend\.com/i.test(text), false, file);
  }
  const page = readFileSync("src/components/sales-agents/approval-queue.tsx", "utf8");
  assert.match(page, /max-w-\[390px\]/);
  assert.match(page, /h-12 w-full/);
  const sql = readFileSync("supabase/migrations/20261112140000_phase5q_sales_agents.sql", "utf8");
  assert.match(sql, /force row level security/);
  assert.match(sql, /'queued'/);
  assert.equal(/status',\s*'sent'/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
});

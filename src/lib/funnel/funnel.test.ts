import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createWorkflowStore, emitEvent, enqueueEvent, pump } from "@/lib/workflows/runner";
import { createInitialState } from "@/lib/automation/engine";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import { RESULTS_CALL_FALLBACK, pickBookingSlug, resultsCallHref } from "@/lib/funnel/booking-link";
import { handlePublicCapture, shouldNotifyContact } from "@/lib/funnel/capture";
import { isSalesFunnelEnabled, salesFunnelDisplayMode } from "@/lib/funnel/flag";
import { draftsFromNotifyMemory, planOwnerAlert } from "@/lib/funnel/notify";
import { acceptPolish, buildAuditReport, numbersIn, sourceFacts } from "@/lib/funnel/report";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const AUDIT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const auditInput = {
  kind: "audit" as const,
  orgId: ORG,
  sourceId: AUDIT,
  leadId: "lead_audit_1",
  name: "Lesego Dlamini",
  company: "Ndlovu Dental",
  phone: "0820000000",
  leadEmail: "lesego@prospect.example",
  detail: "AAT-SAMPLE",
  audit: {
    company: "Ndlovu Dental",
    industry: "clinic",
    website: "",
    answers: { response_time: "WhatsApp sits until morning" },
    score: { readiness: "Early", total: 42 },
    recommendations: [
      {
        agent: "WhatsApp receptionist",
        problem: "New enquiries sit unanswered overnight",
        hours: "4 hours a week",
        hoursAssumption: "The practice typed this into the audit",
      },
    ],
    recommendedAgents: [{ department: "booking", agent: "WhatsApp receptionist", count: 1 }],
  },
};

function deps(enabled: boolean) {
  const notifications: { kind: string; dedupeKey: string; body: string; title: string }[] = [];
  const reports: { narrative: string; polished: boolean; sections: { id: string; body: string }[] }[] = [];
  const alerts: { sent: boolean; to?: string[] }[] = [];
  let fetches = 0;
  return {
    notifications,
    reports,
    alerts,
    fetches: () => fetches,
    capture: {
      env: enabled
        ? { SALES_FUNNEL_ENABLED: "true", OWNER_EMAILS: "billyfaber06@gmail.com" }
        : { OWNER_EMAILS: "billyfaber06@gmail.com" },
      resultsCallUrl: async () => RESULTS_CALL_FALLBACK,
      insertNotification: async (row: { kind: string; dedupeKey: string; body: string; title: string }) => {
        notifications.push(row);
        return { id: "note-1" };
      },
      insertReport: async (row: { narrative: string; polished: boolean; sections: { id: string; body: string }[] }) => {
        reports.push(row);
        return { id: "report-1" };
      },
      deliverAlert: async (plan: { deliver: boolean; to?: string[] }) => {
        fetches += 1;
        alerts.push({ sent: plan.deliver, to: plan.to });
        return { sent: false, reason: "provider_unset" };
      },
    },
  };
}

test("the sales funnel flag is off unless it is exactly true", () => {
  assert.equal(isSalesFunnelEnabled({}), false);
  assert.equal(isSalesFunnelEnabled({ SALES_FUNNEL_ENABLED: "false" }), false);
  assert.equal(isSalesFunnelEnabled({ SALES_FUNNEL_ENABLED: " true " }), true);
  assert.equal(salesFunnelDisplayMode({ tenantMode: "preview", env: { SALES_FUNNEL_ENABLED: "true" } }), "fixture");
  assert.equal(salesFunnelDisplayMode({ tenantMode: "member", env: {} }), "fixture");
  assert.equal(salesFunnelDisplayMode({ tenantMode: "member", env: { SALES_FUNNEL_ENABLED: "true" } }), "live");
});

test("public audit capture notifies the owner and drafts a report without emailing the lead", async () => {
  const off = deps(false);
  const skipped = await handlePublicCapture(auditInput, off.capture);
  assert.equal(skipped.skipped, true);
  assert.equal(off.notifications.length, 0);
  assert.equal(off.reports.length, 0);
  assert.equal(off.fetches(), 0);

  const on = deps(true);
  const saved = await handlePublicCapture(auditInput, on.capture);
  assert.equal(saved.skipped, false);
  assert.equal(saved.alertSent, false);
  assert.equal(saved.alertReason, "provider_unset");
  assert.equal(saved.resultsCallUrl, RESULTS_CALL_FALLBACK);
  assert.equal(on.notifications.length, 1);
  assert.equal(on.notifications[0].kind, "audit");
  assert.equal(on.notifications[0].dedupeKey, `audit:${AUDIT}`);
  assert.match(on.notifications[0].body, /Nothing is sent to the lead/);
  assert.equal(on.notifications[0].body.includes("lesego@prospect.example"), false);
  assert.equal(on.reports.length, 1);
  assert.equal(on.reports[0].polished, false);
  assert.match(on.reports[0].sections.find((section) => section.id === "impact")?.body || "", /4 hours a week/);
  assert.equal(on.fetches(), 0);

  const again = await handlePublicCapture(auditInput, on.capture);
  assert.equal(again.notificationId, "note-1");
  assert.equal(on.notifications[1].dedupeKey, on.notifications[0].dedupeKey);
});

test("public contact and booking captures notify, and a TEST contact does not", async () => {
  const on = deps(true);
  const contact = await handlePublicCapture(
    {
      kind: "contact",
      orgId: ORG,
      sourceId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      leadId: "lead_contact_1",
      name: "Thabo Ndlovu",
      company: "Ndlovu Dental",
      phone: "",
      leadEmail: "thabo@prospect.example",
    },
    on.capture,
  );
  assert.equal(contact.skipped, false);
  assert.equal(on.notifications[0].kind, "contact");
  assert.equal(on.reports.length, 0);

  const booking = await handlePublicCapture(
    {
      kind: "booking",
      orgId: ORG,
      sourceId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      leadId: "lead_book_1",
      name: "Thabo Ndlovu",
      company: "",
      phone: "0820000000",
      leadEmail: "thabo@prospect.example",
    },
    on.capture,
  );
  assert.equal(booking.skipped, false);
  assert.equal(on.notifications[1].kind, "booking");
  assert.match(on.notifications[1].body, /wa\.me/);

  assert.equal(shouldNotifyContact("TEST QA", "qa@aiautotech.co.za"), false);
  const hidden = await handlePublicCapture(
    {
      kind: "contact",
      orgId: ORG,
      sourceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      leadId: "lead_test",
      name: "TEST QA",
      company: "",
      phone: "",
      leadEmail: "qa@aiautotech.co.za",
    },
    on.capture,
  );
  assert.equal(hidden.skipped, true);
  assert.equal(on.notifications.length, 2);
});

test("the public routes call the capture helper and do not email the lead", () => {
  const audit = readFileSync(new URL("../../app/api/public/audit/route.ts", import.meta.url), "utf8");
  const contact = readFileSync(new URL("../../app/api/public/contact/route.ts", import.meta.url), "utf8");
  const booking = readFileSync(new URL("../../app/actions/booking.ts", import.meta.url), "utf8");
  assert.match(audit, /notifyPublicCapture/);
  assert.match(audit, /kind: "audit"/);
  assert.match(contact, /notifyPublicCapture/);
  assert.match(contact, /kind: "contact"/);
  assert.match(booking, /notifyPublicCapture/);
  assert.match(booking, /kind: "booking"/);
  for (const source of [audit, contact, booking]) {
    assert.equal(/crm_outbox/.test(source), false);
    assert.equal(/sending_enabled\s*=\s*true/.test(source), false);
  }
});

test("a report copies submitted figures and does not invent statistics", () => {
  const draft = buildAuditReport(auditInput.audit);
  const facts = sourceFacts(draft);
  assert.match(facts, /42/);
  assert.match(facts, /4 hours a week/);
  assert.match(facts, /WhatsApp receptionist/);
  assert.equal(facts.includes("%"), false);
  assert.equal(/R\s?\d/.test(facts), false);
  assert.equal(facts.includes("@"), false);
  assert.equal(facts.includes("lesego"), false);

  const empty = buildAuditReport({
    company: "Quiet Co",
    industry: "",
    website: "",
    answers: {},
    score: {},
    recommendations: [],
    recommendedAgents: [],
  });
  const emptyFacts = sourceFacts(empty);
  assert.match(emptyFacts, /does not estimate one/);
  assert.match(emptyFacts, /did not name an AIOS agent/);
  assert.equal(numbersIn(emptyFacts).size, 0);
  assert.equal(acceptPolish(facts, "Clearer wording about the same 4 hours a week and score 42."), "Clearer wording about the same 4 hours a week and score 42.");
  assert.equal(acceptPolish(facts, "This will save 30% and R15000 a month."), null);
  assert.equal(acceptPolish(facts, "Mail the lead at lesego@prospect.example"), null);
});

test("owner alert email is a no-op until the provider env is set, and never uses the lead address", () => {
  const unset = planOwnerAlert({ OWNER_EMAILS: "billyfaber06@gmail.com" }, {
    title: "New audit",
    body: "Internal",
    leadEmail: "lesego@prospect.example",
  });
  assert.equal(unset.deliver, false);
  if (!unset.deliver) assert.equal(unset.reason, "provider_unset");

  const ready = planOwnerAlert(
    {
      OWNER_ALERT_EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "test-key",
      OWNER_EMAILS: "billyfaber06@gmail.com, lesego@prospect.example",
    },
    { title: "New audit", body: "Internal", leadEmail: "lesego@prospect.example" },
  );
  assert.equal(ready.deliver, true);
  if (ready.deliver) {
    assert.deepEqual(ready.to, ["billyfaber06@gmail.com"]);
    assert.equal(ready.to.includes("lesego@prospect.example"), false);
  }
});

test("notify_user becomes an in-app notification draft", () => {
  const workflow: WorkflowDefinition = {
    id: "workflow:note",
    asset_key: "workflow:note",
    name: "Note",
    active: true,
    trigger_type: "form.submitted",
    trigger: {},
    steps: [
      { id: "note", title: "Tell the owner", action: { kind: "notify_user", text: "A form was submitted." }, next: "end" },
      { id: "end", title: "End", action: { kind: "end" } },
    ],
  };
  const store = createWorkflowStore(createInitialState(), [workflow]);
  const event = emitEvent(store, {
    id: "evt-note",
    type: "form.submitted",
    subjectId: "lead-1",
    occurredAt: "2026-10-06T08:00:00.000Z",
  });
  enqueueEvent(store, event);
  pump(store, new Date("2026-10-06T08:00:00.000Z"));
  const drafts = draftsFromNotifyMemory(store.memory.notifications);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].kind, "workflow");
  assert.equal(drafts[0].leadId, "lead-1");
  assert.match(drafts[0].title, /A form was submitted/);
  assert.equal(drafts[0].href, "/command-centre/leads/lead-1");
});

test("results call uses an active CRM slug and otherwise the website", () => {
  assert.equal(resultsCallHref(null), RESULTS_CALL_FALLBACK);
  assert.equal(resultsCallHref("results-call"), "/book/results-call");
  assert.equal(pickBookingSlug([{ slug: "demo" }, { slug: "results-call", name: "Results call" }]), "results-call");
  assert.equal(pickBookingSlug([]), null);
});

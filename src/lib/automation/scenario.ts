import { applyInbound, advanceHandovers, captureLead, createInitialState, markWon, runCron, updateSettings } from "@/lib/automation/engine";
import type { AutomationState } from "@/lib/automation/types";

const T0 = new Date("2026-09-20T06:30:00.000Z");

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function proveAutomation(start = T0): { state: AutomationState; log: string[] } {
  const log: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
    log.push(message);
  };

  let state = updateSettings(createInitialState(), {
    ...createInitialState().settings,
    bookingUrl: "https://cal.com/ai-autotech/audit",
  });
  state = captureLead(
    state,
    {
      id: "lead-thabo",
      name: "Thabo Ndlovu",
      company: "Ndlovu Dental",
      phone: "0825550101",
      email: "thabo@ndlovi-dental.example",
      source: "highlevel_event",
      qrSource: "billy_phone_qr",
      website: "https://ndlovi-dental.example",
      companySize: "12",
      answers: { teamSize: "12", pain: "WhatsApp inbox is manual and leads fall through" },
      recommendations: [{ agent: "WhatsApp" }, { agent: "Follow-up" }, { agent: "Booking" }],
      notes: "AI Business Audit from the phone QR.",
    },
    start,
  );
  state = captureLead(
    state,
    {
      id: "lead-cafe",
      name: "Lindiwe Nkosi",
      company: "Quiet Cafe",
      phone: "0825550199",
      email: "hello@quiet-cafe.example",
      source: "website_contact",
    },
    start,
  );

  const thabo = () => state.leads.find((lead) => lead.id === "lead-thabo");
  const cafe = () => state.leads.find((lead) => lead.id === "lead-cafe");

  check(thabo()?.ownerName === "Billy", "New QR lead assigned to Billy.");
  check(cafe()?.ownerName === "Billy", "Website lead assigned to the default owner, Billy.");
  check((thabo()?.score ?? 0) >= 60, `Hot lead scored ${thabo()?.score}.`);
  check(thabo()?.stage === "New", "Lead stays New until the automation job runs.");
  check(
    state.outbox.some((message) => message.leadId === "lead-thabo" && message.templateKey === "ack_whatsapp" && message.status === "queued"),
    "Instant WhatsApp acknowledgement queued in the outbox.",
  );
  check(state.outbox.every((message) => message.status !== "sent"), "No message was sent.");

  state = runCron(state, start);
  check(thabo()?.stage === "Contacted", "Cron moved the lead to Contacted once the acknowledgement was queued.");

  state = runCron(state, addDays(start, 1));
  check(
    state.outbox.some((message) => message.leadId === "lead-thabo" && message.templateKey.startsWith("nudge_day1")),
    "Day 1 nudge queued.",
  );
  state = runCron(state, addDays(start, 3));
  check(
    state.outbox.some((message) => message.leadId === "lead-thabo" && message.templateKey.startsWith("nudge_day3")),
    "Day 3 nudge queued.",
  );
  state = runCron(state, addDays(start, 7));
  check(
    state.outbox.some((message) => message.leadId === "lead-thabo" && message.templateKey.startsWith("nudge_day7")),
    "Day 7 nudge queued.",
  );
  check(thabo()?.stage === "Contacted", "Lead is still Contacted on day 7, before the grace period.");

  state = applyInbound(
    state,
    { type: "booking.created", leadId: "lead-thabo", startsAt: addDays(start, 10).toISOString() },
    addDays(start, 8),
  );
  check(thabo()?.stage === "Audit booked", "Booking webhook moved the lead to Audit booked.");

  state = runCron(state, addDays(start, 9));
  check(cafe()?.stage === "Lost", "No reply after the sequence marked the other lead Lost.");
  check((cafe()?.lostReason ?? "").includes("No reply"), "Lost reason explains the finished sequence.");
  check(thabo()?.stage === "Audit booked", "Booked lead was not marked lost.");
  check(
    state.outbox.some((message) => message.leadId === "lead-thabo" && message.templateKey.startsWith("audit_reminder")),
    "Reminder queued inside the day before the audit.",
  );

  state = applyInbound(state, { type: "audit.completed", leadId: "lead-thabo" }, addDays(start, 10));
  check(thabo()?.stage === "Audit done", "Audit completion moved the lead to Audit done.");

  state = applyInbound(
    state,
    { type: "proposal.sent", leadId: "lead-thabo", valueZar: 18500, whatSold: "WhatsApp lead desk" },
    addDays(start, 11),
  );
  check(thabo()?.stage === "Proposal sent", "Proposal webhook moved the lead to Proposal sent.");
  check(thabo()?.valueZar === 18500, "Proposal value stored in rand.");

  state = runCron(state, addDays(start, 14));
  check(
    state.outbox.some((message) => message.leadId === "lead-thabo" && message.templateKey.startsWith("proposal_followup")),
    "Proposal older than 3 days queued a follow-up.",
  );

  state = markWon(
    state,
    "lead-thabo",
    { valueZar: 18500, whatSold: "WhatsApp lead desk", deliveredBy: "Billy" },
    addDays(start, 16),
  );
  check(thabo()?.stage === "Won", "Deal marked won.");
  check(state.handovers.some((handover) => handover.leadId === "lead-thabo" && handover.deliveredBy === "Billy"), "Handover record created.");
  check(state.tasks.filter((task) => task.leadId === "lead-thabo").length >= 5, "Onboarding checklist created.");
  check(state.quotes.some((quote) => quote.leadId === "lead-thabo" && quote.status === "Draft"), "Draft quote placeholder created.");

  state = advanceHandovers(state, addDays(start, 16));
  check(thabo()?.stage === "Onboarding/Handover", "Won deal advanced into Onboarding/Handover.");
  check(state.outbox.every((message) => message.status !== "sent"), "The whole run finished with sending still off.");

  return { state, log };
}

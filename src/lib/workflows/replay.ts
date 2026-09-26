import { captureLead, createInitialState, updateSettings } from "@/lib/automation/engine";
import type { AutomationState, CaptureInput } from "@/lib/automation/types";
import { phase1Workflows } from "@/lib/workflows/phase1";
import { dispatchEvent, runScheduledWorkflows } from "@/lib/workflows/runner";
import type { TriggerType } from "@/lib/workflows/types";

const T0 = new Date("2026-09-20T06:30:00.000Z");

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const THABO: CaptureInput = {
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
};

const CAFE: CaptureInput = {
  id: "lead-cafe",
  name: "Lindiwe Nkosi",
  company: "Quiet Cafe",
  phone: "0825550199",
  email: "hello@quiet-cafe.example",
  source: "website_contact",
};

function fire(state: AutomationState, type: TriggerType, subjectId: string, at: Date, payload: Record<string, unknown> = {}) {
  return dispatchEvent(state, phase1Workflows(), {
    type,
    subjectId,
    occurredAt: at.toISOString(),
    id: `${type}-${subjectId}-${at.toISOString()}`,
    payload,
  }).state;
}

function cron(state: AutomationState, at: Date) {
  return runScheduledWorkflows(state, phase1Workflows(), at).state;
}

/** Same timeline as the phase 1 proof, executed only through workflow steps. */
export function proveAutomationViaWorkflows(start = T0): AutomationState {
  let state = updateSettings(createInitialState(), {
    ...createInitialState().settings,
    bookingUrl: "https://cal.com/ai-autotech/audit",
  });
  state = captureLead(state, THABO, start, { automate: false });
  state = fire(state, "lead.created", "lead-thabo", start);
  state = captureLead(state, CAFE, start, { automate: false });
  state = fire(state, "lead.created", "lead-cafe", start);

  state = cron(state, start);
  state = cron(state, addDays(start, 1));
  state = cron(state, addDays(start, 3));
  state = cron(state, addDays(start, 7));
  state = fire(state, "appointment.booked", "lead-thabo", addDays(start, 8), {
    starts_at: addDays(start, 10).toISOString(),
  });
  state = cron(state, addDays(start, 9));
  state = fire(state, "lead.stage_changed", "lead-thabo", addDays(start, 10), { stage: "Audit done" });
  state = fire(state, "lead.stage_changed", "lead-thabo", addDays(start, 11), {
    stage: "Proposal sent",
    value_zar: 18500,
    what_sold: "WhatsApp lead desk",
  });
  state = cron(state, addDays(start, 14));
  state = fire(state, "lead.stage_changed", "lead-thabo", addDays(start, 16), {
    stage: "Won",
    value_zar: 18500,
    what_sold: "WhatsApp lead desk",
    delivered_by: "Billy",
  });
  return state;
}

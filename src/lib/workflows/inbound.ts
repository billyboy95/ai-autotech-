import { isOptOutText } from "@/lib/automation/compliance";
import { applyInbound, findInboundLead } from "@/lib/automation/engine";
import type { AutomationState, InboundEvent } from "@/lib/automation/types";
import { isWorkflowEngineEnabled } from "@/lib/workflows/flag";
import { phase1Workflows } from "@/lib/workflows/phase1";
import { dispatchEvent } from "@/lib/workflows/runner";
import type { TriggerType } from "@/lib/workflows/types";

export function applyInboundEvent(state: AutomationState, event: InboundEvent, now: Date) {
  if (!isWorkflowEngineEnabled()) return applyInbound(state, event, now);
  const lead = findInboundLead(state, event);
  if (!lead) return state;
  const mapped = mapInbound(event, lead.id, now);
  return dispatchEvent(state, phase1Workflows(), {
    type: mapped.type,
    subjectId: lead.id,
    occurredAt: now.toISOString(),
    id: `${mapped.type}-${lead.id}-${now.toISOString()}`,
    payload: mapped.payload,
  }).state;
}

function mapInbound(event: InboundEvent, leadId: string, now: Date): { type: TriggerType; payload: Record<string, unknown> } {
  if (event.type === "reply.received" && isOptOutText(event.text || "")) {
    return { type: "opt_out.received", payload: { lead_id: leadId } };
  }
  if (event.type === "reply.received") return { type: "message.inbound", payload: { lead_id: leadId } };
  if (event.type === "booking.created") {
    return { type: "appointment.booked", payload: { starts_at: event.startsAt || now.toISOString(), lead_id: leadId } };
  }
  if (event.type === "audit.completed") return { type: "lead.stage_changed", payload: { stage: "Audit done", lead_id: leadId } };
  return {
    type: "lead.stage_changed",
    payload: { stage: "Proposal sent", value_zar: event.valueZar ?? "", what_sold: event.whatSold || "", lead_id: leadId },
  };
}

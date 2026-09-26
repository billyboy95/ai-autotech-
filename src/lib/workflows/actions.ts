import { assignOwner } from "@/lib/automation/assign";
import type { EnvLike } from "@/lib/automation/channels";
import { advanceHandovers, findInboundLead, markWon, queueSequenceStep, setStage, stopQueuedNudges } from "@/lib/automation/engine";
import { applyInbound } from "@/lib/automation/engine";
import type { SequenceStep } from "@/lib/automation/templates";
import type { AutomationState, LeadRecord, PipelineStage } from "@/lib/automation/types";
import { signWebhookBody } from "@/lib/workflows/hmac";
import type { Action, DomainEvent } from "@/lib/workflows/types";

export type SideMemory = {
  tags: Map<string, Set<string>>;
  notifications: Array<{ subjectId: string; text: string; at: string }>;
  tasks: Array<{ subjectId: string; title: string; at: string }>;
  webhooks: Array<{ url: string; body: string; signature: string; delivered: false; at: string }>;
};

export function emptyMemory(): SideMemory {
  return { tags: new Map(), notifications: [], tasks: [], webhooks: [] };
}

export type ActionOutcome = {
  state: AutomationState;
  detail: Record<string, unknown>;
  wait?: { mode: "duration" | "until_time" | "until_event"; hours?: number; at?: string; event?: string; timeoutHours?: number };
  halt?: boolean;
};

const OPEN_STAGES = new Set(["New", "Contacted", "Audit booked", "Audit done", "Proposal sent", "Won", "Onboarding/Handover"]);

export function performAction(
  action: Action,
  input: {
    state: AutomationState;
    lead: LeadRecord | undefined;
    event: DomainEvent;
    now: Date;
    memory: SideMemory;
    env?: EnvLike;
    dryRun?: boolean;
    signingSecret?: string;
  },
): ActionOutcome {
  const leadId = input.event.subjectId;
  switch (action.kind) {
    case "end":
      return { state: input.state, detail: { ended: true }, halt: true };
    case "send_message":
      return sendMessage(action.sequence_step, input, leadId);
    case "move_stage":
      return moveStage(action, input, leadId);
    case "assign_owner":
      return assign(action, input, leadId);
    case "add_tag":
      return addTag(action, input, leadId);
    case "remove_tag": {
      const tags = tagsFor(input.memory, leadId);
      tags.delete(action.tag);
      return { state: input.state, detail: { removed: action.tag } };
    }
    case "create_task":
      input.memory.tasks.push({ subjectId: leadId, title: action.title, at: input.now.toISOString() });
      return { state: input.state, detail: { task: action.title } };
    case "update_field":
      return updateField(action, input, leadId);
    case "wait":
      return {
        state: input.state,
        detail: { waiting: action.mode },
        wait: {
          mode: action.mode,
          hours: action.hours,
          at: action.at,
          event: action.event,
          timeoutHours: action.timeout_hours,
        },
      };
    case "notify_user":
      input.memory.notifications.push({ subjectId: leadId, text: action.text, at: input.now.toISOString() });
      return { state: input.state, detail: { notified: action.text } };
    case "webhook_out":
      return webhookOut(action.url, input, leadId);
    case "handover":
      return handover(input, leadId);
    default:
      return { state: input.state, detail: { ignored: true } };
  }
}

function sendMessage(
  step: SequenceStep,
  input: { state: AutomationState; now: Date; dryRun?: boolean },
  leadId: string,
): ActionOutcome {
  if (input.dryRun) {
    return { state: input.state, detail: { planned: true, sequence_step: step, sent: false } };
  }
  return {
    state: queueSequenceStep(input.state, leadId, step, input.now),
    detail: { queued: step, sent: false },
  };
}

function moveStage(
  action: Extract<Action, { kind: "move_stage" }>,
  input: { state: AutomationState; event: DomainEvent; now: Date },
  leadId: string,
): ActionOutcome {
  const stage = (action.from_event ? String(input.event.payload.stage || "") : action.stage || "") as PipelineStage;
  if (!stage) return { state: input.state, detail: { skipped: "no stage" } };
  if (stage === "Onboarding/Handover" && !action.from_event) {
    return { state: advanceHandovers(input.state, input.now), detail: { stage } };
  }
  const lostReason = action.lost_reason || (input.event.payload.lost_reason ? String(input.event.payload.lost_reason) : undefined);
  const rawValue = input.event.payload.value_zar;
  const valueZar =
    action.value_from_event && rawValue !== undefined && rawValue !== null && rawValue !== "" ? Number(rawValue) : undefined;
  return {
    state: setStage(input.state, leadId, stage, input.now, {
      lostReason,
      valueZar: Number.isFinite(valueZar) ? valueZar : undefined,
    }),
    detail: { stage, sent: false },
  };
}

function assign(
  action: Extract<Action, { kind: "assign_owner" }>,
  input: { state: AutomationState; lead: LeadRecord | undefined; now: Date },
  leadId: string,
): ActionOutcome {
  if (!input.lead) return { state: input.state, detail: { skipped: "no lead" } };
  const team = input.state.settings.team;
  let owner = "";
  let reason = "";
  let settings = input.state.settings;
  if (action.strategy === "least_loaded") {
    owner = leastLoaded(input.state, team.length ? team : [action.default_owner || settings.defaultOwner || "Billy"]);
    reason = "Least-loaded owner";
  } else {
    const rules = (action.rules || []).map((rule, index) => ({
      id: `rule-${index + 1}`,
      name: rule.name,
      active: true,
      matchSource: rule.match_source,
      matchQrSource: rule.match_qr_source,
      owner: rule.owner,
    }));
    const assigned = assignOwner(
      {
        ...settings,
        strategy: action.strategy === "round_robin" ? "round_robin" : "fixed",
        defaultOwner: action.default_owner || settings.defaultOwner || "Billy",
        rules: action.rules ? rules : settings.rules,
      },
      { source: input.lead.source, qrSource: input.lead.qrSource },
    );
    owner = assigned.owner;
    reason = assigned.reason;
    settings = assigned.settings;
  }
  return {
    state: {
      ...input.state,
      settings,
      leads: input.state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, ownerName: owner, updatedAt: input.now.toISOString() } : lead,
      ),
    },
    detail: { owner, reason },
  };
}

function leastLoaded(state: AutomationState, team: string[]) {
  const names = team.map((name) => name.trim()).filter(Boolean);
  const counts = new Map(names.map((name) => [name, 0]));
  for (const lead of state.leads) {
    if (lead.stage === "Lost" || lead.stage === "Won" || lead.stage === "Onboarding/Handover") continue;
    if (!OPEN_STAGES.has(lead.stage) && lead.stage !== "New") continue;
    if (counts.has(lead.ownerName)) counts.set(lead.ownerName, (counts.get(lead.ownerName) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));
  return ranked[0]?.[0] || "Billy";
}

function addTag(
  action: Extract<Action, { kind: "add_tag" }>,
  input: { state: AutomationState; memory: SideMemory; event: DomainEvent },
  leadId: string,
): ActionOutcome {
  const tag = action.from_event ? String(input.event.payload.tag || "") : action.tag || "";
  if (tag) tagsFor(input.memory, leadId).add(tag);
  return { state: input.state, detail: { tag } };
}

function tagsFor(memory: SideMemory, subjectId: string) {
  const existing = memory.tags.get(subjectId);
  if (existing) return existing;
  const created = new Set<string>();
  memory.tags.set(subjectId, created);
  return created;
}

function updateField(
  action: Extract<Action, { kind: "update_field" }>,
  input: { state: AutomationState; event: DomainEvent; now: Date; lead: LeadRecord | undefined },
  leadId: string,
): ActionOutcome {
  if (action.field === "cancel_nudges") {
    return {
      state: stopQueuedNudges(input.state, leadId, input.now, "Follow-up nudges stopped by a workflow."),
      detail: { field: action.field },
    };
  }
  if (action.field === "opt_out") {
    const lead = input.lead || findInboundLead(input.state, { type: "reply.received", leadId });
    return {
      state: applyInbound(
        input.state,
        {
          type: "reply.received",
          leadId,
          text: "stop",
          email: lead?.email,
          phone: lead?.phone,
        },
        input.now,
      ),
      detail: { field: "opt_out", sent: false },
    };
  }
  const value = action.from_event ? input.event.payload[action.from_event] : action.value === "$now" ? input.now.toISOString() : action.value;
  const patch = patchFor(action.field, value);
  return {
    state: {
      ...input.state,
      leads: input.state.leads.map((lead) => (lead.id === leadId ? { ...lead, ...patch, updatedAt: input.now.toISOString() } : lead)),
    },
    detail: { field: action.field },
  };
}

function patchFor(field: string, value: unknown): Partial<LeadRecord> {
  const text = value == null ? "" : String(value);
  if (field === "booked_at") return { bookedAt: text || null, lostReason: "" };
  if (field === "replied_at") return { repliedAt: text || null };
  if (field === "lost_reason") return { lostReason: text };
  if (field === "notes") return { notes: text };
  if (field === "owner_name") return { ownerName: text };
  return {};
}

function webhookOut(
  url: string,
  input: { state: AutomationState; event: DomainEvent; now: Date; memory: SideMemory; signingSecret?: string; dryRun?: boolean },
  leadId: string,
): ActionOutcome {
  const body = JSON.stringify({
    subject_id: leadId,
    event_id: input.event.id,
    type: input.event.type,
    at: input.now.toISOString(),
  });
  const signature = signWebhookBody(input.signingSecret || "workflow-signing-key", body);
  if (!input.dryRun) {
    input.memory.webhooks.push({ url, body, signature, delivered: false, at: input.now.toISOString() });
  }
  return { state: input.state, detail: { url, signature, delivered: false, dry_run: Boolean(input.dryRun) } };
}

function handover(input: { state: AutomationState; event: DomainEvent; now: Date }, leadId: string): ActionOutcome {
  const valueRaw = input.event.payload.value_zar;
  const valueZar = valueRaw == null || valueRaw === "" ? undefined : Number(valueRaw);
  const won = markWon(
    input.state,
    leadId,
    {
      valueZar: Number.isFinite(valueZar) ? valueZar : undefined,
      whatSold: input.event.payload.what_sold ? String(input.event.payload.what_sold) : undefined,
      deliveredBy: input.event.payload.delivered_by ? String(input.event.payload.delivered_by) : undefined,
    },
    input.now,
  );
  return { state: advanceHandovers(won, input.now), detail: { handover: true, sent: false } };
}

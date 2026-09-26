import { assignOwner } from "@/lib/automation/assign";
import { buildWaLink, isSendEnabled, renderTemplate, type EnvLike } from "@/lib/automation/channels";
import { firstName, formatWhen, newId } from "@/lib/automation/ids";
import { readCompanySize, scoreLead } from "@/lib/automation/score";
import { DEFAULT_TEMPLATES, STEP_INDEX, STEP_TEMPLATES, type SequenceStep } from "@/lib/automation/templates";
import {
  DEFAULT_SETTINGS,
  emptyLead,
  type Activity,
  type AutomationSettings,
  type AutomationState,
  type CaptureInput,
  type InboundEvent,
  type LeadRecord,
  type OutboxMessage,
  type PipelineStage,
} from "@/lib/automation/types";

const NUDGE_KEYS = new Set<string>([
  ...STEP_TEMPLATES.day1,
  ...STEP_TEMPLATES.day3,
  ...STEP_TEMPLATES.day7,
]);

export function createInitialState(partial?: Partial<AutomationState>): AutomationState {
  return {
    leads: [],
    activities: [],
    outbox: [],
    templates: DEFAULT_TEMPLATES.map((template) => ({ ...template })),
    settings: {
      ...DEFAULT_SETTINGS,
      team: [...DEFAULT_SETTINGS.team],
      checklist: [...DEFAULT_SETTINGS.checklist],
      rules: DEFAULT_SETTINGS.rules.map((rule) => ({ ...rule })),
    },
    handovers: [],
    tasks: [],
    quotes: [],
    ...partial,
  };
}

export function captureLead(state: AutomationState, input: CaptureInput, now: Date): AutomationState {
  const existing = state.leads.find((lead) => lead.id === input.id);
  if (existing?.enrolled) return state;

  const createdAt = existing?.createdAt || input.createdAt || now.toISOString();
  const answers = input.answers ?? existing?.answers ?? {};
  const companySize = readCompanySize(answers, input.companySize || existing?.companySize);
  const recommendations = input.recommendations ?? [];
  const scored = scoreLead({
    source: input.source || existing?.source,
    qrSource: input.qrSource || existing?.qrSource,
    companySize,
    answers,
    recommendations,
    phone: input.phone || existing?.phone,
    website: input.website || existing?.website,
  });
  const assigned = assignOwner(state.settings, {
    source: input.source || existing?.source || "",
    qrSource: input.qrSource || existing?.qrSource || "",
  });

  const lead = emptyLead({
    ...(existing ?? { id: input.id, name: input.name.trim() || "Unnamed", createdAt }),
    id: input.id,
    name: (input.name || existing?.name || "Unnamed").trim() || "Unnamed",
    company: input.company ?? existing?.company ?? "",
    phone: input.phone ?? existing?.phone ?? "",
    email: input.email ?? existing?.email ?? "",
    whatsapp: (input.phone || existing?.whatsapp || existing?.phone || "").trim(),
    stage: existing?.stage ?? "New",
    notes: existing?.notes || input.notes || "",
    source: input.source || existing?.source || "",
    qrSource: input.qrSource || existing?.qrSource || "",
    campaign: input.campaign || existing?.campaign || "",
    eventName: input.eventName || existing?.eventName || "",
    website: input.website || existing?.website || "",
    industry: input.industry || existing?.industry || "",
    companySize,
    answers,
    ownerName: assigned.owner,
    score: scored.score,
    scoreReasons: scored.reasons,
    valueZar: input.valueZar ?? existing?.valueZar ?? 0,
    auditLeadId: input.auditLeadId ?? existing?.auditLeadId ?? null,
    contactLeadId: input.contactLeadId ?? existing?.contactLeadId ?? null,
    createdAt,
    updatedAt: now.toISOString(),
    stageChangedAt: existing?.stageChangedAt || createdAt,
    enrolled: true,
    ord: existing?.ord ?? -Math.floor(now.getTime() / 1000),
  });

  const activities: Activity[] = [
    activity(lead.id, "assigned", `Assigned to ${assigned.owner}`, assigned.reason, now, { owner: assigned.owner }),
    activity(lead.id, "scored", `Score ${scored.score}`, scored.reasons.join(" · "), now, {
      score: scored.score,
      reasons: scored.reasons,
    }),
  ];

  let next = upsertLead(
    { ...state, settings: assigned.settings },
    lead,
    activities,
  );
  next = queueStep(next, lead.id, "ack", now);
  return next;
}

export function backfillOwners(state: AutomationState, now: Date): AutomationState {
  let next = state;
  for (const lead of state.leads) {
    if (lead.ownerName.trim()) continue;
    const assigned = assignOwner(next.settings, lead);
    next = {
      ...next,
      settings: assigned.settings,
    };
    next = patchLead(next, lead.id, { ownerName: assigned.owner, updatedAt: now.toISOString() }, [
      activity(lead.id, "assigned", `Assigned to ${assigned.owner}`, `${assigned.reason} (existing lead)`, now),
    ]);
  }
  return next;
}

export function runCron(state: AutomationState, now: Date, env: EnvLike = process.env): AutomationState {
  let next = backfillOwners(state, now);
  next = queueDueFollowUps(next, now);
  next = applyStageRules(next, now, env);
  next = advanceHandovers(next, now);
  return next;
}

export function applyStageRules(
  state: AutomationState,
  now: Date,
  env: EnvLike = process.env,
  onlyLeadId?: string,
): AutomationState {
  let next = state;
  for (const lead of state.leads) {
    if (onlyLeadId && lead.id !== onlyLeadId) continue;
    const current = () => next.leads.find((item) => item.id === lead.id);
    const row = current();
    if (!row || !row.enrolled) continue;

    if (row.stage === "New" && acknowledgementReady(next, row.id, env)) {
      next = moveStage(next, row.id, "Contacted", now, "Acknowledgement is in the outbox, so this lead is contacted.");
    }

    const fresh = current();
    if (!fresh || fresh.repliedAt || fresh.bookedAt) continue;
    if (fresh.stage !== "New" && fresh.stage !== "Contacted") continue;
    const day7 = next.outbox.some(
      (message) =>
        message.leadId === fresh.id &&
        message.templateKey.startsWith("nudge_day7") &&
        message.status !== "cancelled",
    );
    const cutoff =
      new Date(fresh.createdAt).getTime() + (7 + next.settings.staleGraceDays) * 24 * 60 * 60 * 1000;
    if (day7 && now.getTime() >= cutoff) {
      next = moveStage(
        next,
        fresh.id,
        "Lost",
        now,
        "No reply after the day 1, day 3 and day 7 follow-ups.",
        { lostReason: "No reply after the day 1, day 3 and day 7 follow-ups." },
      );
    }
  }
  return next;
}

export function advanceHandovers(state: AutomationState, now: Date): AutomationState {
  let next = state;
  for (const lead of state.leads) {
    if (lead.stage !== "Won") continue;
    if (!state.handovers.some((handover) => handover.leadId === lead.id)) continue;
    next = moveStage(next, lead.id, "Onboarding/Handover", now, "Won deal moved into onboarding and handover.");
  }
  return next;
}

export function queueDueFollowUps(state: AutomationState, now: Date): AutomationState {
  let next = state;
  for (const original of state.leads) {
    const current = () => next.leads.find((lead) => lead.id === original.id);
    const lead = current();
    if (!lead?.enrolled || lead.repliedAt) continue;
    if (lead.stage === "Lost" || lead.stage === "Won" || lead.stage === "Onboarding/Handover") continue;

    const ageHours = (now.getTime() - new Date(lead.createdAt).getTime()) / 36e5;
    if ((lead.stage === "New" || lead.stage === "Contacted") && !lead.bookedAt) {
      if (lead.sequenceStep < 1) next = queueStep(next, lead.id, "ack", now);
      if (ageHours >= 24 && (current()?.sequenceStep ?? 0) < 2) next = queueStep(next, lead.id, "day1", now);
      if (ageHours >= 72 && (current()?.sequenceStep ?? 0) < 3) next = queueStep(next, lead.id, "day3", now);
      if (ageHours >= 168 && (current()?.sequenceStep ?? 0) < 4) next = queueStep(next, lead.id, "day7", now);
    }

    const booked = current();
    if (booked?.stage === "Audit booked" && booked.bookedAt) {
      const until = new Date(booked.bookedAt).getTime() - now.getTime();
      if (until > 0 && until <= 24 * 60 * 60 * 1000) {
        next = queueStep(next, booked.id, "audit_reminder", now);
      }
    }

    const proposed = current();
    if (proposed?.stage === "Proposal sent" && proposed.proposalSentAt) {
      const due = new Date(proposed.proposalSentAt).getTime() + next.settings.proposalFollowupDays * 24 * 60 * 60 * 1000;
      if (now.getTime() >= due) next = queueStep(next, proposed.id, "proposal_followup", now);
    }
  }
  return next;
}

export function applyInbound(state: AutomationState, event: InboundEvent, now: Date): AutomationState {
  const lead = findInboundLead(state, event);
  if (!lead) return state;

  if (event.type === "booking.created") {
    const startsAt = event.startsAt || now.toISOString();
    let next = cancelQueued(state, lead.id, NUDGE_KEYS, now, "Follow-up nudges stopped because an audit was booked.");
    next = patchLead(
      next,
      lead.id,
      {
        stage: "Audit booked",
        bookedAt: startsAt,
        stageChangedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        lostReason: "",
      },
      [activity(lead.id, "booking", "Audit booked", `Booked for ${formatWhen(startsAt)}.`, now, { startsAt })],
    );
    const until = new Date(startsAt).getTime() - now.getTime();
    if (until > 0 && until <= 24 * 60 * 60 * 1000) next = queueStep(next, lead.id, "audit_reminder", now);
    return next;
  }

  if (event.type === "reply.received") {
    const next = cancelQueued(state, lead.id, NUDGE_KEYS, now, "Follow-up nudges stopped because they replied.");
    const patch: Partial<LeadRecord> = {
      repliedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (lead.stage === "New") {
      patch.stage = "Contacted";
      patch.stageChangedAt = now.toISOString();
    }
    return patchLead(next, lead.id, patch, [
      activity(lead.id, "reply", "Reply received", event.text || "A reply came in.", now),
    ]);
  }

  if (event.type === "audit.completed") {
    return moveStage(state, lead.id, "Audit done", now, "Audit marked done from the booking webhook.");
  }

  if (event.type === "proposal.sent") {
    return moveStage(state, lead.id, "Proposal sent", now, event.whatSold || "Proposal sent.", {
      valueZar: event.valueZar ?? lead.valueZar,
      proposalSentAt: now.toISOString(),
    });
  }

  return state;
}

export function setStage(
  state: AutomationState,
  leadId: string,
  stage: PipelineStage,
  now: Date,
  extra?: { valueZar?: number; whatSold?: string; lostReason?: string; deliveredBy?: string },
): AutomationState {
  if (stage === "Won" || stage === "Onboarding/Handover") {
    const won = markWon(state, leadId, extra, now);
    if (stage === "Onboarding/Handover") return advanceHandovers(won, now);
    return won;
  }

  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead || lead.stage === stage) return state;
  const patch: Partial<LeadRecord> = {};
  if (stage === "Audit booked" && !lead.bookedAt) patch.bookedAt = now.toISOString();
  if (stage === "Audit done") patch.auditDoneAt = now.toISOString();
  if (stage === "Proposal sent") {
    patch.proposalSentAt = lead.proposalSentAt || now.toISOString();
    if (extra?.valueZar != null) patch.valueZar = extra.valueZar;
  }
  if (stage === "Lost") patch.lostReason = extra?.lostReason || lead.lostReason || "Marked lost";
  return moveStage(state, leadId, stage, now, `Stage set to ${stage}.`, patch);
}

export function markWon(
  state: AutomationState,
  leadId: string,
  extra: { valueZar?: number; whatSold?: string; deliveredBy?: string } | undefined,
  now: Date,
): AutomationState {
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return state;
  const valueZar = extra?.valueZar ?? lead.valueZar ?? 0;
  const whatSold = extra?.whatSold?.trim() || `AI automation for ${lead.company || lead.name}`;
  const deliveredBy = extra?.deliveredBy?.trim() || lead.ownerName || state.settings.defaultOwner || "Billy";
  const existing = state.handovers.find((handover) => handover.leadId === leadId);

  let next = patchLead(
    state,
    leadId,
    {
      stage: lead.stage === "Onboarding/Handover" ? lead.stage : "Won",
      valueZar,
      wonAt: lead.wonAt || now.toISOString(),
      stageChangedAt: lead.stage === "Won" || lead.stage === "Onboarding/Handover" ? lead.stageChangedAt : now.toISOString(),
      updatedAt: now.toISOString(),
      lostReason: "",
    },
    lead.stage === "Won" || lead.stage === "Onboarding/Handover"
      ? []
      : [activity(leadId, "won", "Marked won", `${whatSold} · ${deliveredBy}`, now, { valueZar, whatSold, deliveredBy })],
  );

  if (!existing) {
    const handoverId = newId("ho");
    const tasks = (next.settings.checklist.length ? next.settings.checklist : DEFAULT_SETTINGS.checklist).map(
      (title, ord) => ({
        id: newId("task"),
        leadId,
        handoverId,
        title,
        done: false,
        ord,
        createdAt: now.toISOString(),
      }),
    );
    const quote = {
      id: newId("quo"),
      leadId,
      handoverId,
      kind: "quote" as const,
      reference: `Q-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${leadId.slice(-4).toUpperCase()}`,
      description: whatSold,
      amountZar: valueZar,
      status: "Draft",
      createdAt: now.toISOString(),
    };
    next = {
      ...next,
      handovers: [
        ...next.handovers,
        { id: handoverId, leadId, deliveredBy, whatSold, valueZar, createdAt: now.toISOString() },
      ],
      tasks: [...next.tasks, ...tasks],
      quotes: [...next.quotes, quote],
      activities: [
        ...next.activities,
        activity(leadId, "handover", "Handover opened", `${deliveredBy} delivers: ${whatSold}`, now, { handoverId }),
        activity(leadId, "quote", "Draft quote created", quote.reference, now, { quoteId: quote.id, amountZar: valueZar }),
      ],
    };
  }

  return next;
}

export function addNote(state: AutomationState, leadId: string, body: string, now: Date): AutomationState {
  const note = body.trim();
  if (!note || !state.leads.some((lead) => lead.id === leadId)) return state;
  return {
    ...state,
    activities: [...state.activities, activity(leadId, "note", "Note", note, now)],
  };
}

export function setTaskDone(state: AutomationState, taskId: string, done: boolean): AutomationState {
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, done } : task)),
  };
}

export function updateTemplate(
  state: AutomationState,
  key: string,
  patch: { subject?: string; body?: string; active?: boolean },
): AutomationState {
  return {
    ...state,
    templates: state.templates.map((template) => (template.key === key ? { ...template, ...patch } : template)),
  };
}

export function updateSettings(state: AutomationState, settings: AutomationSettings): AutomationState {
  return {
    ...state,
    settings: {
      ...settings,
      defaultOwner: settings.defaultOwner.trim() || "Billy",
      team: settings.team.map((name) => name.trim()).filter(Boolean),
      proposalFollowupDays: Math.max(1, settings.proposalFollowupDays || 3),
      staleGraceDays: Math.max(0, settings.staleGraceDays || 0),
      stuckAfterDays: Math.max(1, settings.stuckAfterDays || 3),
    },
  };
}

export function approveMessage(state: AutomationState, messageId: string, now: Date): AutomationState {
  const message = state.outbox.find((item) => item.id === messageId);
  if (!message || (message.status !== "queued" && message.status !== "failed")) return state;
  return {
    ...state,
    outbox: state.outbox.map((item) => (item.id === messageId ? { ...item, status: "approved", error: "" } : item)),
    activities: [
      ...state.activities,
      activity(
        message.leadId,
        "message_approved",
        "Outbox message approved",
        "Sending is off, so this stays in the outbox until a provider is switched on.",
        now,
        { messageId },
      ),
    ],
  };
}

export function cancelMessage(state: AutomationState, messageId: string, now: Date): AutomationState {
  const message = state.outbox.find((item) => item.id === messageId);
  if (!message || message.status === "sent" || message.status === "cancelled") return state;
  return {
    ...state,
    outbox: state.outbox.map((item) => (item.id === messageId ? { ...item, status: "cancelled" } : item)),
    activities: [
      ...state.activities,
      activity(message.leadId, "message_cancelled", "Outbox message cancelled", message.templateKey, now, { messageId }),
    ],
  };
}

export function templateVars(lead: LeadRecord, settings: AutomationSettings, when = "") {
  const bookingUrl = settings.bookingUrl.trim() || "reply and I'll send times that work";
  return {
    name: lead.name,
    firstName: firstName(lead.name),
    company: lead.company || "your business",
    owner: lead.ownerName || settings.defaultOwner || "Billy",
    bookingUrl,
    when,
  };
}

function queueStep(state: AutomationState, leadId: string, step: SequenceStep, scheduledFor: Date): AutomationState {
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return state;
  const when =
    step === "audit_reminder" && lead.bookedAt ? ` (${formatWhen(lead.bookedAt)})` : "";
  const vars = templateVars(lead, state.settings, when);
  const messages: OutboxMessage[] = [];
  const activities: Activity[] = [];

  for (const key of STEP_TEMPLATES[step]) {
    const template = state.templates.find((item) => item.key === key && item.active);
    if (!template) continue;
    const toAddress = template.channel === "email" ? lead.email : lead.whatsapp || lead.phone;
    if (!toAddress) continue;
    if (state.outbox.some((item) => item.leadId === leadId && item.templateKey === key && item.status !== "cancelled")) {
      continue;
    }
    const body = renderTemplate(template.body, vars);
    const subject = renderTemplate(template.subject, vars);
    const message: OutboxMessage = {
      id: newId("msg"),
      leadId,
      templateKey: key,
      channel: template.channel,
      toAddress,
      subject,
      body,
      status: "queued",
      scheduledFor: scheduledFor.toISOString(),
      sentAt: null,
      provider: "outbox",
      providerId: "",
      error: "",
      waLink: template.channel === "whatsapp" ? buildWaLink(toAddress, body) : "",
      createdAt: scheduledFor.toISOString(),
    };
    messages.push(message);
    activities.push(
      activity(leadId, "message_queued", `Queued ${template.name}`, `${template.channel} · ${toAddress}`, scheduledFor, {
        templateKey: key,
        messageId: message.id,
      }),
    );
  }

  if (!messages.length && step in STEP_INDEX) {
    const already = state.outbox.some(
      (item) => item.leadId === leadId && (STEP_TEMPLATES[step] as readonly string[]).includes(item.templateKey) && item.status !== "cancelled",
    );
    if (!already) {
      return patchLead(state, leadId, {}, [
        activity(leadId, "message_skipped", `No ${step} message queued`, "This lead has no phone or email for that channel.", scheduledFor),
      ]);
    }
  }

  const sequenceStep =
    step in STEP_INDEX ? Math.max(lead.sequenceStep, STEP_INDEX[step as keyof typeof STEP_INDEX]) : lead.sequenceStep;

  return patchLead(state, leadId, { sequenceStep, updatedAt: scheduledFor.toISOString() }, activities, messages);
}

function acknowledgementReady(state: AutomationState, leadId: string, env: EnvLike) {
  const acks = state.outbox.filter(
    (message) => message.leadId === leadId && message.templateKey.startsWith("ack_") && message.status !== "cancelled" && message.status !== "failed",
  );
  if (!acks.length) return false;
  if (isSendEnabled(env)) return acks.some((message) => message.status === "sent");
  return true;
}

function moveStage(
  state: AutomationState,
  leadId: string,
  stage: PipelineStage,
  now: Date,
  body: string,
  patch: Partial<LeadRecord> = {},
): AutomationState {
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return state;
  const changed = lead.stage !== stage;
  return patchLead(
    state,
    leadId,
    {
      ...patch,
      stage,
      stageChangedAt: changed ? now.toISOString() : lead.stageChangedAt,
      updatedAt: now.toISOString(),
    },
    changed ? [activity(leadId, "stage", `${lead.stage} → ${stage}`, body, now, { from: lead.stage, to: stage })] : [],
  );
}

function cancelQueued(
  state: AutomationState,
  leadId: string,
  keys: Set<string>,
  now: Date,
  title: string,
): AutomationState {
  let cancelled = 0;
  const outbox = state.outbox.map((message) => {
    if (message.leadId !== leadId || message.status !== "queued" || !keys.has(message.templateKey)) return message;
    cancelled += 1;
    return { ...message, status: "cancelled" as const };
  });
  if (!cancelled) return state;
  return {
    ...state,
    outbox,
    activities: [...state.activities, activity(leadId, "sequence_stopped", title, `${cancelled} queued nudge${cancelled === 1 ? "" : "s"} cancelled.`, now)],
  };
}

function findInboundLead(state: AutomationState, event: InboundEvent) {
  if (event.leadId) {
    const byId = state.leads.find((lead) => lead.id === event.leadId);
    if (byId) return byId;
  }
  const email = event.email?.trim().toLowerCase();
  if (email) {
    const byEmail = state.leads.find((lead) => lead.email.toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const phone = (event.phone ?? "").replace(/\D/g, "");
  if (phone) {
    return state.leads.find((lead) => {
      const leadPhone = (lead.phone || lead.whatsapp).replace(/\D/g, "");
      return leadPhone && (leadPhone.endsWith(phone) || phone.endsWith(leadPhone));
    });
  }
  return undefined;
}

function upsertLead(state: AutomationState, lead: LeadRecord, activities: Activity[] = [], messages: OutboxMessage[] = []) {
  const exists = state.leads.some((item) => item.id === lead.id);
  return {
    ...state,
    leads: exists ? state.leads.map((item) => (item.id === lead.id ? lead : item)) : [lead, ...state.leads],
    activities: [...state.activities, ...activities],
    outbox: [...state.outbox, ...messages],
  };
}

function patchLead(
  state: AutomationState,
  leadId: string,
  patch: Partial<LeadRecord>,
  activities: Activity[] = [],
  messages: OutboxMessage[] = [],
): AutomationState {
  return {
    ...state,
    leads: state.leads.map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead)),
    activities: [...state.activities, ...activities],
    outbox: [...state.outbox, ...messages],
  };
}

function activity(
  leadId: string,
  kind: string,
  title: string,
  body: string,
  now: Date,
  metadata: Record<string, unknown> = {},
): Activity {
  return {
    id: newId("act"),
    leadId,
    kind,
    title,
    body,
    metadata,
    createdAt: now.toISOString(),
  };
}

import { buildSmsLink, buildWaLink, renderTemplate } from "@/lib/automation/channels";
import { ensureMarketingFooter, messageCategory } from "@/lib/automation/compliance";
import { firstName, newId } from "@/lib/automation/ids";
import { assignOwner } from "@/lib/automation/assign";
import { scoreLead } from "@/lib/automation/score";
import {
  emptyLead,
  type Activity,
  type AutomationState,
  type Campaign,
  type CampaignStep,
  type Channel,
  type InboundEvent,
  type OutboxMessage,
  type Prospect,
  type ProspectTouch,
} from "@/lib/automation/types";

export function defaultCampaignSteps(): CampaignStep[] {
  return [
    {
      id: newId("stp"),
      channel: "whatsapp",
      delayHours: 0,
      subject: "",
      body: "{{opening}}\n\nHi {{firstName}}, it's {{owner}} from AI AutoTech. I had a look at {{business}}. If a short audit would help, grab a time: {{bookingUrl}}",
    },
    {
      id: newId("stp"),
      channel: "email",
      delayHours: 24,
      subject: "{{business}} — a short audit",
      body: "Hi {{firstName}},\n\n{{opening}}\n\nI help {{niche}} businesses get the follow-up off WhatsApp and into a pipeline. Book a short audit here: {{bookingUrl}}\n\n{{owner}}\nAI AutoTech",
    },
    {
      id: newId("stp"),
      channel: "sms",
      delayHours: 72,
      subject: "",
      body: "{{firstName}}, {{owner}} at AI AutoTech. {{opening}} Book a short audit: {{bookingUrl}}",
    },
  ];
}

export function parseProspectCsv(csv: string): { rows: Array<Omit<Prospect, "id" | "campaignId" | "status" | "stepIndex" | "leadId" | "touches" | "createdAt" | "updatedAt" | "marketingConsent">>; error: string } {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows: [], error: "The CSV is empty." };
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const index = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  const columns = {
    name: index("name"),
    business: index("business", "company"),
    niche: index("niche", "industry"),
    website: index("website", "url"),
    phone: index("phone", "mobile"),
    email: index("email"),
    opening: index("opening line", "opening_line", "opening"),
  };
  const missing = Object.entries({
    name: columns.name,
    business: columns.business,
    niche: columns.niche,
    website: columns.website,
    phone: columns.phone,
    email: columns.email,
    "opening line": columns.opening,
  })
    .filter(([, value]) => value < 0)
    .map(([name]) => name);
  if (missing.length) return { rows: [], error: `CSV is missing: ${missing.join(", ")}.` };

  const rows = lines.slice(1).flatMap((line) => {
    const cells = splitCsvLine(line);
    const name = cell(cells, columns.name);
    if (!name) return [];
    return [
      {
        name,
        business: cell(cells, columns.business),
        niche: cell(cells, columns.niche),
        website: cell(cells, columns.website),
        phone: cell(cells, columns.phone),
        email: cell(cells, columns.email).toLowerCase(),
        openingLine: cell(cells, columns.opening),
      },
    ];
  });
  if (!rows.length) return { rows: [], error: "The CSV has headers but no prospect rows." };
  return { rows, error: "" };
}

export function importProspectCsv(
  state: AutomationState,
  csv: string,
  now: Date,
  campaignId = "",
  options?: { consentBasis?: Array<"" | "consent" | "existing_customer"> },
): { state: AutomationState; error: string; count: number } {
  const parsed = parseProspectCsv(csv);
  if (parsed.error) return { state, error: parsed.error, count: 0 };

  let next = state;
  let campaign = campaignId ? next.campaigns.find((item) => item.id === campaignId) : undefined;
  if (campaignId && !campaign) return { state, error: "That campaign does not exist.", count: 0 };
  if (!campaign) {
    campaign = {
      id: newId("cmp"),
      name: "Outbound prospects",
      status: "active",
      steps: defaultCampaignSteps(),
      createdAt: now.toISOString(),
    };
    next = { ...next, campaigns: [campaign, ...next.campaigns] };
  }

  const existingEmails = new Set(
    next.prospects.filter((item) => item.campaignId === campaign.id && item.email).map((item) => item.email.toLowerCase()),
  );
  const created = parsed.rows.flatMap((row, index) => {
    if (row.email && existingEmails.has(row.email)) return [];
    if (row.email) existingEmails.add(row.email);
    const basis = options?.consentBasis ? options.consentBasis[index] ?? "" : undefined;
    const prospect: Prospect = {
      id: newId("prs"),
      campaignId: campaign.id,
      ...row,
      marketingConsent: basis === "consent",
      consentBasis: basis ?? "",
      consentRequested: false,
      status: basis === "" ? "not_contacted" : "in_sequence",
      stepIndex: 0,
      leadId: null,
      touches: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    return [prospect];
  });

  next = { ...next, prospects: [...created, ...next.prospects] };
  next = queueDueCampaignSteps(next, now);
  return { state: next, error: "", count: created.length };
}

export function saveCampaign(state: AutomationState, campaign: Campaign): AutomationState {
  const steps = campaign.steps.filter((step) => step.body.trim());
  const next: Campaign = {
    ...campaign,
    name: campaign.name.trim() || "Outbound prospects",
    steps: steps.length ? steps : defaultCampaignSteps(),
  };
  const exists = state.campaigns.some((item) => item.id === next.id);
  return {
    ...state,
    campaigns: exists ? state.campaigns.map((item) => (item.id === next.id ? next : item)) : [next, ...state.campaigns],
  };
}

export function queueDueCampaignSteps(state: AutomationState, now: Date): AutomationState {
  let next = state;
  for (const original of state.prospects) {
    for (let guard = 0; guard < 8; guard += 1) {
      const prospect = next.prospects.find((item) => item.id === original.id);
      const campaign = prospect ? next.campaigns.find((item) => item.id === prospect.campaignId) : undefined;
      if (!prospect || !campaign || campaign.status !== "active") break;
      if (
        prospect.leadId
        || prospect.status === "replied"
        || prospect.status === "booked"
        || prospect.status === "stopped"
        || prospect.status === "not_contacted"
      ) break;
      const step = campaign.steps[prospect.stepIndex];
      if (!step) break;
      const dueAt = new Date(prospect.createdAt).getTime() + Math.max(0, step.delayHours) * 36e5;
      if (now.getTime() < dueAt) break;
      next = enqueueStep(next, prospect, campaign, step, new Date(dueAt));
    }
  }
  return next;
}

export function ensureProspectInPipeline(state: AutomationState, event: InboundEvent, now: Date): AutomationState {
  if (event.type !== "reply.received" && event.type !== "booking.created") return state;
  const prospect = findProspect(state, event);
  if (!prospect) return state;
  const existing = findLead(state, event) || (prospect.leadId ? state.leads.find((lead) => lead.id === prospect.leadId) : undefined);
  if (existing) return linkProspect(state, prospect, existing.id, event, now);
  return materializeProspect(state, prospect, event, now);
}

function enqueueStep(state: AutomationState, prospect: Prospect, campaign: Campaign, step: CampaignStep, when: Date): AutomationState {
  const templateKey = `campaign_${step.id}`;
  const already = state.outbox.some((message) => message.prospectId === prospect.id && message.templateKey === templateKey && message.status !== "cancelled");
  const address = step.channel === "email" ? prospect.email : prospect.phone;
  const touches = [...prospect.touches];
  if (!address) {
    touches.push({
      at: when.toISOString(),
      channel: step.channel,
      title: `Skipped ${step.channel}`,
      body: `No ${step.channel === "email" ? "email" : "phone"} on this prospect.`,
      messageId: "",
    });
    return replaceProspect(state, prospect.id, { stepIndex: prospect.stepIndex + 1, touches, updatedAt: when.toISOString() });
  }
  if (already) {
    return replaceProspect(state, prospect.id, { stepIndex: prospect.stepIndex + 1, updatedAt: when.toISOString() });
  }

  const vars = prospectVars(state, prospect);
  const category = messageCategory(templateKey);
  const rendered = renderTemplate(step.body, vars);
  const body = category === "marketing" ? ensureMarketingFooter(rendered, vars.owner) : rendered;
  const subject = renderTemplate(step.subject, vars);
  const message: OutboxMessage = {
    id: newId("msg"),
    leadId: "",
    prospectId: prospect.id,
    templateKey,
    channel: step.channel,
    toAddress: address,
    subject,
    body,
    category,
    status: "queued",
    scheduledFor: when.toISOString(),
    sentAt: null,
    provider: "outbox",
    providerId: "",
    error: "",
    costUsd: null,
    costZar: null,
    costCategory: "",
    waLink: step.channel === "whatsapp" ? buildWaLink(address, body) : step.channel === "sms" ? buildSmsLink(address, body) : "",
    createdAt: when.toISOString(),
  };
  const touch: ProspectTouch = {
    at: when.toISOString(),
    channel: step.channel,
    title: `Touched on ${step.channel}`,
    body: `${step.channel} · ${address}`,
    messageId: message.id,
  };
  return {
    ...replaceProspect(state, prospect.id, {
      stepIndex: prospect.stepIndex + 1,
      touches: [...touches, touch],
      updatedAt: when.toISOString(),
    }),
    outbox: [...state.outbox, message],
  };
}

function materializeProspect(state: AutomationState, prospect: Prospect, event: InboundEvent, now: Date): AutomationState {
  const campaign = state.campaigns.find((item) => item.id === prospect.campaignId);
  const leadId = newId("lead");
  const assigned = assignOwner(state.settings, { source: "outbound_campaign", qrSource: "" });
  const scored = scoreLead({
    source: "outbound_campaign",
    phone: prospect.phone,
    website: prospect.website,
  });
  const lead = emptyLead({
    id: leadId,
    name: prospect.name || "Unnamed",
    company: prospect.business,
    phone: prospect.phone,
    email: prospect.email,
    whatsapp: prospect.phone,
    website: prospect.website,
    industry: prospect.niche,
    notes: prospect.openingLine,
    marketingConsent: prospect.marketingConsent === true,
    source: "outbound_campaign",
    campaign: campaign?.name || "",
    utmSource: "",
    ownerName: assigned.owner,
    score: scored.score,
    scoreReasons: scored.reasons,
    stage: "New",
    enrolled: true,
    sequenceStep: 4,
    createdAt: prospect.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    stageChangedAt: now.toISOString(),
    ord: -Math.floor(now.getTime() / 1000),
  });
  const activities = touchActivities(leadId, prospect, campaign?.name || "", now);
  return {
    ...linkMessages(state, prospect.id, leadId),
    settings: assigned.settings,
    leads: [lead, ...state.leads],
    activities: [...state.activities, ...activities],
    prospects: state.prospects.map((item) =>
      item.id === prospect.id
        ? { ...item, leadId, status: event.type === "booking.created" ? "booked" : "replied", updatedAt: now.toISOString() }
        : item,
    ),
  };
}

function linkProspect(state: AutomationState, prospect: Prospect, leadId: string, event: InboundEvent, now: Date): AutomationState {
  if (prospect.leadId === leadId && (prospect.status === "replied" || prospect.status === "booked")) return state;
  const campaign = state.campaigns.find((item) => item.id === prospect.campaignId);
  const known = new Set(state.activities.map((item) => String(item.metadata.messageId || "")));
  const activities = touchActivities(leadId, prospect, campaign?.name || "", now).filter((item) => {
    const messageId = String(item.metadata.messageId || "");
    return !messageId || !known.has(messageId);
  });
  return {
    ...linkMessages(state, prospect.id, leadId),
    activities: [...state.activities, ...activities],
    prospects: state.prospects.map((item) =>
      item.id === prospect.id
        ? {
            ...item,
            leadId,
            status: event.type === "booking.created" ? "booked" : item.status === "booked" ? "booked" : "replied",
            updatedAt: now.toISOString(),
          }
        : item,
    ),
  };
}

function linkMessages(state: AutomationState, prospectId: string, leadId: string): AutomationState {
  return {
    ...state,
    outbox: state.outbox.map((message) => {
      if (message.prospectId !== prospectId) return message;
      if (message.status === "queued") return { ...message, leadId, status: "cancelled" };
      return { ...message, leadId };
    }),
  };
}

function touchActivities(leadId: string, prospect: Prospect, campaignName: string, now: Date): Activity[] {
  const touches = prospect.touches.map((touch) => ({
    id: newId("act"),
    leadId,
    kind: "channel_touch",
    title: touch.title,
    body: touch.body,
    metadata: { channel: touch.channel, messageId: touch.messageId, campaign: campaignName },
    createdAt: touch.at,
  }));
  return [
    ...touches,
    {
      id: newId("act"),
      leadId,
      kind: "attribution",
      title: "Entered from an outbound campaign",
      body: `source outbound_campaign · campaign ${campaignName || "none"}`,
      metadata: { source: "outbound_campaign", campaign: campaignName },
      createdAt: now.toISOString(),
    },
  ];
}

function replaceProspect(state: AutomationState, prospectId: string, patch: Partial<Prospect>): AutomationState {
  return {
    ...state,
    prospects: state.prospects.map((item) => (item.id === prospectId ? { ...item, ...patch } : item)),
  };
}

function prospectVars(state: AutomationState, prospect: Prospect) {
  const bookingUrl = state.settings.bookingUrl.trim() || "reply and I'll send times that work";
  return {
    name: prospect.name,
    firstName: firstName(prospect.name),
    business: prospect.business || "your business",
    company: prospect.business || "your business",
    niche: prospect.niche || "your",
    website: prospect.website,
    opening: prospect.openingLine,
    openingLine: prospect.openingLine,
    owner: state.settings.defaultOwner || "Billy",
    bookingUrl,
  };
}

function findProspect(state: AutomationState, event: InboundEvent) {
  const email = event.email?.trim().toLowerCase() || "";
  const phone = event.phone || "";
  return state.prospects.find((prospect) => {
    if (prospect.status === "stopped") return false;
    if (email && prospect.email.toLowerCase() === email) return true;
    return Boolean(phone && phonesMatch(prospect.phone, phone));
  });
}

function findLead(state: AutomationState, event: InboundEvent) {
  if (event.leadId) {
    const byId = state.leads.find((lead) => lead.id === event.leadId);
    if (byId) return byId;
  }
  const email = event.email?.trim().toLowerCase();
  if (email) {
    const byEmail = state.leads.find((lead) => lead.email.toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const phone = event.phone || "";
  if (!phone) return undefined;
  return state.leads.find((lead) => phonesMatch(lead.phone || lead.whatsapp, phone));
}

function phonesMatch(left: string, right: string) {
  const a = left.replace(/\D/g, "");
  const b = right.replace(/\D/g, "");
  if (!a || !b) return false;
  return a.slice(-9) === b.slice(-9);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function cell(cells: string[], index: number) {
  return (cells[index] || "").trim();
}

export function channelLabel(channel: Channel) {
  if (channel === "sms") return "SMS";
  if (channel === "email") return "Email";
  return "WhatsApp";
}

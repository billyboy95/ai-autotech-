import { formatZar, firstName } from "@/lib/automation/ids";
import { PIPELINE_STAGES } from "@/lib/automation/types";

export type HomeChatPerson = {
  id: string;
  kind: "lead" | "contact";
  name: string;
  company: string;
  phone: string;
  email: string;
  stage: string;
  score: number;
  valueZar: number;
};

export type HomeChatDraft = {
  kind: "follow_up" | "task";
  status: "draft";
  title: string;
  body: string;
  leadRef: string;
  leadName: string;
  channel: "whatsapp" | "email" | "sms" | "";
};

export type HomeChatLink = { href: string; label: string };

export type HomeChatAnswer = {
  message: string;
  nextStep: HomeChatLink;
  matches: HomeChatPerson[];
  drafts: HomeChatDraft[];
};

export type HomeChatSnapshot = {
  people: HomeChatPerson[];
  pipelineValueZar: number;
  newToday: number;
  perStage: { stage: string; count: number; valueZar: number }[];
  stuck: { id: string; name: string; stage: string; reason: string }[];
};

export type HomeChatState = HomeChatAnswer & {
  id: string;
  request: string;
  mode: "fixture" | "sandbox";
  persisted: boolean;
};

export const EMPTY_HOME_CHAT: HomeChatState = {
  id: "",
  request: "",
  message: "",
  nextStep: { href: "/command-centre/pipeline", label: "Open the pipeline" },
  matches: [],
  drafts: [],
  mode: "fixture",
  persisted: false,
};

/** Demo identities used when the workspace has no leads and Supabase is not connected. */
export const FIXTURE_PEOPLE: HomeChatPerson[] = [
  {
    id: "lead-ayesha",
    kind: "lead",
    name: "Ayesha Patel",
    company: "Patel Logistics",
    phone: "0795550121",
    email: "ayesha@patel-logistics.example",
    stage: "Won",
    score: 67,
    valueZar: 32000,
  },
  {
    id: "lead-johan",
    kind: "lead",
    name: "Johan Botha",
    company: "Botha Farming",
    phone: "0845550166",
    email: "johan@botha-farming.example",
    stage: "Proposal sent",
    score: 40,
    valueZar: 24000,
  },
  {
    id: "lead-thabo",
    kind: "lead",
    name: "Thabo Ndlovu",
    company: "Ndlovu Dental",
    phone: "0825550101",
    email: "thabo@ndlovi-dental.example",
    stage: "Onboarding/Handover",
    score: 82,
    valueZar: 18500,
  },
];

const NAV: { href: string; label: string; phrases: string[] }[] = [
  { href: "/command-centre/lead-agent", label: "Lead Agent", phrases: ["lead agent", "full team", "build the team", "build a team"] },
  { href: "/command-centre/connect-accounts", label: "Connect accounts", phrases: ["connect accounts", "connect account"] },
  { href: "/command-centre/import-contacts", label: "Import contacts", phrases: ["import contacts", "import contact"] },
  { href: "/command-centre/bots", label: "Agent store", phrases: ["agent store", "bot store", "bots"] },
  { href: "/command-centre/billing", label: "Billing", phrases: ["billing"] },
];

function mentions(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i").test(text);
}

function personLink(person: HomeChatPerson): HomeChatLink {
  if (person.kind === "lead") return { href: `/command-centre/leads/${person.id}`, label: `Open ${person.name}` };
  return { href: "/command-centre/contacts", label: "Open contacts" };
}

export function findPeople(text: string, people: HomeChatPerson[]) {
  const ranked: { person: HomeChatPerson; score: number }[] = [];
  const textDigits = text.replace(/\D/g, "");
  for (const person of people) {
    const name = person.name.trim().toLowerCase();
    const company = person.company.trim().toLowerCase();
    const email = person.email.trim().toLowerCase();
    let score = 0;
    if (name && mentions(text, name)) score = name.length + 10;
    else {
      const first = name.split(/\s+/)[0] ?? "";
      if (first.length >= 3 && mentions(text, first)) score = first.length;
    }
    if (company.length >= 3 && mentions(text, company)) score = Math.max(score, company.length + 5);
    const digits = person.phone.replace(/\D/g, "");
    if (digits.length >= 8 && textDigits.includes(digits)) score = Math.max(score, digits.length);
    if (email && text.toLowerCase().includes(email)) score = Math.max(score, email.length + 5);
    if (score) ranked.push({ person, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
  const best = ranked[0]?.score ?? 0;
  const seen = new Set<string>();
  return ranked.flatMap((item) => {
    if (item.score !== best || seen.has(item.person.id)) return [];
    seen.add(item.person.id);
    return [item.person];
  });
}

export function fixtureSnapshot(): HomeChatSnapshot {
  const perStage = PIPELINE_STAGES.map((stage) => {
    const rows = FIXTURE_PEOPLE.filter((person) => person.stage === stage);
    return {
      stage,
      count: rows.length,
      valueZar: rows.reduce((sum, person) => sum + person.valueZar, 0),
    };
  });
  return {
    people: FIXTURE_PEOPLE,
    perStage,
    pipelineValueZar: FIXTURE_PEOPLE.reduce((sum, person) => sum + person.valueZar, 0),
    newToday: 0,
    stuck: [{ id: "lead-johan", name: "Johan Botha", stage: "Proposal sent", reason: "Proposal follow-up is still a draft." }],
  };
}

export function emptySnapshot(): HomeChatSnapshot {
  return {
    people: [],
    pipelineValueZar: 0,
    newToday: 0,
    perStage: PIPELINE_STAGES.map((stage) => ({ stage, count: 0, valueZar: 0 })),
    stuck: [],
  };
}

function channelFor(text: string): "whatsapp" | "email" | "sms" {
  if (/\bemail\b/.test(text)) return "email";
  if (/\bsms\b/.test(text)) return "sms";
  return "whatsapp";
}

function followUpBody(person: HomeChatPerson) {
  const about = person.company ? ` about ${person.company}` : "";
  return `Hi ${firstName(person.name)}, this is AI AutoTech following up${about}. Tell me a time that suits you. Reply STOP to opt out.`;
}

function taskTitle(text: string, person: HomeChatPerson | null) {
  const cleaned = text
    .replace(/^\s*(please\s+)?(create|add|open|make)\s+(a\s+)?(task|to-do|todo)\s+(to\s+|for\s+)?/i, "")
    .replace(/^\s*remind me to\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const title = (cleaned || (person ? `Follow up with ${person.name}` : "Follow up")).slice(0, 140);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function intro(): HomeChatAnswer {
  return {
    message: "Ask for a lead, a pipeline summary, a follow-up draft, or a task. Nothing is sent.",
    nextStep: { href: "/command-centre/pipeline", label: "Open the pipeline" },
    matches: [],
    drafts: [],
  };
}

function refuseSend(): HomeChatAnswer {
  return {
    message: "Sending stays off. Nothing is sent.",
    nextStep: { href: "/command-centre/outbox", label: "Open the outbox" },
    matches: [],
    drafts: [],
  };
}

function matchNav(text: string) {
  let best: { href: string; label: string; length: number } | null = null;
  for (const item of NAV) {
    for (const phrase of item.phrases) {
      if (!mentions(text, phrase)) continue;
      if (!best || phrase.length > best.length) best = { href: item.href, label: item.label, length: phrase.length };
    }
  }
  return best;
}

function navReply(link: HomeChatLink, team = false): HomeChatAnswer {
  return {
    message: team
      ? "The Lead Agent recommends the full team for that business. Nothing is sent."
      : `Open ${link.label}. Nothing is sent.`,
    nextStep: link,
    matches: [],
    drafts: [],
  };
}

function draftReply(text: string, snapshot: HomeChatSnapshot): HomeChatAnswer {
  const named = findPeople(text, snapshot.people);
  if (named.length > 1) {
    const top = named[0];
    return {
      message: `${named.length} people match. Open ${top.name}, then ask for one follow-up draft. Nothing is sent.`,
      nextStep: personLink(top),
      matches: named.slice(0, 5),
      drafts: [],
    };
  }
  const stuck = named.length === 0 && snapshot.stuck.length === 1
    ? snapshot.people.find((person) => person.id === snapshot.stuck[0]?.id) ?? null
    : null;
  const person = named[0] ?? stuck;
  if (!person) {
    return {
      message: "Name the lead or contact for the follow-up. Nothing is stored and nothing is sent.",
      nextStep: snapshot.people.length
        ? { href: "/command-centre/pipeline", label: "Open the pipeline" }
        : { href: "/command-centre/import-contacts", label: "Import contacts" },
      matches: [],
      drafts: [],
    };
  }
  const channel = channelFor(text);
  return {
    message: `A follow-up for ${person.name} is a draft on ${channel}. Nothing is sent.`,
    nextStep: { href: "/command-centre/outbox", label: "Open the outbox" },
    matches: [person],
    drafts: [{
      kind: "follow_up",
      status: "draft",
      title: `Follow up with ${person.name}`,
      body: followUpBody(person),
      leadRef: person.id,
      leadName: person.name,
      channel,
    }],
  };
}

function taskReply(text: string, snapshot: HomeChatSnapshot): HomeChatAnswer {
  const named = findPeople(text, snapshot.people);
  if (named.length > 1) {
    const top = named[0];
    return {
      message: `${named.length} people match. Open ${top.name}, then ask for one task. Nothing is sent.`,
      nextStep: personLink(top),
      matches: named.slice(0, 5),
      drafts: [],
    };
  }
  const person = named[0] ?? null;
  const title = taskTitle(text, person);
  return {
    message: `A task draft is ready: ${title}. Nothing is sent.`,
    nextStep: person ? personLink(person) : { href: "/command-centre/jobs", label: "Open jobs" },
    matches: person ? [person] : [],
    drafts: [{
      kind: "task",
      status: "draft",
      title,
      body: title,
      leadRef: person?.id ?? "",
      leadName: person?.name ?? "",
      channel: "",
    }],
  };
}

function summaryReply(snapshot: HomeChatSnapshot): HomeChatAnswer {
  const active = snapshot.perStage.filter((row) => row.count > 0);
  if (!snapshot.people.length && snapshot.pipelineValueZar === 0 && active.length === 0) {
    return {
      message: "No leads in the pipeline yet. Nothing is sent.",
      nextStep: { href: "/command-centre/import-contacts", label: "Import contacts" },
      matches: [],
      drafts: [],
    };
  }
  const stages = active.map((row) => `${row.stage} ${row.count}`).join(", ");
  const stuck = snapshot.stuck[0];
  const person = stuck ? snapshot.people.find((item) => item.id === stuck.id) : undefined;
  const stuckLine = stuck ? ` ${stuck.name} needs a look (${stuck.stage}).` : "";
  const stageLine = stages ? `${stages}.` : "No leads in a stage yet.";
  return {
    message: `Pipeline value is ${formatZar(snapshot.pipelineValueZar)}. ${snapshot.newToday} new today. ${stageLine}${stuckLine} Nothing is sent.`,
    nextStep: person ? personLink(person) : { href: "/command-centre/pipeline", label: "Open the pipeline" },
    matches: person ? [person] : [],
    drafts: [],
  };
}

function lookupReply(text: string, snapshot: HomeChatSnapshot): HomeChatAnswer {
  const named = findPeople(text, snapshot.people);
  if (!named.length) {
    return {
      message: "No lead or contact matches that. Nothing is sent.",
      nextStep: { href: "/command-centre/import-contacts", label: "Import contacts" },
      matches: [],
      drafts: [],
    };
  }
  if (named.length > 1) {
    const top = named[0];
    return {
      message: `${named.map((person) => person.name).slice(0, 4).join(", ")} match. Open ${top.name}. Nothing is sent.`,
      nextStep: personLink(top),
      matches: named.slice(0, 5),
      drafts: [],
    };
  }
  const person = named[0];
  const where = person.company ? `${person.company} · ` : "";
  const stage = person.stage || "a contact";
  return {
    message: `${person.name} is ${where}${stage}. Nothing is sent.`,
    nextStep: personLink(person),
    matches: [person],
    drafts: [],
  };
}

/**
 * Rules-only home assistant. It looks up people, summarises the pipeline,
 * and prepares follow-up or task drafts. It never sends.
 */
export function answerHomeChat(raw: string, snapshot: HomeChatSnapshot): HomeChatAnswer {
  const text = raw.trim().toLowerCase();
  if (!text) return intro();
  const sendNow = /\b(send now|send it|turn sending on|enable sending|charge|payfast)\b/.test(text);
  const followUp = /\bfollow[- ]?ups?\b/.test(text)
    || /\bdraft\b/.test(text)
    || /\bwrite\b/.test(text)
    || (/\bsend\b/.test(text) && /\b(message|email|sms|whatsapp|follow)\b/.test(text));
  const task = /\b(tasks?|to-?dos?|remind me)\b/.test(text);
  const summary = /\bsummar/.test(text) || (/\bpipeline\b/.test(text) && !/\b(open|go to|show)\b/.test(text));
  const nav = matchNav(text);
  if (sendNow && !followUp && !task) return refuseSend();
  if (followUp) return draftReply(text, snapshot);
  if (task) return taskReply(raw.trim(), snapshot);
  if (summary) return summaryReply(snapshot);
  if (nav) return navReply({ href: nav.href, label: nav.label }, nav.href === "/command-centre/lead-agent");
  if (/\b(open|go to|show)\b/.test(text) && /\bpipeline\b/.test(text)) {
    return navReply({ href: "/command-centre/pipeline", label: "Open the pipeline" });
  }
  if (/\b(find|look\s*up|lookup|who is|search)\b/.test(text) || findPeople(text, snapshot.people).length) {
    return lookupReply(text, snapshot);
  }
  return {
    message: "Try a lead name, a pipeline summary, a follow-up draft, or a task. Nothing is sent.",
    nextStep: { href: "/command-centre/pipeline", label: "Open the pipeline" },
    matches: [],
    drafts: [],
  };
}

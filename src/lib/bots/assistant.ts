import type { ReplyProvider } from "@/lib/ai-reply/provider";
import { isBotAssistantEnabled } from "@/lib/bots/flag";
import { botBySlug } from "@/lib/bots/catalog";

export const ASSISTANT_KINDS = ["create_task", "draft_message", "move_stage", "activate_bot"] as const;
export type AssistantKind = (typeof ASSISTANT_KINDS)[number];

export type ProposedAction = {
  id: string;
  kind: AssistantKind;
  label: string;
  detail: string;
};

export type AssistantPlan = {
  enabled: boolean;
  message: string;
  proposals: ProposedAction[];
};

export type AssistantBook = {
  sendingEnabled: false;
  tasks: { id: string; title: string }[];
  drafts: { id: string; body: string; status: "draft" }[];
  stageMoves: { id: string; stage: string }[];
  activeBots: string[];
};

const SYSTEM = [
  "You propose CRM actions for a human to confirm.",
  "Reply with JSON only: {\"actions\":[{\"kind\":\"create_task|draft_message|move_stage|activate_bot\",\"label\":\"...\",\"detail\":\"...\"}]}",
  "Never include a send action. Drafts stay drafts.",
].join(" ");

export function assistantUnavailableMessage() {
  return "The assistant is off. Set BOT_ASSISTANT_ENABLED=true and AI_REPLY_API_KEY. Nothing was sent.";
}

export function proposalsFromText(raw: string): ProposedAction[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  let parsed: { actions?: { kind?: string; label?: string; detail?: string }[] };
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as { actions?: { kind?: string; label?: string; detail?: string }[] };
  } catch {
    return [];
  }
  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  return actions.flatMap((action, index) => {
    if (!ASSISTANT_KINDS.includes(action.kind as AssistantKind)) return [];
    const label = String(action.label || "").trim();
    const detail = String(action.detail || "").trim();
    if (!label) return [];
    return [{ id: `proposal-${index + 1}`, kind: action.kind as AssistantKind, label, detail }];
  });
}

export async function proposeAssistantActions(input: {
  request: string;
  env?: NodeJS.ProcessEnv;
  provider?: ReplyProvider;
}): Promise<AssistantPlan> {
  const env = input.env ?? process.env;
  if (!isBotAssistantEnabled(env)) {
    return { enabled: false, message: assistantUnavailableMessage(), proposals: [] };
  }
  const provider = input.provider;
  if (!provider || !provider.configured()) {
    return { enabled: false, message: assistantUnavailableMessage(), proposals: [] };
  }
  const request = input.request.trim();
  if (!request) {
    return { enabled: true, message: "Type a request. Nothing was sent.", proposals: [] };
  }
  const completed = await provider.complete([
    { role: "system", content: SYSTEM },
    { role: "user", content: request },
  ]);
  if (!completed.ok) {
    return { enabled: true, message: `${completed.message} Nothing was sent.`, proposals: [] };
  }
  const proposals = proposalsFromText(completed.text);
  return {
    enabled: true,
    message: proposals.length
      ? "Confirm the actions to apply. Nothing is sent until you confirm, and a confirm still does not send."
      : "No CRM action was proposed. Nothing was sent.",
    proposals,
  };
}

export function applyConfirmedActions(book: AssistantBook, proposals: ProposedAction[], ids: string[]): AssistantBook {
  const chosen = proposals.filter((item) => ids.includes(item.id));
  return chosen.reduce((current, action) => {
    if (action.kind === "create_task") {
      return { ...current, tasks: [...current.tasks, { id: action.id, title: action.label }] };
    }
    if (action.kind === "draft_message") {
      return {
        ...current,
        drafts: [...current.drafts, { id: action.id, body: action.detail || action.label, status: "draft" as const }],
      };
    }
    if (action.kind === "move_stage") {
      return { ...current, stageMoves: [...current.stageMoves, { id: action.id, stage: action.detail || action.label }] };
    }
    const slug = action.detail.trim();
    botBySlug(slug);
    if (current.activeBots.includes(slug)) return current;
    return { ...current, activeBots: [...current.activeBots, slug] };
  }, { ...book, sendingEnabled: false as const });
}

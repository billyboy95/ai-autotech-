import fs from "node:fs";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSendEnabled } from "@/lib/automation/channels";
import { applyStageRules, captureLead, createInitialState, runCron } from "@/lib/automation/engine";
import { messageCategory } from "@/lib/automation/compliance";
import { flushOutbox } from "@/lib/automation/flush";
import { loadSupabaseWorkspace, MIGRATION_FILE, saveSupabaseWorkspace } from "@/lib/automation/persist";
import { publishDuePosts, recordClick } from "@/lib/automation/social";
import type { AutomationState, CaptureInput } from "@/lib/automation/types";

const DEMO_FILE = path.join(process.cwd(), "data", "automation-demo.json");

export type Workspace = {
  state: AutomationState;
  automationReady: boolean;
  setupError: string | null;
  demo: boolean;
};

export function isDemoMode() {
  return process.env.CRM_DEMO_DATA === "1";
}

export async function loadWorkspace(): Promise<Workspace> {
  if (isDemoMode()) {
    return { state: applyEnvDefaults(hydrateState(readDemoState())), automationReady: true, setupError: null, demo: true };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("CRM store requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const loaded = await loadSupabaseWorkspace(supabase);
  return { ...loaded, state: applyEnvDefaults(hydrateState(loaded.state)), demo: false };
}

function applyEnvDefaults(state: AutomationState): AutomationState {
  const bookingUrl = state.settings.bookingUrl.trim() || process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  if (bookingUrl === state.settings.bookingUrl) return state;
  return { ...state, settings: { ...state.settings, bookingUrl } };
}

export async function saveWorkspace(before: AutomationState, after: AutomationState) {
  if (isDemoMode()) {
    writeDemoState(after);
    return;
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  await saveSupabaseWorkspace(supabase, before, after);
}

export async function enrollLead(input: CaptureInput) {
  try {
    const workspace = await loadWorkspace();
    if (!workspace.automationReady) {
      return { ok: false as const, error: workspace.setupError || `Apply ${MIGRATION_FILE} first.` };
    }
    const now = new Date();
    let after = captureLead(workspace.state, input, now);
    after = applyStageRules(after, now, process.env, input.id);
    await saveWorkspace(workspace.state, after);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation enroll failed.";
    console.error("automation enroll failed", message);
    return { ok: false as const, error: message };
  }
}

export async function runAutomationJob() {
  const workspace = await loadWorkspace();
  if (!workspace.automationReady) {
    return { ok: false as const, events: [] as string[], error: workspace.setupError || `Apply ${MIGRATION_FILE} first.` };
  }
  const now = new Date();
  let after = runCron(workspace.state, now, process.env);
  after = await flushOutbox(after, now, process.env);
  after = await publishDuePosts(after, now, process.env);
  if (isSendEnabled()) after = applyStageRules(after, now, process.env);
  await saveWorkspace(workspace.state, after);
  return { ok: true as const, events: describeChanges(workspace.state, after), error: undefined };
}

export async function mutateWorkspace(change: (state: AutomationState) => AutomationState | Promise<AutomationState>) {
  const workspace = await loadWorkspace();
  if (!workspace.automationReady) {
    throw new Error(workspace.setupError || `Apply ${MIGRATION_FILE} before changing automation data.`);
  }
  const after = await change(workspace.state);
  await saveWorkspace(workspace.state, after);
  return after;
}

export function readDemoState(): AutomationState {
  if (!fs.existsSync(DEMO_FILE)) return createInitialState();
  const parsed = JSON.parse(fs.readFileSync(DEMO_FILE, "utf8")) as AutomationState;
  if (!parsed.settings) return createInitialState();
  return hydrateState(parsed);
}

export function hydrateState(state: AutomationState): AutomationState {
  const base = createInitialState();
  return {
    ...base,
    ...state,
    settings: state.settings || base.settings,
    leads: (state.leads || []).map((lead) => ({ ...lead, utmSource: lead.utmSource || "", marketingConsent: lead.marketingConsent === true })),
    outbox: (state.outbox || []).map((message) => ({
      ...message,
      prospectId: message.prospectId ?? null,
      category: message.category === "service" || message.category === "marketing" ? message.category : messageCategory(message.templateKey || ""),
      costUsd: message.costUsd ?? null,
      costZar: message.costZar ?? null,
      costCategory: message.costCategory || "",
    })),
    socialPosts: state.socialPosts || [],
    campaigns: state.campaigns || [],
    prospects: (state.prospects || []).map((prospect) => ({ ...prospect, marketingConsent: prospect.marketingConsent === true })),
    clicks: state.clicks || [],
    suppressions: state.suppressions || [],
  };
}

export async function recordTrackedClick(input: {
  postId?: string | null;
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
  destination: string;
}) {
  const workspace = await loadWorkspace();
  const after = recordClick(workspace.state, input, new Date());
  await saveWorkspace(workspace.state, after);
}

export function writeDemoState(state: AutomationState) {
  fs.mkdirSync(path.dirname(DEMO_FILE), { recursive: true });
  fs.writeFileSync(DEMO_FILE, JSON.stringify(state, null, 2));
}

export function describeChanges(before: AutomationState, after: AutomationState) {
  const events: string[] = [];
  for (const lead of after.leads) {
    const prev = before.leads.find((item) => item.id === lead.id);
    if (!prev) events.push(`Added ${lead.name} and assigned ${lead.ownerName || "an owner"}.`);
    else if (prev.stage !== lead.stage) events.push(`${lead.name}: ${prev.stage} → ${lead.stage}.`);
    else if (!prev.ownerName && lead.ownerName) events.push(`${lead.name} assigned to ${lead.ownerName}.`);
  }
  for (const message of after.outbox) {
    if (!before.outbox.some((item) => item.id === message.id)) {
      events.push(`Queued ${message.templateKey} to ${message.toAddress}.`);
    }
  }
  const knownActivity = new Set(before.activities.map((item) => item.id));
  for (const item of after.activities) {
    if (knownActivity.has(item.id)) continue;
    if (item.kind === "reply" || item.kind === "booking" || item.kind === "sequence_stopped" || item.kind === "opt_out") {
      events.push(`${item.title}. ${item.body}`.trim());
    }
  }
  return events;
}

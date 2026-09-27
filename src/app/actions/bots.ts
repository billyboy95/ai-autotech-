"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { templateBySlug } from "@/lib/bots/catalog";
import { configurePaidTeam } from "@/lib/bots/configure";
import { isBotAssistantEnabled } from "@/lib/bots/flag";
import { polishRecommendationExplanations, type TeamRecommendation } from "@/lib/bots/recommend";
import { assistantUnavailableMessage, applyConfirmedActions, proposeAssistantActions, proposalsFromText, type AssistantBook } from "@/lib/bots/assistant";
import { openBotCheckout } from "@/lib/bots/billing";
import { runBot } from "@/lib/bots/runtime";
import { createOpenAiCompatibleProvider } from "@/lib/ai-reply/provider";
import { isBillingSandboxEnabled } from "@/lib/billing/flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

export type AssistantActionState = {
  message: string;
  proposals: { id: string; kind: string; label: string; detail: string }[];
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

function safeReturn(value: FormDataEntryValue | null) {
  const path = String(value ?? "").split("?")[0];
  if (
    path.startsWith("/command-centre/bots")
    || path.startsWith("/command-centre/agents")
    || path === "/command-centre/team"
    || path === "/command-centre/setup"
  ) return path;
  return "/command-centre/bots";
}

function withNotice(path: string, message: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}notice=${encodeURIComponent(message)}`);
}

async function manageable(slug: string) {
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.mode !== "member" || workspace.active.slug !== slug || !canManage(workspace.role)) return null;
  return workspace;
}

export async function startBotTrial(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const bot = String(formData.get("bot") ?? "") || null;
  const bundle = String(formData.get("bundle") ?? "") || null;
  const intent = String(formData.get("intent") ?? "trial") === "buy" ? "buy" : "trial";
  const back = safeReturn(formData.get("return_to"));
  const workspace = await manageable(slug);
  if (!workspace) {
    withNotice(back, "Preview workspace, or sign in as a workspace admin. Nothing was stored and nothing was sent.");
  }
  const opened = openBotCheckout({
    orgId: workspace.active.id,
    orgName: workspace.active.name,
    botSlug: bot,
    bundleSlug: bundle,
    intent,
    env: process.env,
  });
  if (!opened.lines.length) withNotice(back, opened.checkout.message);
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("start_bot_sandbox_trial", {
    p_org: workspace.active.id,
    p_bot_slug: bot,
    p_bundle_slug: bundle,
  });
  if (saved.error) withNotice(back, saved.error.message);
  revalidatePath("/command-centre/bots");
  const label = bundle || bot || "bot";
  const checkoutNote = opened.checkout.mode === "form"
    ? " Sandbox checkout is ready."
    : "";
  withNotice(back, `${intent === "buy" ? "Sandbox buy" : "Sandbox trial"} recorded for ${label}.${checkoutNote} No charge was sent.`);
}

export async function applyBotTemplate(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const template = String(formData.get("template") ?? "");
  const back = safeReturn(formData.get("return_to"));
  const workspace = await manageable(slug);
  if (!workspace) {
    withNotice(back, "Preview workspace, or sign in as a workspace admin. The template was not applied. Nothing was sent.");
  }
  if (!isBillingSandboxEnabled()) {
    withNotice(back, "Billing sandbox is off. Set BILLING_SANDBOX=true. The template was not applied and no charge was sent.");
  }
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("apply_bot_template", {
    p_org: workspace.active.id,
    p_slug: template,
  });
  if (saved.error) withNotice(back, saved.error.message);
  const payload = saved.data as { charged?: boolean; sending_enabled?: boolean } | null;
  if (payload?.charged === true || payload?.sending_enabled === true) {
    withNotice(back, "Template apply was refused. Nothing was sent.");
  }
  revalidatePath("/command-centre/bots");
  withNotice(back, `${template} applied. Pipelines, workflows, and bot config were saved. Sending stays off and no charge was sent.`);
}

export async function updateInstalledBot(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const bot = String(formData.get("bot") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = safeReturn(formData.get("return_to"));
  const workspace = await manageable(slug);
  if (!workspace) withNotice(back, "Preview workspace. Nothing was stored and nothing was sent.");
  const supabase = await createSupabaseServerClient();
  const existing = await supabase.from("org_bots").select("id, config").eq("org_id", workspace.active.id).eq("bot_slug", bot).maybeSingle();
  if (existing.error || !existing.data) {
    withNotice(back, existing.error?.message || "Start a sandbox trial before changing this bot. Nothing was sent.");
  }
  const current = existing.data.config && typeof existing.data.config === "object" ? existing.data.config as Record<string, unknown> : {};
  const hours = current.workingHours && typeof current.workingHours === "object" ? current.workingHours as Record<string, unknown> : {};
  const text = (name: string, fallback: unknown) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || (typeof fallback === "string" ? fallback : "");
  };
  const config = {
    ...current,
    tone: text("tone", current.tone),
    pipeline: text("pipeline", current.pipeline),
    stage: text("stage", current.stage),
    channel: text("channel", current.channel),
    workingHours: {
      ...hours,
      start: text("hours_start", hours.start) || "08:00",
      end: text("hours_end", hours.end) || "17:00",
    },
  };
  const patch: { config: typeof config; status?: string } = { config };
  if (status === "active" || status === "paused" || status === "trial" || status === "cancelled") patch.status = status;
  const saved = await supabase.from("org_bots").update(patch).eq("id", existing.data.id).eq("org_id", workspace.active.id);
  if (saved.error) withNotice(back, saved.error.message);
  revalidatePath(`/command-centre/bots/${bot}`);
  withNotice(back, "Bot settings saved. Nothing was sent.");
}

export async function runInstalledBot(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const bot = String(formData.get("bot") ?? "");
  const back = safeReturn(formData.get("return_to"));
  const workspace = await manageable(slug);
  if (!workspace) withNotice(back, "Preview workspace. The bot was not run and nothing was sent.");
  const supabase = await createSupabaseServerClient();
  const installed = await supabase.from("org_bots").select("id, config, status").eq("org_id", workspace.active.id).eq("bot_slug", bot).maybeSingle();
  if (installed.error || !installed.data) {
    withNotice(back, installed.error?.message || "Start a sandbox trial before running this bot. Nothing was sent.");
  }
  if (installed.data.status === "paused" || installed.data.status === "cancelled") {
    withNotice(back, "This bot is paused. Nothing was sent.");
  }
  const org = await supabase.from("organizations").select("sending_enabled").eq("id", workspace.active.id).maybeSingle();
  const run = runBot({
    slug: bot,
    config: installed.data.config && typeof installed.data.config === "object" ? installed.data.config as Partial<import("@/lib/bots/catalog").BotConfig> : undefined,
    sendingEnabled: org.data?.sending_enabled === true,
    suppressed: false,
    stopped: false,
    consents: bot === "outbound-sales" ? [] : [{ channel: "whatsapp", status: "opted_in" }],
    leadName: "there",
  });
  if (run.artifacts.some((item) => item.outboxStatus && item.outboxStatus !== "draft")) {
    withNotice(back, "The bot tried to queue a message. It was refused and nothing was sent.");
  }
  if (run.output.outboxStatus === "draft") {
    const drafted = await supabase.rpc("record_bot_outbox_draft", {
      p_org: workspace.active.id,
      p_bot_slug: bot,
      p_summary: run.summary,
      p_body: run.output.draftBody || run.summary,
      p_channel: "whatsapp",
      p_lead_id: null,
    });
    if (drafted.error) withNotice(back, drafted.error.message);
  } else {
    const logged = await supabase.from("bot_runs").insert({
      org_id: workspace.active.id,
      org_bot_id: installed.data.id,
      bot_slug: bot,
      kind: run.kind,
      status: run.status,
      summary: run.summary,
      output: run.output,
    });
    if (logged.error) withNotice(back, logged.error.message);
  }
  revalidatePath(`/command-centre/bots/${bot}`);
  withNotice(back, `${run.summary}`);
}

export async function proposeBotAssistant(
  _state: AssistantActionState,
  formData: FormData,
): Promise<AssistantActionState> {
  if (!isBotAssistantEnabled()) return { message: assistantUnavailableMessage(), proposals: [] };
  const request = String(formData.get("request") ?? "");
  const plan = await proposeAssistantActions({
    request,
    provider: createOpenAiCompatibleProvider(process.env),
  });
  return { message: plan.message, proposals: plan.proposals };
}

export async function applyBotAssistant(
  _state: AssistantActionState,
  formData: FormData,
): Promise<AssistantActionState> {
  if (!isBotAssistantEnabled()) return { message: assistantUnavailableMessage(), proposals: [] };
  const proposals = proposalsFromText(String(formData.get("payload") ?? ""));
  const ids = formData.getAll("id").map((value) => String(value));
  const book: AssistantBook = { sendingEnabled: false, tasks: [], drafts: [], stageMoves: [], activeBots: [] };
  let next = book;
  try {
    next = applyConfirmedActions(book, proposals, ids);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Those actions were not applied.";
    return { message: `${message} Nothing was sent.`, proposals };
  }
  return {
    message: `Applied ${next.tasks.length} task${next.tasks.length === 1 ? "" : "s"}, ${next.drafts.length} draft${next.drafts.length === 1 ? "" : "s"}, ${next.stageMoves.length} stage move${next.stageMoves.length === 1 ? "" : "s"}, and ${next.activeBots.length} bot activation${next.activeBots.length === 1 ? "" : "s"}. Nothing was sent.`,
    proposals: [],
  };
}

function readAnswers(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "{}")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const answers: Record<string, string> = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (typeof item === "string" && /^[a-z0-9-]{1,40}$/.test(key)) answers[key] = item.slice(0, 500);
    }
    return answers;
  } catch {
    return {};
  }
}

export async function buildRecommendedTeam(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const templateSlug = String(formData.get("template") ?? "");
  const back = safeReturn(formData.get("return_to"));
  const workspace = await manageable(slug);
  if (!workspace) {
    withNotice(back, "Preview workspace, or sign in as a workspace admin. The team was not applied. Nothing was sent.");
  }
  let template: ReturnType<typeof templateBySlug>;
  try {
    template = templateBySlug(templateSlug);
  } catch {
    withNotice(back, "That team is not in the catalogue. Nothing was sent.");
  }
  const answers = readAnswers(formData.get("answers"));
  const opened = openBotCheckout({
    orgId: workspace.active.id,
    orgName: workspace.active.name,
    bundleSlug: template.bundleSlug,
    intent: "buy",
    env: process.env,
  });
  const configured = configurePaidTeam({
    orgId: workspace.active.id,
    orgName: workspace.active.name,
    templateSlug: template.slug,
    answers,
    checkout: opened.checkout,
    lines: opened.lines,
    env: process.env,
  });
  if (!configured.configured) withNotice(back, configured.reason);
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("apply_bot_template", {
    p_org: workspace.active.id,
    p_slug: template.slug,
  });
  if (saved.error) withNotice(back, saved.error.message);
  const payload = saved.data as { charged?: boolean; sending_enabled?: boolean } | null;
  if (payload?.charged === true || payload?.sending_enabled === true) {
    withNotice(back, "The team was refused. Nothing was sent.");
  }
  for (const bot of configured.book.bots) {
    const updated = await supabase.from("org_bots").update({ config: bot.config }).eq("org_id", workspace.active.id).eq("bot_slug", bot.botSlug);
    if (updated.error) withNotice(back, updated.error.message);
  }
  revalidatePath("/command-centre/bots");
  revalidatePath("/command-centre/agents");
  revalidatePath("/command-centre/setup");
  const notice = "Sandbox checkout succeeded. Every agent, pipeline, workflow, and template is configured. Nothing was sent. Connect your accounts and import your contacts.";
  redirect(`/command-centre/setup?team=${encodeURIComponent(template.slug)}&paid=1&notice=${encodeURIComponent(notice)}`);
}

export async function polishTeamCopy(formData: FormData) {
  if (!isBotAssistantEnabled()) return null;
  let recommendation: TeamRecommendation;
  try {
    recommendation = JSON.parse(String(formData.get("recommendation") ?? "")) as TeamRecommendation;
  } catch {
    return null;
  }
  if (!recommendation || !Array.isArray(recommendation.agents)) return null;
  const polished = await polishRecommendationExplanations(recommendation, (messages) => createOpenAiCompatibleProvider(process.env).complete(messages));
  return polished.agents.map((agent) => agent.why);
}

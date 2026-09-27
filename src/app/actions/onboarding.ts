"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { onboardingBotConfigs } from "@/lib/bots/onboarding-config";
import {
  parseAgentAnswers,
  parseBusinessProfile,
  quoteForTeam,
  recommendFullTeam,
} from "@/lib/bots/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

function backPath() {
  return "/command-centre/lead-agent";
}

function withNotice(message: string): never {
  redirect(`${backPath()}?notice=${encodeURIComponent(message)}`);
}

function readJson(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return null;
  }
}

export async function startLeadOnboardingTeam(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.mode !== "member" || workspace.active.slug !== slug || !canManage(workspace.role)) {
    withNotice("Preview workspace, or sign in as a workspace admin. The sandbox trial was not recorded. Nothing was sent.");
  }
  const profile = parseBusinessProfile(readJson(formData.get("profile")));
  if (!profile) {
    withNotice("Answer the niche, at least one goal, and at least one channel. Nothing was sent.");
  }
  const answers = parseAgentAnswers(readJson(formData.get("answers")));
  if (!answers.hours && profile.hours) answers.hours = profile.hours;

  let recommendation: ReturnType<typeof recommendFullTeam>;
  try {
    recommendation = recommendFullTeam(profile);
  } catch {
    withNotice("That niche does not match a full catalogue team. Nothing was sent.");
  }
  const quote = quoteForTeam(recommendation);
  const slugs = recommendation.agents.map((agent) => agent.slug);
  const supabase = await createSupabaseServerClient();
  const recorded = await supabase.rpc("record_lead_onboarding_trial", {
    p_org: workspace.active.id,
    p_template_slug: recommendation.templateSlug,
    p_slugs: slugs,
    p_business: profile,
    p_agent_answers: answers,
    p_quote: quote,
  });
  if (recorded.error) withNotice(recorded.error.message);
  const payload = recorded.data as {
    sandbox?: boolean;
    charged?: boolean;
    sending_enabled?: boolean;
    bots?: number;
  } | null;
  if (!payload || payload.sandbox !== true || payload.charged === true || payload.bots !== slugs.length) {
    withNotice("The sandbox trial was refused. Nothing was sent.");
  }

  const configs = onboardingBotConfigs(recommendation.templateSlug, answers, profile);
  for (const bot of configs) {
    const existing = await supabase.from("org_bots").select("id, config").eq("org_id", workspace.active.id).eq("bot_slug", bot.slug).maybeSingle();
    if (existing.error || !existing.data) {
      withNotice(existing.error?.message || "The sandbox trial was recorded. Agent settings were not saved. Nothing was sent.");
    }
    const current = existing.data.config && typeof existing.data.config === "object" ? existing.data.config as Record<string, unknown> : {};
    const saved = await supabase.from("org_bots").update({
      config: { ...current, ...bot.config },
    }).eq("id", existing.data.id).eq("org_id", workspace.active.id);
    if (saved.error) withNotice(saved.error.message);
  }

  revalidatePath("/command-centre/lead-agent");
  revalidatePath("/command-centre/bots");
  revalidatePath("/command-centre/agents");
  const notice = "Sandbox trial recorded for the full team. No charge was sent. Connect accounts and import contacts after the subscription is paid. Nothing was sent.";
  redirect(`${backPath()}?started=1&team=${encodeURIComponent(recommendation.templateSlug)}&notice=${encodeURIComponent(notice)}`);
}

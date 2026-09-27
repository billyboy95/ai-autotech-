"use server";

import { redirect } from "next/navigation";
import { botBySlug } from "@/lib/bots/catalog";
import { usesFixtureComputers } from "@/lib/computers/load";
import { allowanceSecondsForAgent, canOpenComputer, clampTick } from "@/lib/computers/meter";
import { computerPagePath } from "@/lib/computers/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import type { MembershipRole } from "@/lib/tenant/types";

function missingComputerTable(message: string) {
  return /does not exist|schema cache|could not find|agent_computers/i.test(message);
}

export async function addFixtureComputerMinute(formData: FormData) {
  const bot = String(formData.get("bot") ?? "");
  const viewOnly = String(formData.get("view_only") ?? "1") !== "0";
  const tick = clampTick(formData.get("tick"));
  if (!/^[a-z0-9-]{1,80}$/.test(bot)) redirect("/command-centre/bots");
  const workspace = await safeResolveWorkspace(String(formData.get("slug") ?? "") || null);
  const back = (nextTick: number, notice?: string) =>
    computerPagePath(bot, { org: workspace.active.slug, viewOnly, tick: nextTick, notice: notice ?? null });

  let department = "";
  try {
    department = botBySlug(bot).department;
  } catch {
    redirect("/command-centre/bots");
  }

  const fixture = usesFixtureComputers({
    mode: workspace.mode,
    scoped: workspace.scoped,
    orgId: workspace.active.id,
  });
  if (fixture) redirect(back(tick + 1));

  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  const viewerUserId = user.data.user?.id ?? null;
  let assignedOnly = false;
  if (viewerUserId && workspace.role === "client_user") {
    const membership = await supabase
      .from("memberships")
      .select("assigned_only")
      .eq("user_id", viewerUserId)
      .eq("org_id", workspace.active.id)
      .maybeSingle();
    if (!membership.error && membership.data) assignedOnly = Boolean(membership.data.assigned_only);
  }
  const existing = await supabase
    .from("agent_computers")
    .select("assigned_user_id")
    .eq("org_id", workspace.active.id)
    .eq("bot_slug", bot)
    .maybeSingle();
  if (existing.error) {
    if (missingComputerTable(existing.error.message)) {
      redirect(back(tick + 1, "Computer tables are not applied yet. The minute was counted on this page only. Nothing was charged."));
    }
    redirect(back(tick, existing.error.message));
  }
  const assignedUserId = existing.data?.assigned_user_id
    ? String(existing.data.assigned_user_id)
    : assignedOnly
      ? viewerUserId
      : null;
  if (!canOpenComputer({
    role: workspace.role as MembershipRole | null,
    assignedOnly,
    assignedUserId,
    viewerUserId,
  })) {
    redirect(back(tick, "You can open this computer when you are an agency owner, a client admin, or assigned to this agent."));
  }

  const ensured = await supabase.rpc("ensure_agent_computer", {
    p_org: workspace.active.id,
    p_bot_slug: bot,
    p_allowance_seconds: allowanceSecondsForAgent(bot, department),
    p_assigned: assignedUserId,
  });
  if (ensured.error) redirect(back(tick, ensured.error.message));
  const added = await supabase.rpc("add_agent_computer_fixture_minute", {
    p_org: workspace.active.id,
    p_bot_slug: bot,
  });
  if (added.error) redirect(back(tick, added.error.message));
  redirect(back(0, "Added one sandbox minute. Nothing was charged."));
}

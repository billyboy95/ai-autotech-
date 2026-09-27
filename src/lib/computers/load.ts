import { botBySlug } from "@/lib/bots/catalog";
import {
  allowanceHoursForAgent,
  allowanceSecondsForAgent,
  canOpenComputer,
  clampTick,
  computerMeter,
} from "@/lib/computers/meter";
import { resolveComputerProvider, type ComputerProviderName, type ComputerStatus } from "@/lib/computers/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import type { MembershipRole } from "@/lib/tenant/types";

export type ComputerViewData = {
  preview: boolean;
  found: boolean;
  canOpen: boolean;
  orgSlug: string;
  botSlug: string;
  botName: string;
  department: string;
  provider: ComputerProviderName;
  status: ComputerStatus;
  sandbox: true;
  viewOnly: boolean;
  tick: number;
  liveViewUrl: string;
  allowanceHours: number;
  usedSeconds: number;
  overAllowance: boolean;
  notice: string | null;
  pricePlaceholder: true;
};

function connected() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function usesFixtureComputers(input: { mode: string; scoped: boolean; orgId: string }) {
  return !connected() || input.mode !== "member" || !input.scoped || input.orgId.startsWith("preview-");
}

function missingComputerTable(message: string) {
  return /does not exist|schema cache|could not find|agent_computers/i.test(message);
}

function emptyView(input: {
  orgSlug: string;
  slug: string;
  viewOnly: boolean;
  tick: number;
  notice: string | null;
  name?: string;
}): ComputerViewData {
  return {
    preview: true,
    found: false,
    canOpen: false,
    orgSlug: input.orgSlug,
    botSlug: input.slug,
    botName: input.name ?? "Unknown agent",
    department: "",
    provider: "fixture",
    status: "idle",
    sandbox: true,
    viewOnly: input.viewOnly,
    tick: input.tick,
    liveViewUrl: "",
    allowanceHours: 0,
    usedSeconds: 0,
    overAllowance: false,
    notice: input.notice,
    pricePlaceholder: true,
  };
}

export async function loadComputerView(input: {
  org?: string | null;
  slug: string;
  viewOnly?: boolean;
  tick?: number;
  notice?: string | null;
}): Promise<ComputerViewData> {
  const viewOnly = input.viewOnly !== false;
  const tick = clampTick(input.tick ?? 0);
  const tenant = await safeResolveWorkspace(input.org);
  const notice = input.notice ?? null;
  let bot: ReturnType<typeof botBySlug> | null = null;
  try {
    bot = botBySlug(input.slug);
  } catch {
    bot = null;
  }
  if (!bot) {
    return emptyView({ orgSlug: tenant.active.slug, slug: input.slug, viewOnly, tick, notice: notice ?? "That agent is not in the catalogue." });
  }

  const fixture = usesFixtureComputers({ mode: tenant.mode, scoped: tenant.scoped, orgId: tenant.active.id });
  let assignedOnly = false;
  let viewerUserId: string | null = null;
  let assignedUserId: string | null = null;
  let storedSeconds = 0;
  let storedStatus: ComputerStatus = "idle";
  let persisted = false;
  let tableNotice: string | null = null;

  if (!fixture) {
    const supabase = await createSupabaseServerClient();
    const user = await supabase.auth.getUser();
    viewerUserId = user.data.user?.id ?? null;
    if (viewerUserId && tenant.role === "client_user") {
      const membership = await supabase
        .from("memberships")
        .select("assigned_only")
        .eq("user_id", viewerUserId)
        .eq("org_id", tenant.active.id)
        .maybeSingle();
      if (!membership.error && membership.data) assignedOnly = Boolean(membership.data.assigned_only);
    }
    const row = await supabase
      .from("agent_computers")
      .select("status, hours_used_seconds, assigned_user_id, provider, sandbox")
      .eq("org_id", tenant.active.id)
      .eq("bot_slug", bot.slug)
      .maybeSingle();
    if (row.error) {
      if (missingComputerTable(row.error.message)) {
        tableNotice = "Computer tables are not in this database yet. Apply step 22 before saving minutes. Nothing was charged.";
      }
    } else if (row.data) {
      persisted = true;
      storedSeconds = Number(row.data.hours_used_seconds ?? 0);
      assignedUserId = row.data.assigned_user_id ? String(row.data.assigned_user_id) : null;
      const status = String(row.data.status);
      if (status === "idle" || status === "running" || status === "paused" || status === "error") storedStatus = status;
    }
  }

  const canOpen = canOpenComputer({
    role: tenant.role as MembershipRole | null,
    assignedOnly,
    assignedUserId,
    viewerUserId,
  });
  const usedSeconds = persisted ? storedSeconds : tick * 60;
  const allowanceSeconds = allowanceSecondsForAgent(bot.slug, bot.department);
  const meter = computerMeter({ allowanceSeconds, usedSeconds, status: storedStatus });
  const provider = resolveComputerProvider();
  let status = meter.status;
  let liveViewUrl = "";
  if (canOpen) {
    const session = await provider.createSession({ orgId: tenant.active.id, botSlug: bot.slug });
    const settled = meter.overAllowance ? await provider.pause(session.id) : await provider.resume(session.id);
    status = meter.overAllowance ? "paused" : settled.status;
    liveViewUrl = await provider.getLiveViewUrl({ sessionId: session.id, viewOnly });
  }

  return {
    preview: fixture,
    found: true,
    canOpen,
    orgSlug: tenant.active.slug,
    botSlug: bot.slug,
    botName: bot.name,
    department: bot.department,
    provider: provider.name,
    status,
    sandbox: true,
    viewOnly,
    tick,
    liveViewUrl,
    allowanceHours: allowanceHoursForAgent(bot.slug, bot.department),
    usedSeconds: meter.usedSeconds,
    overAllowance: meter.overAllowance,
    notice: notice ?? tableNotice ?? (fixture
      ? "Sandbox computer. No desktop is connected and nothing is charged."
      : "Sandbox computer. The minute counter does not spend."),
    pricePlaceholder: true,
  };
}

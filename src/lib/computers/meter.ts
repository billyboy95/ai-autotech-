import type { ComputerStatus } from "@/lib/computers/provider";
import { PLATFORM_INCLUDED_HOURS, tierForAgent, tierHours } from "@/lib/pricing/price-sheet";
import type { MembershipRole } from "@/lib/tenant/types";

/** One fixture tick. Display and the sandbox ledger only. It does not spend. */
export const FIXTURE_INCREMENT_SECONDS = 60;

export function allowanceHoursForAgent(slug: string, department: string) {
  const tier = tierForAgent(slug, department);
  const hours = tierHours(tier);
  if (hours > 0) return hours;
  if (tier === "included") return PLATFORM_INCLUDED_HOURS;
  return 0;
}

export function allowanceSecondsForAgent(slug: string, department: string) {
  return allowanceHoursForAgent(slug, department) * 3600;
}

export function computerMeter(input: {
  allowanceSeconds: number;
  usedSeconds: number;
  status: ComputerStatus;
}) {
  const usedSeconds = Math.max(0, input.usedSeconds);
  const allowanceSeconds = Math.max(0, input.allowanceSeconds);
  const overAllowance = usedSeconds > allowanceSeconds;
  return {
    allowanceSeconds,
    allowanceHours: allowanceSeconds / 3600,
    usedSeconds,
    overAllowance,
    status: overAllowance ? "paused" as const : input.status,
    sandbox: true as const,
  };
}

export function formatComputerUsage(usedSeconds: number) {
  if (usedSeconds < 3600) return `${Math.floor(Math.max(0, usedSeconds) / 60)} min`;
  const hours = Math.round((usedSeconds / 3600) * 10) / 10;
  return `${hours}h`;
}

export function clampTick(value: unknown) {
  const tick = Number(value);
  if (!Number.isFinite(tick) || tick < 0) return 0;
  return Math.min(10_000, Math.floor(tick));
}

export function canOpenComputer(input: {
  role: MembershipRole | null;
  assignedOnly: boolean;
  assignedUserId: string | null;
  viewerUserId: string | null;
}) {
  if (input.role === "agency_owner" || input.role === "agency_staff" || input.role === "client_admin") return true;
  if (input.role !== "client_user") return false;
  if (!input.assignedOnly) return true;
  return Boolean(input.viewerUserId && input.assignedUserId === input.viewerUserId);
}

export function computerDetailFields(input: {
  slug: string;
  department: string;
  canViewComputer: boolean;
  usedSeconds: number;
  status: ComputerStatus;
}) {
  const allowanceSeconds = allowanceSecondsForAgent(input.slug, input.department);
  const meter = computerMeter({
    allowanceSeconds,
    usedSeconds: input.usedSeconds,
    status: input.status,
  });
  return {
    canViewComputer: input.canViewComputer,
    computerAllowanceHours: allowanceHoursForAgent(input.slug, input.department),
    computerUsedSeconds: meter.usedSeconds,
    computerStatus: meter.status,
  };
}

export const HIDDEN_COMPUTER = {
  canViewComputer: false,
  computerAllowanceHours: 0,
  computerUsedSeconds: 0,
  computerStatus: "idle" as const,
};

import type { EnvLike } from "@/lib/automation/channels";
import { PAYFAST_SANDBOX_MERCHANT_ID, isBillingSandboxEnabled, payfastMerchantId } from "@/lib/billing/flag";
import { payfastMode } from "@/lib/payfast/config";
import { SEAT_ADDON_LINES } from "@/lib/pricing/price-sheet";
import type { BillingPlan } from "@/lib/billing/types";

export type SeatPlanView = {
  code: string;
  name: string;
  priceCents: number;
  interval: "month";
};

export type SeatBillingView = {
  teamSeats: number | null;
  whatsappNumbers: number | null;
  plans: SeatPlanView[];
  notice: string | null;
};

const ADDON_CODES = new Set<string>(SEAT_ADDON_LINES.map((line) => line.code));

/** On only when TEAM_SEAT_BILLING_ENABLED is the exact string true. */
export function isTeamSeatBillingEnabled(env: EnvLike = process.env) {
  return String(env.TEAM_SEAT_BILLING_ENABLED ?? "") === "true";
}

export function isSeatAddonPlanCode(code: string) {
  return ADDON_CODES.has(code);
}

export function seatAddonPlans(): SeatPlanView[] {
  return SEAT_ADDON_LINES.map((line) => ({
    code: line.code,
    name: line.name,
    priceCents: line.priceCents,
    interval: "month",
  }));
}

export function seatAddonPlan(code: string): BillingPlan | null {
  const line = SEAT_ADDON_LINES.find((item) => item.code === code);
  if (!line) return null;
  return {
    code: line.code,
    name: line.name,
    priceCents: line.priceCents,
    interval: "month",
    currency: "ZAR",
  };
}

/** Distinct membership rows. Empty input is zero seats, not an error. */
export function countTeamSeats(rows: { userId?: string | null; user_id?: string | null }[] | null | undefined) {
  const ids = new Set<string>();
  for (const row of rows ?? []) {
    const id = String(row.userId ?? row.user_id ?? "").trim();
    if (id) ids.add(id);
  }
  return ids.size;
}

/**
 * Connected WhatsApp lines only. The same stored number counts once.
 * A connected row with a blank identifier still counts as one line.
 */
export function countConnectedWhatsappNumbers(
  rows: { channel?: string | null; status?: string | null; identifier?: string | null }[] | null | undefined,
) {
  const numbers = new Set<string>();
  let blank = 0;
  for (const row of rows ?? []) {
    if (String(row.channel ?? "").trim().toLowerCase() !== "whatsapp") continue;
    if (String(row.status ?? "").trim().toLowerCase() !== "connected") continue;
    const identifier = String(row.identifier ?? "").trim();
    if (identifier) numbers.add(identifier);
    else blank += 1;
  }
  return numbers.size + blank;
}

/**
 * Placeholder arithmetic for tests and dry review. This does not create an invoice and does not charge.
 */
export function placeholderAddonCents(extraSeats: number, extraNumbers: number) {
  const seats = Number.isFinite(extraSeats) ? Math.max(0, Math.floor(extraSeats)) : 0;
  const numbers = Number.isFinite(extraNumbers) ? Math.max(0, Math.floor(extraNumbers)) : 0;
  const seat = seatAddonPlan("extra_team_seat");
  const number = seatAddonPlan("extra_whatsapp_number");
  const seatCents = seats * (seat?.priceCents ?? 0);
  const numberCents = numbers * (number?.priceCents ?? 0);
  return {
    seatCents,
    numberCents,
    totalCents: seatCents + numberCents,
    placeholder: true as const,
    charged: false as const,
    currency: "ZAR" as const,
  };
}

export function visiblePlans<T extends { code: string }>(plans: T[], enabled: boolean): T[] {
  const withoutAddons = plans.filter((plan) => !ADDON_CODES.has(plan.code));
  if (!enabled) return withoutAddons;
  const present = new Set(plans.filter((plan) => ADDON_CODES.has(plan.code)).map((plan) => plan.code));
  const extras = seatAddonPlans().filter((plan) => !present.has(plan.code)) as unknown as T[];
  const kept = plans.filter((plan) => ADDON_CODES.has(plan.code));
  return [...withoutAddons, ...kept, ...extras];
}

export function buildSeatBilling(input: {
  enabled: boolean;
  preview?: boolean;
  membershipRows?: { userId?: string | null; user_id?: string | null }[] | null;
  connectionRows?: { channel?: string | null; status?: string | null; identifier?: string | null }[] | null;
  membershipMissing?: boolean;
  connectionMissing?: boolean;
}): SeatBillingView | null {
  if (!input.enabled) return null;
  const notices: string[] = [];
  let teamSeats: number | null = null;
  let whatsappNumbers: number | null = null;
  if (input.preview) {
    notices.push("Preview only. Seat and number counts appear after you sign in.");
  } else {
    if (input.membershipMissing) {
      notices.push("Team seat count is unavailable. Memberships could not be read.");
    } else {
      teamSeats = countTeamSeats(input.membershipRows);
    }
    if (input.connectionMissing) {
      notices.push("WhatsApp number count is unavailable. Channel connections could not be read.");
    } else {
      whatsappNumbers = countConnectedWhatsappNumbers(input.connectionRows);
    }
  }
  return {
    teamSeats,
    whatsappNumbers,
    plans: seatAddonPlans(),
    notice: notices.length > 0 ? notices.join(" ") : null,
  };
}

export function applySeatBilling<T extends { plans: { code: string; name?: string; priceCents?: number }[] }>(
  model: T,
  input: {
    env?: EnvLike;
    preview?: boolean;
    membershipRows?: { userId?: string | null; user_id?: string | null }[] | null;
    connectionRows?: { channel?: string | null; status?: string | null; identifier?: string | null }[] | null;
    membershipMissing?: boolean;
    connectionMissing?: boolean;
  },
): T & { seatBilling: SeatBillingView | null } {
  const enabled = isTeamSeatBillingEnabled(input.env);
  const plans = visiblePlans(model.plans, enabled);
  const seat = buildSeatBilling({ ...input, enabled });
  if (!seat) return { ...model, plans, seatBilling: null };
  const listed = plans.filter((plan) => isSeatAddonPlanCode(plan.code));
  return {
    ...model,
    plans,
    seatBilling: {
      ...seat,
      plans: listed.map((plan) => ({
        code: plan.code,
        name: plan.name || seat.plans.find((line) => line.code === plan.code)?.name || plan.code,
        priceCents: Number.isFinite(plan.priceCents) ? Number(plan.priceCents) : seat.plans.find((line) => line.code === plan.code)?.priceCents || 0,
        interval: "month" as const,
      })),
    },
  };
}

/**
 * Seat and number checkout stays closed unless the flag is the string true,
 * PayFast is not in live mode, and the merchant id is blank or the sandbox merchant.
 * Platform plans are unchanged: this returns null for any other code.
 */
export function seatCheckoutRefusal(planCode: string, env: EnvLike = process.env) {
  if (!isSeatAddonPlanCode(planCode)) return null;
  if (!isTeamSeatBillingEnabled(env)) {
    return "Team seat billing is off. No charge was sent.";
  }
  if (payfastMode(env) === "live") {
    return "Team seat checkout stays on the PayFast sandbox. Live mode was refused. No charge was sent.";
  }
  const merchant = payfastMerchantId(env);
  if (merchant && merchant !== PAYFAST_SANDBOX_MERCHANT_ID) {
    return "Refusing PayFast checkout because PAYFAST_MERCHANT_ID is not sandbox merchant 10000100. No charge was sent.";
  }
  return null;
}

export function resolveCheckoutPlan(
  planCode: string,
  dbRow: { code?: string; name?: string; price_cents?: number; interval?: string } | null,
  env: EnvLike = process.env,
): { ok: true; plan: BillingPlan } | { ok: false; message: string } {
  if (!isBillingSandboxEnabled(env)) {
    return { ok: false, message: "Billing sandbox is off. Set BILLING_SANDBOX=true. No charge was sent." };
  }
  const blocked = seatCheckoutRefusal(planCode, env);
  if (blocked) return { ok: false, message: blocked };
  if (dbRow?.code) {
    return {
      ok: true,
      plan: {
        code: String(dbRow.code),
        name: String(dbRow.name || dbRow.code),
        priceCents: Number(dbRow.price_cents),
        interval: String(dbRow.interval) === "year" ? "year" : "month",
        currency: "ZAR",
      },
    };
  }
  const addon = isTeamSeatBillingEnabled(env) ? seatAddonPlan(planCode) : null;
  if (!addon) return { ok: false, message: "That plan is not available. No charge was sent." };
  return { ok: true, plan: addon };
}

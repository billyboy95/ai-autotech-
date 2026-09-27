import { headers } from "next/headers";
import { referralQrSvg } from "@/lib/referrals/qr";
import {
  PLACEHOLDER_TIERS,
  referralLink,
  type ReferralStatus,
  type ReferralTier,
  type RewardStatus,
  type RewardType,
} from "@/lib/referrals/codes";
import { previewReferralDesk } from "@/lib/referrals/preview";
import type { LeaderRow, ReferralDesk, ReferralProgramView, ReferralRewardView, ReferralRowView } from "@/lib/referrals/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

async function siteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") || headerStore.get("host") || "").split(",")[0].trim();
  if (!host) return "";
  const forwarded = (headerStore.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwarded || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function missingRelation(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find");
}

function asRewardType(value: unknown): RewardType {
  if (value === "percent_off_months" || value === "cash_commission" || value === "account_credit") return value;
  return "account_credit";
}

function asStatus(value: unknown): ReferralStatus {
  if (value === "signed_up" || value === "paid" || value === "rewarded" || value === "void" || value === "clicked") return value;
  return "clicked";
}

function asRewardStatus(value: unknown): RewardStatus {
  if (value === "approved" || value === "paid" || value === "void" || value === "pending") return value;
  return "pending";
}

function parseTiers(value: unknown): ReferralTier[] {
  if (!Array.isArray(value)) return PLACEHOLDER_TIERS;
  const tiers = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const name = String(row.name || "").trim();
    const paidReferrals = Number(row.paid_referrals);
    if (!name || !Number.isFinite(paidReferrals)) return [];
    return [{
      name,
      paidReferrals,
      rewardType: asRewardType(row.reward_type),
      amountCents: Number(row.amount_cents) || 0,
    }];
  });
  return tiers.length ? tiers : PLACEHOLDER_TIERS;
}

function programFrom(row: Record<string, unknown> | null): ReferralProgramView {
  if (!row) {
    return {
      holdDays: 14,
      rewardType: "account_credit",
      accountCreditCents: 50000,
      percentOff: 10,
      percentOffMonths: 1,
      cashCommissionCents: 25000,
      tiers: PLACEHOLDER_TIERS,
      enabled: true,
    };
  }
  return {
    holdDays: Number(row.hold_days) || 0,
    rewardType: asRewardType(row.reward_type),
    accountCreditCents: Number(row.account_credit_cents) || 0,
    percentOff: Number(row.percent_off) || 0,
    percentOffMonths: Number(row.percent_off_months) || 0,
    cashCommissionCents: Number(row.cash_commission_cents) || 0,
    tiers: parseTiers(row.tiers),
    enabled: row.enabled !== false,
  };
}

function statsFor(rows: { status: ReferralStatus }[], rewards: ReferralRewardView[]) {
  const live = rows.filter((row) => row.status !== "void");
  const earnedCents = rewards
    .filter((reward) => reward.status === "approved" || reward.status === "paid")
    .reduce((sum, reward) => sum + reward.amountCents, 0);
  return {
    clicks: live.length,
    signups: live.filter((row) => row.status === "signed_up" || row.status === "paid" || row.status === "rewarded").length,
    paying: live.filter((row) => row.status === "paid" || row.status === "rewarded").length,
    earnedCents,
  };
}

function leaderboard(rows: ReferralRowView[]): LeaderRow[] {
  const byCode = new Map<string, LeaderRow>();
  for (const row of rows) {
    if (row.status === "void") continue;
    const current = byCode.get(row.displayCode) ?? { code: row.displayCode, clicks: 0, signups: 0, paying: 0 };
    current.clicks += 1;
    if (row.status === "signed_up" || row.status === "paid" || row.status === "rewarded") current.signups += 1;
    if (row.status === "paid" || row.status === "rewarded") current.paying += 1;
    byCode.set(row.displayCode, current);
  }
  return [...byCode.values()].sort((a, b) => b.paying - a.paying || b.signups - a.signups).slice(0, 8);
}

export async function loadReferralDesk(org?: string | null): Promise<ReferralDesk> {
  const tenant = await safeResolveWorkspace(org);
  const origin = await siteUrl();
  const preview = previewReferralDesk(tenant.active.slug, origin);
  preview.qrSvg = await referralQrSvg(preview.link);
  const connected = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!connected || tenant.mode !== "member" || !tenant.scoped || tenant.active.id.startsWith("preview-")) {
    return preview;
  }

  const canAdmin = isAgencyRole(tenant.role);
  const canEditProgram = tenant.role === "agency_owner" && tenant.active.orgType === "agency";
  const desk: ReferralDesk = {
    ...preview,
    preview: false,
    notice: null,
    canAdmin,
    canEditProgram,
    qrSvg: preview.qrSvg,
  };

  try {
    const supabase = await createSupabaseServerClient();
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id ?? null;
    if (!userId) return { ...desk, notice: "Sign in to load your referral link." };

    const ensured = await supabase.rpc("ensure_referral_code", { p_org: tenant.active.id, p_vanity: null, p_scope: "user" });
    if (ensured.error) {
      desk.notice = missingRelation(ensured.error)
        ? "Referral tables are not in this database yet. Apply step 19 in supabase/APPLY-ORDER.md. Nothing was saved and no payout was sent."
        : ensured.error.message;
      return desk;
    }
    const display = String((ensured.data as { display_code?: string } | null)?.display_code || desk.code);
    desk.code = display;
    desk.link = referralLink(display, origin);
    desk.qrSvg = await referralQrSvg(desk.link);

    const agencyId = tenant.active.orgType === "agency" ? tenant.active.id : tenant.active.parentId;
    const [referralResult, rewardResult, settingsResult, codeResult] = await Promise.all([
      supabase.from("referrals").select("id, status, source, referred_org_id, clicked_at, code_id, referrer_user_id").order("clicked_at", { ascending: false }).limit(200),
      supabase.from("referral_rewards").select("id, referral_id, reward_type, amount_cents, percent_off, months, status, hold_until, sandbox").order("created_at", { ascending: false }).limit(200),
      agencyId
        ? supabase.from("referral_program_settings").select("hold_days, reward_type, account_credit_cents, percent_off, percent_off_months, cash_commission_cents, tiers, enabled").eq("org_id", agencyId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("referral_codes").select("id, code, vanity_code").limit(200),
    ]);

    const failed = [referralResult.error, rewardResult.error, settingsResult.error, codeResult.error].find(Boolean);
    if (failed) {
      desk.notice = missingRelation(failed) ? "Referral tables are not in this database yet. Apply step 19 in supabase/APPLY-ORDER.md. Nothing was saved and no payout was sent." : failed.message;
      return desk;
    }

    const codes = new Map((codeResult.data ?? []).map((row) => {
      const id = String(row.id);
      return [id, String(row.vanity_code || row.code)] as const;
    }));

    const referrals: ReferralRowView[] = (referralResult.data ?? []).map((row) => ({
      id: String(row.id),
      status: asStatus(row.status),
      source: String(row.source || ""),
      displayCode: codes.get(String(row.code_id)) || "Code",
      referrerUserId: row.referrer_user_id ? String(row.referrer_user_id) : null,
      referredOrgId: row.referred_org_id ? String(row.referred_org_id) : null,
      clickedAt: String(row.clicked_at),
    }));
    const mine = referrals.filter((row) => row.referrerUserId === userId);
    const rewardCode = new Map(referrals.map((row) => [row.id, row.displayCode]));
    const rewards: ReferralRewardView[] = (rewardResult.data ?? []).map((row) => ({
      id: String(row.id),
      referralId: String(row.referral_id),
      rewardType: asRewardType(row.reward_type),
      amountCents: Number(row.amount_cents) || 0,
      percentOff: row.percent_off == null ? null : Number(row.percent_off),
      months: row.months == null ? null : Number(row.months),
      status: asRewardStatus(row.status),
      holdUntil: String(row.hold_until),
      sandbox: row.sandbox !== false,
      displayCode: rewardCode.get(String(row.referral_id)) || "Code",
    }));
    const mineIds = new Set(mine.map((row) => row.id));
    const visibleRewards = canAdmin ? rewards : rewards.filter((reward) => mineIds.has(reward.referralId));

    desk.program = programFrom((settingsResult.data ?? null) as Record<string, unknown> | null);
    const visibleReferrals = canAdmin ? referrals : mine;
    desk.referrals = visibleReferrals.slice(0, 50);
    desk.rewards = visibleRewards.slice(0, 50);
    desk.stats = statsFor(visibleReferrals, canAdmin ? rewards : visibleRewards);
    desk.payingCount = desk.stats.paying;
    desk.leaderboard = canAdmin ? leaderboard(referrals) : [];
  } catch (error) {
    desk.notice = error instanceof Error ? error.message : "Referral details could not be loaded.";
  }

  return desk;
}

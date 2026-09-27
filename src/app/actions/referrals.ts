"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { REFERRAL_COOKIE, readReferralCode, type RewardType } from "@/lib/referrals/codes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

export type ReferralActionState = {
  ok: boolean;
  message: string;
};

async function codeFromRequest(formData: FormData) {
  const posted = readReferralCode(String(formData.get("ref") ?? ""));
  if (posted) return posted;
  const stored = (await cookies()).get(REFERRAL_COOKIE)?.value;
  return readReferralCode(stored);
}

export async function saveVanityCode(
  _state: ReferralActionState,
  formData: FormData,
): Promise<ReferralActionState> {
  const slug = String(formData.get("org") ?? "");
  const tenant = await safeResolveWorkspace(slug);
  if (tenant.mode !== "member" || tenant.active.id.startsWith("preview-")) {
    return { ok: false, message: "Sign in before saving a vanity code. Nothing was stored." };
  }
  const vanity = String(formData.get("vanity") ?? "");
  const scope = String(formData.get("scope") ?? "user");
  if (scope === "org" && !isAgencyRole(tenant.role) && tenant.role !== "client_admin") {
    return { ok: false, message: "An admin sets the organisation code." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ensure_referral_code", {
    p_org: tenant.active.id,
    p_vanity: vanity,
    p_scope: scope === "org" ? "org" : "user",
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/command-centre/referrals");
  return { ok: true, message: "Referral code saved." };
}

export async function attributeSignup(
  _state: ReferralActionState,
  formData: FormData,
): Promise<ReferralActionState> {
  const tenant = await safeResolveWorkspace();
  if (tenant.mode !== "member" || tenant.active.id.startsWith("preview-")) {
    return { ok: false, message: "Sign in, then attribute this workspace. No email is sent from this page." };
  }
  const code = await codeFromRequest(formData);
  if (!code) return { ok: false, message: "Add a referral code first. It stays in a first-party cookie for 60 days." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("attribute_referral_signup", {
    p_code: code,
    p_referred_org: tenant.active.id,
    p_source: "signup",
  });
  if (error) return { ok: false, message: error.message };
  const reason = String((data as { reason?: string } | null)?.reason || "");
  if (reason === "self_referral") {
    return { ok: false, message: "That code belongs to this workspace, so the referral was not recorded." };
  }
  revalidatePath("/command-centre/referrals");
  if (reason === "already_attributed") {
    return { ok: true, message: "This workspace already has a referral. No second reward was created." };
  }
  return { ok: true, message: "Referral recorded. A sandbox reward is created after the first successful payment and the hold period." };
}

export async function acceptTeamInvite(
  _state: ReferralActionState,
  formData: FormData,
): Promise<ReferralActionState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { ok: false, message: "This team link is missing its token." };
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) return { ok: false, message: "Sign in with the invited email, then accept. No message is sent from this page." };
  const accepted = await supabase.rpc("accept_invitation", { raw_token: token });
  if (accepted.error) return { ok: false, message: accepted.error.message };
  const code = await codeFromRequest(formData);
  const orgId = typeof accepted.data === "string" ? accepted.data : null;
  if (code && orgId) {
    const attributed = await supabase.rpc("attribute_referral_signup", {
      p_code: code,
      p_referred_org: orgId,
      p_source: "team",
    });
    if (!attributed.error && String((attributed.data as { reason?: string } | null)?.reason || "") === "self_referral") {
      return { ok: true, message: "Invitation accepted. Your own referral code was not applied." };
    }
  }
  revalidatePath("/command-centre");
  return { ok: true, message: "Invitation accepted. Open the workspace from the switcher." };
}

async function agencyRewardAction(formData: FormData, fn: "approve_referral_reward" | "void_referral_reward" | "mark_referral_reward_paid") {
  const slug = String(formData.get("org") ?? "");
  const rewardId = String(formData.get("rewardId") ?? "");
  const tenant = await safeResolveWorkspace(slug);
  if (tenant.mode !== "member" || !isAgencyRole(tenant.role)) {
    return { ok: false, message: "An agency admin updates the reward ledger. No payout was sent." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(rewardId)) return { ok: false, message: "Choose a reward." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(fn, { p_reward: rewardId });
  if (error) return { ok: false, message: error.message };
  const charged = (data as { charged?: boolean } | null)?.charged;
  if (charged) return { ok: false, message: "This ledger does not move money." };
  revalidatePath("/command-centre/referrals");
  if (fn === "approve_referral_reward") return { ok: true, message: "Reward approved on the sandbox ledger." };
  if (fn === "void_referral_reward") return { ok: true, message: "Reward voided. The row stays in the ledger." };
  return { ok: true, message: "Marked paid on the sandbox ledger. No money was sent." };
}

export async function approveReward(_state: ReferralActionState, formData: FormData) {
  return agencyRewardAction(formData, "approve_referral_reward");
}

export async function voidReward(_state: ReferralActionState, formData: FormData) {
  return agencyRewardAction(formData, "void_referral_reward");
}

export async function markRewardPaid(_state: ReferralActionState, formData: FormData) {
  return agencyRewardAction(formData, "mark_referral_reward_paid");
}

export async function saveReferralProgram(
  _state: ReferralActionState,
  formData: FormData,
): Promise<ReferralActionState> {
  const slug = String(formData.get("org") ?? "");
  const tenant = await safeResolveWorkspace(slug);
  if (tenant.mode !== "member" || tenant.role !== "agency_owner" || tenant.active.orgType !== "agency") {
    return { ok: false, message: "The agency owner edits programme settings. Amounts stay placeholders until Billy confirms them." };
  }
  const rands = (name: string, fallback: number) => {
    const value = Number(String(formData.get(name) ?? ""));
    if (!Number.isFinite(value)) return fallback;
    return Math.round(value * 100);
  };
  const rewardType = String(formData.get("rewardType") ?? "account_credit");
  const safeType: RewardType = rewardType === "percent_off_months" || rewardType === "cash_commission" ? rewardType : "account_credit";
  const tiers = [1, 2, 3].map((index) => ({
    name: String(formData.get(`tier${index}Name`) ?? "").trim() || `Tier ${index}`,
    paid_referrals: Number(formData.get(`tier${index}Paid`) ?? index),
    reward_type: String(formData.get(`tier${index}Type`) ?? "account_credit"),
    amount_cents: rands(`tier${index}Amount`, 500),
  }));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_referral_program_settings", {
    p_org: tenant.active.id,
    p_patch: {
      enabled: formData.get("enabled") === "on",
      hold_days: Number(formData.get("holdDays") ?? 14),
      reward_type: safeType,
      account_credit_cents: rands("accountCredit", 500),
      percent_off: Number(formData.get("percentOff") ?? 10),
      percent_off_months: Number(formData.get("percentOffMonths") ?? 1),
      cash_commission_cents: rands("cashCommission", 250),
      tiers,
    },
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/command-centre/referrals");
  return { ok: true, message: "Programme saved. Amounts are still placeholders until Billy confirms them. No payout was sent." };
}

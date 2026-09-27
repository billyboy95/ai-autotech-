export const REFERRAL_COOKIE = "aat_ref";
export const REFERRAL_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

export const REWARD_TYPES = ["account_credit", "percent_off_months", "cash_commission"] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const REFERRAL_STATUSES = ["clicked", "signed_up", "paid", "rewarded", "void"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REWARD_STATUSES = ["pending", "approved", "paid", "void"] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

export const CLICK_SOURCES = ["audit", "signup", "team", "cookie"] as const;
export type ReferralClickSource = (typeof CLICK_SOURCES)[number];

export type ReferralTier = {
  name: string;
  paidReferrals: number;
  rewardType: RewardType;
  amountCents: number;
};

export const PLACEHOLDER_TIERS: ReferralTier[] = [
  { name: "Starter", paidReferrals: 1, rewardType: "account_credit", amountCents: 50000 },
  { name: "Advocate", paidReferrals: 3, rewardType: "account_credit", amountCents: 75000 },
  { name: "Partner", paidReferrals: 10, rewardType: "cash_commission", amountCents: 100000 },
];

const CODE_RE = /^[A-Z0-9]{4,16}$/;

export function readReferralCode(value: string | null | undefined) {
  if (!value) return null;
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!CODE_RE.test(code)) return null;
  return code;
}

export function referralCodeFromCookieHeader(header: string | null) {
  if (!header) return null;
  const part = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${REFERRAL_COOKIE}=`));
  if (!part) return null;
  const raw = part.slice(REFERRAL_COOKIE.length + 1);
  try {
    return readReferralCode(decodeURIComponent(raw));
  } catch {
    return readReferralCode(raw);
  }
}

export function isSelfReferral(input: {
  codeUserId: string | null;
  codeOrgId: string;
  referredUserId: string | null;
  referredOrgId: string | null;
  codeOwnerIsMemberOfReferredOrg: boolean;
  actorIsMemberOfCodeOrg?: boolean;
}) {
  if (input.referredUserId && input.codeUserId && input.referredUserId === input.codeUserId) return true;
  if (input.referredOrgId && input.referredOrgId === input.codeOrgId) return true;
  if (input.codeOwnerIsMemberOfReferredOrg) return true;
  if (input.actorIsMemberOfCodeOrg) return true;
  return false;
}

export function shouldCreateReward(input: {
  paymentStatus: string;
  sandbox: boolean;
  priorCompleteCount: number;
  hasSignupReferral: boolean;
  selfReferral: boolean;
}) {
  if (!input.sandbox) return false;
  if (input.paymentStatus.toUpperCase() !== "COMPLETE") return false;
  if (input.priorCompleteCount !== 0) return false;
  if (!input.hasSignupReferral) return false;
  if (input.selfReferral) return false;
  return true;
}

export function rewardHoldUntil(paidAt: Date, holdDays: number) {
  const until = new Date(paidAt.getTime());
  until.setUTCDate(until.getUTCDate() + holdDays);
  return until;
}

export function canApproveReward(now: Date, holdUntil: Date, status: string) {
  return status === "pending" && now.getTime() >= holdUntil.getTime();
}

export function tierProgress(tiers: ReferralTier[], payingCount: number) {
  const sorted = [...tiers].sort((a, b) => a.paidReferrals - b.paidReferrals);
  const current = [...sorted].reverse().find((tier) => payingCount >= tier.paidReferrals) ?? null;
  const upcoming = sorted.find((tier) => payingCount < tier.paidReferrals) ?? null;
  return { current, upcoming };
}

export function formatZar(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100).toString();
  const centsPart = String(abs % 100).padStart(2, "0");
  return `${sign}R${rands}.${centsPart}`;
}

export function rewardTypeLabel(type: RewardType) {
  if (type === "account_credit") return "Account credit";
  if (type === "percent_off_months") return "Percent off";
  return "Cash commission";
}

export type ShareChannel = "whatsapp" | "facebook" | "x" | "linkedin" | "email";

export function shareLinks(url: string, text: string): Record<ShareChannel, string> {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    x: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    email: `mailto:?subject=${t}&body=${encodeURIComponent(`${text}\n${url}`)}`,
  };
}

export function referralLink(code: string, origin = "") {
  const path = `/audit?ref=${encodeURIComponent(code)}`;
  const base = origin.replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

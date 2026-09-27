import type { ReferralStatus, ReferralTier, RewardStatus, RewardType } from "@/lib/referrals/codes";

export type ReferralStats = {
  clicks: number;
  signups: number;
  paying: number;
  earnedCents: number;
};

export type ReferralRewardView = {
  id: string;
  referralId: string;
  rewardType: RewardType;
  amountCents: number;
  percentOff: number | null;
  months: number | null;
  status: RewardStatus;
  holdUntil: string;
  sandbox: boolean;
  displayCode: string;
};

export type ReferralRowView = {
  id: string;
  status: ReferralStatus;
  source: string;
  displayCode: string;
  referrerUserId: string | null;
  referredOrgId: string | null;
  clickedAt: string;
};

export type LeaderRow = {
  code: string;
  clicks: number;
  signups: number;
  paying: number;
};

export type ReferralProgramView = {
  holdDays: number;
  rewardType: RewardType;
  accountCreditCents: number;
  percentOff: number;
  percentOffMonths: number;
  cashCommissionCents: number;
  tiers: ReferralTier[];
  enabled: boolean;
};

export type ReferralDesk = {
  preview: boolean;
  notice: string | null;
  orgSlug: string;
  canAdmin: boolean;
  canEditProgram: boolean;
  code: string;
  link: string;
  qrSvg: string;
  stats: ReferralStats;
  program: ReferralProgramView;
  payingCount: number;
  rewards: ReferralRewardView[];
  referrals: ReferralRowView[];
  leaderboard: LeaderRow[];
  shareText: string;
};

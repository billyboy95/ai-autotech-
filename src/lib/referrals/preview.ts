import { PLACEHOLDER_TIERS, referralLink } from "@/lib/referrals/codes";
import type { ReferralDesk } from "@/lib/referrals/types";

export function previewReferralDesk(slug: string, origin: string): ReferralDesk {
  const code = "BILLY42";
  return {
    preview: true,
    notice: "Preview only. Apply step 19 in supabase/APPLY-ORDER.md before this workspace can save referrals. Amounts are placeholders until Billy confirms them.",
    orgSlug: slug,
    canAdmin: true,
    canEditProgram: false,
    code,
    link: referralLink(code, origin),
    qrSvg: "",
    stats: { clicks: 0, signups: 0, paying: 0, earnedCents: 0 },
    program: {
      holdDays: 14,
      rewardType: "account_credit",
      accountCreditCents: 50000,
      percentOff: 10,
      percentOffMonths: 1,
      cashCommissionCents: 25000,
      tiers: PLACEHOLDER_TIERS,
      enabled: true,
    },
    payingCount: 0,
    rewards: [],
    referrals: [],
    leaderboard: [],
    shareText: "Join me on AI AutoTech",
  };
}

import type { MembershipRole } from "@/lib/tenant/types";

export const MEMBERSHIP_STATUSES = ["pending", "active", "past_due", "suspended", "cancelled"] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export function isMembershipStatus(value: string | null | undefined): value is MembershipStatus {
  return Boolean(value && (MEMBERSHIP_STATUSES as readonly string[]).includes(value));
}

/** Platform features open only while the AIOS membership is active. */
export function membershipGrantsPlatform(status: MembershipStatus | null) {
  return status === "active";
}

/**
 * Client workspaces with a lapsed membership lose platform access.
 * No row, or a checkout that is still pending, does not lock a legacy workspace.
 * Agency operators are not gated.
 */
export function clientPlatformDecision(input: {
  role: MembershipRole | null;
  status: MembershipStatus | null;
}) {
  if (!input.role || input.role === "agency_owner" || input.role === "agency_staff") {
    return { allowed: true, gated: false, reason: "Agency operators keep platform access." };
  }
  if (input.status == null || input.status === "pending") {
    return {
      allowed: true,
      gated: false,
      reason: input.status == null ? "No AIOS membership is on file for this workspace." : "Checkout is still pending. Access is unchanged.",
    };
  }
  if (membershipGrantsPlatform(input.status)) {
    return { allowed: true, gated: true, reason: "AIOS membership is active." };
  }
  return { allowed: false, gated: true, reason: "Platform access needs an active AIOS membership." };
}

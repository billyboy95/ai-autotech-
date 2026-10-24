export const TRY_LINK_DAYS = 7;
export const TRY_DEFAULT_MAX_MESSAGES = 50;

export type TryLinkState = {
  id: string;
  orgId: string;
  orgSlug: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  maxMessages: number;
  usedMessages: number;
};

export type TryAccess =
  | { ok: true }
  | { ok: false; code: "missing" | "mismatch" | "expired" | "revoked" | "capped"; message: string };

const INACTIVE = "This test link is not active.";

export function assessTryLink(input: {
  link: TryLinkState | null;
  slug: string;
  tokenHash: string;
  now: Date;
}): TryAccess {
  const link = input.link;
  if (!link || link.tokenHash !== input.tokenHash) {
    return { ok: false, code: "missing", message: INACTIVE };
  }
  if (link.orgSlug !== input.slug.trim().toLowerCase()) {
    return { ok: false, code: "mismatch", message: INACTIVE };
  }
  if (link.revokedAt) {
    return { ok: false, code: "revoked", message: "This test link was revoked." };
  }
  const expires = Date.parse(link.expiresAt);
  if (!Number.isFinite(expires) || expires <= input.now.getTime()) {
    return { ok: false, code: "expired", message: "This test link has expired." };
  }
  if (link.usedMessages >= link.maxMessages) {
    return { ok: false, code: "capped", message: "This test chat has reached its message limit." };
  }
  return { ok: true };
}

export function tryAccessStatus(code: Extract<TryAccess, { ok: false }>["code"]) {
  if (code === "expired") return 410;
  if (code === "revoked") return 403;
  if (code === "capped") return 409;
  return 404;
}

import { createHash, randomBytes } from "node:crypto";

/** SHA-256 hex. The raw token is not stored. */
export function hashTryToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newTryToken() {
  return randomBytes(32).toString("base64url");
}

export function tryLinkPath(orgSlug: string, token: string) {
  return `/try/${orgSlug}?t=${encodeURIComponent(token)}`;
}

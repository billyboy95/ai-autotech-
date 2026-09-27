import { createHash, randomBytes } from "node:crypto";

/** SHA-256 hex. The raw token is not stored. */
export function hashLiveViewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newLiveViewToken() {
  return randomBytes(24).toString("hex");
}

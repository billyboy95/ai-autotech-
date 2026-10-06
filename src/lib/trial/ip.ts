import { createHash } from "node:crypto";

export function trialIpHash(ip: string) {
  return createHash("sha256").update(ip.trim() || "unknown").digest("hex");
}

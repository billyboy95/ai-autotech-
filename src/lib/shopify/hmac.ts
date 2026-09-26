import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyHmac(rawBody: string, header: string, secret: string) {
  if (!secret || !header) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const left = Buffer.from(digest);
  const right = Buffer.from(header);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** True only when the workspace has an Admin API token saved. Callers must not fetch Shopify otherwise. */
export function shopifyAdminReady(adminAccessToken: string) {
  return adminAccessToken.trim().length > 0;
}

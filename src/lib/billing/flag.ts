import type { EnvLike } from "@/lib/automation/channels";

/** PayFast's published sandbox merchant. Any other id is refused. */
export const PAYFAST_SANDBOX_MERCHANT_ID = "10000100";
export const PAYFAST_SANDBOX_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process";
export const PAYFAST_SANDBOX_VALIDATE_URL = "https://sandbox.payfast.co.za/eng/query/validate";

/** Off unless BILLING_SANDBOX=true. Checkout stays closed and no provider is called. */
export function isBillingSandboxEnabled(env: EnvLike = process.env) {
  return String(env.BILLING_SANDBOX ?? "").trim().toLowerCase() === "true";
}

/**
 * The browser mock ITN is for local sandbox only.
 * Production ignores it unless BILLING_ALLOW_MOCK_ITN is set on purpose.
 */
export function mockItnAllowed(env: EnvLike = process.env) {
  if (!isBillingSandboxEnabled(env)) return false;
  if (String(env.BILLING_ALLOW_MOCK_ITN ?? "").trim().toLowerCase() === "true") return true;
  return String(env.VERCEL_ENV ?? "").trim().toLowerCase() !== "production";
}

export function payfastMerchantId(env: EnvLike = process.env) {
  return String(env.PAYFAST_MERCHANT_ID ?? "").trim();
}

export function assertSandboxMerchant(env: EnvLike = process.env) {
  const merchant = payfastMerchantId(env);
  if (merchant && merchant !== PAYFAST_SANDBOX_MERCHANT_ID) {
    throw new Error("Refusing PayFast merchant id that is not the sandbox merchant 10000100. No charge was sent.");
  }
}

/** Sandbox API path only. The testing flag is required. This function does not call fetch. */
export function sandboxAdhocUrl(token: string) {
  const safe = encodeURIComponent(token);
  return `https://api.payfast.co.za/subscriptions/${safe}/adhoc?testing=true`;
}

export function assertSandboxPaymentUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.host === "sandbox.payfast.co.za") return;
  if (parsed.host === "api.payfast.co.za" && parsed.searchParams.get("testing") === "true") return;
  throw new Error(`Refusing non-sandbox payment host ${parsed.host}. No charge was sent.`);
}

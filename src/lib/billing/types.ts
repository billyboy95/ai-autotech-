export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "suspended", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_PROVIDERS = ["payfast", "paystack", "yoco", "manual"] as const;
export type BillingProviderName = (typeof BILLING_PROVIDERS)[number];

export type BillingOrg = {
  id: string;
  name: string;
  email?: string;
  slug?: string;
};

export type BillingPlan = {
  code: string;
  name: string;
  priceCents: number;
  interval: "month" | "year";
  currency: "ZAR";
};

export type OrgSubscription = {
  orgId: string;
  planCode: string;
  provider: BillingProviderName;
  providerCustomerRef: string | null;
  providerToken: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  nextChargeAt: string | null;
  pastDueAt: string | null;
  suspendedAt: string | null;
  sandbox: true;
};

export type BillingEventInput = {
  provider: BillingProviderName;
  providerEventId: string;
  orgId: string;
  type: string;
  payload: {
    sandbox: true;
    paymentStatus?: "COMPLETE" | "FAILED" | "CANCELLED" | "PENDING";
    planCode?: string;
    amountCents?: number;
    token?: string;
    occurredAt?: string;
  };
};

export type CheckoutResult = {
  provider: BillingProviderName;
  sandbox: true;
  charged: false;
  mode: "form" | "link" | "stub" | "disabled";
  actionUrl: string | null;
  fields: Record<string, string> | null;
  message: string;
};

export type ProviderCallResult = {
  ok: boolean;
  provider: BillingProviderName;
  sandbox: true;
  charged: false;
  simulated: boolean;
  dispatched: false;
  message: string;
  reference: string | null;
};

export type WebhookRequest = {
  rawBody?: string;
  fields?: Record<string, string>;
};

export type WebhookResult = {
  ok: boolean;
  duplicate: boolean;
  provider: BillingProviderName;
  providerEventId: string | null;
  orgId: string | null;
  status: SubscriptionStatus | null;
  sandbox: true;
  charged: false;
  sendingEnabled: false;
  message: string;
};

export interface BillingProvider {
  name: BillingProviderName;
  createCheckout(org: BillingOrg, plan: BillingPlan): CheckoutResult;
  handleWebhook(req: WebhookRequest): WebhookResult;
  cancel(sub: OrgSubscription): ProviderCallResult;
  chargeAdhoc(sub: OrgSubscription, cents: number): ProviderCallResult;
}

import type { EnvLike } from "@/lib/automation/channels";
import { payfastSignature } from "@/lib/billing/signature";
import { payfastCheckoutReady, payfastCredentials, payfastProcessUrl, siteOrigin } from "@/lib/payfast/config";

const ONCE_OFF_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
];

const SUBSCRIPTION_ORDER = [
  ...ONCE_OFF_ORDER,
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
];

export type PayfastCheckout = {
  ok: boolean;
  sandbox: boolean;
  charged: false;
  mode: "sandbox" | "live";
  actionUrl: string | null;
  fields: Record<string, string> | null;
  message: string;
};

function centsToRands(cents: number) {
  return (cents / 100).toFixed(2);
}

function billingDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function closed(message: string, mode: "sandbox" | "live"): PayfastCheckout {
  return {
    ok: false,
    sandbox: mode !== "live",
    charged: false,
    mode,
    actionUrl: null,
    fields: null,
    message,
  };
}

function signedForm(input: {
  env: EnvLike;
  order: string[];
  fields: Record<string, string>;
  message: string;
}): PayfastCheckout {
  const credentials = payfastCredentials(input.env);
  if (!payfastCheckoutReady(input.env)) {
    return closed("Add PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY. No checkout was opened.", credentials.mode);
  }
  if (input.fields.amount === "0.00" || Number(input.fields.amount) <= 0) {
    return closed("The amount must be more than zero. No checkout was opened.", credentials.mode);
  }
  const unsigned: Record<string, string> = {
    ...input.fields,
    merchant_id: credentials.merchantId,
    merchant_key: credentials.merchantKey,
    custom_str3: credentials.mode,
    custom_str4: "income",
  };
  const signature = payfastSignature(unsigned, input.order, credentials.passphrase);
  const fields: Record<string, string> = {};
  for (const key of input.order) {
    const value = unsigned[key];
    if (value == null || value.trim() === "") continue;
    fields[key] = value;
  }
  fields.signature = signature;
  return {
    ok: true,
    sandbox: credentials.mode !== "live",
    charged: false,
    mode: credentials.mode,
    actionUrl: payfastProcessUrl(credentials.mode),
    fields,
    message: input.message,
  };
}

export function onceOffCheckout(input: {
  env?: EnvLike;
  paymentId: string;
  amountCents: number;
  itemName: string;
  itemDescription: string;
  firstName: string;
  lastName: string;
  email: string;
  customStr1: string;
  customStr2: string;
  returnPath: string;
  cancelPath: string;
}): PayfastCheckout {
  const env = input.env ?? process.env;
  const origin = siteOrigin(env);
  return signedForm({
    env,
    order: ONCE_OFF_ORDER,
    message: "PayFast once-off checkout. Nothing has been charged yet.",
    fields: {
      return_url: `${origin}${input.returnPath}`,
      cancel_url: `${origin}${input.cancelPath}`,
      notify_url: `${origin}/api/webhooks/payfast`,
      name_first: input.firstName.slice(0, 100) || "Customer",
      name_last: input.lastName.slice(0, 100),
      email_address: input.email,
      m_payment_id: input.paymentId,
      amount: centsToRands(input.amountCents),
      item_name: input.itemName.slice(0, 100),
      item_description: input.itemDescription.slice(0, 255),
      custom_str1: input.customStr1,
      custom_str2: input.customStr2,
    },
  });
}

export function subscriptionCheckout(input: {
  env?: EnvLike;
  paymentId: string;
  amountCents: number;
  itemName: string;
  itemDescription: string;
  firstName: string;
  lastName: string;
  email: string;
  customStr1: string;
  customStr2: string;
  now?: Date;
}): PayfastCheckout {
  const env = input.env ?? process.env;
  const origin = siteOrigin(env);
  const amount = centsToRands(input.amountCents);
  return signedForm({
    env,
    order: SUBSCRIPTION_ORDER,
    message: "PayFast monthly subscription. Nothing has been charged yet.",
    fields: {
      return_url: `${origin}/membership?billing=return`,
      cancel_url: `${origin}/membership?billing=cancel`,
      notify_url: `${origin}/api/webhooks/payfast`,
      name_first: input.firstName.slice(0, 100) || "Customer",
      name_last: input.lastName.slice(0, 100),
      email_address: input.email,
      m_payment_id: input.paymentId,
      amount,
      item_name: input.itemName.slice(0, 100),
      item_description: input.itemDescription.slice(0, 255),
      custom_str1: input.customStr1,
      custom_str2: input.customStr2,
      subscription_type: "1",
      billing_date: billingDate(input.now ?? new Date()),
      recurring_amount: amount,
      frequency: "3",
      cycles: "0",
    },
  });
}

import type { EnvLike } from "@/lib/automation/channels";
import type { BillingBook } from "@/lib/billing/book";
import { createPayfastProvider } from "@/lib/billing/payfast";
import { createPaystackProvider } from "@/lib/billing/paystack";
import { createYocoProvider } from "@/lib/billing/yoco";
import type { BillingProvider, BillingProviderName } from "@/lib/billing/types";

export function billingProvider(name: BillingProviderName, book: BillingBook, env?: EnvLike): BillingProvider {
  if (name === "payfast") return createPayfastProvider(book, env);
  if (name === "paystack") return createPaystackProvider(book);
  return createYocoProvider(book);
}

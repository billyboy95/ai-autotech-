import type { BillingBook } from "@/lib/billing/book";
import type {
  BillingOrg,
  BillingPlan,
  BillingProvider,
  CheckoutResult,
  OrgSubscription,
  ProviderCallResult,
  WebhookRequest,
  WebhookResult,
} from "@/lib/billing/types";

function checkout(message: string): CheckoutResult {
  return {
    provider: "paystack",
    sandbox: true,
    charged: false,
    mode: "stub",
    actionUrl: null,
    fields: null,
    message,
  };
}

function call(ok: boolean, message: string): ProviderCallResult {
  return {
    ok,
    provider: "paystack",
    sandbox: true,
    charged: false,
    simulated: true,
    dispatched: false,
    message,
    reference: null,
  };
}

export function createPaystackProvider(_book: BillingBook): BillingProvider {
  return {
    name: "paystack",
    createCheckout(_org: BillingOrg, _plan: BillingPlan) {
      return checkout("Paystack recurring billing is a sandbox stub. No charge was sent.");
    },
    handleWebhook(_req: WebhookRequest): WebhookResult {
      return {
        ok: true,
        duplicate: false,
        provider: "paystack",
        providerEventId: null,
        orgId: null,
        status: null,
        sandbox: true,
        charged: false,
        sendingEnabled: false,
        message: "Paystack webhook stub ignored the payload. No charge was sent.",
      };
    },
    cancel(_sub: OrgSubscription) {
      return call(false, "Paystack cancel is not enabled. No charge was sent.");
    },
    chargeAdhoc(_sub: OrgSubscription, _cents: number) {
      return call(false, "Paystack ad-hoc charges are not enabled. No charge was sent.");
    },
  };
}

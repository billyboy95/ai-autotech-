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

function call(ok: boolean, message: string, reference: string | null = null): ProviderCallResult {
  return {
    ok,
    provider: "yoco",
    sandbox: true,
    charged: false,
    simulated: true,
    dispatched: false,
    message,
    reference,
  };
}

/** Yoco is once-off invoices and payment links. It has no recurring billing. */
export function createYocoProvider(_book: BillingBook): BillingProvider {
  return {
    name: "yoco",
    createCheckout(org: BillingOrg, plan: BillingPlan): CheckoutResult {
      const reference = `sandbox-yoco-${org.id}-${plan.code}`;
      return {
        provider: "yoco",
        sandbox: true,
        charged: false,
        mode: "link",
        actionUrl: null,
        fields: {
          reference,
          amount_cents: String(plan.priceCents),
          currency: "ZAR",
          description: `${plan.name} once-off invoice`,
        },
        message: "Yoco payment links are once-off invoices. Recurring billing is not supported. No link was created at Yoco and no charge was sent.",
      };
    },
    handleWebhook(_req: WebhookRequest): WebhookResult {
      return {
        ok: true,
        duplicate: false,
        provider: "yoco",
        providerEventId: null,
        orgId: null,
        status: null,
        sandbox: true,
        charged: false,
        sendingEnabled: false,
        message: "Yoco webhook stub ignored the payload. No charge was sent.",
      };
    },
    cancel(_sub: OrgSubscription) {
      return call(false, "Yoco has no subscription to cancel.");
    },
    chargeAdhoc(_sub: OrgSubscription, _cents: number) {
      return call(false, "Yoco does not support recurring or ad-hoc subscription charges. No charge was sent.");
    },
  };
}

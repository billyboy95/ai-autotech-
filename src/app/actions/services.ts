"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { nid } from "@/lib/crm-store";
import { buildServiceEnquiry } from "@/lib/services/enquiry";
import { membershipTier } from "@/lib/membership/tiers";
import { payfastMode } from "@/lib/payfast/config";
import { splitPersonName } from "@/lib/aios/public-intake";
import { subscriptionCheckout, type PayfastCheckout } from "@/lib/payfast/checkout";
import { callServiceRpc, publicIntakeOrgId } from "@/server/workers/with-org";

export type QuoteActionState = {
  ok: boolean;
  message: string;
  acceptPath?: string;
};

export async function requestServiceQuote(_state: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  if (String(formData.get("_honey") || "").trim()) {
    return { ok: true, message: "Thanks. We have the request." };
  }
  const leadId = nid();
  const quoteId = randomUUID();
  const acceptToken = randomBytes(32).toString("hex");
  const built = buildServiceEnquiry({
    leadId,
    quoteId,
    acceptToken,
    name: String(formData.get("full_name") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    company: String(formData.get("company") || ""),
    message: String(formData.get("message") || ""),
    packageCode: String(formData.get("package_code") || ""),
    ord: -Math.floor(Date.now() / 1000),
  });
  if (!built.ok) return { ok: false, message: built.error };
  const orgId = await publicIntakeOrgId();
  const saved = await callServiceRpc("create_service_enquiry", {
    p_org: orgId,
    p_lead_id: leadId,
    p_quote_id: quoteId,
    p_token: acceptToken,
    p_package: built.package.code,
    p_name: built.quote.contact_name,
    p_email: built.quote.email,
    p_phone: built.quote.phone,
    p_company: built.quote.company,
    p_message: built.quote.message,
  });
  if (!saved.configured) {
    return { ok: false, message: "Quote storage is not configured. Email Willem@aiautotech.co.za and we will take it from here." };
  }
  if (saved.error) {
    const missing = /does not exist|schema cache|create_service_enquiry/i.test(saved.error.message);
    return {
      ok: false,
      message: missing
        ? "The services catalogue is not on the database yet. Nothing was charged. Email Willem@aiautotech.co.za."
        : "Could not save the quote. Please try again or email Willem@aiautotech.co.za.",
    };
  }
  return {
    ok: true,
    message: `Quote request saved. The ${built.package.name} price is still a placeholder. Nothing was charged.`,
    acceptPath: `/quotes/${acceptToken}`,
  };
}

export type MembershipActionState = {
  ok: boolean;
  message: string;
  checkout: PayfastCheckout | null;
};

export async function startMembershipCheckout(_state: MembershipActionState, formData: FormData): Promise<MembershipActionState> {
  if (String(formData.get("_honey") || "").trim()) {
    return { ok: true, message: "Thanks.", checkout: null };
  }
  const tier = membershipTier(String(formData.get("tier_code") || ""));
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("full_name") || "").trim();
  if (!tier) return { ok: false, message: "Choose a membership tier.", checkout: null };
  if (!name || !email.includes("@")) return { ok: false, message: "Name and email are required.", checkout: null };
  const id = randomUUID();
  const person = splitPersonName(name);
  const checkout = subscriptionCheckout({
    paymentId: `mem_${id}`,
    amountCents: tier.priceCents,
    itemName: `AIOS ${tier.name}`,
    itemDescription: `${tier.name} monthly membership. Prices exclude VAT.`,
    firstName: person.firstName,
    lastName: person.lastName,
    email,
    customStr1: id,
    customStr2: tier.code,
  });
  if (!checkout.ok || !checkout.actionUrl || !checkout.fields) {
    return { ok: false, message: checkout.message, checkout: null };
  }
  const sandbox = payfastMode() !== "live";
  const saved = await callServiceRpc("start_aios_membership", {
    p_id: id,
    p_org: null,
    p_email: email,
    p_name: name,
    p_tier: tier.code,
    p_sandbox: sandbox,
  });
  if (!saved.configured) {
    return { ok: false, message: "Membership storage is not configured. Email Willem@aiautotech.co.za.", checkout: null };
  }
  if (saved.error) {
    const missing = /does not exist|schema cache|start_aios_membership/i.test(saved.error.message);
    return {
      ok: false,
      message: missing
        ? "Membership tables are not on the database yet. Nothing was charged."
        : "Could not start the membership. Nothing was charged.",
      checkout: null,
    };
  }
  return { ok: true, message: "Opening PayFast. Nothing has been charged yet.", checkout };
}

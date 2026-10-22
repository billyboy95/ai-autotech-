import { crmLeadMirror, splitPersonName } from "@/lib/aios/public-intake";
import { PRICE_PLACEHOLDER_LABEL, servicePackage, type ServicePackageCode } from "@/lib/services/catalog";

export type ServiceEnquiryInput = {
  leadId: string;
  quoteId: string;
  acceptToken: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  packageCode: string;
  ord: number;
};

export function buildServiceEnquiry(input: ServiceEnquiryInput) {
  const pack = servicePackage(input.packageCode);
  if (!pack) return { ok: false as const, error: "Choose a website, app, or marketing package." };
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false as const, error: "Please enter your name." };
  if (!email.includes("@")) return { ok: false as const, error: "Please enter a valid email address." };
  const person = splitPersonName(name);
  const notes = [
    "Service quote request",
    `Package: ${pack.name} (${pack.code})`,
    `Placeholder amount: ${(pack.priceCents / 100).toFixed(2)} ZAR excluding VAT`,
    PRICE_PLACEHOLDER_LABEL,
    `Email: ${email}`,
    input.message.trim() ? `Message: ${input.message.trim().slice(0, 1500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const lead = crmLeadMirror({
    id: input.leadId,
    name,
    company: input.company,
    phone: input.phone,
    email,
    notes,
    source: "service_enquiry",
    ord: input.ord,
  });
  return {
    ok: true as const,
    package: pack,
    person,
    lead: {
      ...lead,
      enrolled: false,
      marketing_consent: false,
    },
    quote: {
      id: input.quoteId,
      lead_id: input.leadId,
      package_code: pack.code as ServicePackageCode,
      contact_name: name,
      email,
      phone: input.phone.trim(),
      company: input.company.trim(),
      message: input.message.trim().slice(0, 3000),
      amount_cents: pack.priceCents,
      currency: "ZAR",
      price_placeholder: true,
      status: "requested",
      accept_token: input.acceptToken,
      sandbox: true,
    },
  };
}

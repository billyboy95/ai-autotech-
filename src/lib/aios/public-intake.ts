import { toE164 } from "@/lib/automation/channels";

/** Client workspace the provisioning script creates from the agency template. */
export const AI_AUTOTECH_CLIENT_SLUG = "aiautotech";

/** Agency parent. Public forms stay here until the client workspace is marked. */
export const AI_AUTOTECH_AGENCY_SLUG = "ai-autotech";

/** settings.public_intake value that moves audit and guide intake onto the client pipeline. */
export const AI_AUTOTECH_INTAKE_MARKER = "aiautotech";

export const AGENCY_TEMPLATE_SNAPSHOT_ID = "a2c00000-0000-4000-8000-000000000001";

export const SALES_PIPELINE_NEW_STAGE = "New";

export type IntakeOrgRow = {
  id: string;
  slug: string;
  settings?: unknown;
};

function marker(settings: unknown) {
  if (!settings || typeof settings !== "object") return "";
  const value = (settings as { public_intake?: unknown }).public_intake;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Prefer the provisioned AI AutoTech client when it is marked for public intake.
 * Otherwise keep the agency workspace, which is where the forms land today.
 */
export function choosePublicIntakeOrg(rows: IntakeOrgRow[]) {
  const client = rows.find(
    (row) => row.slug === AI_AUTOTECH_CLIENT_SLUG && marker(row.settings) === AI_AUTOTECH_INTAKE_MARKER,
  );
  if (client) return client.id;
  return rows.find((row) => row.slug === AI_AUTOTECH_AGENCY_SLUG)?.id ?? null;
}

/** Guide pages on aiautotech.co.za post through the contact route with a page path. */
export function publicFormSource(page: string) {
  const text = page.trim().toLowerCase();
  if (text === "guide" || text.includes("/guide")) return "website_guide";
  return "website_contact";
}

export function splitPersonName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export type CrmLeadMirror = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  stage: "New";
  notes: string;
  source: string;
  website: string;
  industry: string;
  ord: number;
  marketing_consent: false;
  enrolled: false;
  audit_lead_id?: string;
  stage_id?: string;
};

/** CRM card for a public audit or guide submission. Email and the audit id stay on the lead. */
export function crmLeadMirror(input: {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
  source: string;
  website?: string;
  industry?: string;
  ord: number;
  auditLeadId?: string | null;
  stageId?: string | null;
}): CrmLeadMirror {
  const row: CrmLeadMirror = {
    id: input.id,
    name: input.name.trim(),
    company: input.company.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    stage: "New",
    notes: input.notes,
    source: input.source,
    website: (input.website ?? "").trim(),
    industry: (input.industry ?? "").trim(),
    ord: input.ord,
    marketing_consent: false,
    enrolled: false,
  };
  if (input.auditLeadId) row.audit_lead_id = input.auditLeadId;
  if (input.stageId) row.stage_id = input.stageId;
  return row;
}

/** Contact the public booking lookup uses, so a results call stays on this lead. */
export function intakeContactRow(input: {
  name: string;
  email: string;
  phone: string;
  company: string;
  leadId: string;
  source: string;
}) {
  const person = splitPersonName(input.name);
  const phone = toE164(input.phone);
  return {
    first_name: person.firstName,
    last_name: person.lastName,
    email: input.email.trim().toLowerCase(),
    phone_e164: phone,
    whatsapp_e164: phone,
    company: input.company.trim(),
    lead_id: input.leadId,
    tags: [] as string[],
    custom: { source: input.source },
  };
}

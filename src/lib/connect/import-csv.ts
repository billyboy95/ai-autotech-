import { splitCsvLine } from "@/lib/compliance/campaign-import";

export type ImportField = "name" | "phone" | "email" | "consent" | "company" | "ignored";

export type ImportColumn = {
  header: string;
  field: ImportField;
};

export type ConsentBasis = "consent" | "existing_customer" | "";

export type ImportIssue = {
  name: string;
  phone: string;
  email: string;
  company: string;
  consentBasis: ConsentBasis;
  issues: string[];
};

export type ImportPreview = {
  columns: ImportColumn[];
  rows: ImportIssue[];
  error: string;
  ready: number;
  blocked: number;
  skipped: number;
};

export type DraftContact = {
  name: string;
  phone: string;
  email: string;
  company: string;
  consent_basis: "consent" | "existing_customer";
};

const FIELD_ALIASES: Record<string, ImportField> = {
  name: "name",
  phone: "phone",
  mobile: "phone",
  public_phone: "phone",
  email: "email",
  public_email: "email",
  consent_basis: "consent",
  "consent basis": "consent",
  consent: "consent",
  marketing_consent: "consent",
  company: "company",
  business: "company",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Consent-ready outbound shape: name, phone, email, and a POPIA consent column. */
export function previewContactImport(csv: string): ImportPreview {
  const empty: ImportPreview = { columns: [], rows: [], error: "", ready: 0, blocked: 0, skipped: 0 };
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { ...empty, error: "The CSV is empty." };
  const headers = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const normalized = headers.map((header) => header.toLowerCase());
  if (!normalized.some((header) => header === "name")) return { ...empty, error: "CSV is missing: name." };
  if (!normalized.some((header) => FIELD_ALIASES[header] === "consent")) {
    return { ...empty, error: "CSV is missing: consent_basis." };
  }
  if (lines.length - 1 > 200) return { ...empty, error: "Import up to 200 contacts at a time. Nothing was stored and nothing was sent." };

  const used = new Set<ImportField>();
  const columns: ImportColumn[] = headers.map((header) => {
    const field = FIELD_ALIASES[header.trim().toLowerCase()] ?? "ignored";
    if (field !== "ignored" && used.has(field)) return { header, field: "ignored" };
    if (field !== "ignored") used.add(field);
    return { header, field };
  });
  const index = (field: ImportField) => columns.findIndex((column) => column.field === field);

  let skipped = 0;
  const rows = lines.slice(1).flatMap((line) => {
    const cells = splitCsvLine(line);
    const name = cell(cells, index("name"));
    if (!name) {
      skipped += 1;
      return [];
    }
    const phone = cell(cells, index("phone"));
    const email = cell(cells, index("email")).toLowerCase();
    const company = cell(cells, index("company"));
    const consent = classifyConsent(cell(cells, index("consent")));
    const issues: string[] = [];
    if (!phone && !email) issues.push("Needs a phone or an email.");
    if (email && !EMAIL.test(email)) issues.push("Email is not valid.");
    if (consent.optedOut) issues.push("POPIA: this contact opted out. This row is not imported.");
    else if (!consent.basis) issues.push("POPIA: consent_basis is blank. This row is not imported.");
    return [{ name, phone, email, company, consentBasis: consent.basis, issues }];
  });

  const blocked = rows.filter((row) => row.issues.length > 0).length;
  return {
    columns,
    rows,
    error: rows.length ? "" : "The CSV has headers but no contacts.",
    ready: rows.length - blocked,
    blocked,
    skipped,
  };
}

export function draftContacts(preview: ImportPreview): DraftContact[] {
  return preview.rows.flatMap((row) => {
    if (row.issues.length || (row.consentBasis !== "consent" && row.consentBasis !== "existing_customer")) return [];
    return [{
      name: row.name,
      phone: row.phone,
      email: row.email,
      company: row.company,
      consent_basis: row.consentBasis,
    }];
  });
}

export function importSummary(preview: ImportPreview) {
  return {
    ready: preview.ready,
    blocked: preview.blocked,
    skipped: preview.skipped,
    sandbox: true as const,
    charged: false as const,
    sent: false as const,
  };
}

function cell(cells: string[], index: number) {
  if (index < 0) return "";
  return (cells[index] || "").trim();
}

function classifyConsent(raw: string): { basis: ConsentBasis; optedOut: boolean } {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (value === "consent" || value === "opted_in" || value === "yes") return { basis: "consent", optedOut: false };
  if (value === "existing_customer" || value === "existing" || value === "customer") return { basis: "existing_customer", optedOut: false };
  if (value === "opted_out" || value === "no" || value === "stop" || value === "false") return { basis: "", optedOut: true };
  return { basis: "", optedOut: false };
}

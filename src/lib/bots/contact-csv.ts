import { consentBasisColumn, rowConsentBasis, splitCsvLine } from "@/lib/compliance/campaign-import";

export type ImportedContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  consentBasis: "consent" | "existing_customer" | "";
};

/** CRM contact rows from a CSV. Reuses the campaign importer's consent_basis column. */
export function parseContactCsv(csv: string): { rows: ImportedContact[]; error: string } {
  if (!consentBasisColumn(csv)) return { rows: [], error: "CSV is missing: consent_basis." };
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const header = splitCsvLine(lines[0] || "").map((cell) => cell.trim().toLowerCase());
  const index = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  const nameIndex = index("name");
  if (nameIndex < 0) return { rows: [], error: "CSV is missing: name." };
  const emailIndex = index("email");
  const phoneIndex = index("phone", "mobile");
  const companyIndex = index("company", "business");
  const bases = rowConsentBasis(csv);
  const rows = lines.slice(1).flatMap((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const name = (cells[nameIndex] || "").trim();
    if (!name) return [];
    const [firstName, ...rest] = name.split(/\s+/);
    return [{
      firstName: firstName || "",
      lastName: rest.join(" "),
      email: emailIndex >= 0 ? (cells[emailIndex] || "").trim().toLowerCase() : "",
      phone: phoneIndex >= 0 ? (cells[phoneIndex] || "").trim() : "",
      company: companyIndex >= 0 ? (cells[companyIndex] || "").trim() : "",
      consentBasis: bases[rowIndex] ?? "",
    }];
  });
  if (!rows.length) return { rows: [], error: "The CSV has headers but no contacts." };
  return { rows, error: "" };
}

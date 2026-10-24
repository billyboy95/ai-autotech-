/**
 * Blank business names arrive as empty strings, null, or sentinels such as
 * "None" and "N/A" (a form or client stringifying a missing value).
 * Stored company fields use "" . Message templates use "your business".
 */
const BLANK_COMPANY_KEYS = new Set(["none", "na", "null", "undefined"]);

export function normalizeCompany(value: unknown): string {
  if (value == null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (BLANK_COMPANY_KEYS.has(key)) return "";
  return text;
}

/** Phrase substituted for {{company}} when the business name is missing. */
export function companyTemplateLabel(value: unknown): string {
  return normalizeCompany(value) || "your business";
}

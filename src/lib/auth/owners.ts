export const DEFAULT_OWNER_EMAIL = "billyfaber06@gmail.com";

export function parseOwnerEmails(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/** Blank or missing OWNER_EMAILS uses the agency owner address. */
export function ownerEmailList(raw: string | null | undefined = process.env.OWNER_EMAILS) {
  if (raw === undefined || raw.trim() === "") return [DEFAULT_OWNER_EMAIL];
  const parsed = parseOwnerEmails(raw);
  return parsed.length ? parsed : [DEFAULT_OWNER_EMAIL];
}

export function isOwnerEmail(email: string | null | undefined, listed = ownerEmailList()) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return Boolean(normalized && listed.includes(normalized));
}

/** Attach only when the address is listed and the user has no membership yet. */
export function shouldAttachOwner(input: { email: string | null | undefined; listed: string[]; membershipCount: number }) {
  if (input.membershipCount > 0) return false;
  return isOwnerEmail(input.email, input.listed);
}

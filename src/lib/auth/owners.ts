export function parseOwnerEmails(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined, listed = parseOwnerEmails(process.env.OWNER_EMAILS)) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return Boolean(normalized && listed.includes(normalized));
}

/** Attach only when the address is listed and the user has no membership yet. */
export function shouldAttachOwner(input: { email: string | null | undefined; listed: string[]; membershipCount: number }) {
  if (input.membershipCount > 0) return false;
  return isOwnerEmail(input.email, input.listed);
}

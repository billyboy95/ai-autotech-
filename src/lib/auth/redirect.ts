/** Same-origin path only. Rejects protocol-relative and backslash tricks. */
export function safeNextPath(value: string | null | undefined, fallback = "/command-centre") {
  if (!value) return fallback;
  const next = value.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.includes("\\") || next.includes("://")) return fallback;
  return next;
}

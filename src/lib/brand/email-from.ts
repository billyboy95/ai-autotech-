function extractAddress(value: string) {
  const wrapped = value.match(/<([^>]+)>/);
  const candidate = (wrapped?.[1] ?? value).trim();
  if (!candidate.includes("@")) return "";
  return candidate.replace(/^mailto:/i, "");
}

function quoteName(name: string) {
  if (/[",<>]/.test(name)) return `"${name.replace(/"/g, "")}"`;
  return name;
}

/**
 * Email From header. A client workspace omits "AI AutoTech" unless showPlatformName is on.
 * When the caller does not pass a sender, the legacy agency header stays so existing sends are unchanged.
 */
export function brandedEmailFrom(input: {
  senderName?: string;
  address?: string;
  showPlatformName?: boolean;
  legacy?: string;
}) {
  const sender = (input.senderName || "").trim();
  const legacy = input.legacy || "AI AutoTech <billy@aiautotech.co.za>";
  const raw = (input.address || "").trim();
  const hidePlatform = input.showPlatformName === false;
  const address = extractAddress(raw) || (hidePlatform ? "" : extractAddress(legacy));
  const name = sender || (hidePlatform ? "" : "AI AutoTech");
  if (hidePlatform && /ai autotech/i.test(name)) {
    return address || "Workspace";
  }
  if (!address) return hidePlatform ? name || "Workspace" : legacy;
  if (!name) return address;
  return `${quoteName(name)} <${address}>`;
}

export function brandedSubject(input: { subject?: string; senderName?: string; showPlatformName?: boolean }) {
  const subject = (input.subject || "").trim();
  if (subject) return subject;
  if (input.showPlatformName === false) return (input.senderName || "").trim() || "Message";
  return "AI AutoTech";
}

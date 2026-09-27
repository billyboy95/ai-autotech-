export type ReplyConsent = {
  ok: boolean;
  reason: string;
};

/** Newest row per channel and purpose. Callers pass rows newest first. */
export function latestChannelConsents(rows: { channel?: string; purpose?: string; status?: string }[]) {
  const seen = new Set<string>();
  const latest: { channel: string; status: string }[] = [];
  for (const row of rows) {
    const channel = String(row.channel || "");
    const purpose = String(row.purpose || "");
    const key = `${channel}:${purpose}`;
    if (!channel || seen.has(key)) continue;
    seen.add(key);
    latest.push({ channel, status: String(row.status || "") });
  }
  return latest;
}

/**
 * Conversation AI needs an opt-in on the channel. STOP, suppression, and opt-out
 * refuse the draft. This is stricter than a manual service reply, which may still
 * be queued by a person through the existing inbox form.
 */
export function assessReplyConsent(input: {
  channel: string;
  consents: { channel: string; status: string }[];
  suppressed: boolean;
  inboundStop: boolean;
}): ReplyConsent {
  if (input.inboundStop) {
    return { ok: false, reason: "This contact sent STOP. No AI draft and nothing is queued." };
  }
  if (input.suppressed) {
    return { ok: false, reason: "This contact is suppressed on this channel. No AI draft and nothing is queued." };
  }
  const rows = input.consents.filter((row) => row.channel === input.channel);
  if (rows.some((row) => row.status === "opted_out")) {
    return { ok: false, reason: "This contact is opted out on this channel. No AI draft and nothing is queued." };
  }
  if (!rows.some((row) => row.status === "opted_in")) {
    return { ok: false, reason: "This contact has no opt-in on this channel. No AI draft and nothing is queued." };
  }
  return { ok: true, reason: "" };
}

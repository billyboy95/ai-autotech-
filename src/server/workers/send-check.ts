import { evaluateSend, type ConsentStatus, type OutboundChannel, type OutboundPurpose, type SendDecision } from "@/lib/compliance/send-gate";
import { withOrg } from "@/server/workers/with-org";

function latestConsent(rows: { status?: string; basis?: string; captured_at?: string }[]): {
  consent: ConsentStatus;
  basis: "consent" | "existing_customer" | null;
} {
  const sorted = [...rows].sort((a, b) => String(b.captured_at ?? "").localeCompare(String(a.captured_at ?? "")));
  const row = sorted[0];
  const status = row?.status;
  const consent: ConsentStatus =
    status === "opted_in" || status === "opted_out" || status === "requested" ? status : "none";
  const basis = row?.basis === "existing_customer" || row?.basis === "consent" ? row.basis : null;
  return { consent, basis };
}

/**
 * Outbox gate. Reads one workspace, applies the POPIA check, and does not call a provider.
 * A workspace with sending_enabled false (the default) is skipped.
 */
export async function gateOutbound(input: {
  orgId: string;
  channel: OutboundChannel;
  purpose: OutboundPurpose;
  address: string;
  body: string;
}): Promise<SendDecision> {
  const address = input.address.trim().toLowerCase();
  const org = await withOrg(input.orgId, "id").from("organizations").select("name, sender_name, sending_enabled").maybeSingle();
  if (org.error) throw new Error(org.error.message);
  const orgRow = (org.data ?? {}) as { name?: string; sender_name?: string; sending_enabled?: boolean };
  const purpose = input.purpose === "transactional" ? "service" : input.purpose;
  const [suppressed, consents] = await Promise.all([
    withOrg(input.orgId).from("suppressions").select("id").eq("channel", input.channel).eq("address", address).limit(1),
    withOrg(input.orgId)
      .from("contact_consents")
      .select("status, basis, captured_at")
      .eq("channel", input.channel)
      .eq("purpose", purpose)
      .eq("address", address),
  ]);
  if (suppressed.error) throw new Error(suppressed.error.message);
  if (consents.error) throw new Error(consents.error.message);
  const consent = latestConsent((consents.data ?? []) as { status?: string; basis?: string; captured_at?: string }[]);
  return evaluateSend({
    sendingEnabled: Boolean(orgRow.sending_enabled),
    channel: input.channel,
    purpose: input.purpose,
    senderName: String(orgRow.sender_name || orgRow.name || ""),
    suppressed: (suppressed.data ?? []).length > 0,
    consent: consent.consent,
    basis: consent.basis,
    body: input.body,
  });
}

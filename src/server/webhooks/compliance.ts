import { withOrg } from "@/server/workers/with-org";

function missingTable(message: string) {
  const text = message.toLowerCase();
  return text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find");
}

export async function recordConsent(input: {
  orgId: string;
  channel: "email" | "sms" | "whatsapp";
  purpose: "marketing" | "service";
  status: "opted_in" | "opted_out" | "requested";
  basis: "consent" | "existing_customer";
  address: string;
  source: string;
  evidence?: Record<string, unknown>;
}) {
  const address = input.address.trim().toLowerCase();
  if (!address) return;
  const saved = await withOrg(input.orgId).from("contact_consents").insert({
    channel: input.channel,
    purpose: input.purpose,
    status: input.status,
    basis: input.basis,
    address,
    source: input.source,
    evidence: input.evidence ?? {},
    captured_at: new Date().toISOString(),
    withdrawn_at: input.status === "opted_out" ? new Date().toISOString() : null,
  });
  if (saved.error && !missingTable(saved.error.message)) throw new Error(saved.error.message);
  if (input.status === "opted_out") {
    const suppressed = await withOrg(input.orgId).from("suppressions").upsert(
      {
        channel: input.channel,
        address,
        reason: "unsubscribe",
      },
      { onConflict: "org_id,channel,address" },
    );
    if (suppressed.error && !missingTable(suppressed.error.message)) throw new Error(suppressed.error.message);
  }
}

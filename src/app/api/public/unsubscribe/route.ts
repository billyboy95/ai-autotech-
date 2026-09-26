import { NextResponse } from "next/server";
import { stopAddress } from "@/lib/compliance/stop";
import { lookupRow, serviceConfigured, withOrg } from "@/server/workers/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!serviceConfigured()) {
    return NextResponse.json({ ok: false, error: "Storage is not configured." }, { status: 500 });
  }
  const form = await request.formData().catch(() => null);
  const slug = String(form?.get("org") || "").trim();
  const channelRaw = String(form?.get("channel") || "email");
  const channel = channelRaw === "sms" || channelRaw === "whatsapp" ? channelRaw : "email";
  const address = stopAddress(channel, String(form?.get("address") || ""));
  if (!slug || !address) {
    return NextResponse.json({ ok: false, error: "Workspace and address are required." }, { status: 400 });
  }
  const org = await lookupRow("organizations", "slug", slug, "id, sender_name, name");
  if (!org.configured || org.error || !org.data) {
    return NextResponse.json({ ok: false, error: "Unknown workspace." }, { status: 404 });
  }
  const orgId = String((org.data as unknown as { id: string }).id);
  const suppressed = await withOrg(orgId).from("suppressions").upsert(
    { channel, address, reason: "unsubscribe" },
    { onConflict: "org_id,channel,address" },
  );
  if (suppressed.error) return NextResponse.json({ ok: false, error: suppressed.error.message }, { status: 500 });
  await withOrg(orgId).from("contact_consents").insert({
    channel,
    purpose: "marketing",
    status: "opted_out",
    basis: "consent",
    address,
    source: "/unsubscribe",
    evidence: { consent_text: "Confirmed unsubscribe" },
    captured_at: new Date().toISOString(),
    withdrawn_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, message: "You are opted out. Nothing was sent." });
}

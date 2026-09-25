import { after, NextResponse } from "next/server";
import { handleBusinessEcho, handleInbound, transcribeWithGateway } from "@/lib/whatsapp/engine";
import { downloadMedia, markReadAndType, sendText, verifySignature, whatsappConfigured, type WaInboundMessage, type WaWebhook } from "@/lib/whatsapp/meta";
import { isTestNumber } from "@/lib/whatsapp/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * WhatsApp Cloud API webhook.
 * GET: Meta verification handshake (hub.mode / hub.verify_token / hub.challenge).
 * POST: inbound messages + business-app echoes (coexistence). Signature-checked, answered 200 fast,
 * work continues in after() so Meta doesn't retry. Idempotent on message id.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function textOf(m: WaInboundMessage) {
  switch (m.type) {
    case "text":
      return m.text?.body ?? "";
    case "button":
      return m.button?.text ?? "";
    case "interactive":
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "image":
      return m.image?.caption ?? "";
    case "video":
      return m.video?.caption ?? "";
    case "document":
      return m.document?.caption ?? m.document?.filename ?? "";
    case "location":
      return [m.location?.name, m.location?.address].filter(Boolean).join(", ");
    default:
      return "";
  }
}

function mediaIdOf(m: WaInboundMessage) {
  return m.audio?.id ?? m.image?.id ?? m.video?.id ?? m.document?.id ?? m.sticker?.id ?? null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 512 * 1024) return new NextResponse("Too large", { status: 413 });
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WaWebhook;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const ownNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const jobs: Array<() => Promise<unknown>> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      if (ownNumberId && value.metadata?.phone_number_id && value.metadata.phone_number_id !== ownNumberId) continue;

      if (change.field === "messages") {
        const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? ""]));
        for (const m of value.messages ?? []) {
          // Ignore stale deliveries (older than 15 min), e.g. after an outage, so we don't answer yesterday's "hi".
          if (Number(m.timestamp) * 1000 < Date.now() - 15 * 60_000) continue;
          jobs.push(() =>
            handleInbound(
              {
                waId: m.from,
                channel: "whatsapp",
                isTest: isTestNumber(m.from),
                profileName: names.get(m.from),
                waMessageId: m.id,
                type: m.type,
                text: textOf(m),
                mediaId: mediaIdOf(m),
              },
              {
                realDelays: true,
                debounceMs: Number(process.env.WHATSAPP_DEBOUNCE_MS || 3500),
                typing: async (id) => {
                  if (id && whatsappConfigured()) await markReadAndType(id);
                },
                send: async (text) => (whatsappConfigured() ? sendText(m.from, text) : null),
                transcribe: async (mediaId) => {
                  const media = await downloadMedia(mediaId);
                  return media ? transcribeWithGateway(media.data, media.mimeType) : null;
                },
              },
            ),
          );
        }
      }

      // Coexistence: messages Billy sends from the WhatsApp Business app arrive as echoes.
      if (change.field === "smb_message_echoes" || value.message_echoes) {
        for (const e of value.message_echoes ?? []) {
          jobs.push(() => handleBusinessEcho({ waId: e.to, waMessageId: e.id, text: e.text?.body ?? "" }));
        }
      }
    }
  }

  if (jobs.length) {
    after(async () => {
      const results = await Promise.allSettled(jobs.map((job) => job()));
      for (const r of results) {
        if (r.status === "rejected") console.error("whatsapp webhook job failed", (r.reason as Error)?.message);
      }
    });
  }
  return NextResponse.json({ ok: true });
}

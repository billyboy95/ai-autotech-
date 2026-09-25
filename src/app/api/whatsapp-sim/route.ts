import { NextResponse } from "next/server";
import { z } from "zod";
import { handleInbound } from "@/lib/whatsapp/engine";
import { db, loadMessages, patchConversation } from "@/lib/whatsapp/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Simulator API: runs the exact same engine + brain as the Meta webhook, but with channel 'simulator',
 * status 'test' (never mirrored to crm_leads, no email alerts) and no WhatsApp sending.
 */

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = Number(process.env.WHATSAPP_SIM_RATE_MAX || 120);
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_MAX;
}

const schema = z.object({
  session: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
  action: z.enum(["message", "resume"]).default("message"),
  type: z.enum(["text", "audio", "image"]).default("text"),
  text: z.string().max(2000).default(""),
  unplayable: z.boolean().optional(),
  profileName: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ ok: false, error: "Slow down a bit." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  const input = parsed.data;
  const waId = `sim:${input.session}`;

  try {
    if (input.action === "resume") {
      const conv = await db().from("crm_whatsapp_conversations").select("id").eq("wa_id", waId).maybeSingle();
      if (conv.data) await patchConversation((conv.data as { id: string }).id, { bot_paused_until: null, needs_attention: false, handover_reason: "" });
      return NextResponse.json({ ok: true });
    }
    if (input.type === "text" && !input.text.trim()) return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });

    const result = await handleInbound(
      {
        waId,
        channel: "simulator",
        isTest: true,
        profileName: input.profileName,
        waMessageId: null,
        type: input.type,
        text: input.text,
        simUnplayable: input.unplayable,
      },
      { realDelays: false, debounceMs: 0 },
    );

    let state: Record<string, unknown> | null = null;
    if (result.conversationId) {
      const conv = await db()
        .from("crm_whatsapp_conversations")
        .select("status, bot_paused_until, handover_reason, needs_attention, opted_out, lead, crm_lead_id")
        .eq("id", result.conversationId)
        .single();
      state = conv.data as Record<string, unknown>;
    }
    return NextResponse.json({ ok: true, result, state });
  } catch (e) {
    console.error("sim failed", e);
    const msg = (e as Error).message || "Failed";
    return NextResponse.json({ ok: false, error: msg.slice(0, 400) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("session") ?? "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(session)) return NextResponse.json({ ok: false }, { status: 400 });
  const conv = await db()
    .from("crm_whatsapp_conversations")
    .select("id, status, bot_paused_until, handover_reason, needs_attention, opted_out, lead, crm_lead_id")
    .eq("wa_id", `sim:${session}`)
    .maybeSingle();
  if (!conv.data) return NextResponse.json({ ok: true, messages: [] });
  const { id, ...state } = conv.data as { id: string } & Record<string, unknown>;
  const rows = await loadMessages(id, 100);
  return NextResponse.json({
    ok: true,
    state,
    messages: rows.map((r) => ({ author: r.author, body: r.body, type: r.type, at: r.created_at })),
  });
}

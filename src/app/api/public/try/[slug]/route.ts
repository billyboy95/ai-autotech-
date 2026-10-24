import { NextResponse } from "next/server";
import { z } from "zod";
import { handleTryMessage, readTryHistory } from "@/lib/try-chat/handle";
import { TRY_BANNER } from "@/lib/try-chat/prompt";
import { createTryProvider } from "@/lib/try-chat/provider";
import { TRY_RATE_WINDOW_MS } from "@/lib/try-chat/rate";
import { hashTryToken } from "@/lib/try-chat/token";
import { createTryStore } from "@/server/workers/try-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const ipHits = new Map<string, number[]>();
const linkHits = new Map<string, number[]>();

const bodySchema = z.object({
  token: z.string().trim().min(20).max(200),
  message: z.string().trim().min(1).max(2000),
});

function clientIp(request: Request) {
  return (
    request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown"
  );
}

function bucket(map: Map<string, number[]>, key: string, now: number) {
  const hits = (map.get(key) ?? []).filter((hit) => now - hit < TRY_RATE_WINDOW_MS);
  if (map.size > 5000) {
    for (const [entry, times] of map) {
      if (!times.some((hit) => now - hit < TRY_RATE_WINDOW_MS)) map.delete(entry);
    }
  }
  return hits;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
  });
}

function unavailable() {
  return json({
    ok: false,
    message: "This test chat is not available until the workspace is connected. Nothing was sent.",
    reply: "",
    tool: null,
  }, 503);
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const token = new URL(request.url).searchParams.get("t")?.trim() ?? "";
  if (token.length < 20) return json({ ok: false, message: "This test link is not active.", messages: [] }, 404);
  const store = createTryStore();
  if (!store) return unavailable();
  const read = await readTryHistory({
    slug,
    tokenHash: hashTryToken(token),
    now: new Date(),
    store,
  });
  return json({ ...read.body, banner: TRY_BANNER }, read.status);
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ ok: false, message: "That message is too long.", reply: "", tool: null }, 413);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "JSON body required.", reply: "", tool: null }, 400);
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return json({ ok: false, message: "Enter a message.", reply: "", tool: null }, 400);
  }
  const store = createTryStore();
  if (!store) return unavailable();
  const now = Date.now();
  const tokenHash = hashTryToken(parsed.data.token);
  const ipKey = hashTryToken(clientIp(request));
  const handled = await handleTryMessage({
    slug,
    token: parsed.data.token,
    tokenHash,
    message: parsed.data.message,
    now: new Date(now),
    ipHits: bucket(ipHits, ipKey, now),
    linkHits: bucket(linkHits, tokenHash, now),
    store,
    provider: createTryProvider(process.env),
  });
  ipHits.set(ipKey, handled.ipHits);
  linkHits.set(tokenHash, handled.linkHits);
  return json({ ...handled.body, banner: TRY_BANNER }, handled.status);
}

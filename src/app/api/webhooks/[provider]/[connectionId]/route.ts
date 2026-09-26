import { NextResponse } from "next/server";
import { metaWebhookChallenge, receiveChannelWebhook } from "@/server/webhooks/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string; connectionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { connectionId } = await context.params;
  const url = new URL(request.url);
  const result = await metaWebhookChallenge({
    connectionId,
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  });
  if (result.status !== 200) return new NextResponse("Unauthorized", { status: result.status });
  return new NextResponse(result.body, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request, context: RouteContext) {
  const { provider, connectionId } = await context.params;
  const rawBody = await request.text();
  const result = await receiveChannelWebhook({
    provider,
    connectionId,
    rawBody,
    signature: request.headers.get("x-hub-signature-256") || request.headers.get("x-webhook-signature"),
    sharedSecret: request.headers.get("x-channel-secret"),
  });
  return NextResponse.json(result.body, { status: result.status });
}

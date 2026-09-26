import { NextResponse } from "next/server";
import { runAutomationJob } from "@/lib/automation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (secret) return header === secret;
  return process.env.VERCEL_ENV !== "production";
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Set CRON_SECRET and send Authorization: Bearer <CRON_SECRET>." }, { status: 401 });
  }
  const result = await runAutomationJob();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}

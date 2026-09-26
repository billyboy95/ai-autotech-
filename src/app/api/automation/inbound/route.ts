import { NextResponse } from "next/server";
import { applyInbound } from "@/lib/automation/engine";
import { normalizeInbound } from "@/lib/automation/inbound";
import { describeChanges, loadWorkspace, saveWorkspace } from "@/lib/automation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.AUTOMATION_WEBHOOK_SECRET || process.env.CRON_SECRET;
  const header =
    request.headers.get("x-automation-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (secret) return header === secret;
  return process.env.VERCEL_ENV !== "production";
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Set AUTOMATION_WEBHOOK_SECRET and send it as x-automation-secret." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON body required." }, { status: 400 });
  }

  const event = normalizeInbound(body);
  if (!event) {
    return NextResponse.json(
      { ok: false, error: "Unsupported event. Use booking.created, reply.received, audit.completed, or proposal.sent." },
      { status: 400 },
    );
  }

  try {
    const workspace = await loadWorkspace();
    if (!workspace.automationReady) {
      return NextResponse.json({ ok: false, error: workspace.setupError }, { status: 503 });
    }
    const after = applyInbound(workspace.state, event, new Date());
    const matched = after !== workspace.state || describeChanges(workspace.state, after).length > 0;
    if (after === workspace.state) {
      return NextResponse.json({ ok: true, matched: false, error: "No lead matched that event." }, { status: 202 });
    }
    await saveWorkspace(workspace.state, after);
    return NextResponse.json({ ok: true, matched, events: describeChanges(workspace.state, after) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not apply the event." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { requireCrmApiUser } from "@/lib/auth/session";
import { isSendEnabled } from "@/lib/automation/channels";
import { loadSupabaseWorkspace } from "@/lib/automation/persist";
import { buildReport, summaryLines } from "@/lib/automation/report";
import { hydrateState } from "@/lib/automation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const token = process.env.AUTOMATION_SUMMARY_TOKEN;
  if (!token) return true;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const query = new URL(request.url).searchParams.get("token") || "";
  return header === token || query === token;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const session = await requireCrmApiUser();
  if (!session.ok) return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  if (!session.userId || !("supabase" in session) || !session.supabase) {
    return NextResponse.json({ ok: true, lines: [], report: null, setupError: "Preview mode." });
  }
  try {
    const loaded = await loadSupabaseWorkspace(session.supabase, null);
    const report = buildReport(hydrateState(loaded.state), new Date(), isSendEnabled());
    return NextResponse.json({
      ok: true,
      lines: summaryLines(report),
      report,
      setupError: loaded.setupError,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not build the summary." },
      { status: 500 },
    );
  }
}

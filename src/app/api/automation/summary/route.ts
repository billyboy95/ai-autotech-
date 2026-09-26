import { NextResponse } from "next/server";
import { isSendEnabled } from "@/lib/automation/channels";
import { buildReport, summaryLines } from "@/lib/automation/report";
import { loadWorkspace } from "@/lib/automation/service";

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
  try {
    const workspace = await loadWorkspace();
    const report = buildReport(workspace.state, new Date(), isSendEnabled());
    return NextResponse.json({
      ok: true,
      lines: summaryLines(report),
      report,
      setupError: workspace.setupError,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not build the summary." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { loadWorkspace, recordTrackedClick } from "@/lib/automation/service";
import { resolvePublicRedirect } from "@/lib/automation/social";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const extra: string[] = [];
  try {
    const workspace = await loadWorkspace();
    if (workspace.state.settings.bookingUrl) extra.push(workspace.state.settings.bookingUrl);
  } catch (error) {
    console.error("redirect settings skipped", error);
  }

  const destination = resolvePublicRedirect(url.searchParams.get("to") || "", process.env, extra);
  if (!destination) {
    return NextResponse.json({ ok: false, error: "That link is not allowed." }, { status: 400 });
  }

  const utmSource = (url.searchParams.get("utm_source") || "").slice(0, 120);
  const utmCampaign = (url.searchParams.get("utm_campaign") || "").slice(0, 120);
  const utmMedium = (url.searchParams.get("utm_medium") || "social").slice(0, 120);
  const postId = (url.searchParams.get("post") || "").slice(0, 80);

  if (utmSource || utmCampaign) {
    try {
      await recordTrackedClick({
        postId,
        utmSource,
        utmCampaign,
        utmMedium,
        destination,
      });
    } catch (error) {
      console.error("click record failed", error);
    }
  }

  const target = new URL(destination);
  if (utmSource) target.searchParams.set("utm_source", utmSource);
  if (utmCampaign) target.searchParams.set("utm_campaign", utmCampaign);
  if (utmMedium) target.searchParams.set("utm_medium", utmMedium);
  return NextResponse.redirect(target, 302);
}

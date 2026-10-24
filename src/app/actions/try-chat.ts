"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";
import { createBotTryLink, revokeBotTryLink } from "@/server/workers/try-chat";

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

function safeReturn(value: FormDataEntryValue | null, bot: string) {
  const path = String(value ?? "").split("?")[0];
  if (path.startsWith("/command-centre/bots/") && !path.includes("..")) return path;
  return `/command-centre/bots/${bot}`;
}

function withNotice(path: string, message: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}notice=${encodeURIComponent(message)}`);
}

async function manageable(slug: string) {
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.mode !== "member" || workspace.active.slug !== slug || !canManage(workspace.role)) return null;
  return workspace;
}

export async function createBotTryLinkAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const bot = String(formData.get("bot") ?? "");
  const back = safeReturn(formData.get("return_to"), bot);
  const workspace = await manageable(slug);
  if (!workspace) withNotice(back, "Preview workspace, or sign in as a workspace admin. The test link was not created. Nothing was sent.");
  const created = await createBotTryLink({ orgId: workspace.active.id, orgSlug: workspace.active.slug, botSlug: bot });
  if (!created.ok) withNotice(back, created.message);
  revalidatePath(`/command-centre/bots/${bot}`);
  withNotice(back, `Test link ready. Copy it now. Only the hash is stored. ${created.url} Nothing was sent.`);
}

export async function revokeBotTryLinkAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const bot = String(formData.get("bot") ?? "");
  const linkId = String(formData.get("link") ?? "");
  const back = safeReturn(formData.get("return_to"), bot);
  const workspace = await manageable(slug);
  if (!workspace) withNotice(back, "Preview workspace. Nothing was revoked and nothing was sent.");
  const revoked = await revokeBotTryLink({ orgId: workspace.active.id, botSlug: bot, linkId });
  revalidatePath(`/command-centre/bots/${bot}`);
  withNotice(back, revoked.message);
}

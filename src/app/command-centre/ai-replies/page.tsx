import type { Metadata } from "next";
import { AiReplySettingsForm } from "@/components/ai-reply-settings-form";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { canManageAiReplies, DEFAULT_AI_REPLY_SETTINGS, missingAiTable, parseAiReplySettings } from "@/lib/ai-reply/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversation AI",
  robots: { index: false, follow: false },
};

export default async function AiRepliesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, tenant] = await Promise.all([
    loadCommandData(),
    safeResolveWorkspace(params.org),
  ]);
  const canManage = tenant.mode === "member" && canManageAiReplies(tenant.role);
  let settings = DEFAULT_AI_REPLY_SETTINGS;
  let notice = tenant.mode === "preview"
    ? "Preview. Conversation AI stays off until this workspace is connected. Nothing is sent."
    : null;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && tenant.mode === "member"
    && tenant.role
    && !tenant.requiresLogin
    && tenant.scoped
    && !tenant.active.id.startsWith("preview-")
  ) {
    try {
      const supabase = await createSupabaseServerClient();
      const row = await supabase.from("ai_reply_settings").select("*").eq("org_id", tenant.active.id).maybeSingle();
      if (row.error) {
        notice = missingAiTable(row.error.message)
          ? "Conversation AI tables are not in this database yet. Apply phase 3a before saving. Nothing was sent."
          : row.error.message;
      } else if (row.data) {
        settings = parseAiReplySettings(row.data);
      }
    } catch {
      notice = "Conversation AI settings could not be loaded. Nothing was sent.";
    }
  }

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Conversation AI</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Drafts a reply from the latest inbox messages. Approve keeps it in the inbox, or queues it in the outbox when that mode is on. Opt-out and STOP never enter the outbox.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Set <code>AI_REPLY_API_KEY</code>. Optional <code>AI_REPLY_BASE_URL</code> (OpenAI-compatible, default https://api.openai.com/v1) and <code>AI_REPLY_MODEL</code> (default gpt-4o-mini). If the key is missing, the inbox stores provider_unconfigured and stays up. The cron at <code>/api/cron/ai-replies</code> stays idle unless <code>AI_REPLY_CRON_ENABLED</code> is true, and it still needs <code>CRON_SECRET</code>. Leave that flag unset.
        </p>
      </div>
      {notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{notice}</p> : null}
      <AiReplySettingsForm
        settings={settings}
        orgSlug={tenant.active.slug}
        canManage={canManage}
        sendingEnabled={tenant.active.sendingEnabled}
      />
    </CommandShell>
  );
}

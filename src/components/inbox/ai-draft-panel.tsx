"use client";

import Link from "next/link";
import { approveAiDraft, draftInboxWithAi, editAiDraft, rejectAiDraft } from "@/app/actions/ai-reply";
import type { InboxData } from "@/lib/inbox/types";

export function AiDraftPanel({ data }: { data: InboxData }) {
  const thread = data.thread;
  if (!thread) return null;
  const draft = data.draft;
  const settingsHref = data.orgSlug && data.orgSlug !== "preview"
    ? `/command-centre/ai-replies?org=${data.orgSlug}`
    : "/command-centre/ai-replies";
  const editable = Boolean(draft) && (draft?.status === "pending_review" || draft?.status === "approved") && Boolean(draft?.consentOk) && !draft?.failure;
  const showApprove = Boolean(draft) && draft?.status === "pending_review" && draft.consentOk && !draft.failure;

  return (
    <div data-testid="ai-draft-panel" className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0B1F3A]">Conversation AI</h3>
        <Link href={settingsHref} className="text-xs font-semibold text-[#2563EB]">Settings</Link>
      </div>
      {!data.aiEnabled ? (
        <p className="text-sm text-slate-600">
          Conversation AI is off for this workspace. An agency owner or client admin can turn drafts on. Nothing is sent from here.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          {data.aiMode === "queue_outbox"
            ? "Approve queues the reply in the outbox. It is not delivered while sending is off."
            : "Approve keeps the draft in the inbox. It is not queued."}
          {data.aiRequireHuman ? " A person reviews each draft." : ""}
        </p>
      )}
      {data.preview && draft ? (
        <p className="text-xs text-slate-500">Example draft in the preview inbox. Nothing is sent.</p>
      ) : null}
      <form action={draftInboxWithAi}>
        <Hidden data={data} id={thread.id} />
        <button
          className="h-9 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!data.aiEnabled && !data.preview}
        >
          Draft with AI
        </button>
      </form>
      {draft ? (
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label(draft.status)}
            {draft.outboxStatus ? ` · outbox ${draft.outboxStatus}` : ""}
          </p>
          {!draft.consentOk || draft.failure ? (
            <p className="text-sm text-rose-800">{draft.reason || failureCopy(draft.failure)}</p>
          ) : null}
          {draft.status === "queued" ? (
            <p className="text-sm text-slate-600">
              {draft.outboxStatus === "held" || !data.sendingEnabled
                ? "Queued in the outbox and held. Sending is off, so nothing was delivered."
                : "Queued in the outbox. This screen did not deliver it."}
            </p>
          ) : null}
          {editable ? (
            <form action={editAiDraft} className="grid gap-2">
              <Hidden data={data} id={thread.id} />
              <input type="hidden" name="draftId" value={draft.id} />
              <textarea name="draftBody" key={draft.id} defaultValue={draft.body} rows={4} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">Save edit</button>
                {showApprove ? (
                  <button formAction={approveAiDraft} className="h-9 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white">
                    {data.aiMode === "queue_outbox" ? "Approve and queue" : "Approve"}
                  </button>
                ) : null}
              </div>
            </form>
          ) : draft.body ? (
            <p className="whitespace-pre-wrap text-sm text-slate-800">{draft.body}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {draft.status === "pending_review" || draft.status === "approved" ? (
              <form action={rejectAiDraft}>
                <Hidden data={data} id={thread.id} />
                <input type="hidden" name="draftId" value={draft.id} />
                <button className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">Reject</button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function label(status: string) {
  if (status === "pending_review") return "Pending review";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "queued") return "Queued";
  if (status === "sent") return "Sent";
  return "Not drafted";
}

function failureCopy(failure: string) {
  if (failure === "provider_unconfigured") return "AI_REPLY_API_KEY is not set. Nothing was sent.";
  if (failure === "consent_denied") return "This contact cannot receive an AI draft. Nothing was queued.";
  if (failure === "provider_error") return "The reply provider failed. Nothing was sent.";
  if (failure === "channel_not_allowed") return "Conversation AI is not allowed on this channel.";
  return "This draft was not queued.";
}

function Hidden({ data, id }: { data: InboxData; id: string }) {
  return (
    <>
      <input type="hidden" name="org" value={data.orgSlug === "preview" ? "" : data.orgSlug} />
      <input type="hidden" name="filter" value={data.filter} />
      <input type="hidden" name="channel" value={data.channel} />
      <input type="hidden" name="id" value={id} />
    </>
  );
}

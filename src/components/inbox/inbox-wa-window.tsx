import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import type { CustomerCareWindow } from "@/lib/inbox/wa-window";

export function InboxWaWindow({
  care,
  category,
  blocked,
  prompt,
}: {
  care: CustomerCareWindow;
  category: string;
  blocked: boolean;
  prompt: string;
}) {
  const status = care.open
    ? `Customer care window open. Closes in ${care.countdown}. Free-form stays queued only. Nothing is sent.`
    : care.inboundAt
      ? "24-hour window closed. Use an approved template."
      : "24-hour window closed. No inbound WhatsApp message yet. Use an approved template.";
  return (
    <div
      data-testid="inbox-wa-window"
      data-window={care.open ? "open" : "closed"}
      data-freeform={blocked ? "blocked" : "open"}
      className={`rounded-xl border px-3 py-2 ${care.open ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
    >
      <p data-testid="inbox-wa-window-status" className={`text-sm font-medium ${care.open ? "text-emerald-950" : "text-amber-950"}`}>
        {status}
      </p>
      <p data-testid="inbox-wa-window-meter" className="mt-1 text-xs text-slate-600">
        Message category: {category} (placeholder). Cost metering is not live yet.
      </p>
      {blocked ? (
        <p data-testid="inbox-wa-template-gate" className="mt-2 text-sm font-medium text-amber-950">
          {prompt}
        </p>
      ) : null}
    </div>
  );
}

export function InboxWaReplyFields({
  blocked,
  body,
  onBody,
}: {
  blocked: boolean;
  body: string;
  onBody?: (value: string) => void;
}) {
  return (
    <>
      <textarea
        name="body"
        data-testid="inbox-reply-body"
        value={body}
        onChange={(event) => onBody?.(event.target.value)}
        rows={4}
        disabled={blocked}
        placeholder={blocked ? "Free-form is closed. Use an approved template." : "Write a reply. It is queued, not sent."}
        className="rounded-md border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
      />
      <button
        type="submit"
        data-testid="inbox-queue-reply"
        className="h-10 justify-self-start rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={blocked}
      >
        Queue reply
      </button>
    </>
  );
}

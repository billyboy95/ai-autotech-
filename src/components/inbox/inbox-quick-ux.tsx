import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import type { InboxQuickReply } from "@/lib/inbox/types";
import { inboxQuickClasses } from "@/lib/inbox/quick-ux";

export function InboxQuickFrame({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const layout = inboxQuickClasses(enabled);
  if (!enabled) return <div className={layout.columns}>{children}</div>;
  return (
    <div data-testid="inbox-quick-layout" data-stack="narrow" data-desktop="three-column" className={layout.columns}>
      {children}
    </div>
  );
}

export function InboxQuickReplies({
  replies,
  onInsert,
}: {
  replies: readonly InboxQuickReply[];
  onInsert: (body: string) => void;
}) {
  if (!replies.length) return null;
  return (
    <div data-testid="inbox-quick-replies" className="grid min-w-0 gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick replies</p>
      <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1">
        {replies.map((reply) => (
          <button
            key={reply.id}
            type="button"
            data-reply={reply.id}
            className="inline-flex h-11 min-h-11 shrink-0 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#0B1F3A] ring-1 ring-slate-200"
            onClick={() => onInsert(reply.body)}
          >
            {reply.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Fills the box only. Press Queue reply to queue it. Nothing is sent.</p>
    </div>
  );
}

export function InboxCollisionBanner({ label }: { label: string }) {
  if (!label) return null;
  return (
    <p
      data-testid="inbox-collision"
      role="status"
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
    >
      {label}
    </p>
  );
}

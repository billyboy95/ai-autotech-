"use client";

import React, { useState } from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import {
  bulkScopeKey,
  bulkStatusFor,
  bulkStatusLabel,
  selectableConversationIds,
  selectionForScope,
  toggleBulkId,
} from "@/lib/inbox/bulk";

type BulkRow = { id: string; status: string; contactName: string };

type BulkAction = (formData: FormData) => void | Promise<void>;

export function InboxBulkChrome<T extends BulkRow>({
  enabled,
  filter,
  channel,
  number,
  conversations,
  members,
  userId,
  orgSlug,
  threadId,
  initialSelected,
  assignAction,
  statusAction,
  readAction,
  children,
}: {
  enabled: boolean;
  filter: string;
  channel: string;
  number: string;
  conversations: readonly T[];
  members: readonly { userId: string; role: string }[];
  userId: string | null;
  orgSlug: string;
  threadId: string;
  initialSelected?: readonly string[];
  assignAction?: BulkAction;
  statusAction?: BulkAction;
  readAction?: BulkAction;
  children: (item: T) => React.ReactNode;
}) {
  const scopeKey = bulkScopeKey({ filter, channel, number });
  const [trackedScope, setTrackedScope] = useState(scopeKey);
  const [selected, setSelected] = useState<string[]>(() => [...(initialSelected ?? [])]);
  if (trackedScope !== scopeKey) {
    setTrackedScope(scopeKey);
    setSelected(selectionForScope({ previousScope: trackedScope, nextScope: scopeKey, selected }));
  }
  if (!enabled) return null;

  const selectable = selectableConversationIds(conversations);
  const active = (trackedScope === scopeKey ? selected : []).filter((id) => selectable.includes(id));
  const chosen = conversations.filter((item) => active.includes(item.id));
  const status = bulkStatusFor(chosen.map((item) => item.status));
  const statusLabel = bulkStatusLabel(status);

  return (
    <>
      {active.length > 0 ? (
        <form
          action={assignAction}
          data-testid="inbox-bulk-toolbar"
          className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          <p className="text-sm font-semibold text-[#0B1F3A]">
            {active.length} selected. Nothing is sent.
          </p>
          <input type="hidden" name="org" value={orgSlug === "preview" ? "" : orgSlug} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="channel" value={channel} />
          {number ? <input type="hidden" name="number" value={number} /> : null}
          {threadId ? <input type="hidden" name="id" value={threadId} /> : null}
          {active.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <div className="flex flex-wrap items-center gap-2">
            <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold text-slate-500">
              Assign
              <select name="assignee" aria-label="Assign selected" defaultValue="" className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900">
                <option value="">Unassigned</option>
                {userId ? <option value={userId}>Me</option> : null}
                {members.filter((member) => member.userId !== userId).map((member) => (
                  <option key={member.userId} value={member.userId}>{member.role} · {member.userId.slice(0, 8)}</option>
                ))}
              </select>
            </label>
            <button type="submit" data-testid="inbox-bulk-assign" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">
              Assign
            </button>
            <button
              type="submit"
              formAction={statusAction}
              data-testid="inbox-bulk-status"
              data-status={status}
              className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
            >
              {statusLabel}
            </button>
            <button type="submit" formAction={readAction} data-testid="inbox-bulk-read" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">
              Mark read
            </button>
          </div>
        </form>
      ) : null}
      {conversations.map((item) => {
        const canSelect = selectable.includes(item.id);
        return (
          <div key={item.id} data-testid="inbox-bulk-row" className="flex min-w-0 items-start gap-1">
            {canSelect ? (
              <label className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.contactName}`}
                  data-testid="inbox-bulk-select"
                  data-id={item.id}
                  checked={active.includes(item.id)}
                  onChange={() => setSelected((current) => toggleBulkId(current, item.id, selectable))}
                  className="h-5 w-5 accent-[#2563EB]"
                />
              </label>
            ) : null}
            <div className="min-w-0 flex-1">{children(item)}</div>
          </div>
        );
      })}
    </>
  );
}

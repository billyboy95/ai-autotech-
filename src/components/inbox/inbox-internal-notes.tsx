import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import { formatNoteTimestamp, noteAuthorLabel } from "@/lib/inbox/internal-notes";
import type { InboxData, InboxNote } from "@/lib/inbox/types";

type NoteAction = (formData: FormData) => void | Promise<void>;

export function InboxInternalNotes({
  enabled,
  notes,
  data,
  threadId,
  saveAction,
}: {
  enabled: boolean;
  notes: readonly InboxNote[];
  data: InboxData;
  threadId: string;
  saveAction: NoteAction;
}) {
  if (!enabled || !threadId) return null;
  return (
    <section data-testid="inbox-internal-notes" className="grid gap-3 border-t border-slate-100 pt-3">
      <div>
        <h3 className="text-sm font-semibold text-[#0B1F3A]">Internal notes</h3>
        <p className="mt-1 text-xs text-slate-500">Staff only. Saved on this thread. Not queued and not sent.</p>
      </div>
      {notes.length === 0 ? (
        <p data-testid="inbox-internal-notes-empty" className="text-sm text-slate-500">No internal notes yet.</p>
      ) : (
        <ul data-testid="inbox-internal-note-list" className="grid gap-2">
          {notes.map((note) => (
            <li key={note.id} data-testid="inbox-internal-note" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p data-testid="inbox-internal-note-meta" className="text-xs font-semibold uppercase tracking-wide">
                {noteAuthorLabel(note.authorUserId, { userId: data.userId, members: data.members })}
                {" · "}
                {formatNoteTimestamp(note.createdAt)}
                {" · not sent"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form action={saveAction} className="grid gap-2">
        <input type="hidden" name="org" value={data.orgSlug === "preview" ? "" : data.orgSlug} />
        <input type="hidden" name="filter" value={data.filter} />
        <input type="hidden" name="channel" value={data.channel} />
        {data.multiNumber && data.number ? <input type="hidden" name="number" value={data.number} /> : null}
        <input type="hidden" name="id" value={threadId} />
        <label className="grid gap-1 text-xs font-semibold text-slate-500">
          Add a note
          <textarea
            name="note"
            data-testid="inbox-internal-note-body"
            rows={2}
            placeholder="Only your team can see this."
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button className="h-9 justify-self-start rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">Save note</button>
      </form>
    </section>
  );
}

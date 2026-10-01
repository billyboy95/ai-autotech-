"use client";

import { useActionState } from "react";
import { recordGoliveChecklistNote } from "@/app/actions/golive-checklist";
import type { GoliveMode } from "@/lib/golive/checklist";

const initial = { stored: false, write: false, mode: "fixture" as const, message: "" };

export function GoliveNoteForm({
  mode,
  write,
  hint,
  orgSlug,
}: {
  mode: GoliveMode;
  write: boolean;
  hint: string;
  orgSlug: string;
}) {
  const [state, action] = useActionState(recordGoliveChecklistNote, initial);
  const idle = `${hint} write: ${write ? "true" : "false"}.`;
  return (
    <form action={action} className="grid gap-3" data-testid="golive-note-form">
      <input type="hidden" name="slug" value={orgSlug} />
      <button className="inline-flex h-11 w-fit items-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">
        Record sandbox note
      </button>
      <p
        className="text-sm text-slate-700"
        data-stored={state.stored ? "yes" : "no"}
        data-write={state.message ? String(state.write) : write ? "true" : "false"}
        data-mode={mode}
      >
        {state.message || idle}
      </p>
    </form>
  );
}

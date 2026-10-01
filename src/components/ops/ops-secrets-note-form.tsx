"use client";

import { useActionState } from "react";
import { recordOpsSecretsNote } from "@/app/actions/ops-secrets";
import type { OpsSecretsMode } from "@/lib/ops/secrets";

const initial = { stored: false, write: false, mode: "fixture" as const, message: "" };

export function OpsSecretsNoteForm({
  mode,
  write,
  hint,
  orgSlug,
}: {
  mode: OpsSecretsMode;
  write: boolean;
  hint: string;
  orgSlug: string;
}) {
  const [state, action] = useActionState(recordOpsSecretsNote, initial);
  const idle = `${hint} write: ${write ? "true" : "false"}.`;
  return (
    <form action={action} className="grid gap-3" data-testid="ops-secrets-note-form">
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

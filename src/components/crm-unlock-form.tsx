"use client";

import { useActionState } from "react";
import { unlockCrm, type UnlockState } from "@/app/actions/crm-auth";

const initialState: UnlockState = { ok: false, message: "" };

export function UnlockForm({ from }: { from: string }) {
  const [state, formAction, pending] = useActionState(unlockCrm, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="from" value={from} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Password
        <input
          name="password"
          type="password"
          required
          autoFocus
          className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Unlocking..." : "Unlock"}
      </button>
      {state.message ? <p className="text-sm font-medium text-rose-700">{state.message}</p> : null}
    </form>
  );
}

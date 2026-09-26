"use client";

import { useActionState } from "react";
import { acceptInvitation, type TenantActionState } from "@/app/actions/tenant";

const initial: TenantActionState = { ok: false, message: "" };

export function AcceptInvite({ token }: { token: string }) {
  const [state, action, pending] = useActionState(async () => acceptInvitation(token), initial);
  return (
    <form action={action} className="mt-5 grid gap-3">
      <button disabled={pending} className="h-10 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}

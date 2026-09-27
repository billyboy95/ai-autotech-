"use client";

import { useActionState } from "react";
import { acceptTeamInvite, attributeSignup, type ReferralActionState } from "@/app/actions/referrals";

const initial: ReferralActionState = { ok: false, message: "" };

export function SignupAttribution({ code }: { code: string | null }) {
  const [state, action, pending] = useActionState(attributeSignup, initial);
  return (
    <form action={action} className="mt-5 grid gap-3">
      {code ? <input type="hidden" name="ref" value={code} /> : null}
      <button disabled={pending} className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : "Attribute this workspace"}
      </button>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}

export function TeamAccept({ token, code }: { token: string; code: string | null }) {
  const [state, action, pending] = useActionState(acceptTeamInvite, initial);
  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="token" value={token} />
      {code ? <input type="hidden" name="ref" value={code} /> : null}
      <button disabled={pending} className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}

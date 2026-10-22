"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startMembershipCheckout, type MembershipActionState } from "@/app/actions/services";
import { PayfastRedirect } from "@/components/payfast/redirect-form";
import { BUSINESS_EMAIL } from "@/lib/brand/contact";
import { MEMBERSHIP_TIERS } from "@/lib/membership/tiers";
import { formatPackageZar } from "@/lib/services/catalog";

const initial: MembershipActionState = { ok: false, message: "", checkout: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
      {pending ? "Preparing checkout..." : "Continue to PayFast"}
    </button>
  );
}

export function MembershipForm() {
  const [state, action] = useActionState(startMembershipCheckout, initial);
  if (state.checkout?.actionUrl && state.checkout.fields) {
    return (
      <div>
        <p className="text-sm text-slate-700">{state.message}</p>
        <PayfastRedirect action={state.checkout.actionUrl} fields={state.checkout.fields} />
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-700">Tier</legend>
        {MEMBERSHIP_TIERS.map((tier) => (
          <label key={tier.code} className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <input type="radio" name="tier_code" value={tier.code} defaultChecked={tier.code === "platform"} required className="mt-1" />
            <span>
              <span className="font-semibold text-[#0B1F3A]">{tier.name}</span>
              {" · "}
              {formatPackageZar(tier.priceCents)} / month
              {tier.code === "agent_starter" ? " · agents from R699" : ""}
              <span className="mt-1 block text-slate-600">{tier.summary} Excludes VAT.</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Name
        <input name="full_name" required className="h-11 rounded-md border border-slate-200 px-3" />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <input name="email" type="email" required className="h-11 rounded-md border border-slate-200 px-3" />
      </label>
      <input name="_honey" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <Submit />
      {state.message ? <p className="text-sm text-slate-700">{state.message}</p> : null}
      <p className="text-sm text-slate-600">
        Questions: <a className="font-semibold" href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
      </p>
    </form>
  );
}

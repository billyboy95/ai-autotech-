"use client";

import { useActionState, useState } from "react";
import { applyZentrixWorkspacePack, type ApplyZentrixState } from "@/app/actions/zentrix-pack";
import { ZENTRIX_PACK_BUTTON, ZENTRIX_STORE_STUBS, type ZentrixPackMode } from "@/lib/zentrix/pack";

const initial: ApplyZentrixState = {
  ok: false,
  stored: false,
  refused: false,
  queued: 0,
  sent: 0,
  message: "",
};

export function ApplyZentrixPackForm({ mode = "fixture" }: { mode?: ZentrixPackMode }) {
  const [state, action, pending] = useActionState(applyZentrixWorkspacePack, initial);
  const [confirming, setConfirming] = useState(false);

  return (
    <section id="zentrix-pack" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="apply-zentrix-pack">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#16A34A]">Zentrix Online</p>
      <h2 className="mt-1 font-display text-lg font-bold text-[#0B1F3A]">Zentrix workspace pack</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Stores three Shopify stubs on the existing Zentrix Online workspace. Pets and Kitchens are priority. Auto is QA /
        reference and is not an ad target. No Shopify call runs, no key is stored, and sending stays off.
      </p>
      {mode === "fixture" ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Fixture only. These stubs are not stored until ZENTRIX_WORKSPACE_PACK_ENABLED is true and step 29 is applied.
          Nothing is sent.
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Sandbox pack. Applying stores the three stubs. Nothing is sent.</p>
      )}
      <ul className="mt-3 grid gap-2">
        {ZENTRIX_STORE_STUBS.map((store) => (
          <li key={store.key} data-store={store.key} className="min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <p className="font-semibold text-[#0B1F3A]">
              {store.label}{" "}
              <span className="font-medium text-slate-500">· {store.purposeLabel}</span>
            </p>
            <p className="break-all text-slate-600">
              Handle {store.handle}. Storefront placeholder {store.storefrontUrl}.
            </p>
            <p className="break-all text-slate-500">
              {store.intendedPublicHost
                ? `Intended later: ${store.intendedPublicHost}. Live DNS is not required.`
                : "QA / reference only. Not an ad target. No public subdomain in this pack."}
            </p>
          </li>
        ))}
      </ul>
      {confirming ? (
        <form action={action} className="mt-3 grid gap-3">
          <input type="hidden" name="intent" value="apply" />
          <input type="hidden" name="confirm" value="yes" />
          <p className="text-sm text-slate-700">
            Confirm this applies the Zentrix pack to Zentrix Online only. Nothing is sent and sending stays off.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending}
              className="h-10 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Applying…" : "Confirm apply to Zentrix Online"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-10 rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 h-10 rounded-md bg-[#16A34A] px-4 text-sm font-semibold text-white"
        >
          {ZENTRIX_PACK_BUTTON}
        </button>
      )}
      <form action={action} className="mt-3 flex flex-wrap gap-2">
        <button
          name="intent"
          value="publish"
          className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
        >
          Publish
        </button>
        <button
          name="intent"
          value="send"
          className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
        >
          Send
        </button>
        <button
          name="intent"
          value="go_live"
          className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
        >
          Go live
        </button>
      </form>
      <p className="mt-2 text-sm text-slate-500">
        Publish, Send, and Go live are refused. Billy must approve sends. No ad spend. Nothing is posted.
      </p>
      {state.message ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </section>
  );
}

"use client";

import React from "react"; // node:test compiles JSX with the classic runtime.
import Link from "next/link";
import { useState } from "react";
import { previewEmbeddedSignupClick, type EmbeddedSignupShown } from "@/lib/channels/embedded-signup";

const buttonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 sm:w-fit";

export function WhatsAppEmbeddedSignupPanel({
  panel,
  surface,
}: {
  panel: EmbeddedSignupShown;
  surface: "settings" | "whatsapp";
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const blockedId = "whatsapp-embedded-signup-blocked";

  return (
    <section data-testid="whatsapp-embedded-signup" className="grid max-w-2xl gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{panel.heading}</h2>
        <p className="mt-1 text-sm text-slate-700">{panel.coexistence}</p>
        <p className="mt-2 text-sm font-semibold text-[#0B1F3A]">{panel.officialOnly}</p>
      </div>
      <p className="text-sm text-slate-700">
        This is a draft stub. It does not start Meta login, does not mark the channel connected, and does not turn sending on.
        Live connect still needs Billy and Meta Tech Provider app review.
      </p>
      <ol className="grid list-decimal gap-1 pl-5 text-sm text-slate-700">
        {panel.checklist.map((item) => (
          <li key={item.id} data-testid={`whatsapp-embedded-signup-${item.id}`}>{item.label}</li>
        ))}
      </ol>
      {panel.ready ? (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800" data-testid="whatsapp-embedded-signup-ready">
          A public Meta app id is present. The button previews Embedded Signup on this page. Meta login stays closed.
        </p>
      ) : (
        <p id={blockedId} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" data-testid="whatsapp-embedded-signup-blocked" role="status">
          {panel.blockedMessage}
        </p>
      )}
      <button
        type="button"
        className={`${buttonClass} bg-[#2563EB] text-white`}
        data-testid="whatsapp-embedded-signup-button"
        data-launch="false"
        data-feature-type={panel.scaffold.featureType}
        disabled={!panel.ready}
        aria-describedby={panel.ready ? undefined : blockedId}
        onClick={() => {
          setPreview(previewEmbeddedSignupClick({ ready: panel.ready }).message);
        }}
      >
        {panel.buttonLabel}
      </button>
      {panel.ready ? (
        <script type="application/json" data-testid="whatsapp-embedded-signup-scaffold">
          {JSON.stringify(panel.scaffold)}
        </script>
      ) : null}
      {preview ? (
        <p data-testid="whatsapp-embedded-signup-preview" className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800" role="status">
          {preview}
        </p>
      ) : (
        <p className="text-sm text-slate-700">{panel.previewMessage}</p>
      )}
      {surface === "settings" ? (
        <p className="text-sm text-slate-700">
          <Link href="/command-centre/connect-accounts/whatsapp" className="font-semibold text-[#2563EB]">Open the WhatsApp connect page</Link>.
          Nothing is sent.
        </p>
      ) : (
        <p className="text-sm text-slate-700">The sandbox stub on this page is unchanged. Nothing is stored.</p>
      )}
    </section>
  );
}

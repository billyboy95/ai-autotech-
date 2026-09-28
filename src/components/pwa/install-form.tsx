"use client";

import { useActionState } from "react";
import { recordInstallIntent } from "@/app/actions/pwa-install";
import { INSTALL_PLATFORMS, type PwaInstallMode } from "@/lib/pwa/install";

const initial = { stored: false, mode: "fixture" as const, message: "" };

export function InstallIntentForm({ mode, orgSlug }: { mode: PwaInstallMode; orgSlug: string }) {
  const [state, action] = useActionState(recordInstallIntent, initial);
  return (
    <form action={action} className="grid gap-3" data-testid="pwa-install-form">
      <input type="hidden" name="slug" value={orgSlug} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        This phone
        <select name="platform" defaultValue="android" className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          {INSTALL_PLATFORMS.map((platform) => (
            <option key={platform.id} value={platform.id}>
              {platform.label}
            </option>
          ))}
        </select>
      </label>
      <button className="inline-flex h-11 w-fit items-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">
        Record install intent
      </button>
      <p className="text-sm text-slate-700" data-stored={state.stored ? "yes" : "no"} data-mode={state.message ? state.mode : mode}>
        {state.message || (mode === "fixture" ? "Recording stays off while the flag is unset." : "Recording can store a sandbox install intent. Nothing is sent.")}
      </p>
    </form>
  );
}

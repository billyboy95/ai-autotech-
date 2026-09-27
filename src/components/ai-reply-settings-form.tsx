"use client";

import { useActionState } from "react";
import { saveAiReplySettings, type AiReplyActionState } from "@/app/actions/ai-reply";
import { AI_REPLY_CHANNELS, type AiReplySettings } from "@/lib/ai-reply/types";

const initial: AiReplyActionState = { ok: false, message: "" };

export function AiReplySettingsForm({
  settings,
  orgSlug,
  canManage,
  sendingEnabled,
}: {
  settings: AiReplySettings;
  orgSlug: string;
  canManage: boolean;
  sendingEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveAiReplySettings, initial);

  return (
    <form action={action} data-testid="ai-reply-settings" className="grid max-w-3xl gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="org" value={orgSlug === "preview" ? "" : orgSlug} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input name="enabled" type="checkbox" defaultChecked={settings.enabled} disabled={!canManage} />
        Enable Conversation AI drafts
      </label>
      <p className="text-sm text-slate-500">
        Off until an agency owner or client admin enables it. Enabling drafts does not turn sending on.
        Workspace sending is {sendingEnabled ? "on" : "off"}. This page cannot change that switch.
      </p>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Mode
        <select name="mode" defaultValue={settings.mode} disabled={!canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="draft_only">Draft only — approve keeps it in the inbox</option>
          <option value="queue_outbox">Queue outbox — approve inserts a held or queued outbox row</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Tone
        <input name="tone" defaultValue={settings.tone} disabled={!canManage} maxLength={200} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        System prompt
        <textarea name="systemPrompt" defaultValue={settings.systemPrompt} disabled={!canManage} rows={5} maxLength={4000} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Max drafts per hour
        <input name="maxAutoPerHour" type="number" min={0} max={500} defaultValue={settings.maxAutoPerHour} disabled={!canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <fieldset className="grid gap-2" disabled={!canManage}>
        <legend className="text-xs font-semibold text-slate-600">Channels</legend>
        {AI_REPLY_CHANNELS.map((channel) => (
          <label key={channel} className="flex items-center gap-2 text-sm capitalize text-slate-700">
            <input type="checkbox" name="channels" value={channel} defaultChecked={settings.channels.includes(channel)} />
            {channel}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input name="requireHuman" type="checkbox" defaultChecked={settings.requireHumanBeforeSend} disabled={!canManage} />
        Require a person before send
      </label>
      <p className="text-sm text-slate-500">
        On by default. The optional cron queues pending drafts only when this is off, the mode is queue outbox, and workspace sending is already on. Consent is checked again. Leave the cron flag unset until you mean to run it.
      </p>
      {!canManage ? <p className="text-sm text-slate-600">Only an agency owner or client admin can change these settings.</p> : null}
      {state.message ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>{state.message}</p>
      ) : null}
      <button disabled={!canManage || pending} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
        Save Conversation AI
      </button>
    </form>
  );
}

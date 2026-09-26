"use client";

import { useActionState } from "react";
import { queueChannelTest, saveChannelConnection, type ChannelActionState } from "@/app/actions/channels";

const initial: ChannelActionState = { ok: false, message: "" };

const channels = [
  { channel: "whatsapp", provider: "meta_cloud", title: "WhatsApp (Meta Cloud)", identifier: "Phone number id" },
  { channel: "sms", provider: "smsportal", title: "SMS", identifier: "Sender id" },
  { channel: "email", provider: "resend", title: "Email", identifier: "From address" },
  { channel: "facebook", provider: "meta", title: "Facebook", identifier: "Page id" },
  { channel: "instagram", provider: "meta", title: "Instagram", identifier: "Instagram account id" },
] as const;

export type ChannelConnectionView = {
  id: string;
  channel: string;
  provider: string;
  identifier: string;
  displayName: string;
  status: string;
};

export function ChannelConnectForm({
  slug,
  canEdit,
  connections,
}: {
  slug: string;
  canEdit: boolean;
  connections: ChannelConnectionView[];
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Channels</h2>
        <p className="mt-1 text-sm text-slate-600">
          Each workspace sends with its own connection. Secrets go to Supabase Vault. Send test queues a held dry run and does not call a provider.
        </p>
      </div>
      {connections.length ? (
        <ul className="grid gap-2 text-sm">
          {connections.map((connection) => (
            <li key={connection.id} className="rounded-md bg-slate-50 px-3 py-2">
              <span className="font-semibold text-[#0B1F3A]">{connection.channel}</span>
              {" · "}
              {connection.provider}
              {" · "}
              {connection.identifier}
              {" · "}
              {connection.status}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No connections yet.</p>
      )}
      {channels.map((item) => (
        <ConnectForm key={`${item.channel}-${item.provider}`} slug={slug} canEdit={canEdit} spec={item} />
      ))}
      <TestForm slug={slug} canEdit={canEdit} connections={connections} />
    </section>
  );
}

function ConnectForm({
  slug,
  canEdit,
  spec,
}: {
  slug: string;
  canEdit: boolean;
  spec: (typeof channels)[number];
}) {
  const [state, action, pending] = useActionState(saveChannelConnection, initial);
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-slate-100 p-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="channel" value={spec.channel} />
      <h3 className="font-semibold text-[#0B1F3A]">{spec.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {spec.channel === "sms" ? (
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Provider
            <select name="provider" defaultValue="smsportal" className="h-10 rounded-md border border-slate-200 px-2 text-sm font-medium">
              <option value="smsportal">SMSPortal</option>
              <option value="bulksms">BulkSMS</option>
              <option value="clickatell">Clickatell</option>
            </select>
          </label>
        ) : spec.channel === "email" ? (
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Provider
            <select name="provider" defaultValue="resend" className="h-10 rounded-md border border-slate-200 px-2 text-sm font-medium">
              <option value="resend">Resend</option>
              <option value="smtp">SMTP</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="provider" value={spec.provider} />
        )}
        <Field name="identifier" label={spec.identifier} />
        <Field name="displayName" label="Display name" />
        <Field name="token" label="Access token" secret />
        <Field name="apiKey" label="API key" secret />
        <Field name="apiSecret" label="API secret" secret />
        <Field name="clientId" label="Client id" />
        <Field name="webhookSecret" label="Webhook secret" secret />
        <Field name="verifyToken" label="Verify token" secret />
        <Field name="appSecret" label="App secret" secret />
        {spec.channel === "email" ? (
          <>
            <Field name="fromAddress" label="From address" />
            <Field name="host" label="SMTP host" />
            <Field name="port" label="SMTP port" />
            <Field name="smtpUser" label="SMTP user" />
            <Field name="password" label="SMTP password" secret />
          </>
        ) : null}
      </div>
      <button disabled={!canEdit || pending} className="h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : `Connect ${spec.title}`}
      </button>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}

function TestForm({ slug, canEdit, connections }: { slug: string; canEdit: boolean; connections: ChannelConnectionView[] }) {
  const [state, action, pending] = useActionState(queueChannelTest, initial);
  return (
    <form action={action} className="grid gap-3 rounded-lg bg-slate-50 p-3">
      <input type="hidden" name="slug" value={slug} />
      <h3 className="font-semibold text-[#0B1F3A]">Send test</h3>
      <p className="text-sm text-slate-600">Queues a held outbox item for this workspace. No provider is called.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Connection
          <select name="connectionId" className="h-10 rounded-md border border-slate-200 px-2 text-sm font-medium">
            <option value="">Select</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.channel} · {connection.identifier}
              </option>
            ))}
          </select>
        </label>
        <Field name="to" label="Test address (not sent)" />
      </div>
      <button disabled={!canEdit || pending} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Queueing…" : "Send test"}
      </button>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}

function Field({ name, label, secret = false }: { name: string; label: string; secret?: boolean }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input
        name={name}
        type={secret ? "password" : "text"}
        autoComplete="off"
        className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900"
      />
    </label>
  );
}

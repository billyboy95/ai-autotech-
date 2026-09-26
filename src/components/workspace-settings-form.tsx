"use client";

import { useActionState } from "react";
import { addWorkspaceMember, createInvitation, saveWorkspaceSettings, type TenantActionState } from "@/app/actions/tenant";
import type { ShopifyStoreRecord, WorkspaceSummary } from "@/lib/tenant/types";

const initial: TenantActionState = { ok: false, message: "" };

export function WorkspaceSettingsForm({
  workspace,
  stages,
  members,
  stores,
  canEdit,
  canToggleSending,
}: {
  workspace: WorkspaceSummary;
  stages: string[];
  members: { email: string; role: string }[];
  stores: ShopifyStoreRecord[];
  canEdit: boolean;
  canToggleSending: boolean;
}) {
  const [saved, save, saving] = useActionState(saveWorkspaceSettings, initial);
  const [added, add, adding] = useActionState(addWorkspaceMember, initial);
  const [invited, invite, inviting] = useActionState(createInvitation, initial);
  const intake = `/api/public/intake/${workspace.formKey}`;

  return (
    <div className="grid gap-4">
      <form action={save} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="slug" value={workspace.slug} />
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Branding</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="name" label="Name" defaultValue={workspace.name} />
          <Field name="legalName" label="Legal name" defaultValue={workspace.legalName} />
          <Field name="location" label="Location" defaultValue={workspace.location} />
          <Field name="domain" label="Domain" defaultValue={workspace.domain} />
          <Field name="logoUrl" label="Logo URL" defaultValue={workspace.logoUrl} />
          <Field name="primaryColor" label="Primary colour" defaultValue={workspace.primaryColor} />
          <Field name="accentColor" label="Accent colour" defaultValue={workspace.accentColor} />
          <Field name="senderName" label="Sender name" defaultValue={workspace.senderName} />
          <Field name="informationOfficerName" label="Information officer" defaultValue="" />
          <Field name="informationOfficerEmail" label="Information officer email" defaultValue="" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input name="sendingEnabled" type="checkbox" defaultChecked={workspace.sendingEnabled} disabled={!canToggleSending} />
          Sending enabled
        </label>
        <p className="text-sm text-slate-500">
          Off by default. Only an agency owner can turn sending on. Outbound messages stay held until then, and each one still needs a sender name and a lawful opt-out.
        </p>
        <h2 className="mt-2 font-display text-lg font-bold text-[#0B1F3A]">Channel placeholders</h2>
        <p className="text-sm text-slate-500">Stored on the workspace. Nothing is sent until a channel adapter is switched on.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="whatsappPhoneNumberId" label="WhatsApp phone number id" defaultValue={workspace.settings.channels.whatsapp.phoneNumberId} />
          <Field name="whatsappDisplayPhone" label="WhatsApp display number" defaultValue={workspace.settings.channels.whatsapp.displayPhone} />
          <Field name="emailFrom" label="Email from address" defaultValue={workspace.settings.channels.email.fromAddress} />
          <Field name="emailProvider" label="Email provider" defaultValue={workspace.settings.channels.email.provider} />
          <Field name="smsSenderId" label="SMS sender id" defaultValue={workspace.settings.channels.sms.senderId} />
        </div>
        <h2 className="mt-2 font-display text-lg font-bold text-[#0B1F3A]">Shopify</h2>
        <p className="text-sm text-slate-500">
          Placeholders only. Saving these does not call Shopify. When the webhook secret is set, orders, customers, and checkouts posted to /api/shopify/webhook land in this workspace.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="shopifyAdminAccessToken" label="Admin API access token" defaultValue={workspace.settings.shopify.adminAccessToken} />
          <Field name="shopifyWebhookSecret" label="Webhook secret" defaultValue={workspace.settings.shopify.webhookSecret} />
          <Field name="shopifyApiVersion" label="API version" defaultValue={workspace.settings.shopify.apiVersion} />
        </div>
        <button disabled={!canEdit || saving} className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved.message ? <p className={`text-sm ${saved.ok ? "text-emerald-700" : "text-rose-700"}`}>{saved.message}</p> : null}
      </form>

      {stores.length ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Shopify stores</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Store</th>
                  <th className="py-2 pr-3">myshopify domain</th>
                  <th className="py-2 pr-3">Public domain</th>
                  <th className="py-2">Plan</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.myshopifyDomain} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-[#0B1F3A]">{store.name}</td>
                    <td className="py-2 pr-3 text-slate-600">{store.myshopifyDomain}</td>
                    <td className="py-2 pr-3 text-slate-600">{store.publicDomain}</td>
                    <td className="py-2 text-slate-600">{store.planStatus === "credentials_saved" ? "Credentials saved" : "Not connected"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Pipeline</h2>
        <p className="mt-2 text-sm text-slate-600">{stages.length ? stages.join(" → ") : "No stages yet."}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Public intake</h2>
        <p className="mt-2 text-sm text-slate-600">
          Form key <span className="font-semibold">{workspace.formKey}</span>. Post JSON to{" "}
          <a className="font-semibold text-[#2563EB]" href={intake}>{intake}</a>. The hosted form is{" "}
          <a className="font-semibold text-[#2563EB]" href={`/intake/${workspace.formKey}`}>/intake/{workspace.formKey}</a>.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Users</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {members.length === 0 ? <li className="text-slate-500">No members yet. The owner adds the first agency login from Supabase Auth.</li> : null}
          {members.map((member) => (
            <li key={`${member.email}-${member.role}`} className="rounded-md bg-slate-50 px-3 py-2">
              {member.email} · {member.role.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
        <form action={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input type="hidden" name="slug" value={workspace.slug} />
          <input name="email" type="email" placeholder="person@eastc.co.za" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <select name="role" defaultValue={workspace.orgType === "agency" ? "agency_staff" : "client_admin"} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            {workspace.orgType === "agency" ? <option value="agency_owner">Agency owner</option> : null}
            {workspace.orgType === "agency" ? <option value="agency_staff">Agency staff</option> : null}
            <option value="client_admin">Client admin</option>
            <option value="client_user">Client user</option>
          </select>
          <button disabled={!canEdit || adding} className="h-10 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white disabled:opacity-60">
            {adding ? "Adding…" : "Add user"}
          </button>
        </form>
        {added.message ? <p className={`mt-2 text-sm ${added.ok ? "text-emerald-700" : "text-rose-700"}`}>{added.message}</p> : null}
        <form action={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input type="hidden" name="slug" value={workspace.slug} />
          <input name="email" type="email" placeholder="invite@company.co.za" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <select name="role" defaultValue={workspace.orgType === "agency" ? "agency_staff" : "client_admin"} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            {workspace.orgType === "agency" ? <option value="agency_owner">Agency owner</option> : null}
            {workspace.orgType === "agency" ? <option value="agency_staff">Agency staff</option> : null}
            <option value="client_admin">Client admin</option>
            <option value="client_user">Client user</option>
          </select>
          <button disabled={!canEdit || inviting} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60">
            {inviting ? "Creating…" : "Create invite link"}
          </button>
        </form>
        {invited.message ? <p className={`mt-2 text-sm ${invited.ok ? "text-emerald-700" : "text-rose-700"}`}>{invited.message}</p> : null}
      </section>
    </div>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input name={name} defaultValue={defaultValue} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
    </label>
  );
}

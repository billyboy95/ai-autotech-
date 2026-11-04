import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import { buildContactPanel, type ContactPanelModel } from "@/lib/inbox/contact-panel";
import type { InboxData, InboxThread } from "@/lib/inbox/types";

type PanelAction = (formData: FormData) => void | Promise<void>;

export function InboxContactPanel({
  enabled,
  className,
  data,
  thread,
  saveAction,
  assignAction,
}: {
  enabled: boolean;
  className: string;
  data: InboxData;
  thread: InboxThread | null;
  saveAction: PanelAction;
  assignAction: PanelAction;
}) {
  if (!enabled) return null;
  const model = buildContactPanel({
    contact: thread?.contact ?? null,
    consents: thread?.consents ?? [],
    channel: thread?.channel,
  });
  return (
    <aside data-testid="inbox-contact-panel" data-layout="side" className={className}>
      <details open>
        <summary
          data-testid="inbox-contact-panel-toggle"
          className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-[#0B1F3A] lg:hidden"
        >
          Contact
        </summary>
        <div className="grid gap-3">
          <h2 className="hidden font-semibold text-[#0B1F3A] lg:block">Contact</h2>
          <ContactPanelBody model={model} />
          {thread?.contact ? (
            <form action={saveAction} className="grid gap-2 border-t border-slate-100 pt-3">
              <Hidden data={data} id={thread.id} />
              {model.leadLinked ? (
                <label className="grid gap-1 text-xs font-semibold text-slate-500">
                  Lead stage
                  <select
                    name="stage"
                    data-testid="inbox-contact-stage"
                    defaultValue={model.stage}
                    className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
                  >
                    {!model.stage ? <option value="">Unknown</option> : null}
                    {model.stageOptions.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                Contact tags
                <input
                  name="tags"
                  data-testid="inbox-contact-tags"
                  defaultValue={model.tagEditor}
                  placeholder="Comma-separated tags"
                  className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
                />
              </label>
              <p className="text-xs text-slate-500">Updates the lead and contact rows only. Nothing is queued and no sequence starts.</p>
              <button className="h-9 justify-self-start rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">Save contact</button>
            </form>
          ) : null}
          {thread?.contact ? (
            <form action={assignAction} className="grid gap-2">
              <Hidden data={data} id={thread.id} />
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                Assign
                <select name="assignee" defaultValue={thread.assignedUserId || ""} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm">
                  <option value="">Unassigned</option>
                  {data.userId ? <option value={data.userId}>Me</option> : null}
                  {data.members.filter((member) => member.userId !== data.userId).map((member) => (
                    <option key={member.userId} value={member.userId}>{member.role} · {member.userId.slice(0, 8)}</option>
                  ))}
                </select>
              </label>
              <button className="h-9 rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]">Save assignment</button>
            </form>
          ) : null}
        </div>
      </details>
    </aside>
  );
}

function ContactPanelBody({ model }: { model: ContactPanelModel }) {
  if (!model.hasContact) {
    return (
      <div data-testid="inbox-contact-panel-body" className="grid gap-3 text-sm text-slate-700">
        <p>No contact on this thread.</p>
        <ConsentList model={model} />
      </div>
    );
  }
  return (
    <div data-testid="inbox-contact-panel-body" className="grid gap-3 text-sm text-slate-700">
      <p data-testid="inbox-contact-name" className="font-semibold text-[#0B1F3A]">{model.name}</p>
      <p>{model.company || "No company"}</p>
      <p data-testid="inbox-contact-address">
        {model.addressKind === "none" ? "No phone or email" : model.address}
      </p>
      <p data-testid="inbox-contact-stage-label">Stage: {model.stageLabel}</p>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
        <p data-testid="inbox-contact-tag-list">{model.tags.length ? model.tags.join(", ") : "None"}</p>
        {model.tagSource === "lead" ? <p className="text-xs text-slate-500">From the linked lead.</p> : null}
      </div>
      <ConsentList model={model} />
    </div>
  );
}

function ConsentList({ model }: { model: ContactPanelModel }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consent</p>
      <ul data-testid="inbox-contact-consent" className="mt-1 grid gap-1">
        {model.channels.map((channel) => (
          <li key={channel.channel} data-channel={channel.channel}>
            {channel.known
              ? channel.lines.map((line) => `${channel.label} · ${line.purpose} · ${line.statusLabel}`).join("; ")
              : `${channel.label} · Unknown`}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-slate-500">From recorded consent. This panel does not change it.</p>
    </div>
  );
}

function Hidden({ data, id }: { data: InboxData; id: string }) {
  return (
    <>
      <input type="hidden" name="org" value={data.orgSlug === "preview" ? "" : data.orgSlug} />
      <input type="hidden" name="filter" value={data.filter} />
      <input type="hidden" name="channel" value={data.channel} />
      {data.multiNumber && data.number ? <input type="hidden" name="number" value={data.number} /> : null}
      <input type="hidden" name="id" value={id} />
    </>
  );
}

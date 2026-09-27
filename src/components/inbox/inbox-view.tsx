"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addInboxNote, assignInboxConversation, markInboxRead, sendInboxReply, setInboxStatus } from "@/app/actions/inbox";
import { formatInboxCost, inboxCost, realtimeOrgFilter, acceptRealtimeRow, serviceAllowanceLabel, whatsappComposeGate, windowCountdown, type InboxChannel } from "@/lib/inbox/rules";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { InboxData } from "@/lib/inbox/types";

const CHANNELS: InboxChannel[] = ["whatsapp", "sms", "email", "facebook", "instagram"];

export function InboxView({ data, banner, bannerTone }: { data: InboxData; banner?: string | null; bannerTone?: "error" | "ok" }) {
  const router = useRouter();
  const thread = data.thread;
  const [channel, setChannel] = useState(thread?.channel || "whatsapp");
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const now = useMemo(() => new Date(), []);
  const template = data.templates.find((item) => item.id === templateId) || null;
  const gate = whatsappComposeGate({
    channel,
    now,
    windowExpiresAt: channel === thread?.channel ? thread.windowExpiresAt : null,
    template: template ? { approved: template.approved } : null,
  });
  const cost = inboxCost({
    channel,
    waCategory: template?.waCategory || (channel === "whatsapp" ? "service" : ""),
    now,
    serviceSendsThisMonth: data.serviceUsed,
  });
  const connectionId = data.connections.find((item) => item.channel === channel)?.id || thread?.connectionId || "";
  const unread = data.conversations.reduce((sum, item) => sum + item.unread, 0);

  const threadId = thread?.id ?? "";
  const threadChannel = thread?.channel ?? "whatsapp";
  useEffect(() => {
    setChannel(threadChannel);
    setTemplateId("");
    setBody("");
  }, [threadId, threadChannel]);
  useEffect(() => {
    if (!threadId || data.preview || threadId.startsWith("00000000")) return;
    void markInboxRead(threadId);
  }, [threadId, data.preview]);

  useEffect(() => {
    if (data.preview || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let filter = "";
    try {
      filter = realtimeOrgFilter(data.orgId);
    } catch {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const channelName = supabase.channel(`inbox-${data.orgId}`);
    const refresh = (row: { org_id?: string } | null | undefined) => {
      if (!acceptRealtimeRow(data.orgId, row?.org_id)) return;
      router.refresh();
    };
    for (const table of ["messages", "conversations", "conversation_notes"] as const) {
      channelName.on("postgres_changes", { event: "*", schema: "public", table, filter }, (payload) => {
        const next = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as { org_id?: string };
        refresh(next);
      });
    }
    channelName.subscribe();
    return () => {
      void supabase.removeChannel(channelName);
    };
  }, [data.orgId, data.preview, router]);

  return (
    <div data-testid="inbox" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Inbox</h1>
          <p className="text-sm text-slate-500">
            {unread} unread in this view. Replies stay in the outbox until sending is switched on.
          </p>
        </div>
        {data.assignedOnly ? (
          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">You only see conversations assigned to you.</p>
        ) : null}
      </div>
      {data.notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{data.notice}</p> : null}
      {banner ? (
        <p className={`rounded-xl border px-4 py-3 text-sm ${bannerTone === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
          {banner}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(["open", "mine", "unassigned"] as const).map((filter) => (
          <Link
            key={filter}
            href={href({ ...data, filter, channel: data.channel, id: thread?.id })}
            className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold ${data.filter === filter ? "bg-[#0B1F3A] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {filter === "open" ? "Open" : filter === "mine" ? "Mine" : "Unassigned"}
          </Link>
        ))}
        <Link href={href({ ...data, channel: "", id: thread?.id })} className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold ${data.channel === "" ? "bg-[#2563EB] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
          All channels
        </Link>
        {CHANNELS.map((item) => (
          <Link
            key={item}
            href={href({ ...data, channel: item, id: thread?.id })}
            className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold capitalize ${data.channel === item ? "bg-[#2563EB] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <section className="grid gap-2">
          {data.conversations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No conversations in this filter.</p>
          ) : null}
          {data.conversations.map((item) => (
            <Link
              key={item.id}
              href={href({ ...data, id: item.id })}
              className={`rounded-xl border bg-white p-3 shadow-sm ${thread?.id === item.id ? "border-[#2563EB]" : "border-slate-200"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#0B1F3A]">{item.contactName}</span>
                {item.unread > 0 ? <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-xs font-semibold text-white">{item.unread}</span> : null}
              </span>
              <span className="mt-1 block text-xs uppercase tracking-wide text-slate-500">{item.channel} · {item.status}</span>
              <span className="mt-1 block truncate text-sm text-slate-600">{item.preview || "Open the thread"}</span>
            </Link>
          ))}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {thread ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#0B1F3A]">{thread.contact?.name || "Conversation"}</h2>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{thread.channel} · {thread.status}</p>
                  {thread.channel === "whatsapp" ? <WindowLine expiresAt={thread.windowExpiresAt} /> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={setInboxStatus}>
                    <Hidden data={data} id={thread.id} />
                    <input type="hidden" name="status" value={thread.status === "closed" ? "open" : "closed"} />
                    <button className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">
                      {thread.status === "closed" ? "Reopen" : "Close"}
                    </button>
                  </form>
                </div>
              </div>
              <div className="grid max-h-[28rem] gap-2 overflow-y-auto">
                {thread.messages.map((message) => (
                  <article key={message.id} className={`max-w-[36rem] rounded-xl px-3 py-2 text-sm ${message.direction === "out" ? "ml-auto bg-[#0B1F3A] text-white" : "bg-slate-100 text-slate-800"}`}>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className={`mt-1 text-xs ${message.direction === "out" ? "text-slate-200" : "text-slate-500"}`}>
                      {message.direction === "out" ? "Out" : "In"} · {message.status}
                      {message.channel === "whatsapp" ? ` · ${formatInboxCost({ cents: message.costCents, label: message.waCategory || "service" })}` : ""}
                      {message.providerMessageId ? ` · ${message.providerMessageId}` : ""}
                    </p>
                  </article>
                ))}
                {thread.notes.map((note) => (
                  <article key={note.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <p className="text-xs font-semibold uppercase tracking-wide">Internal note · not sent</p>
                    <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                  </article>
                ))}
              </div>
              <form action={sendInboxReply} className="grid gap-2 border-t border-slate-100 pt-3">
                <Hidden data={data} id={thread.id} />
                <div className="flex flex-wrap gap-2">
                  <label className="grid gap-1 text-xs font-semibold text-slate-500">
                    Channel
                    <select name="replyChannel" value={channel} onChange={(event) => { setChannel(event.target.value); setTemplateId(""); }} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900">
                      {CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="grid min-w-40 flex-1 gap-1 text-xs font-semibold text-slate-500">
                    Template
                    <select
                      name="templateId"
                      value={templateId}
                      onChange={(event) => {
                        const next = data.templates.find((item) => item.id === event.target.value);
                        setTemplateId(event.target.value);
                        if (next) {
                          setChannel(next.channel);
                          setBody(next.body);
                        }
                      }}
                      className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
                    >
                      <option value="">Free-form</option>
                      {data.templates.filter((item) => item.channel === channel).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}{item.channel === "whatsapp" ? ` · ${item.waCategory || "template"} · ${item.approved ? "approved" : "not approved"}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid min-w-40 flex-1 gap-1 text-xs font-semibold text-slate-500">
                    Number
                    <select name="connectionId" defaultValue={connectionId} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900">
                      <option value="">Workspace default</option>
                      {data.connections.filter((item) => item.channel === channel).map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  {formatInboxCost(cost)}. {serviceAllowanceLabel({ now, used: data.serviceUsed, hasNumber: channel === "whatsapp" && Boolean(connectionId) })}
                </p>
                {!gate.ok ? <p className="text-sm font-medium text-amber-800">{gate.message}</p> : null}
                <textarea name="body" value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="Write a reply. It is queued, not sent." className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
                <button className="h-10 justify-self-start rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white" disabled={!gate.ok}>
                  Queue reply
                </button>
              </form>
              <form action={addInboxNote} className="grid gap-2">
                <Hidden data={data} id={thread.id} />
                <label className="grid gap-1 text-xs font-semibold text-slate-500">
                  Internal note
                  <textarea name="note" rows={2} placeholder="Only your team can see this." className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <button className="h-9 justify-self-start rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">Save note</button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a conversation.</p>
          )}
        </section>
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-[#0B1F3A]">Contact</h2>
          {thread?.contact ? (
            <div className="mt-3 grid gap-3 text-sm text-slate-700">
              <p className="font-semibold text-[#0B1F3A]">{thread.contact.name}</p>
              <p>{thread.contact.company || "No company"}</p>
              <p>Stage: {thread.contact.stage || "No lead stage"}</p>
              <p>{thread.contact.email || "No email"}</p>
              <p>{thread.contact.phone || thread.contact.whatsapp || "No phone"}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
                <p>{thread.contact.tags.length ? thread.contact.tags.join(", ") : "None"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consent</p>
                {thread.consents.length === 0 ? <p>No consent recorded.</p> : null}
                <ul className="mt-1 grid gap-1">
                  {thread.consents.map((consent) => (
                    <li key={`${consent.channel}-${consent.purpose}`}>{consent.channel} · {consent.purpose} · {consent.status}</li>
                  ))}
                </ul>
              </div>
              <form action={assignInboxConversation} className="grid gap-2">
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
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No contact on this thread.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function WindowLine({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return <p className="mt-1 text-sm text-slate-600">WhatsApp 24-hour window</p>;
  const left = windowCountdown(expiresAt, now);
  if (!left) return <p className="mt-1 text-sm font-medium text-amber-800">24-hour window closed. Use an approved template.</p>;
  return <p className="mt-1 text-sm text-slate-600">WhatsApp window closes in {left}.</p>;
}

function Hidden({ data, id }: { data: InboxData; id: string }) {
  return (
    <>
      <input type="hidden" name="org" value={data.orgSlug === "preview" ? "" : data.orgSlug} />
      <input type="hidden" name="filter" value={data.filter} />
      <input type="hidden" name="channel" value={data.channel} />
      <input type="hidden" name="id" value={id} />
    </>
  );
}

function href(input: { orgSlug: string; filter: string; channel: string; id?: string }) {
  const params = new URLSearchParams();
  if (input.orgSlug && input.orgSlug !== "preview") params.set("org", input.orgSlug);
  if (input.filter && input.filter !== "open") params.set("filter", input.filter);
  if (input.channel) params.set("channel", input.channel);
  if (input.id) params.set("id", input.id);
  const qs = params.toString();
  return qs ? `/command-centre/inbox?${qs}` : "/command-centre/inbox";
}

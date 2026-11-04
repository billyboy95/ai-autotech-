"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addInboxNote, assignInboxConversation, bulkAssignInbox, bulkMarkInboxRead, bulkSetInboxStatus, markInboxRead, saveInboxContactPanel, sendInboxReply, setInboxStatus } from "@/app/actions/inbox";
import { AiDraftPanel } from "@/components/inbox/ai-draft-panel";
import { InboxBulkChrome } from "@/components/inbox/inbox-bulk";
import { InboxContactPanel } from "@/components/inbox/inbox-contact-panel";
import { InboxCollisionBanner, InboxQuickFrame, InboxQuickReplies } from "@/components/inbox/inbox-quick-ux";
import { InboxTeamStatsPanel } from "@/components/inbox/inbox-team-stats";
import { InboxWaMessageMeter, InboxWaMetering } from "@/components/inbox/inbox-wa-metering";
import { InboxWaReplyFields, InboxWaWindow } from "@/components/inbox/inbox-wa-window";
import { inboxHref } from "@/lib/inbox/numbers";
import {
  collisionBanner,
  inboxQuickClasses,
  insertQuickReply,
  peersFromPresence,
  presencePayload,
  viewerPresenceName,
} from "@/lib/inbox/quick-ux";
import { formatInboxCost, inboxCost, realtimeOrgFilter, acceptRealtimeRow, serviceAllowanceLabel, type InboxChannel } from "@/lib/inbox/rules";
import { waCareState } from "@/lib/inbox/wa-window";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { InboxData, InboxListItem, InboxPresencePeer } from "@/lib/inbox/types";

const CHANNELS: InboxChannel[] = ["whatsapp", "sms", "email", "facebook", "instagram"];

export function InboxView({ data, banner, bannerTone }: { data: InboxData; banner?: string | null; bannerTone?: "error" | "ok" }) {
  const router = useRouter();
  const thread = data.thread;
  const [channel, setChannel] = useState(thread?.channel || "whatsapp");
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const [livePeers, setLivePeers] = useState<InboxPresencePeer[] | null>(null);
  const presenceChannel = useRef<{ track: (payload: Record<string, string>) => Promise<unknown> } | null>(null);
  const bodyRef = useRef(body);
  const threadIdRef = useRef(thread?.id ?? "");
  bodyRef.current = body;
  threadIdRef.current = thread?.id ?? "";
  const layout = inboxQuickClasses(data.quickUx);
  const viewerName = viewerPresenceName(data.userId, data.members);
  const now = useMemo(() => new Date(), []);
  const [windowNow, setWindowNow] = useState(() => new Date(data.loadedAt));
  const template = data.templates.find((item) => item.id === templateId) || null;
  const care = thread
    ? waCareState({
        enabled: data.waWindowEnabled,
        threadChannel: thread.channel,
        replyChannel: channel,
        messages: thread.messages,
        now: windowNow,
        template: template ? { approved: template.approved, waCategory: template.waCategory } : null,
      })
    : null;
  const blocked = Boolean(care?.blocked);
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
  const collision = data.quickUx && thread ? collisionBanner(livePeers ?? data.presence, data.userId, thread.id) : "";
  useEffect(() => {
    setChannel(threadChannel);
    setTemplateId("");
    setBody("");
  }, [threadId, threadChannel]);
  useEffect(() => {
    setWindowNow(new Date(data.loadedAt));
  }, [data.loadedAt]);
  useEffect(() => {
    if (!data.waWindowEnabled || data.preview) return;
    const timer = setInterval(() => setWindowNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [data.waWindowEnabled, data.preview]);
  useEffect(() => {
    if (!threadId || data.preview || threadId.startsWith("00000000")) return;
    void markInboxRead(threadId);
  }, [threadId, data.preview]);

  useEffect(() => {
    if (!data.quickUx) return;
    setLivePeers(null);
  }, [data.quickUx, threadId]);

  useEffect(() => {
    if (data.preview || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let filter = "";
    try {
      filter = realtimeOrgFilter(data.orgId);
    } catch {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const channelName = data.quickUx
      ? supabase.channel(`inbox-${data.orgId}`, { config: { presence: { key: data.userId || "viewer" } } })
      : supabase.channel(`inbox-${data.orgId}`);
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
    if (data.quickUx) {
      channelName.on("presence", { event: "sync" }, () => {
        setLivePeers(peersFromPresence(
          channelName.presenceState() as Record<string, readonly unknown[]>,
          data.userId,
          threadIdRef.current,
          data.members,
        ));
      });
      channelName.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        const payload = presencePayload({
          userId: data.userId,
          name: viewerName,
          conversationId: threadIdRef.current,
          typing: bodyRef.current.trim().length > 0,
        });
        if (!payload) return;
        presenceChannel.current = channelName;
        void channelName.track(payload);
      });
    } else {
      channelName.subscribe();
    }
    return () => {
      presenceChannel.current = null;
      void supabase.removeChannel(channelName);
    };
  }, [data.orgId, data.preview, data.quickUx, data.userId, data.members, viewerName, router]);

  useEffect(() => {
    if (!data.quickUx || data.preview) return;
    const tracked = presenceChannel.current;
    if (!tracked || !threadId) return;
    const payload = presencePayload({
      userId: data.userId,
      name: viewerName,
      conversationId: threadId,
      typing: body.trim().length > 0,
    });
    if (!payload) return;
    void tracked.track(payload);
    if (!body.trim()) return;
    const timer = window.setTimeout(() => {
      const idle = presencePayload({
        userId: data.userId,
        name: viewerName,
        conversationId: threadId,
        typing: false,
      });
      if (idle) void tracked.track(idle);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [body, data.preview, data.quickUx, data.userId, threadId, viewerName]);

  return (
    <div data-testid="inbox" data-quick-ux={data.quickUx ? "on" : undefined} data-contact-panel={data.contactPanel ? "on" : undefined} className={layout.shell}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Inbox</h1>
          <p className="text-sm text-slate-500">
            {unread} unread in this view. Replies stay in the outbox until sending is switched on.
          </p>
          {data.teamStats ? (
            <a href="#inbox-team-stats" className="text-sm font-semibold text-[#2563EB]">Team stats</a>
          ) : null}
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
      <div className={layout.filters}>
        {(["open", "mine", "unassigned"] as const).map((filter) => (
          <Link
            key={filter}
            href={inboxHref({ ...data, filter, id: thread?.id })}
            className={`${layout.chip} ${data.filter === filter ? "bg-[#0B1F3A] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {filter === "open" ? "Open" : filter === "mine" ? "Mine" : "Unassigned"}
          </Link>
        ))}
        <Link href={inboxHref({ ...data, channel: "", id: thread?.id })} className={`${layout.chip} ${data.channel === "" ? "bg-[#2563EB] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
          All channels
        </Link>
        {CHANNELS.map((item) => (
          <Link
            key={item}
            href={inboxHref({ ...data, channel: item, number: item === "whatsapp" ? data.number : "", id: thread?.id })}
            className={`${layout.chip} capitalize ${data.channel === item ? "bg-[#2563EB] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {item}
          </Link>
        ))}
      </div>
      {data.multiNumber ? (
        <form action="/command-centre/inbox" method="get" data-testid="inbox-number-filter" className={layout.numberForm}>
          {data.orgSlug && data.orgSlug !== "preview" ? <input type="hidden" name="org" value={data.orgSlug} /> : null}
          {data.filter !== "open" ? <input type="hidden" name="filter" value={data.filter} /> : null}
          {data.channel === "whatsapp" ? <input type="hidden" name="channel" value="whatsapp" /> : null}
          {thread?.id ? <input type="hidden" name="id" value={thread.id} /> : null}
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            WhatsApp number
            <select
              name="number"
              aria-label="WhatsApp number"
              value={data.number}
              onChange={(event) => {
                const next = event.target.value;
                router.push(inboxHref({
                  ...data,
                  number: next,
                  channel: next && data.channel && data.channel !== "whatsapp" ? "" : data.channel,
                  id: thread?.id,
                }));
              }}
              className={layout.numberSelect}
            >
              <option value="">All numbers</option>
              {data.whatsappNumbers.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" className={layout.showButton}>
            Show
          </button>
          {data.whatsappNumbers.length === 0 ? (
            <p className="text-sm text-slate-500">No WhatsApp numbers are connected for this workspace.</p>
          ) : (
            <p className="text-sm text-slate-500">Filter only. Replies stay queued and nothing is sent.</p>
          )}
        </form>
      ) : null}
      {data.teamStats ? <InboxTeamStatsPanel stats={data.teamStats} /> : null}
      <InboxQuickFrame enabled={data.quickUx}>
        <section className={layout.list}>
          {data.conversations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No conversations in this filter.</p>
          ) : null}
          {data.bulkActions ? (
            <InboxBulkChrome
              enabled
              filter={data.filter}
              channel={data.channel}
              number={data.multiNumber ? data.number : ""}
              conversations={data.conversations}
              members={data.members}
              userId={data.userId}
              orgSlug={data.orgSlug}
              threadId={thread?.id ?? ""}
              assignAction={bulkAssignInbox}
              statusAction={bulkSetInboxStatus}
              readAction={bulkMarkInboxRead}
            >
              {(item) => <InboxConversationCard data={data} item={item} active={thread?.id === item.id} />}
            </InboxBulkChrome>
          ) : data.conversations.map((item) => (
            <InboxConversationCard key={item.id} data={data} item={item} active={thread?.id === item.id} />
          ))}
        </section>
        <section className={layout.thread}>
          <InboxWaMetering
            enabled={data.waMeteringEnabled}
            meters={data.waMeters}
            currentConnectionId={thread?.channel === "whatsapp" ? thread.connectionId : null}
          />
          {thread ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#0B1F3A]">{thread.contact?.name || "Conversation"}</h2>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{thread.channel} · {thread.status}</p>
                  {data.multiNumber && thread.channel === "whatsapp" ? (
                    <p className="mt-1 text-sm text-slate-600">{whatsappNumberLabel(data, thread.connectionId) || "No WhatsApp number on this thread"}</p>
                  ) : null}
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
              {data.quickUx ? <InboxCollisionBanner label={collision} /> : null}
              <div className={layout.messageList}>
                {thread.messages.map((message) => (
                  <article key={message.id} className={`${layout.bubble} ${message.direction === "out" ? "ml-auto bg-[#0B1F3A] text-white" : "bg-slate-100 text-slate-800"}`}>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className={`mt-1 text-xs ${message.direction === "out" ? "text-slate-200" : "text-slate-500"}`}>
                      {message.direction === "out" ? "Out" : "In"} · {message.status}
                      {message.channel === "whatsapp" && !data.waMeteringEnabled ? ` · ${formatInboxCost({ cents: message.costCents, label: message.waCategory || "service" })}` : ""}
                      {message.providerMessageId ? ` · ${message.providerMessageId}` : ""}
                    </p>
                    {data.waMeteringEnabled ? <InboxWaMessageMeter message={message} now={data.loadedAt} /> : null}
                  </article>
                ))}
                {thread.notes.map((note) => (
                  <article key={note.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <p className="text-xs font-semibold uppercase tracking-wide">Internal note · not sent</p>
                    <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                  </article>
                ))}
              </div>
              <AiDraftPanel data={data} />
              <form action={sendInboxReply} className={layout.replyForm}>
                <Hidden data={data} id={thread.id} />
                <div className={layout.compose}>
                  <label className={layout.channelField}>
                    Channel
                    <select name="replyChannel" value={channel} onChange={(event) => { setChannel(event.target.value); setTemplateId(""); }} className={layout.replySelect}>
                      {CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className={layout.field}>
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
                      className={layout.replySelect}
                    >
                      <option value="">Free-form</option>
                      {data.templates.filter((item) => item.channel === channel).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}{item.channel === "whatsapp" ? ` · ${item.waCategory || "template"} · ${item.approved ? "approved" : "not approved"}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={layout.field}>
                    Number
                    <select name="connectionId" defaultValue={connectionId} className={layout.replySelect}>
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
                {care?.visible && care.care ? (
                  <InboxWaWindow
                    care={care.care}
                    category={care.category}
                    blocked={care.blocked}
                    prompt={care.prompt}
                    meteringLive={data.waMeteringEnabled}
                  />
                ) : null}
                {data.quickUx ? (
                  <InboxQuickReplies
                    replies={data.quickReplies}
                    onInsert={(reply) => setBody((current) => insertQuickReply(current, reply))}
                  />
                ) : null}
                <InboxWaReplyFields blocked={blocked} body={body} onBody={setBody} />
              </form>
              <form action={addInboxNote} className="grid gap-2">
                <Hidden data={data} id={thread.id} />
                <label className="grid gap-1 text-xs font-semibold text-slate-500">
                  Internal note
                  <textarea name="note" rows={2} placeholder="Only your team can see this." className={data.quickUx ? "w-full min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm" : "rounded-md border border-slate-200 px-3 py-2 text-sm"} />
                </label>
                <button className="h-9 justify-self-start rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">Save note</button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a conversation.</p>
          )}
        </section>
        {data.contactPanel ? (
          <InboxContactPanel
            enabled
            className={layout.aside}
            data={data}
            thread={thread ?? null}
            saveAction={saveInboxContactPanel}
            assignAction={assignInboxConversation}
          />
        ) : (
        <aside className={layout.aside}>
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
        )}
      </InboxQuickFrame>
    </div>
  );
}

function InboxConversationCard({ data, item, active }: { data: InboxData; item: InboxListItem; active: boolean }) {
  return (
    <Link
      href={inboxHref({ ...data, id: item.id })}
      className={`rounded-xl border bg-white p-3 shadow-sm ${active ? "border-[#2563EB]" : "border-slate-200"}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#0B1F3A]">{item.contactName}</span>
        {item.unread > 0 ? <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-xs font-semibold text-white">{item.unread}</span> : null}
      </span>
      <span className="mt-1 block text-xs uppercase tracking-wide text-slate-500">{item.channel} · {item.status}</span>
      {data.multiNumber && item.channel === "whatsapp" ? (
        <span className="mt-1 block text-xs text-slate-500">{whatsappNumberLabel(data, item.connectionId) || "No number"}</span>
      ) : null}
      <span className="mt-1 block truncate text-sm text-slate-600">{item.preview || "Open the thread"}</span>
    </Link>
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

function whatsappNumberLabel(data: InboxData, connectionId: string | null) {
  if (!connectionId) return "";
  return data.whatsappNumbers.find((item) => item.id === connectionId)?.label ?? "";
}

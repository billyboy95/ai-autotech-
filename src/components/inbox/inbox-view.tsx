"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addInboxNote, assignInboxConversation, bulkAssignInbox, bulkMarkInboxRead, bulkSetInboxStatus, markInboxRead, saveInboxContactPanel, sendInboxReply, setInboxStatus } from "@/app/actions/inbox";
import { AiDraftPanel } from "@/components/inbox/ai-draft-panel";
import { InboxBulkChrome } from "@/components/inbox/inbox-bulk";
import { InboxContactPanel } from "@/components/inbox/inbox-contact-panel";
import { InboxInternalNotes } from "@/components/inbox/inbox-internal-notes";
import { InboxMessageMedia } from "@/components/inbox/inbox-media";
import { InboxOutboundMedia } from "@/components/inbox/inbox-outbound-media";
import { InboxConversationSearch, InboxSearchEmpty } from "@/components/inbox/inbox-search";
import { InboxTagFilter, InboxTagFilterEmpty } from "@/components/inbox/inbox-tag-filter";
import { InboxTemplatesPicker } from "@/components/inbox/inbox-templates-picker";
import { InboxCollisionBanner, InboxQuickFrame, InboxQuickReplies } from "@/components/inbox/inbox-quick-ux";
import { InboxTeamStatsPanel } from "@/components/inbox/inbox-team-stats";
import { InboxWaMessageMeter, InboxWaMetering } from "@/components/inbox/inbox-wa-metering";
import { InboxWaReplyFields, InboxWaWindow } from "@/components/inbox/inbox-wa-window";
import { inboxHref } from "@/lib/inbox/numbers";
import { revokeOutboundPreview, type OutboundMediaDraft } from "@/lib/inbox/outbound-media";
import {
  collisionBanner,
  inboxQuickClasses,
  insertQuickReply,
  peersFromPresence,
  presencePayload,
  viewerPresenceName,
} from "@/lib/inbox/quick-ux";
import { formatInboxCost, inboxCost, realtimeOrgFilter, serviceAllowanceLabel, type InboxChannel } from "@/lib/inbox/rules";
import { inboxListForSearch, searchApplyDelay } from "@/lib/inbox/search";
import { inboxListForTags, tagFilterChoices, toggleTagSelection } from "@/lib/inbox/tag-filter";
import { pickTemplateIntoComposer } from "@/lib/inbox/templates-picker";
import { acceptInboxRealtime, inboxFilterChips, inboxScopeFromKind } from "@/lib/inbox/assigned-only";
import { applyInboxRealtimeChange, attachInboxRealtime, liveInboxFromData, liveUnreadCount, type RealtimeSocket } from "@/lib/inbox/realtime";
import { inboxFilterLabel, inboxStatusFilterChips } from "@/lib/inbox/status-filter";
import { waCareState } from "@/lib/inbox/wa-window";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { InboxData, InboxListItem, InboxPresencePeer } from "@/lib/inbox/types";

const CHANNELS: InboxChannel[] = ["whatsapp", "sms", "email", "facebook", "instagram"];

export function InboxView({
  data,
  banner,
  bannerTone,
  realtimeEnabled = false,
}: {
  data: InboxData;
  banner?: string | null;
  bannerTone?: "error" | "ok";
  realtimeEnabled?: boolean;
}) {
  const router = useRouter();
  const thread = data.thread;
  const dataRef = useRef(data);
  dataRef.current = data;
  const [live, setLive] = useState<ReturnType<typeof liveInboxFromData> | null>(null);
  const [channel, setChannel] = useState(thread?.channel || "whatsapp");
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [outboundAttachment, setOutboundAttachment] = useState<OutboundMediaDraft | null>(null);
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
  const shownMessages = realtimeEnabled && live && thread && live.threadId === thread.id ? live.messages : thread?.messages ?? [];
  const shownStatus = realtimeEnabled && live && thread && live.threadId === thread.id && live.threadStatus ? live.threadStatus : thread?.status;
  const care = thread
    ? waCareState({
        enabled: data.waWindowEnabled,
        threadChannel: thread.channel,
        replyChannel: channel,
        messages: shownMessages,
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
  const sourceConversations = realtimeEnabled && live ? live.conversations : data.conversations;
  const unread = sourceConversations.reduce((sum, item) => sum + item.unread, 0);
  const tagChoices = useMemo(
    () => (data.tagFilter ? tagFilterChoices(sourceConversations) : []),
    [data.tagFilter, sourceConversations],
  );
  const searched = inboxListForSearch(data.search, sourceConversations, appliedSearch);
  const listed = inboxListForTags(data.tagFilter, searched, selectedTags);
  const searchEmpty = sourceConversations.length > 0 && searched.length === 0;
  const tagEmpty = searched.length > 0 && listed.length === 0;

  const threadId = thread?.id ?? "";
  const threadChannel = thread?.channel ?? "whatsapp";
  const collision = data.quickUx && thread ? collisionBanner(livePeers ?? data.presence, data.userId, thread.id) : "";
  useEffect(() => {
    setChannel(threadChannel);
    setTemplateId("");
    setBody("");
    setTemplatesOpen(false);
    setOutboundAttachment((current) => {
      revokeOutboundPreview(current);
      return null;
    });
  }, [threadId, threadChannel]);
  useEffect(() => {
    if (!data.search) return;
    const delay = searchApplyDelay(searchQuery);
    if (delay === 0) {
      setAppliedSearch("");
      return;
    }
    const timer = window.setTimeout(() => setAppliedSearch(searchQuery), delay);
    return () => window.clearTimeout(timer);
  }, [data.search, searchQuery]);
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
    if (!realtimeEnabled) {
      setLive(null);
      return;
    }
    const next = snapshotFrom(data);
    setLive((current) => {
      if (!current || current.orgId !== next.orgId) return next;
      return {
        ...next,
        previews: current.previews,
        conversations: next.conversations.map((item) => ({
          ...item,
          preview: item.preview || current.previews[item.id]?.body || current.conversations.find((row) => row.id === item.id)?.preview || "",
        })),
      };
    });
  }, [realtimeEnabled, data]);

  const scope = useMemo(
    () => inboxScopeFromKind(data.inboxScope, data.userId),
    [data.inboxScope, data.userId],
  );
  const filterChips = (scope.kind === "own" || scope.kind === "closed")
    ? (data.statusFiltersEnabled && scope.kind === "own" ? [...inboxFilterChips(scope), "closed" as const] : inboxFilterChips(scope))
    : inboxStatusFilterChips(data.statusFiltersEnabled);

  useEffect(() => {
    if (!realtimeEnabled || data.preview) return;
    if (data.inboxScope === "closed") return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let socket: RealtimeSocket;
    try {
      socket = browserRealtimeSocket();
    } catch {
      return;
    }
    const attached = attachInboxRealtime({
      enabled: true,
      orgId: data.orgId,
      preview: false,
      supabaseConfigured: true,
      client: socket,
      onChange: (change) => {
        if (!acceptInboxRealtime({
          scope,
          sessionOrgId: data.orgId,
          rowOrgId: change.orgId,
          table: change.table,
          assignedUserId: typeof change.row.assigned_user_id === "string" ? change.row.assigned_user_id : null,
          userId: data.userId,
        })) return;
        setLive((current) => {
          const latest = dataRef.current;
          const base = current ?? snapshotFrom(latest);
          return applyInboxRealtimeChange(base, change).state;
        });
        router.refresh();
      },
    });
    return () => attached.detach();
  }, [realtimeEnabled, data.preview, data.inboxScope, data.orgId, data.userId, router, scope]);

  useEffect(() => {
    if (!data.quickUx) return;
    setLivePeers(null);
  }, [data.quickUx, threadId]);

  useEffect(() => {
    if (data.preview || data.inboxScope === "closed" || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
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
    const refresh = (table: "messages" | "conversations" | "conversation_notes", row: { org_id?: string; assigned_user_id?: string | null } | null | undefined) => {
      if (!acceptInboxRealtime({
        scope,
        sessionOrgId: data.orgId,
        rowOrgId: row?.org_id,
        table,
        assignedUserId: row?.assigned_user_id,
        userId: data.userId,
      })) return;
      router.refresh();
    };
    const watched = data.internalNotes
      ? ["messages", "conversations", "conversation_notes"] as const
      : ["messages", "conversations"] as const;
    for (const table of watched) {
      channelName.on("postgres_changes", { event: "*", schema: "public", table, filter }, (payload) => {
        const next = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as { org_id?: string; assigned_user_id?: string | null };
        refresh(table, next);
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
  }, [data.internalNotes, data.inboxScope, data.orgId, data.preview, data.quickUx, data.userId, data.members, viewerName, router, scope]);

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
    <div data-testid="inbox" data-quick-ux={data.quickUx ? "on" : undefined} data-contact-panel={data.contactPanel ? "on" : undefined} data-internal-notes={data.internalNotes ? "on" : undefined} data-templates-picker={data.templatesPicker ? "on" : undefined} data-search={data.search ? "on" : undefined} data-tag-filter={data.tagFilter ? "on" : undefined} data-media={data.media ? "on" : undefined} data-outbound-media={data.outboundMedia ? "on" : undefined} className={layout.shell}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Inbox</h1>
          <p className="text-sm text-slate-500">
            {unread} unread in this view. Replies stay in the outbox until sending is switched on.
          </p>
          {realtimeEnabled ? <p className="text-xs text-slate-500">Live for this workspace. Nothing is sent.</p> : null}
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
        {filterChips.map((filter) => (
          <Link
            key={filter}
            href={inboxHref({ ...data, filter, id: thread?.id })}
            {...(filter === "closed" ? { "data-testid": "inbox-filter-closed" } : {})}
            className={`${layout.chip} ${data.filter === filter ? "bg-[#0B1F3A] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {inboxFilterLabel(filter)}
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
      <InboxTagFilter
        enabled={data.tagFilter}
        tags={tagChoices}
        selected={selectedTags}
        onToggle={(tag) => setSelectedTags((current) => toggleTagSelection(current, tag))}
        onClear={() => setSelectedTags([])}
      />
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
          <InboxConversationSearch enabled={data.search} query={searchQuery} onQuery={setSearchQuery} />
          {data.conversations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No conversations in this filter.</p>
          ) : null}
          <InboxSearchEmpty show={searchEmpty} />
          <InboxTagFilterEmpty show={tagEmpty} />
          {data.bulkActions ? (
            <InboxBulkChrome
              enabled
              filter={data.filter}
              channel={data.channel}
              number={data.multiNumber ? data.number : ""}
              conversations={listed}
              members={data.members}
              userId={data.userId}
              orgSlug={data.orgSlug}
              threadId={thread?.id ?? ""}
              assignAction={bulkAssignInbox}
              statusAction={bulkSetInboxStatus}
              readAction={bulkMarkInboxRead}
            >
              {(item) => <InboxConversationCard data={data} item={item} active={thread?.id === item.id} realtimeEnabled={realtimeEnabled} />}
            </InboxBulkChrome>
          ) : listed.map((item) => (
            <InboxConversationCard key={item.id} data={data} item={item} active={thread?.id === item.id} realtimeEnabled={realtimeEnabled} />
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
                  <p className="text-xs uppercase tracking-wide text-slate-500">{thread.channel} · {shownStatus}</p>
                  {data.multiNumber && thread.channel === "whatsapp" ? (
                    <p className="mt-1 text-sm text-slate-600">{whatsappNumberLabel(data, thread.connectionId) || "No WhatsApp number on this thread"}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={setInboxStatus}>
                    <Hidden data={data} id={thread.id} />
                    <input type="hidden" name="status" value={shownStatus === "closed" ? "open" : "closed"} />
                    <button className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">
                      {shownStatus === "closed" ? "Reopen" : "Close"}
                    </button>
                  </form>
                </div>
              </div>
              {data.quickUx ? <InboxCollisionBanner label={collision} /> : null}
              <div className={layout.messageList}>
                {shownMessages.map((message) => (
                  <article key={message.id} className={`${layout.bubble} ${message.direction === "out" ? "ml-auto bg-[#0B1F3A] text-white" : "bg-slate-100 text-slate-800"}`}>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <InboxMessageMedia enabled={data.media} attachments={message.media} />
                    <p className={`mt-1 text-xs ${message.direction === "out" ? "text-slate-200" : "text-slate-500"}`}>
                      {message.direction === "out" ? "Out" : "In"} · {message.status}
                      {message.channel === "whatsapp" && !data.waMeteringEnabled ? ` · ${formatInboxCost({ cents: message.costCents, label: message.waCategory || "service" })}` : ""}
                      {message.providerMessageId ? ` · ${message.providerMessageId}` : ""}
                    </p>
                    {data.waMeteringEnabled ? <InboxWaMessageMeter message={message} now={data.loadedAt} /> : null}
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
                {data.templatesPicker ? (
                  <InboxTemplatesPicker
                    enabled
                    templates={data.templates}
                    open={templatesOpen}
                    onToggle={() => setTemplatesOpen((current) => !current)}
                    onPick={(template) => {
                      setBody(pickTemplateIntoComposer({ body, templateId }, template).body);
                      setTemplatesOpen(false);
                    }}
                  />
                ) : null}
                {data.outboundMedia ? (
                  <InboxOutboundMedia
                    key={thread.id}
                    enabled
                    pending={outboundAttachment}
                    onAttach={(next) => {
                      setOutboundAttachment((current) => {
                        if (current?.previewUrl !== next.previewUrl) revokeOutboundPreview(current);
                        return next;
                      });
                    }}
                    onRemove={() => {
                      setOutboundAttachment((current) => {
                        revokeOutboundPreview(current);
                        return null;
                      });
                    }}
                  />
                ) : null}
                <InboxWaReplyFields blocked={blocked} body={body} onBody={setBody} />
              </form>
              {data.internalNotes ? (
                <InboxInternalNotes
                  key={thread.id}
                  enabled
                  notes={thread.notes}
                  data={data}
                  threadId={thread.id}
                  saveAction={addInboxNote}
                />
              ) : null}
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

function InboxConversationCard({ data, item, active, realtimeEnabled }: { data: InboxData; item: InboxListItem; active: boolean; realtimeEnabled: boolean }) {
  const liveBadge = liveUnreadCount(realtimeEnabled, item.unread);
  return (
    <Link
      href={inboxHref({ ...data, id: item.id })}
      className={`rounded-xl border bg-white p-3 shadow-sm ${active ? "border-[#2563EB]" : "border-slate-200"}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#0B1F3A]">{item.contactName}</span>
        {realtimeEnabled
          ? (liveBadge != null ? <span data-testid="inbox-live-unread" className="rounded-full bg-[#2563EB] px-2 py-0.5 text-xs font-semibold text-white">{liveBadge}</span> : null)
          : (item.unread > 0 ? <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-xs font-semibold text-white">{item.unread}</span> : null)}
      </span>
      <span className="mt-1 block text-xs uppercase tracking-wide text-slate-500">{item.channel} · {item.status}</span>
      {data.multiNumber && item.channel === "whatsapp" ? (
        <span className="mt-1 block text-xs text-slate-500">{whatsappNumberLabel(data, item.connectionId) || "No number"}</span>
      ) : null}
      <span className="mt-1 block truncate text-sm text-slate-600">{item.preview || "Open the thread"}</span>
    </Link>
  );
}

function snapshotFrom(data: InboxData) {
  return liveInboxFromData({
    orgId: data.orgId,
    filter: data.filter,
    channel: data.channel,
    userId: data.userId,
    assignedOnly: data.assignedOnly,
    conversations: data.conversations,
    thread: data.thread
      ? {
          id: data.thread.id,
          status: data.thread.status,
          windowExpiresAt: data.thread.windowExpiresAt,
          messages: data.thread.messages,
        }
      : null,
  });
}

function browserRealtimeSocket(): RealtimeSocket {
  const supabase = createSupabaseBrowserClient();
  return {
    channel(name) {
      const channel = supabase.channel(name);
      return {
        on(table, filter, listener) {
          channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table, filter },
            (payload) => {
              const next = payload.new && typeof payload.new === "object" ? payload.new as Record<string, unknown> : null;
              const prev = payload.old && typeof payload.old === "object" ? payload.old as Record<string, unknown> : null;
              listener({
                eventType: payload.eventType,
                new: next && Object.keys(next).length ? next : null,
                old: prev && Object.keys(prev).length ? prev : null,
              });
            },
          );
        },
        subscribe() {
          channel.subscribe();
        },
        unsubscribe() {
          void supabase.removeChannel(channel);
        },
      };
    },
  };
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

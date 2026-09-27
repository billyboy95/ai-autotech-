import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { contactLookup, parseInboxChannel, parseInboxFilter } from "@/lib/inbox/rules";
import { previewInbox } from "@/lib/inbox/preview";
import type { InboxConsent, InboxContact, InboxData, InboxListItem, InboxMessage, InboxNote, InboxThread } from "@/lib/inbox/types";

export async function loadInboxUnread() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 0;
  try {
    const supabase = await createSupabaseServerClient();
    const listed = await supabase.from("conversations").select("unread_count").neq("status", "closed");
    if (listed.error) return 0;
    return (listed.data ?? []).reduce((sum, row) => sum + Number(row.unread_count || 0), 0);
  } catch {
    return 0;
  }
}

export async function loadInbox(query: {
  org?: string;
  filter?: string;
  channel?: string;
  id?: string;
  notice?: string | null;
}): Promise<InboxData> {
  const filter = parseInboxFilter(query.filter);
  const channel = parseInboxChannel(query.channel);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return previewInbox({ ...query, filter, channel, notice: query.notice });
  }

  const tenant = await safeResolveWorkspace(query.org);
  if (!tenant.scoped || tenant.active.id.startsWith("preview-")) {
    return previewInbox({ ...query, filter, channel, notice: query.notice });
  }

  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id ?? null;
  const base: InboxData = {
    preview: false,
    orgId: tenant.active.id,
    orgSlug: tenant.active.slug,
    userId,
    assignedOnly: false,
    sendingEnabled: tenant.active.sendingEnabled,
    filter,
    channel,
    conversations: [],
    thread: null,
    templates: [],
    connections: [],
    members: [],
    serviceUsed: 0,
    notice: query.notice ?? null,
  };

  if (userId) {
    const membership = await supabase
      .from("memberships")
      .select("assigned_only")
      .eq("user_id", userId)
      .eq("org_id", tenant.active.id)
      .maybeSingle();
    if (!membership.error && membership.data) base.assignedOnly = Boolean(membership.data.assigned_only);
  }

  let listed = supabase
    .from("conversations")
    .select("id, channel, status, assigned_user_id, unread_count, last_message_at, wa_window_expires_at, contact_id, channel_connection_id, crm_contacts(first_name, last_name)")
    .eq("org_id", tenant.active.id)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (filter === "mine" && userId) listed = listed.eq("assigned_user_id", userId);
  if (filter === "unassigned") listed = listed.is("assigned_user_id", null);
  if (channel) listed = listed.eq("channel", channel);
  const conversations = await listed;
  if (conversations.error) {
    if (missingInboxTable(conversations.error.message)) {
      return { ...base, notice: "Inbox tables are not in this database yet. Apply phase 2e before using the inbox. Nothing was sent." };
    }
    return { ...base, notice: conversations.error.message };
  }

  base.conversations = (conversations.data ?? []).map((row) => {
    const contact = one(row.crm_contacts) as { first_name?: string; last_name?: string } | null;
    const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
    return {
      id: String(row.id),
      channel: String(row.channel),
      status: String(row.status),
      assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
      unread: Number(row.unread_count || 0),
      lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
      windowExpiresAt: row.wa_window_expires_at ? String(row.wa_window_expires_at) : null,
      contactName: name || "Unknown contact",
      preview: "",
    } satisfies InboxListItem;
  });

  const selected = query.id && base.conversations.some((item) => item.id === query.id) ? query.id : base.conversations[0]?.id;
  if (selected) base.thread = await loadThread(supabase, tenant.active.id, selected);

  const [templates, connections, members] = await Promise.all([
    supabase.from("message_templates").select("id, name, channel, subject, body, wa_category, wa_status, active").eq("org_id", tenant.active.id).eq("active", true),
    supabase.from("channel_connections").select("id, channel, display_name, identifier").eq("org_id", tenant.active.id),
    supabase.from("memberships").select("user_id, role").eq("org_id", tenant.active.id),
  ]);
  if (!templates.error) {
    base.templates = (templates.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name || "Template"),
      channel: String(row.channel),
      subject: String(row.subject || ""),
      body: String(row.body || ""),
      waCategory: String(row.wa_category || ""),
      approved: String(row.wa_status || "") === "approved" || String(row.channel) !== "whatsapp",
    }));
  }
  if (!connections.error) {
    base.connections = (connections.data ?? []).map((row) => ({
      id: String(row.id),
      channel: String(row.channel),
      label: String(row.display_name || row.identifier || row.channel),
    }));
  }
  if (!members.error) {
    base.members = (members.data ?? []).map((row) => ({ userId: String(row.user_id), role: String(row.role) }));
  }

  const connectionId = base.thread?.connectionId || base.connections.find((item) => item.channel === "whatsapp")?.id || null;
  if (connectionId && isUuid(connectionId)) {
    const counted = await supabase.rpc("wa_service_sends_this_month", { p_org: tenant.active.id, p_connection: connectionId });
    if (!counted.error && typeof counted.data === "number") base.serviceUsed = counted.data;
  }
  return base;
}

async function loadThread(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, orgId: string, id: string): Promise<InboxThread | null> {
  const conversation = await supabase
    .from("conversations")
    .select("id, channel, status, assigned_user_id, channel_connection_id, wa_window_expires_at, contact_id, crm_contacts(id, first_name, last_name, email, phone_e164, whatsapp_e164, company, tags, lead_id)")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (conversation.error || !conversation.data) return null;
  const row = conversation.data;
  const contactRow = one(row.crm_contacts) as {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_e164?: string;
    whatsapp_e164?: string;
    company?: string;
    tags?: string[] | null;
    lead_id?: string | null;
  } | null;
  let stage = "";
  if (contactRow?.lead_id) {
    const lead = await supabase.from("crm_leads").select("stage").eq("id", contactRow.lead_id).eq("org_id", orgId).maybeSingle();
    if (!lead.error && lead.data) stage = String(lead.data.stage || "");
  }
  const contact: InboxContact | null = contactRow?.id
    ? {
        id: String(contactRow.id),
        name: [contactRow.first_name, contactRow.last_name].filter(Boolean).join(" ") || "Contact",
        email: String(contactRow.email || ""),
        phone: String(contactRow.phone_e164 || ""),
        whatsapp: String(contactRow.whatsapp_e164 || ""),
        company: String(contactRow.company || ""),
        tags: Array.isArray(contactRow.tags) ? contactRow.tags.map(String) : [],
        stage,
        leadId: contactRow.lead_id ? String(contactRow.lead_id) : null,
      }
    : null;

  const [messages, notes, consents] = await Promise.all([
    supabase.from("messages").select("id, direction, body, status, channel, wa_category, cost_cents, provider_message_id, created_at").eq("conversation_id", id).order("created_at", { ascending: true }),
    supabase.from("conversation_notes").select("id, body, created_at").eq("conversation_id", id).order("created_at", { ascending: true }),
    contact ? supabase.from("contact_consents").select("channel, purpose, status, captured_at").eq("contact_id", contact.id).order("captured_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    id: String(row.id),
    channel: String(row.channel),
    status: String(row.status),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    connectionId: row.channel_connection_id ? String(row.channel_connection_id) : null,
    windowExpiresAt: row.wa_window_expires_at ? String(row.wa_window_expires_at) : null,
    contact,
    messages: ((messages.data ?? []) as Record<string, unknown>[]).map(mapMessage),
    notes: ((notes.error ? [] : notes.data ?? []) as Record<string, unknown>[]).map(mapNote),
    consents: consentRows(consents.data),
  };
}

function mapMessage(row: Record<string, unknown>): InboxMessage {
  return {
    id: String(row.id),
    direction: row.direction === "out" ? "out" : "in",
    body: String(row.body || ""),
    status: String(row.status || ""),
    channel: String(row.channel || ""),
    waCategory: String(row.wa_category || ""),
    costCents: Number(row.cost_cents || 0),
    providerMessageId: String(row.provider_message_id || ""),
    createdAt: String(row.created_at || ""),
  };
}

function mapNote(row: Record<string, unknown>): InboxNote {
  return { id: String(row.id), body: String(row.body || ""), createdAt: String(row.created_at || "") };
}

function consentRows(data: unknown): InboxConsent[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const rows: InboxConsent[] = [];
  for (const row of data as { channel?: string; purpose?: string; status?: string }[]) {
    const key = `${row.channel}:${row.purpose}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ channel: String(row.channel || ""), purpose: String(row.purpose || ""), status: String(row.status || "") });
  }
  return rows;
}

function one<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function missingInboxTable(message: string) {
  const text = message.toLowerCase();
  return text.includes("conversations") && (text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find"));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function threadAddress(channel: string, contact: { email: string; phone: string; whatsapp: string }) {
  if (channel === "email") return contact.email;
  if (channel === "whatsapp") return contact.whatsapp || contact.phone;
  if (channel === "sms") return contact.phone;
  const lookup = contactLookup(channel, contact.phone || contact.email);
  return lookup.externalId || lookup.phone || lookup.email;
}

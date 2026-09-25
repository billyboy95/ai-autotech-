import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nid } from "@/lib/crm-store";
import type { LeadFacts } from "./persona";
import type { HistoryItem } from "./brain";

/** Persistence for WhatsApp conversations. Tables: crm_whatsapp_conversations, crm_whatsapp_messages. */

export type Conversation = {
  id: string;
  wa_id: string;
  channel: "whatsapp" | "simulator";
  profile_name: string;
  status: "active" | "handover" | "opted_out" | "closed" | "test";
  is_test: boolean;
  bot_paused_until: string | null;
  handover_reason: string;
  needs_attention: boolean;
  opted_out: boolean;
  lead: LeadFacts;
  crm_lead_id: string | null;
  message_count: number;
};

export type MessageRow = {
  id: string;
  created_at: string;
  direction: "in" | "out";
  author: "lead" | "bot" | "billy" | "system";
  type: string;
  body: string;
  wa_message_id: string | null;
  media_id: string | null;
  meta: Record<string, unknown>;
};

export function db() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase admin client is not configured.");
  return supabase;
}

export function isTestNumber(waId: string) {
  const list = (process.env.WHATSAPP_TEST_NUMBERS || "")
    .split(/[,\s]+/)
    .map((s) => s.replace(/\D/g, ""))
    .filter(Boolean);
  return list.includes(waId.replace(/\D/g, ""));
}

export async function getOrCreateConversation(input: {
  waId: string;
  channel: "whatsapp" | "simulator";
  profileName?: string;
  isTest: boolean;
}): Promise<Conversation> {
  const supabase = db();
  const existing = await supabase.from("crm_whatsapp_conversations").select("*").eq("wa_id", input.waId).maybeSingle();
  if (existing.data) {
    const conv = existing.data as Conversation;
    if (input.profileName && input.profileName !== conv.profile_name) {
      await supabase.from("crm_whatsapp_conversations").update({ profile_name: input.profileName }).eq("id", conv.id);
      conv.profile_name = input.profileName;
    }
    return conv;
  }
  const inserted = await supabase
    .from("crm_whatsapp_conversations")
    .insert({
      wa_id: input.waId,
      channel: input.channel,
      source: input.channel === "simulator" ? "simulator" : "whatsapp",
      profile_name: input.profileName ?? "",
      status: input.isTest ? "test" : "active",
      is_test: input.isTest,
    })
    .select("*")
    .single();
  if (inserted.error) {
    // Race: another invocation created it first.
    const again = await supabase.from("crm_whatsapp_conversations").select("*").eq("wa_id", input.waId).single();
    if (again.error) throw new Error(inserted.error.message);
    return again.data as Conversation;
  }
  return inserted.data as Conversation;
}

/** Insert a message. Returns null when the wa_message_id was already stored (duplicate webhook delivery). */
export async function insertMessage(
  conversationId: string,
  m: {
    direction: "in" | "out";
    author: MessageRow["author"];
    type?: string;
    body: string;
    waMessageId?: string | null;
    mediaId?: string | null;
    status?: string;
    meta?: Record<string, unknown>;
  },
): Promise<MessageRow | null> {
  const supabase = db();
  const res = await supabase
    .from("crm_whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      direction: m.direction,
      author: m.author,
      type: m.type ?? "text",
      body: m.body.slice(0, 4000),
      wa_message_id: m.waMessageId ?? null,
      media_id: m.mediaId ?? null,
      status: m.status ?? "",
      meta: m.meta ?? {},
    })
    .select("*")
    .single();
  if (res.error) {
    if (res.error.code === "23505") return null; // unique violation → duplicate
    throw new Error(res.error.message);
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (m.direction === "in") patch.last_inbound_at = now;
  else patch.last_outbound_at = now;
  await supabase.from("crm_whatsapp_conversations").update(patch).eq("id", conversationId);
  return res.data as MessageRow;
}

export async function updateMessageMeta(id: string, patch: { body?: string; meta?: Record<string, unknown>; status?: string }) {
  await db().from("crm_whatsapp_messages").update(patch).eq("id", id);
}

export async function loadMessages(conversationId: string, limit = 40): Promise<MessageRow[]> {
  const res = await db()
    .from("crm_whatsapp_messages")
    .select("id, created_at, direction, author, type, body, wa_message_id, media_id, meta")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (res.error) throw new Error(res.error.message);
  return ((res.data ?? []) as MessageRow[]).reverse();
}

/** Split stored messages into answered history and the trailing unanswered lead messages. */
export function splitHistory(rows: MessageRow[]) {
  let cut = rows.length;
  while (cut > 0 && rows[cut - 1].direction === "in") cut--;
  const history: HistoryItem[] = rows.slice(0, cut).filter((r) => r.author !== "system").map((r) => ({
    role: r.author === "lead" ? "lead" : r.author === "billy" ? "billy" : "bot",
    text: r.body,
  }));
  return { history, pending: rows.slice(cut) };
}

export async function latestInboundId(conversationId: string) {
  const res = await db()
    .from("crm_whatsapp_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (res.data as { id: string } | null)?.id ?? null;
}

export async function refreshConversation(id: string): Promise<Conversation> {
  const res = await db().from("crm_whatsapp_conversations").select("*").eq("id", id).single();
  if (res.error) throw new Error(res.error.message);
  return res.data as Conversation;
}

export function isPaused(conv: Conversation, now = Date.now()) {
  return Boolean(conv.bot_paused_until && new Date(conv.bot_paused_until).getTime() > now);
}

export async function patchConversation(id: string, patch: Record<string, unknown>) {
  const res = await db()
    .from("crm_whatsapp_conversations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export function handoverHours() {
  const h = Number(process.env.WHATSAPP_HANDOVER_HOURS || 12);
  return Number.isFinite(h) && h > 0 ? h : 12;
}

function leadNotes(conv: Conversation, lead: LeadFacts, flag?: string) {
  return [
    flag ? `[WHATSAPP ${flag}]` : "",
    "WhatsApp enquiry (auto-responder)",
    `Source: whatsapp · wa.me/${conv.wa_id}`,
    lead.industry ? `Industry: ${lead.industry}` : "",
    lead.pain ? `Pain: ${lead.pain}` : "",
    lead.budget ? `Budget: ${lead.budget}` : "",
    lead.timeline ? `Timeline: ${lead.timeline}` : "",
    lead.email ? `Email: ${lead.email}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Mirror a real WhatsApp lead into crm_leads once a name or business is known.
 * Test conversations are never mirrored. Returns the crm_leads id (or null).
 */
export async function syncCrmLead(conv: Conversation, lead: LeadFacts, flag?: string) {
  if (conv.is_test) return null;
  if (!lead.name && !lead.business && !flag) return conv.crm_lead_id;
  const supabase = db();
  const row = {
    name: lead.name || conv.profile_name || "WhatsApp lead",
    company: lead.business ?? "",
    phone: `+${conv.wa_id}`,
    notes: leadNotes(conv, lead, flag),
  };
  if (conv.crm_lead_id) {
    const res = await supabase.from("crm_leads").update({ ...row, updated_at: new Date().toISOString() }).eq("id", conv.crm_lead_id);
    if (!res.error) return conv.crm_lead_id;
    console.error("crm_leads update failed", res.error.message);
  }
  const id = nid();
  const res = await supabase.from("crm_leads").insert({ id, ...row, stage: "New", ord: -Math.floor(Date.now() / 1000) });
  if (res.error) {
    console.error("crm_leads insert failed", res.error.message);
    return null;
  }
  await patchConversation(conv.id, { crm_lead_id: id });
  return id;
}

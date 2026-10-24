import { newId } from "@/lib/automation/ids";
import type { BotConfig } from "@/lib/bots/catalog-types";
import { mergeBotConfig, seedBotConfig } from "@/lib/try-chat/seed";
import type { TryLinkState } from "@/lib/try-chat/access";
import type { SandboxBookingPlan } from "@/lib/try-chat/booking";
import { TEST_CALENDAR_NAME, TEST_EVENT_NAME } from "@/lib/try-chat/booking";
import type { TryGrounding } from "@/lib/try-chat/prompt";
import type { TryCommitInput, TryCommitResult, TryHistoryMessage, TryLoadedLink, TryStore } from "@/lib/try-chat/store";
import { hashTryToken, newTryToken, tryLinkPath } from "@/lib/try-chat/token";
import { openServiceDatabase } from "@/server/workers/service-db";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIG_FALLBACK: BotConfig = {
  tone: "warm and plain",
  workingHours: { timezone: "Africa/Johannesburg", start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5] },
  pipeline: "",
  stage: "",
  channel: "whatsapp",
};

export type TryLinkSummary = {
  id: string;
  expiresAt: string;
  maxMessages: number;
  usedMessages: number;
  revokedAt: string | null;
};

type Row = Record<string, unknown>;

function text(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function database() {
  return openServiceDatabase();
}

function linkState(row: Row, orgSlug: string): TryLinkState {
  return {
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    orgSlug,
    tokenHash: text(row, "token_hash"),
    expiresAt: text(row, "expires_at"),
    revokedAt: row.revoked_at ? text(row, "revoked_at") : null,
    maxMessages: Number(row.max_messages ?? 50),
    usedMessages: Number(row.used_messages ?? 0),
  };
}

async function groundingFor(client: NonNullable<ReturnType<typeof database>>, orgName: string, bot: Row, config: BotConfig): Promise<TryGrounding> {
  const templates = await client.from("bot_templates").select("slug, name, description, industry, department, payload");
  const rows = (templates.data ?? []) as Row[];
  const seeded = seedBotConfig({
    botSlug: text(bot, "slug"),
    templates: rows.map((row) => ({ slug: text(row, "slug"), payload: row.payload })),
    fallback: config,
  });
  const template = rows.find((row) => text(row, "slug") === seeded.templateSlug);
  return {
    orgName,
    botName: text(bot, "name"),
    botDescription: text(bot, "description"),
    config,
    templateName: template ? text(template, "name") : "",
    templateDescription: template ? text(template, "description") : "",
    industry: template ? text(template, "industry") : "",
    department: template ? text(template, "department") : "",
    capabilities: strings(bot.capabilities),
  };
}

async function ensureTestCalendar(client: NonNullable<ReturnType<typeof database>>, orgId: string, plan: SandboxBookingPlan) {
  const existing = await client
    .from("calendars")
    .select("id")
    .eq("org_id", orgId)
    .eq("sandbox", true)
    .eq("name", TEST_CALENDAR_NAME)
    .maybeSingle();
  if (existing.error) return { ok: false as const, message: "The TEST calendar could not be opened. Nothing was booked." };
  let calendarId = existing.data ? text(existing.data as Row, "id") : "";
  if (!calendarId) {
    const created = await client.from("calendars").insert({
      org_id: orgId,
      name: TEST_CALENDAR_NAME,
      timezone: "Africa/Johannesburg",
      description: "Sandbox test bookings from the try chat. No confirmation is sent.",
      sandbox: true,
      active: true,
    }).select("id").single();
    if (created.error || !created.data) return { ok: false as const, message: "The TEST calendar could not be opened. Nothing was booked." };
    calendarId = text(created.data as Row, "id");
  }
  const event = await client
    .from("calendar_event_types")
    .select("id")
    .eq("org_id", orgId)
    .eq("calendar_id", calendarId)
    .eq("name", TEST_EVENT_NAME)
    .maybeSingle();
  if (event.error) return { ok: false as const, message: "The TEST calendar could not be opened. Nothing was booked." };
  let eventId = event.data ? text(event.data as Row, "id") : "";
  if (!eventId) {
    const created = await client.from("calendar_event_types").insert({
      org_id: orgId,
      calendar_id: calendarId,
      name: TEST_EVENT_NAME,
      duration_minutes: plan.durationMinutes,
      location_mode: plan.locationMode,
      location_detail: plan.locationDetail,
      active: true,
    }).select("id").single();
    if (created.error || !created.data) return { ok: false as const, message: "The TEST calendar could not be opened. Nothing was booked." };
    eventId = text(created.data as Row, "id");
  }
  return { ok: true as const, calendarId, eventId };
}

export async function listBotTryLinks(input: { orgId: string; botSlug: string }) {
  const client = database();
  if (!client || !UUID.test(input.orgId) || !SLUG.test(input.botSlug)) return { configured: Boolean(client), links: [] as TryLinkSummary[] };
  const bot = await client.from("org_bots").select("id").eq("org_id", input.orgId).eq("bot_slug", input.botSlug).maybeSingle();
  if (bot.error || !bot.data) return { configured: true, links: [] as TryLinkSummary[] };
  const links = await client
    .from("bot_try_links")
    .select("id, expires_at, max_messages, used_messages, revoked_at")
    .eq("org_id", input.orgId)
    .eq("org_bot_id", text(bot.data as Row, "id"))
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (links.error) return { configured: true, links: [] as TryLinkSummary[] };
  return {
    configured: true,
    links: ((links.data ?? []) as Row[]).map((row) => ({
      id: text(row, "id"),
      expiresAt: text(row, "expires_at"),
      maxMessages: Number(row.max_messages ?? 50),
      usedMessages: Number(row.used_messages ?? 0),
      revokedAt: row.revoked_at ? text(row, "revoked_at") : null,
    })),
  };
}

export async function createBotTryLink(input: { orgId: string; orgSlug: string; botSlug: string }) {
  const client = database();
  if (!client) return { ok: false as const, message: "Supabase service role is not configured. The test link was not stored." };
  if (!UUID.test(input.orgId) || !SLUG.test(input.orgSlug) || !SLUG.test(input.botSlug)) {
    return { ok: false as const, message: "That workspace or agent is not valid. Nothing was stored." };
  }
  const org = await client.from("organizations").select("id, slug, name").eq("id", input.orgId).maybeSingle();
  if (org.error || !org.data || text(org.data as Row, "slug") !== input.orgSlug) {
    return { ok: false as const, message: "That workspace was not found. Nothing was stored." };
  }
  const catalog = await client
    .from("bot_catalog")
    .select("slug, name, description, capabilities, default_config")
    .eq("slug", input.botSlug)
    .maybeSingle();
  if (catalog.error || !catalog.data) {
    return { ok: false as const, message: catalog.error?.message || "That agent is not in the catalogue. Nothing was stored." };
  }
  const installed = await client.from("org_bots").select("id, config").eq("org_id", input.orgId).eq("bot_slug", input.botSlug).maybeSingle();
  if (installed.error) return { ok: false as const, message: installed.error.message };
  let orgBotId = installed.data ? text(installed.data as Row, "id") : "";
  if (!orgBotId) {
    const templates = await client.from("bot_templates").select("slug, payload");
    if (templates.error) return { ok: false as const, message: templates.error.message };
    const seeded = seedBotConfig({
      botSlug: input.botSlug,
      templates: ((templates.data ?? []) as Row[]).map((row) => ({ slug: text(row, "slug"), payload: row.payload })),
      fallback: mergeBotConfig((catalog.data as Row).default_config, CONFIG_FALLBACK),
    });
    const created = await client.from("org_bots").insert({
      org_id: input.orgId,
      bot_slug: input.botSlug,
      status: "trial",
      config: seeded.config,
      sandbox: true,
    }).select("id").single();
    if (created.error || !created.data) return { ok: false as const, message: created.error?.message || "The sandbox agent was not saved." };
    orgBotId = text(created.data as Row, "id");
  }
  const token = newTryToken();
  const saved = await client.from("bot_try_links").insert({
    org_id: input.orgId,
    org_bot_id: orgBotId,
    token_hash: hashTryToken(token),
  }).select("expires_at").single();
  if (saved.error || !saved.data) return { ok: false as const, message: saved.error?.message || "The test link was not stored." };
  return {
    ok: true as const,
    url: tryLinkPath(input.orgSlug, token),
    expiresAt: text(saved.data as Row, "expires_at"),
  };
}

export async function revokeBotTryLink(input: { orgId: string; botSlug: string; linkId: string }) {
  const client = database();
  if (!client) return { ok: false as const, message: "Supabase service role is not configured. Nothing was revoked." };
  if (!UUID.test(input.orgId) || !UUID.test(input.linkId) || !SLUG.test(input.botSlug)) {
    return { ok: false as const, message: "That test link was not found." };
  }
  const bot = await client.from("org_bots").select("id").eq("org_id", input.orgId).eq("bot_slug", input.botSlug).maybeSingle();
  if (bot.error || !bot.data) return { ok: false as const, message: "That test link was not found." };
  const saved = await client
    .from("bot_try_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.linkId)
    .eq("org_id", input.orgId)
    .eq("org_bot_id", text(bot.data as Row, "id"))
    .is("revoked_at", null)
    .select("id");
  if (saved.error) return { ok: false as const, message: saved.error.message };
  if (!saved.data?.length) return { ok: false as const, message: "That test link was already revoked." };
  return { ok: true as const, message: "Test link revoked. New chats on that link are refused. Nothing was sent." };
}

async function loadLink(client: NonNullable<ReturnType<typeof database>>, slug: string, tokenHash: string): Promise<TryLoadedLink | null> {
  if (!SLUG.test(slug) || !/^[0-9a-f]{64}$/.test(tokenHash)) return null;
  const found = await client.from("bot_try_links").select("id, org_id, org_bot_id, token_hash, expires_at, revoked_at, max_messages, used_messages").eq("token_hash", tokenHash).maybeSingle();
  if (found.error || !found.data) return null;
  const row = found.data as Row;
  const org = await client.from("organizations").select("id, slug, name").eq("id", text(row, "org_id")).maybeSingle();
  if (org.error || !org.data) return null;
  const orgSlug = text(org.data as Row, "slug");
  const installed = await client.from("org_bots").select("id, bot_slug, config, sandbox").eq("id", text(row, "org_bot_id")).eq("org_id", text(row, "org_id")).maybeSingle();
  if (installed.error || !installed.data || (installed.data as Row).sandbox !== true) return null;
  const catalog = await client
    .from("bot_catalog")
    .select("slug, name, description, capabilities, default_config")
    .eq("slug", text(installed.data as Row, "bot_slug"))
    .maybeSingle();
  if (catalog.error || !catalog.data) return null;
  const config = mergeBotConfig((installed.data as Row).config, mergeBotConfig((catalog.data as Row).default_config, CONFIG_FALLBACK));
  const messages = await client
    .from("bot_try_messages")
    .select("role, content, created_at")
    .eq("link_id", text(row, "id"))
    .order("created_at", { ascending: false })
    .limit(12);
  const history: TryHistoryMessage[] = ((messages.data ?? []) as Row[])
    .reverse()
    .flatMap((item) => {
      const role = text(item, "role");
      if (role !== "user" && role !== "assistant") return [];
      return [{ role, content: text(item, "content") }];
    });
  return {
    link: linkState(row, orgSlug),
    grounding: await groundingFor(client, text(org.data as Row, "name"), catalog.data as Row, config),
    history,
  };
}

async function commitLink(client: NonNullable<ReturnType<typeof database>>, input: TryCommitInput): Promise<TryCommitResult> {
  const found = await client.from("bot_try_links").select("id, org_id, expires_at, revoked_at, max_messages, used_messages").eq("id", input.linkId).maybeSingle();
  if (found.error || !found.data) return { ok: false, code: "missing", message: "This test link is not active." };
  const row = found.data as Row;
  if (row.revoked_at) return { ok: false, code: "revoked", message: "This test link was revoked." };
  if (Date.parse(text(row, "expires_at")) <= input.now.getTime()) {
    return { ok: false, code: "expired", message: "This test link has expired." };
  }
  const used = Number(row.used_messages ?? 0);
  const max = Number(row.max_messages ?? 50);
  if (used >= max) return { ok: false, code: "capped", message: "This test chat has reached its message limit." };
  const orgId = text(row, "org_id");
  if (input.booking) {
    const calendar = await ensureTestCalendar(client, orgId, input.booking);
    if (!calendar.ok) return { ok: false, code: "tool_failed", message: calendar.message };
    const booked = await client.from("crm_appointments").insert({
      org_id: orgId,
      calendar_id: calendar.calendarId,
      event_type_id: calendar.eventId,
      starts_at: input.booking.startsAt,
      ends_at: input.booking.endsAt,
      status: "scheduled",
      guest_name: input.booking.guestName,
      guest_phone: input.booking.guestPhone,
      guest_email: input.booking.guestEmail,
      location_mode: input.booking.locationMode,
      location_detail: input.booking.locationDetail,
      consent_accepted: true,
      consent_text: input.booking.consentText,
      consent_at: input.now.toISOString(),
    });
    if (booked.error) return { ok: false, code: "tool_failed", message: "The TEST booking was not saved. Nothing was sent." };
  }
  if (input.lead) {
    const captured = await client.from("crm_leads").insert({
      id: newId("try"),
      org_id: orgId,
      name: input.lead.name,
      company: input.lead.company,
      phone: input.lead.phone,
      email: input.lead.email,
      stage: input.lead.stage,
      notes: input.lead.notes,
      source: input.lead.source,
      marketing_consent: input.lead.marketingConsent,
      enrolled: input.lead.enrolled,
      value_zar: input.lead.valueZar,
    });
    if (captured.error) return { ok: false, code: "tool_failed", message: "The TEST lead was not saved. Nothing was sent." };
  }
  const bumped = await client
    .from("bot_try_links")
    .update({ used_messages: used + 1 })
    .eq("id", input.linkId)
    .eq("used_messages", used)
    .select("used_messages")
    .maybeSingle();
  if (bumped.error || !bumped.data) return { ok: false, code: "capped", message: "This test chat has reached its message limit." };
  const stored = await client.from("bot_try_messages").insert([
    { link_id: input.linkId, role: "user", content: input.userMessage },
    { link_id: input.linkId, role: "assistant", content: input.assistantMessage },
  ]);
  if (stored.error) return { ok: false, code: "tool_failed", message: "The reply was not stored. Nothing was sent." };
  await client.rpc("purge_bot_try_messages");
  return { ok: true, usedMessages: Number((bumped.data as Row).used_messages ?? used + 1) };
}

export function createTryStore(): TryStore | null {
  const client = database();
  if (!client) return null;
  return {
    load: (input) => loadLink(client, input.slug, input.tokenHash),
    commit: (input) => commitLink(client, input),
  };
}

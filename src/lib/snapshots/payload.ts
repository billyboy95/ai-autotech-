import { createHash } from "node:crypto";

export const SNAPSHOT_V1_KEYS = ["version", "pipelines", "message_templates", "sequences", "custom_fields", "workflows"] as const;

export const SNAPSHOT_V2_EXTRA_KEYS = ["tags", "calendars", "ai_reply", "ai_knowledge", "agent_team", "website"] as const;

export const SNAPSHOT_TOP_LEVEL_KEYS = SNAPSHOT_V1_KEYS;

/** Public site and knowledge text may name a business phone or email. Contacts and secrets stay forbidden. */
export const PUBLIC_SNAPSHOT_ZONES = ["website", "ai_knowledge"] as const;

const PUBLIC_CONTACT_KEYS = new Set(["email", "phone"]);

export const FORBIDDEN_PAYLOAD_KEYS = [
  "access_token",
  "api_key",
  "channel_connections",
  "channel_secret",
  "channel_secrets",
  "contact",
  "contacts",
  "credential",
  "credentials",
  "crm_contacts",
  "crm_outbox",
  "crm_prospects",
  "email",
  "from_address",
  "inbound_events",
  "message",
  "messages",
  "outbox",
  "password",
  "phone",
  "phone_e164",
  "prospects",
  "secret",
  "secrets",
  "service_role",
  "settings",
  "to_address",
  "token",
  "tokens",
  "webhook_secret",
  "whatsapp",
  "whatsapp_e164",
] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_PAYLOAD_KEYS);
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const SECRET = /(sk_live_|whsec_|api[_-]?key\s*[:=]|bearer\s+[a-z0-9]|secret\s*[:=])/i;
const PHONE = /\d{10,}/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ASSET_KEY = /^(pipeline|stage|template|sequence|step|field|workflow|campaign):[A-Za-z0-9_.:-]+$/;

export type SnapshotChannel = "whatsapp" | "email" | "sms";

export type SnapshotStage = {
  asset_key: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
};

export type SnapshotPipeline = {
  asset_key: string;
  name: string;
  is_default: boolean;
  stages: SnapshotStage[];
};

export type SnapshotTemplate = {
  asset_key: string;
  channel: SnapshotChannel;
  name: string;
  subject: string;
  body: string;
  active: boolean;
};

export type SnapshotStep = {
  asset_key: string;
  position: number;
  delay_hours: number;
  channel: SnapshotChannel;
  template_asset_key: string;
};

export type SnapshotSequence = {
  asset_key: string;
  name: string;
  active: boolean;
  steps: SnapshotStep[];
};

export type SnapshotField = {
  asset_key: string;
  entity: "lead" | "deal" | "company";
  field_key: string;
  label: string;
  field_type: string;
  options: string[];
  required: boolean;
  position: number;
};

export type SnapshotWorkflow = {
  asset_key: string;
  name: string;
  active: boolean;
  trigger_type: string;
  trigger: Record<string, unknown>;
  steps: unknown[];
};

export type SnapshotTag = {
  asset_key: string;
  name: string;
  color: string;
};

export type SnapshotWeekly = {
  weekday: number;
  start_minute: number;
  end_minute: number;
};

export type SnapshotBooking = {
  asset_key: string;
  slug_suffix: string;
  active: boolean;
  consent_text: string;
};

export type SnapshotEventType = {
  asset_key: string;
  name: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  location_mode: "phone" | "video" | "in_person" | "custom";
  location_detail: string;
  booking: SnapshotBooking;
};

export type SnapshotCalendar = {
  asset_key: string;
  name: string;
  timezone: string;
  description: string;
  active: boolean;
  weekly: SnapshotWeekly[];
  event_types: SnapshotEventType[];
};

export type SnapshotAiReply = {
  enabled: boolean;
  mode: "draft_only";
  tone: string;
  system_prompt: string;
  max_auto_per_hour: number;
  require_human_before_send: boolean;
};

export type SnapshotKnowledgeEntry = {
  asset_key: string;
  title: string;
  body: string;
};

export type SnapshotKnowledge = {
  entries: SnapshotKnowledgeEntry[];
};

export type SnapshotAgentTeam = {
  template_slug: string;
  sandbox: true;
  charged: false;
  agents: string[];
};

export type SnapshotService = {
  name: string;
  price_label: string;
};

export type SnapshotWebsite = {
  business_name: string;
  colours: { primary: string; accent: string };
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  services: SnapshotService[];
  booking_url: string;
};

export type SnapshotPayloadBase = {
  pipelines: SnapshotPipeline[];
  message_templates: SnapshotTemplate[];
  sequences: SnapshotSequence[];
  custom_fields: SnapshotField[];
  workflows: SnapshotWorkflow[];
};

export type SnapshotPayloadV1 = SnapshotPayloadBase & {
  version: 1;
};

export type SnapshotPayloadV2 = SnapshotPayloadBase & {
  version: 2;
  tags: SnapshotTag[];
  calendars: SnapshotCalendar[];
  ai_reply: SnapshotAiReply;
  ai_knowledge: SnapshotKnowledge;
  agent_team: SnapshotAgentTeam;
  website: SnapshotWebsite;
};

export type SnapshotPayload = SnapshotPayloadV1 | SnapshotPayloadV2;

export type PushResult = "created" | "updated" | "unchanged" | "skipped_client_edit";

export type PushAsset = {
  assetKey: string;
  kind: string;
  checksum: string;
  sourceChecksum: string;
};

export type PushRow = {
  assetKey: string;
  kind: string;
  result: PushResult;
};

export function collectPayloadIssues(value: unknown): string[] {
  const issues: string[] = [];
  walk(value, issues);
  return issues;
}

function isAssetKeyField(key: string) {
  const lower = key.toLowerCase();
  return lower === "asset_key" || lower.endsWith("_asset_key");
}

function hasPhoneNumber(value: string) {
  if (ASSET_KEY.test(value)) return false;
  return PHONE.test(value.replace(UUID, ""));
}

function walk(value: unknown, issues: string[], parentKey = "", publicZone = false) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, issues, parentKey, publicZone);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      const allowedPublicContact = publicZone && PUBLIC_CONTACT_KEYS.has(lower);
      if (FORBIDDEN.has(lower) && !allowedPublicContact) issues.push(key);
      const nextZone = publicZone || (PUBLIC_SNAPSHOT_ZONES as readonly string[]).includes(lower);
      walk(child, issues, key, nextZone);
    }
    return;
  }
  if (typeof value === "string") {
    if (!publicZone && EMAIL.test(value)) issues.push("email_address");
    if (SECRET.test(value)) issues.push("secret_value");
    if (!publicZone && !isAssetKeyField(parentKey) && hasPhoneNumber(value)) issues.push("phone_number");
  }
}

export function checksum(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function planPush(current: PushAsset[], incoming: PushAsset[]): PushRow[] {
  const byKey = new Map(current.map((item) => [`${item.kind}:${item.assetKey}`, item]));
  return incoming.map((item) => {
    const existing = byKey.get(`${item.kind}:${item.assetKey}`);
    if (!existing) return { assetKey: item.assetKey, kind: item.kind, result: "created" };
    if (existing.checksum !== existing.sourceChecksum) {
      return { assetKey: item.assetKey, kind: item.kind, result: "skipped_client_edit" };
    }
    if (existing.checksum === item.checksum) {
      return { assetKey: item.assetKey, kind: item.kind, result: "unchanged" };
    }
    return { assetKey: item.assetKey, kind: item.kind, result: "updated" };
  });
}

export function templateContent(template: Pick<SnapshotTemplate, "asset_key" | "channel" | "name" | "subject" | "body" | "active">) {
  return {
    active: template.active,
    asset_key: template.asset_key,
    body: template.body,
    channel: template.channel,
    name: template.name,
    subject: template.subject,
  };
}

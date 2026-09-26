import { createHash } from "node:crypto";

export const SNAPSHOT_TOP_LEVEL_KEYS = ["version", "pipelines", "message_templates", "sequences", "custom_fields", "workflows"] as const;

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

export type SnapshotPayload = {
  version: 1;
  pipelines: SnapshotPipeline[];
  message_templates: SnapshotTemplate[];
  sequences: SnapshotSequence[];
  custom_fields: SnapshotField[];
  workflows: SnapshotWorkflow[];
};

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

function walk(value: unknown, issues: string[], parentKey = "") {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, issues, parentKey);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN.has(key.toLowerCase())) issues.push(key);
      walk(child, issues, key);
    }
    return;
  }
  if (typeof value === "string") {
    if (EMAIL.test(value)) issues.push("email_address");
    if (SECRET.test(value)) issues.push("secret_value");
    if (!isAssetKeyField(parentKey) && hasPhoneNumber(value)) issues.push("phone_number");
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

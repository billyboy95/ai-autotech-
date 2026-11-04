/**
 * Contact side panel for the unified inbox.
 * Unset, blank, or any value other than the string true keeps today's inbox:
 * no contact panel chrome.
 * Stage and tag saves write crm_leads and crm_contacts only.
 * This module does not send, does not call Meta, does not change consent,
 * and does not turn sending_enabled on.
 */

import { PIPELINE_STAGES } from "@/lib/automation/types";
import type { InboxConsent, InboxContact } from "@/lib/inbox/types";

export const INBOX_CONTACT_PANEL_FLAG = "INBOX_CONTACT_PANEL_ENABLED";
export const CONTACT_PANEL_CHANNELS = ["whatsapp", "email", "sms"] as const;
const TAG_LIMIT = 20;
const TAG_LENGTH = 40;

export type ContactPanelChannelName = (typeof CONTACT_PANEL_CHANNELS)[number];

export type ContactPanelChannel = {
  channel: ContactPanelChannelName;
  label: string;
  known: boolean;
  lines: { purpose: string; status: string; statusLabel: string }[];
};

export type ContactPanelModel = {
  hasContact: boolean;
  name: string;
  company: string;
  address: string;
  addressKind: "phone" | "email" | "none";
  stage: string;
  stageLabel: string;
  leadLinked: boolean;
  stageOptions: string[];
  tags: string[];
  tagSource: "contact" | "lead" | "none";
  tagEditor: string;
  channels: ContactPanelChannel[];
};

const CHANNEL_LABEL: Record<ContactPanelChannelName, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
};

const STATUS_LABEL: Record<string, string> = {
  opted_in: "Opted in",
  opted_out: "Opted out",
  requested: "Requested",
  none: "Unknown",
  unknown: "Unknown",
};

export function inboxContactPanelEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_CONTACT_PANEL_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function consentStatusLabel(status: string) {
  const key = status.trim().toLowerCase();
  if (!key) return "Unknown";
  return STATUS_LABEL[key] ?? status.trim();
}

/** Contact tags win. Lead tags fill in only when the contact has none. */
export function panelTags(contactTags: readonly string[], leadTags: readonly string[]) {
  const contact = cleanTags(contactTags);
  const lead = cleanTags(leadTags);
  if (contact.length) return { tags: contact, source: "contact" as const };
  if (lead.length) return { tags: lead, source: "lead" as const };
  return { tags: [] as string[], source: "none" as const };
}

export function stageOptions(current: string) {
  const stage = current.trim();
  const options: string[] = [...PIPELINE_STAGES];
  if (stage && !options.includes(stage)) options.unshift(stage);
  return options;
}

export function buildContactPanel(input: {
  contact: InboxContact | null;
  consents: readonly InboxConsent[];
  channel?: string;
}): ContactPanelModel {
  const contact = input.contact;
  const stage = contact?.stage.trim() ?? "";
  const leadLinked = Boolean(contact?.leadId);
  const listed = panelTags(contact?.tags ?? [], contact?.leadTags ?? []);
  const address = contactAddress(contact, input.channel ?? "");
  return {
    hasContact: Boolean(contact?.id),
    name: contact ? (contact.name.trim() || "Unknown") : "",
    company: contact?.company.trim() ?? "",
    address: address.value,
    addressKind: address.kind,
    stage,
    stageLabel: !leadLinked ? "No linked lead" : stage || "Unknown",
    leadLinked,
    stageOptions: stageOptions(stage),
    tags: listed.tags,
    tagSource: listed.source,
    tagEditor: cleanTags(contact?.tags ?? []).join(", "),
    channels: consentByChannel(input.consents),
  };
}

export function parseContactTags(value: string) {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const tag = part.trim().replace(/\s+/g, " ").slice(0, TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    if (tags.length >= TAG_LIMIT) return { ok: false as const, message: "Use up to 20 tags." };
    seen.add(key);
    tags.push(tag);
  }
  return { ok: true as const, tags };
}

/**
 * A blank stage with no current stage writes nothing.
 * A pipeline stage that differs from the current row is the only stage write.
 * Unknown stages are refused so a save cannot invent one.
 */
export function planStageUpdate(input: { submitted: string; current: string; leadId: string | null }) {
  const submitted = input.submitted.trim();
  const current = input.current.trim();
  if (!input.leadId) {
    if (!submitted) return { ok: true as const, stage: null };
    return { ok: false as const, message: "No linked lead." };
  }
  if (!submitted) {
    if (!current) return { ok: true as const, stage: null };
    return { ok: false as const, message: "Choose a lead stage." };
  }
  if (submitted === current) return { ok: true as const, stage: null };
  if (!(PIPELINE_STAGES as readonly string[]).includes(submitted)) {
    return { ok: false as const, message: "That stage is not on this pipeline." };
  }
  return { ok: true as const, stage: submitted };
}

export function sameTags(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function consentByChannel(consents: readonly InboxConsent[]): ContactPanelChannel[] {
  return CONTACT_PANEL_CHANNELS.map((channel) => {
    const rows = consents.filter((row) => row.channel === channel);
    if (!rows.length) return { channel, label: CHANNEL_LABEL[channel], known: false, lines: [] };
    return {
      channel,
      label: CHANNEL_LABEL[channel],
      known: true,
      lines: rows.map((row) => {
        const status = row.status.trim();
        return {
          purpose: row.purpose.trim() || "Unknown",
          status,
          statusLabel: consentStatusLabel(status),
        };
      }),
    };
  });
}

function contactAddress(contact: InboxContact | null, channel: string): { kind: "phone" | "email" | "none"; value: string } {
  if (!contact) return { kind: "none", value: "" };
  const email = contact.email.trim();
  const phone = contact.phone.trim() || contact.whatsapp.trim();
  if (channel === "email") {
    if (email) return { kind: "email", value: email };
    if (phone) return { kind: "phone", value: phone };
    return { kind: "none", value: "" };
  }
  if (phone) return { kind: "phone", value: phone };
  if (email) return { kind: "email", value: email };
  return { kind: "none", value: "" };
}

function cleanTags(tags: readonly string[]) {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const next = String(tag).trim().replace(/\s+/g, " ");
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(next);
  }
  return cleaned;
}

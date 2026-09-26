import { AGENCY_DECK_COLORS } from "@/lib/brand/catalog";
import { emptyChannels, emptyShopify, type ChannelPlaceholders, type MembershipRole, type OrgType, type ShopifyCredentials, type WorkspaceSettings, type WorkspaceSummary } from "./types";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string | null;
  org_type: string;
  parent_id: string | null;
  legal_name: string | null;
  location: string | null;
  industry: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  domain: string | null;
  form_key: string | null;
  settings: unknown;
  sending_enabled?: boolean | null;
  sender_name?: string | null;
  timezone?: string | null;
  currency?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parseSettings(value: unknown): WorkspaceSettings {
  const root = asRecord(value);
  const channels = asRecord(root.channels);
  const whatsapp = asRecord(channels.whatsapp);
  const email = asRecord(channels.email);
  const sms = asRecord(channels.sms);
  const empty = emptyChannels();
  const shopify = asRecord(root.shopify);
  const blankShopify = emptyShopify();
  const parsed: ChannelPlaceholders = {
    whatsapp: {
      phoneNumberId: text(whatsapp.phoneNumberId) || empty.whatsapp.phoneNumberId,
      displayPhone: text(whatsapp.displayPhone) || empty.whatsapp.displayPhone,
    },
    email: {
      fromAddress: text(email.fromAddress) || empty.email.fromAddress,
      provider: text(email.provider) || empty.email.provider,
    },
    sms: {
      senderId: text(sms.senderId) || empty.sms.senderId,
    },
  };
  const credentials: ShopifyCredentials = {
    adminAccessToken: text(shopify.adminAccessToken),
    webhookSecret: text(shopify.webhookSecret),
    apiVersion: text(shopify.apiVersion) || blankShopify.apiVersion,
  };
  return { channels: parsed, shopify: credentials };
}

export function toWorkspace(row: OrganizationRow): WorkspaceSummary | null {
  if (!row.slug) return null;
  const orgType: OrgType = row.org_type === "agency" ? "agency" : "client";
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    orgType,
    parentId: row.parent_id,
    legalName: row.legal_name ?? "",
    location: row.location ?? "",
    industry: row.industry ?? "",
    logoUrl: row.logo_url ?? "",
    primaryColor: row.primary_color || AGENCY_DECK_COLORS.navy,
    accentColor: row.accent_color || AGENCY_DECK_COLORS.blue,
    domain: row.domain ?? "",
    formKey: row.form_key || row.slug,
    settings: parseSettings(row.settings),
    sendingEnabled: Boolean(row.sending_enabled),
    senderName: row.sender_name || row.name,
    timezone: row.timezone || "Africa/Johannesburg",
    currency: row.currency || "ZAR",
  };
}

export function isMembershipRole(value: string): value is MembershipRole {
  return value === "agency_owner" || value === "agency_staff" || value === "client_admin" || value === "client_user";
}

export function missingOrgColumn(error: { message: string } | null | undefined) {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return message.includes("org_id") && (message.includes("column") || message.includes("schema cache") || message.includes("does not exist"));
}

export function missingTenantTable(error: { message: string } | null | undefined) {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("organizations") ||
    message.includes("memberships") ||
    message.includes("workspace_")
  ) && (message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find"));
}

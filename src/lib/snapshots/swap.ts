import type { EnvLike } from "@/lib/automation/channels";

export const WORKSPACE_TEMPLATES_FLAG = "WORKSPACE_TEMPLATES_ENABLED";

export const FIXTURE_DUPLICATE_COPY =
  "Fixture only. WORKSPACE_TEMPLATES_ENABLED is not the string true, so nothing is created. Sending stays off. Nothing is charged.";

export const BUSINESS_TOKEN_KEYS = [
  "name",
  "slug",
  "primary_colour",
  "accent_colour",
  "logo_url",
  "phone",
  "email",
  "address",
  "hours",
  "booking_url",
  "services_text",
] as const;

export type BusinessTokenKey = (typeof BUSINESS_TOKEN_KEYS)[number];

export type SwapService = {
  name: string;
  price_label: string;
};

export type BusinessSwap = {
  name: string;
  slug: string;
  primary_colour: string;
  accent_colour: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  booking_url: string;
  services_text: string;
  services: SwapService[];
};

const SECRET = /(sk_live_|whsec_|api[_-]?key\s*[:=]|bearer\s+[a-z0-9]|secret\s*[:=])/i;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function workspaceTemplatesEnabled(env: EnvLike = process.env) {
  return String(env[WORKSPACE_TEMPLATES_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function workspaceTemplatesMode(input: { tenantMode: string; env?: EnvLike; forceFixture?: boolean }) {
  if (input.forceFixture || input.tenantMode !== "member" || !workspaceTemplatesEnabled(input.env)) return "fixture" as const;
  return "sandbox" as const;
}

export function slugifyBusiness(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function servicesText(services: SwapService[]) {
  return services
    .map((item) => `${item.name} ${item.price_label}`.trim())
    .filter(Boolean)
    .join("; ");
}

export function parseServices(raw: string): SwapService[] {
  const rows: SwapService[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, price] = trimmed.split("|");
    rows.push({
      name: (name ?? "").trim().slice(0, 60),
      price_label: (price ?? "").trim().slice(0, 20),
    });
  }
  return rows.slice(0, 24);
}

export function duplicateIdempotencyKey(sourceKind: string, sourceId: string, slug: string) {
  return `dup:${sourceKind}:${sourceId}:${slug}`.slice(0, 120);
}

function readServices(payload: unknown): SwapService[] {
  if (!payload || typeof payload !== "object") return [];
  const website = (payload as { website?: { services?: unknown } }).website;
  if (!website || !Array.isArray(website.services)) return [];
  return website.services.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { name?: unknown; price_label?: unknown };
    const name = String(row.name ?? "").trim();
    if (!name) return [];
    return [{ name, price_label: String(row.price_label ?? "").trim() }];
  });
}

export function emptySwap(name = ""): BusinessSwap {
  return {
    name,
    slug: slugifyBusiness(name),
    primary_colour: "#0B1F3A",
    accent_colour: "#2563EB",
    logo_url: "",
    phone: "",
    email: "",
    address: "",
    hours: "",
    booking_url: "",
    services_text: "",
    services: [],
  };
}

export function normalizeSwap(raw: Partial<BusinessSwap> & { name: string }, payload?: unknown): BusinessSwap {
  const name = raw.name.trim().slice(0, 80);
  const slug = slugifyBusiness(raw.slug?.trim() || name);
  const services = (raw.services ?? []).slice(0, 24).map((item) => ({
    name: item.name.trim().slice(0, 60),
    price_label: item.price_label.trim().slice(0, 20),
  }));
  const menu = services.length ? services : readServices(payload);
  const services_text = (raw.services_text ?? "").trim() || servicesText(menu);
  return {
    name,
    slug,
    primary_colour: HEX.test(raw.primary_colour ?? "") ? (raw.primary_colour as string) : "#0B1F3A",
    accent_colour: HEX.test(raw.accent_colour ?? "") ? (raw.accent_colour as string) : "#2563EB",
    logo_url: (raw.logo_url ?? "").trim().slice(0, 300),
    phone: (raw.phone ?? "").trim().slice(0, 24),
    email: (raw.email ?? "").trim().slice(0, 120),
    address: (raw.address ?? "").trim().slice(0, 200),
    hours: (raw.hours ?? "").trim().slice(0, 120),
    booking_url: (raw.booking_url ?? "").trim().slice(0, 200),
    services_text: services_text.slice(0, 800),
    services,
  };
}

export function validateSwap(swap: BusinessSwap): string[] {
  const issues: string[] = [];
  if (swap.name.trim().length < 2) issues.push("Give the business a name.");
  if (!swap.slug || swap.slug.length < 2) issues.push("Give the workspace a slug.");
  if (swap.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(swap.email)) issues.push("The email address is not usable.");
  if (swap.phone && !/^[0-9+().\-\s]{6,24}$/.test(swap.phone)) issues.push("The phone number is not usable.");
  if (swap.logo_url && !/^https?:\/\//i.test(swap.logo_url)) issues.push("The logo URL must start with http:// or https://.");
  if (swap.booking_url && !/^https?:\/\//i.test(swap.booking_url) && !swap.booking_url.startsWith("/book/")) {
    issues.push("The booking URL must start with http://, https://, or /book/.");
  }
  const blob = JSON.stringify(swap);
  if (SECRET.test(blob)) issues.push("That value looks like a key. Leave it out.");
  if (/javascript:|data:/i.test(blob)) issues.push("That URL is not allowed.");
  return issues;
}

function replaceTokens(value: string, swap: BusinessSwap) {
  let next = value;
  for (const key of BUSINESS_TOKEN_KEYS) {
    next = next.split(`{{business.${key}}}`).join(swap[key] ?? "");
  }
  return next;
}

function walkSwap(value: unknown, swap: BusinessSwap): unknown {
  if (typeof value === "string") return replaceTokens(value, swap);
  if (Array.isArray(value)) return value.map((item) => walkSwap(item, swap));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      next[key] = walkSwap(child, swap);
    }
    return next;
  }
  return value;
}

function forceDrafts(payload: Record<string, unknown>) {
  if (Array.isArray(payload.message_templates)) {
    payload.message_templates = payload.message_templates.map((item) =>
      item && typeof item === "object" ? { ...item, active: false } : item,
    );
  }
  if (Array.isArray(payload.sequences)) {
    payload.sequences = payload.sequences.map((item) =>
      item && typeof item === "object" ? { ...item, active: false } : item,
    );
  }
  if (Array.isArray(payload.workflows)) {
    payload.workflows = payload.workflows.map((item) =>
      item && typeof item === "object" ? { ...item, active: false } : item,
    );
  }
  if (payload.ai_reply && typeof payload.ai_reply === "object") {
    payload.ai_reply = {
      ...(payload.ai_reply as Record<string, unknown>),
      enabled: false,
      mode: "draft_only",
      require_human_before_send: true,
    };
  }
  if (payload.agent_team && typeof payload.agent_team === "object") {
    payload.agent_team = {
      ...(payload.agent_team as Record<string, unknown>),
      sandbox: true,
      charged: false,
    };
  }
}

export function applyBusinessSwap<T>(payload: T, raw: Partial<BusinessSwap> & { name: string }): T {
  const swap = normalizeSwap(raw, payload);
  const cloned = walkSwap(structuredClone(payload), swap) as Record<string, unknown>;
  if (cloned.website && typeof cloned.website === "object") {
    const site = { ...(cloned.website as Record<string, unknown>) };
    site.business_name = swap.name;
    site.colours = { primary: swap.primary_colour, accent: swap.accent_colour };
    site.logo_url = swap.logo_url;
    site.phone = swap.phone;
    site.email = swap.email;
    site.address = swap.address;
    site.hours = swap.hours;
    site.booking_url = swap.booking_url;
    if (swap.services.length) site.services = swap.services;
    cloned.website = site;
  }
  forceDrafts(cloned);
  return cloned as T;
}

export function leftoverBusinessTokens(value: unknown) {
  return JSON.stringify(value).includes("{{business.");
}

export type DuplicatePreviewCard = {
  businessName: string;
  slug: string;
  primary: string;
  accent: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  bookingUrl: string;
  services: SwapService[];
  stages: string[];
  workflows: { name: string; active: boolean }[];
  templateExcerpt: string;
  agents: string[];
  aiMode: string;
};

export function previewCard(payload: unknown, slug: string): DuplicatePreviewCard {
  const doc = (payload ?? {}) as {
    website?: Partial<BusinessSwap> & { colours?: { primary?: string; accent?: string }; services?: SwapService[]; business_name?: string; booking_url?: string };
    pipelines?: { stages?: { name?: string }[] }[];
    workflows?: { name?: string; active?: boolean }[];
    message_templates?: { body?: string; active?: boolean }[];
    agent_team?: { agents?: string[] };
    ai_reply?: { mode?: string; enabled?: boolean };
  };
  const site = doc.website ?? {};
  return {
    businessName: String(site.business_name ?? ""),
    slug,
    primary: String(site.colours?.primary ?? "#0B1F3A"),
    accent: String(site.colours?.accent ?? "#2563EB"),
    phone: String(site.phone ?? ""),
    email: String(site.email ?? ""),
    address: String(site.address ?? ""),
    hours: String(site.hours ?? ""),
    bookingUrl: String(site.booking_url ?? ""),
    services: Array.isArray(site.services) ? site.services : [],
    stages: (doc.pipelines?.[0]?.stages ?? []).map((stage) => String(stage.name ?? "")),
    workflows: (doc.workflows ?? []).map((item) => ({ name: String(item.name ?? ""), active: Boolean(item.active) })),
    templateExcerpt: String(doc.message_templates?.[0]?.body ?? "").slice(0, 180),
    agents: doc.agent_team?.agents ?? [],
    aiMode: doc.ai_reply?.enabled ? String(doc.ai_reply.mode ?? "draft_only") : "off",
  };
}

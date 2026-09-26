import { NextResponse } from "next/server";
import { z } from "zod";
import { nid } from "@/lib/crm-store";
import { recordConsent } from "@/server/webhooks/compliance";
import { insertForOrg, lookupRow, serviceConfigured } from "@/server/workers/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-workspace public intake. POST /api/public/intake/{formKey}
 * AI AutoTech's existing /api/public/audit route is unchanged and still lands
 * in the agency workspace. Each client workspace has its own form_key.
 */

const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const rateHits = new Map<string, number[]>();

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()).optional().or(z.literal("")),
  phone: z.string().trim().max(40).default(""),
  company: z.string().trim().max(160).default(""),
  message: z.string().trim().max(4000).default(""),
  consent: z.boolean().optional(),
  hp: z.string().max(200).optional(),
});

const CONSENT_TEXT = "I agree that this workspace may contact me about this enquiry, and I can opt out later.";

async function workspaceForKey(formKey: string) {
  const found = await lookupRow("organizations", "form_key", formKey, "id, slug, domain, form_key, name, sender_name");
  if (!found.configured || found.error || !found.data) return null;
  const row = found.data as unknown as { id: string; slug: string; domain: string | null; form_key: string | null; name: string; sender_name?: string };
  return {
    id: String(row.id),
    slug: String(row.slug),
    domain: row.domain ?? "",
    formKey: row.form_key || row.slug,
    name: row.name,
  };
}

function originAllowed(origin: string | null, domain: string, host: string | null) {
  if (!origin) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  const names = new Set(["aiautotech.co.za", "www.aiautotech.co.za", "ai-autotech-crm.vercel.app"]);
  if (domain) {
    names.add(domain);
    names.add(`www.${domain}`);
  }
  return names.has(url.hostname);
}

function corsHeaders(origin: string | null, domain: string, host: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin && originAllowed(origin, domain, host)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function rateLimited(ip: string) {
  const now = Date.now();
  const hits = (rateHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rateHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateHits.set(ip, hits);
  return false;
}

export async function OPTIONS(request: Request, context: { params: Promise<{ formKey: string }> }) {
  const { formKey } = await context.params;
  const org = await workspaceForKey(formKey);
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, org?.domain ?? "", request.headers.get("host")) });
}

export async function POST(request: Request, context: { params: Promise<{ formKey: string }> }) {
  const { formKey } = await context.params;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const org = serviceConfigured() ? await workspaceForKey(formKey) : null;
  const headers = corsHeaders(origin, org?.domain ?? "", host);
  const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers });

  if (origin && !originAllowed(origin, org?.domain ?? "", host)) {
    return json({ ok: false, error: "Origin not allowed." }, 403);
  }
  if (!serviceConfigured()) return json({ ok: false, error: "Lead storage is not configured." }, 500);
  if (!org) {
    return json({ ok: false, error: "Unknown workspace form key." }, 404);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "Payload too large." }, 413);

  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`${formKey}:${ip}`)) {
    return json({ ok: false, error: "Too many submissions. Please try again later." }, 429);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "JSON body required." }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." }, 400);
  }
  if (parsed.data.hp?.trim()) return json({ ok: true, id: null }, 200);
  if (!parsed.data.email && !parsed.data.phone) {
    return json({ ok: false, error: "Add an email or a phone number." }, 400);
  }

  const crmLeadId = nid();
  const saved = await insertForOrg(org.id, "crm_contact_leads", {
    status: "new",
    source: `intake:${org.formKey}`,
    name: parsed.data.name,
    email: parsed.data.email || "",
    phone: parsed.data.phone,
    company: parsed.data.company,
    message: parsed.data.message,
    page: `/intake/${org.formKey}`,
    crm_lead_id: crmLeadId,
  });
  if (saved.error || !saved.data) {
    return json({ ok: false, error: "Could not save this enquiry." }, 500);
  }

  await insertForOrg(org.id, "crm_leads", {
    id: crmLeadId,
    name: parsed.data.name,
    company: parsed.data.company,
    phone: parsed.data.phone,
    stage: "New",
    notes: [`Workspace intake ${org.formKey}`, parsed.data.email, parsed.data.message].filter(Boolean).join("\n"),
    ord: -Math.floor(Date.now() / 1000),
  });

  if (parsed.data.consent && (parsed.data.email || parsed.data.phone)) {
    const address = parsed.data.email || parsed.data.phone;
    await recordConsent({
      orgId: org.id,
      channel: parsed.data.email ? "email" : "sms",
      purpose: "service",
      status: "opted_in",
      basis: "consent",
      address,
      source: `/intake/${org.formKey}`,
      evidence: { consent_text: CONSENT_TEXT },
    });
  }

  return json({ ok: true, id: saved.data.id, workspace: org.slug }, 200);
}

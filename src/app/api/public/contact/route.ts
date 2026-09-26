import { NextResponse } from "next/server";
import { z } from "zod";
import { marketingConsentText, serviceConsentText } from "@/lib/compliance/consent-copy";
import { enrollLead } from "@/lib/automation/service";
import { recordConsent } from "@/server/webhooks/compliance";
import { nid } from "@/lib/crm-store";
import { agencyOrgId, insertForOrg, serviceConfigured } from "@/server/workers/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint for the aiautotech.co.za contact form.
 * No shared secret (static JS is public). Protected by: CORS allow-list, payload size limit,
 * zod validation, honeypot (_honey / hp), optional minimum fill time, per-IP rate limit.
 * Writes crm_contact_leads (source of truth) and mirrors real leads into crm_leads for the CRM UI.
 */

const ALLOWED_ORIGINS = new Set([
  "https://aiautotech.co.za",
  "https://www.aiautotech.co.za",
  "https://aiautotech-redesign-preview.vercel.app",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const MAX_BODY_BYTES = 16 * 1024;
const MIN_FILL_MS = 3_000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const rateHits = new Map<string, number[]>();

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
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
  if (rateHits.size > 5000) {
    for (const [key, times] of rateHits) {
      if (!times.some((t) => now - t < RATE_WINDOW_MS)) rateHits.delete(key);
    }
  }
  return false;
}

const opt = (max: number) => z.string().trim().max(max).optional().default("");

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100),
  email: z.string().trim().toLowerCase().max(160).pipe(z.email("Please enter a valid email address.")),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^[+\d][\d\s()-]{6,29}$/.test(v), "Please enter a valid phone number.")
    .optional()
    .default(""),
  company: opt(120),
  business: opt(120),
  message: z.string().trim().min(1, "Please enter a message.").max(3000),
  page: opt(300),
  utm_source: opt(120),
  utm_medium: opt(120),
  utm_campaign: opt(120),
  utm_term: opt(120),
  utm_content: opt(120),
  referrer: opt(400),
  elapsedMs: z.coerce.number().int().min(0).max(7 * 24 * 60 * 60 * 1000).optional(),
  _honey: z.string().max(200).optional(),
  hp: z.string().max(200).optional(),
  consentService: z.union([z.boolean(), z.string()]).optional(),
  consentMarketing: z.union([z.boolean(), z.string()]).optional(),
});

/** QA submissions (name starts with TEST and an @aiautotech.co.za address) are stored as status='test'
 * and never mirrored into crm_leads, so they never appear as real leads or trigger alerts. */
function isTestSubmission(name: string, email: string) {
  return /^test\b/i.test(name) && email.endsWith("@aiautotech.co.za");
}

async function readBody(request: Request, raw: string): Promise<Record<string, unknown> | null> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  if (type.includes("multipart/form-data")) {
    try {
      const form = await new Response(raw, { headers: { "content-type": type } }).formData();
      const out: Record<string, unknown> = {};
      form.forEach((value, key) => {
        if (typeof value === "string") out[key] = value;
      });
      return out;
    } catch {
      return null;
    }
  }
  return null;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, error: "Origin not allowed." }, 403, origin);
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, error: "Origin not allowed." }, 403, origin);
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Payload too large." }, 413, origin);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Payload too large." }, 413, origin);
  }

  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (rateLimited(ip)) {
    return json({ ok: false, error: "Too many messages. Please try again later or WhatsApp us." }, 429, origin);
  }

  const body = await readBody(request, raw);
  if (!body) {
    return json({ ok: false, error: "JSON or form body required." }, 400, origin);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json({ ok: false, error: first?.message || "Please check your details." }, 400, origin);
  }
  const input = parsed.data;

  // Bots: honeypot filled or impossibly fast. Pretend success, store nothing.
  if ((input._honey && input._honey.trim()) || (input.hp && input.hp.trim()) ||
      (input.elapsedMs !== undefined && input.elapsedMs < MIN_FILL_MS)) {
    return json({ ok: true, id: null }, 200, origin);
  }

  if (!serviceConfigured()) {
    return json({ ok: false, error: "Lead storage is not configured." }, 500, origin);
  }

  const company = input.company || input.business;
  const test = isTestSubmission(input.name, input.email);
  const crmLeadId = test ? null : nid();

  const orgId = await agencyOrgId();
  const { data, error } = await insertForOrg(orgId, "crm_contact_leads", {
    status: test ? "test" : "new",
    source: "website_contact",
    name: input.name,
    email: input.email,
    phone: input.phone,
    company,
    message: input.message,
    page: input.page,
    utm_source: input.utm_source,
    utm_medium: input.utm_medium,
    utm_campaign: input.utm_campaign,
    utm_term: input.utm_term,
    utm_content: input.utm_content,
    referrer: input.referrer,
    user_agent: (request.headers.get("user-agent") ?? "").slice(0, 400),
    crm_lead_id: crmLeadId,
  });

  if (error || !data) {
    console.error("contact insert failed", error?.message);
    return json({ ok: false, error: "Could not send your message. Please try again or WhatsApp us." }, 500, origin);
  }

  if (crmLeadId) {
    const utm = [input.utm_source, input.utm_medium, input.utm_campaign].filter(Boolean).join(" / ");
    const notes = [
      "Website contact form",
      `Email: ${input.email}`,
      `Message: ${input.message.slice(0, 1500)}`,
      `Source: website_contact${utm ? ` · UTM: ${utm}` : ""}${input.page ? ` · Page: ${input.page}` : ""}`,
    ].join("\n");

    const lead = await insertForOrg(orgId, "crm_leads", {
      id: crmLeadId,
      name: input.name,
      company,
      phone: input.phone,
      stage: "New",
      notes,
      ord: -Math.floor(Date.now() / 1000),
    });
    if (lead.error) {
      // Contact row is saved; CRM mirror failure should not lose the lead.
      console.error("crm_leads mirror failed", lead.error.message);
    }

    const enrolled = await enrollLead({
      id: crmLeadId,
      name: input.name,
      company,
      phone: input.phone,
      email: input.email,
      notes,
      source: "website_contact",
      utmSource: input.utm_source,
      campaign: input.utm_campaign,
      contactLeadId: data.id,
    });
    if (!enrolled.ok) {
      console.error("contact automation skipped", enrolled.error);
    }
  }

  if (orgId) {
    const sender = "AI AutoTech Pty Ltd";
    const evidence = { user_agent: (request.headers.get("user-agent") ?? "").slice(0, 400), form_version: "2b" };
    if (flagOn(input.consentService)) {
      await recordConsent({
        orgId,
        channel: "email",
        purpose: "service",
        status: "opted_in",
        basis: "consent",
        address: input.email,
        source: "website_contact",
        evidence: { ...evidence, consent_text: serviceConsentText(sender) },
      });
    }
    if (flagOn(input.consentMarketing)) {
      await recordConsent({
        orgId,
        channel: "email",
        purpose: "marketing",
        status: "opted_in",
        basis: "consent",
        address: input.email,
        source: "website_contact",
        evidence: { ...evidence, consent_text: marketingConsentText(sender) },
      });
    }
  }

  return json({ ok: true, id: data.id }, 200, origin);
}

function flagOn(value: boolean | string | undefined) {
  return value === true || value === "on" || value === "true";
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enrollLead } from "@/lib/automation/service";
import { nid } from "@/lib/crm-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint for the event QR funnel (aiautotech.co.za/connect -> /audit).
 * No shared secret (static JS is public). Protected by: CORS allow-list, payload
 * size limit, zod validation, honeypot, minimum fill time, consent, per-IP rate limit.
 */

const ALLOWED_ORIGINS = new Set([
  "https://aiautotech.co.za",
  "https://www.aiautotech.co.za",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const MAX_BODY_BYTES = 64 * 1024;
const MIN_FILL_MS = 15_000;
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

const str = (max: number) => z.string().trim().max(max).default("");
const answerValue = z.union([
  z.string().max(600),
  z.array(z.string().max(120)).max(30),
  z.number(),
  z.boolean(),
]);

const recommendation = z
  .object({
    agent: z.string().max(80),
    department: z.string().max(60).optional(),
    priority: z.number().int().min(1).max(3).optional(),
    score: z.number().optional(),
    problem: z.string().max(600).optional(),
    solution: z.string().max(600).optional(),
    how: z.string().max(600).optional(),
    benefit: z.string().max(600).optional(),
    hours: z.string().max(200).optional(),
    hoursAssumption: z.string().max(600).optional(),
    revenue: z.string().max(400).optional(),
  })
  .passthrough();

const schema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  company: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d][\d\s()-]{6,29}$/, "Invalid phone number"),
  role: str(80),
  website: str(200),
  industry: str(80),
  answers: z.record(z.string().max(60), answerValue).refine((v) => Object.keys(v).length <= 120),
  score: z.record(z.string().max(60), z.union([z.number(), z.string().max(200)])).default({}),
  recommendations: z.array(recommendation).max(14).default([]),
  recommendedAgents: z
    .array(z.object({ department: z.string().max(60), agent: z.string().max(80), count: z.number().int().min(1).max(10) }))
    .max(20)
    .default([]),
  consent: z.literal(true),
  consentText: z.string().trim().min(10).max(600),
  tracking: z
    .object({
      source: str(80),
      campaign: str(80),
      event: str(80),
      qr_source: str(80),
      utm_source: str(120),
      utm_medium: str(120),
      utm_campaign: str(120),
      utm_term: str(120),
      utm_content: str(120),
      referrer: str(400),
    })
    .partial()
    .default({}),
  elapsedMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  hp: z.string().max(200).optional(),
});

function makeReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `AAT-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
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
    return json({ ok: false, error: "Too many submissions. Please try again later or WhatsApp us." }, 429, origin);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "JSON body required." }, 400, origin);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json(
      { ok: false, error: `Please check ${first?.path.join(".") || "your details"}: ${first?.message ?? "invalid"}` },
      400,
      origin,
    );
  }
  const input = parsed.data;

  // Bots: honeypot filled or impossibly fast. Pretend success, store nothing.
  if ((input.hp && input.hp.trim()) || input.elapsedMs < MIN_FILL_MS) {
    return json({ ok: true, id: null, reference: makeReference() }, 200, origin);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return json({ ok: false, error: "Lead storage is not configured." }, 500, origin);
  }

  const t = input.tracking;
  const reference = makeReference();
  const crmLeadId = nid();
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 400);

  const { data, error } = await supabase
    .from("crm_audit_leads")
    .insert({
      reference,
      first_name: input.firstName,
      last_name: input.lastName,
      company: input.company,
      email: input.email,
      phone: input.phone,
      whatsapp: input.phone,
      role: input.role,
      website: input.website,
      industry: input.industry,
      answers: input.answers,
      score: input.score,
      recommendations: input.recommendations,
      recommended_agents: input.recommendedAgents,
      source: t.source ?? "",
      campaign: t.campaign ?? "",
      event: t.event ?? "",
      qr_source: t.qr_source ?? "",
      utm_source: t.utm_source ?? "",
      utm_medium: t.utm_medium ?? "",
      utm_campaign: t.utm_campaign ?? "",
      utm_term: t.utm_term ?? "",
      utm_content: t.utm_content ?? "",
      referrer: t.referrer ?? "",
      user_agent: userAgent,
      consent: true,
      consent_text: input.consentText,
      crm_lead_id: crmLeadId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("audit insert failed", error?.message);
    return json({ ok: false, error: "Could not save your audit. Please try again." }, 500, origin);
  }

  const top = input.recommendations
    .slice(0, 3)
    .map((r) => r.agent)
    .join(", ");
  const notes = [
    `AI Business Audit ${reference}${t.event ? ` · event: ${t.event}` : ""}${t.campaign ? ` · campaign: ${t.campaign}` : ""}`,
    `Email: ${input.email}`,
    input.role ? `Role: ${input.role}` : "",
    input.industry ? `Industry: ${input.industry}` : "",
    input.website ? `Website: ${input.website}` : "",
    top ? `Top AI opportunities: ${top}` : "",
    `Source: ${[t.source, t.qr_source, t.utm_source, t.utm_medium].filter(Boolean).join(" / ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lead = await supabase.from("crm_leads").insert({
    id: crmLeadId,
    name: `${input.firstName} ${input.lastName}`.trim(),
    company: input.company,
    phone: input.phone,
    stage: "New",
    notes,
    ord: -Math.floor(Date.now() / 1000),
  });
  if (lead.error) {
    // Audit row is saved; CRM mirror failure should not lose the lead.
    console.error("crm_leads mirror failed", lead.error.message);
  }

  const enrolled = await enrollLead({
    id: crmLeadId,
    name: `${input.firstName} ${input.lastName}`.trim(),
    company: input.company,
    phone: input.phone,
    email: input.email,
    notes,
    source: t.source ?? "",
    qrSource: t.qr_source ?? "",
    campaign: t.campaign || t.utm_campaign || "",
    utmSource: t.utm_source ?? "",
    eventName: t.event ?? "",
    website: input.website,
    industry: input.industry,
    answers: input.answers,
    recommendations: input.recommendations,
    auditLeadId: data.id,
  });
  if (!enrolled.ok) {
    console.error("audit automation skipped", enrolled.error);
  }

  return json({ ok: true, id: data.id, reference }, 200, origin);
}

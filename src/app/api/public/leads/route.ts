import { NextResponse } from "next/server";
import { createPublicLead } from "@/lib/crm-store";

const ALLOWED_ORIGINS = new Set([
  "https://aiautotech.co.za",
  "https://www.aiautotech.co.za",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-form-secret",
    Vary: "Origin",
  };
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "JSON body required." }, 400, origin);
  }

  const secret = process.env.CRM_FORM_SECRET;
  if (secret) {
    const provided =
      request.headers.get("x-form-secret") ||
      (typeof body.formSecret === "string" ? body.formSecret : "");
    if (provided !== secret) {
      return json({ ok: false, error: "Unauthorized." }, 401, origin);
    }
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const company = String(body.company ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name && !phone && !message) {
    return json({ ok: false, error: "name, phone, or message is required." }, 400, origin);
  }

  try {
    const id = await createPublicLead({ name, email, phone, company, message });
    return json({ ok: true, id }, 200, origin);
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save lead.",
      },
      500,
      origin,
    );
  }
}

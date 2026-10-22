import { createClient } from "@supabase/supabase-js";
import { authOnlyRealtime } from "@/lib/supabase/realtime";

const TOKEN = /^[a-f0-9]{64}$/;

export type StoredQuote = {
  id: string;
  packageCode: string;
  contactName: string;
  email: string;
  phone: string;
  company: string;
  amountCents: number;
  pricePlaceholder: boolean;
  status: string;
  acceptToken: string;
};

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: authOnlyRealtime,
  });
}

function mapQuote(row: Record<string, unknown>): StoredQuote | null {
  if (typeof row.id !== "string" || typeof row.accept_token !== "string") return null;
  return {
    id: row.id,
    packageCode: String(row.package_code ?? ""),
    contactName: String(row.contact_name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    company: String(row.company ?? ""),
    amountCents: Number(row.amount_cents ?? 0),
    pricePlaceholder: row.price_placeholder !== false,
    status: String(row.status ?? ""),
    acceptToken: row.accept_token,
  };
}

export async function readQuoteByToken(token: string) {
  if (!TOKEN.test(token)) return { configured: true as const, quote: null };
  const supabase = client();
  if (!supabase) return { configured: false as const, quote: null };
  const found = await supabase
    .from("service_quotes")
    .select("id, package_code, contact_name, email, phone, company, amount_cents, price_placeholder, status, accept_token")
    .eq("accept_token", token)
    .maybeSingle();
  if (found.error || !found.data) return { configured: true as const, quote: null };
  return { configured: true as const, quote: mapQuote(found.data as Record<string, unknown>) };
}

export async function markQuoteAccepted(token: string) {
  if (!TOKEN.test(token)) return false;
  const supabase = client();
  if (!supabase) return false;
  const saved = await supabase
    .from("service_quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("accept_token", token)
    .eq("status", "requested");
  return !saved.error;
}

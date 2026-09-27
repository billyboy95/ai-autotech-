/**
 * Session gate for the CRM.
 * Fixture mode (no Supabase keys, and not a Vercel preview/production deploy)
 * stays open so CI and local smoke tests can render sample data.
 * A configured Supabase project, and any Vercel preview or production deploy,
 * requires a session before command-centre, agency, or CRM API data is served.
 */

export function supabaseAuthConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function authGateEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (supabaseAuthConfigured(env)) return true;
  return env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "production";
}

const MARKETING = new Set([
  "/",
  "/about",
  "/services",
  "/contact",
  "/blog",
  "/software-development",
  "/crm-solutions",
  "/ai-agents",
  "/automation",
  "/case-studies",
]);

export function isCrmDataApi(pathname: string) {
  return (
    pathname === "/api/automation/summary" ||
    pathname.startsWith("/api/proposals/") ||
    pathname.startsWith("/api/invoices/") ||
    pathname.startsWith("/api/contacts/")
  );
}

export function isPublicPath(pathname: string) {
  if (MARKETING.has(pathname)) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/audit" || pathname.startsWith("/audit/")) return true;
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname === "/book" || pathname.startsWith("/book/")) return true;
  if (pathname === "/r" || pathname.startsWith("/r/")) return true;
  if (pathname === "/team" || pathname.startsWith("/team/")) return true;
  if (pathname.startsWith("/intake/") || pathname === "/intake") return true;
  if (pathname.startsWith("/invite/") || pathname === "/invite") return true;
  if (pathname === "/unsubscribe" || pathname.startsWith("/unsubscribe/")) return true;
  if (pathname === "/brand/clear" || pathname.startsWith("/d/")) return true;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  if (pathname.startsWith("/api/cron/") || pathname.startsWith("/api/webhooks/")) return true;
  if (pathname === "/api/automation/inbound" || pathname === "/api/billing/webhook" || pathname === "/api/shopify/webhook") {
    return true;
  }
  if (/\.[a-z0-9]+$/i.test(pathname)) return true;
  return false;
}

export function requiresSession(pathname: string) {
  if (isPublicPath(pathname)) return false;
  if (pathname === "/command-centre" || pathname.startsWith("/command-centre/")) return true;
  if (pathname === "/agency" || pathname.startsWith("/agency/")) return true;
  return isCrmDataApi(pathname);
}

export type GateDecision =
  | { type: "continue" }
  | { type: "redirect"; pathname: "/login"; next: string }
  | { type: "unauthorized" };

export function decideAccess(input: {
  pathname: string;
  search?: string;
  authRequired: boolean;
  userId: string | null;
}): GateDecision {
  if (!input.authRequired || !requiresSession(input.pathname)) return { type: "continue" };
  if (input.userId) return { type: "continue" };
  if (isCrmDataApi(input.pathname)) return { type: "unauthorized" };
  const search = input.search && input.search !== "?" ? input.search : "";
  const next = `${input.pathname}${search.startsWith("?") || search === "" ? search : `?${search}`}`;
  return { type: "redirect", pathname: "/login", next };
}

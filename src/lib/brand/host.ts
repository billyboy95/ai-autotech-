export const BRAND_HOST_COOKIE = "aat_brand_host";
export const BRAND_HOST_HEADER = "x-aat-host";

/** Reserved test hosts. They resolve without a purchased domain via /d/<host>/... */
export const TEST_BRAND_HOSTS: Record<string, string> = {
  "crm.eastc.test": "eastc",
  "crm.zentrix.test": "zentrix",
};

export function normalizeHost(value: string | null | undefined) {
  if (!value) return null;
  let host = value.trim().toLowerCase();
  if (!host) return null;
  if (host.includes("://")) {
    try {
      host = new URL(host).host;
    } catch {
      return null;
    }
  }
  host = host.split(",")[0]?.trim() ?? "";
  host = host.replace(/\.$/, "").replace(/:\d+$/, "");
  if (!host || host.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.startsWith(".") || host.includes("..")) return null;
  return host;
}

export function isPlatformHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    host === "aiautotech.co.za" ||
    host === "www.aiautotech.co.za"
  );
}

export function brandHostFrom(input: {
  header?: string | null;
  cookie?: string | null;
  forwardedHost?: string | null;
  host?: string | null;
}) {
  const stub = normalizeHost(input.header);
  if (stub) return stub;
  const forwarded = normalizeHost(input.forwardedHost);
  const host = normalizeHost(input.host);
  if (forwarded && !isPlatformHost(forwarded)) return forwarded;
  if (host && !isPlatformHost(host)) return host;
  return normalizeHost(input.cookie);
}

export function stubPath(pathname: string) {
  const match = pathname.match(/^\/d\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const host = normalizeHost(decodeURIComponent(match[1]));
  if (!host) return { host: null, pathname: "/login" };
  let rest = match[2] || "/login";
  if (!rest.startsWith("/") || rest.startsWith("//")) rest = "/login";
  return { host, pathname: rest };
}

const MARKETING_PATHS = new Set([
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

export function isMarketingPath(pathname: string) {
  return MARKETING_PATHS.has(pathname);
}

export function brandRedirectPath(pathname: string) {
  if (isMarketingPath(pathname)) return "/login";
  if (pathname === "/agency" || pathname.startsWith("/agency/")) return "/command-centre";
  return null;
}

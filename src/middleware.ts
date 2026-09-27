import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { BRAND_HOST_COOKIE, brandHostFrom, brandRedirectPath, isMarketingPath, stubPath } from "@/lib/brand/host";
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE_SECONDS, readReferralCode } from "@/lib/referrals/codes";
import { ORG_COOKIE, WORKSPACE_COOKIE } from "@/lib/tenant/types";

// The company CRM at /command-centre stays open for the agency workspace (owner path).
// Client workspaces are refused in the page when nobody is signed in.
// Middleware refreshes a Supabase session when keys exist, and remembers the workspace slug.
const UNLOCK_PATH = "/command-centre/unlock";

function rememberWorkspace(request: NextRequest, response: NextResponse) {
  const org = request.nextUrl.searchParams.get("org");
  if (org && /^[a-z0-9-]{1,64}$/.test(org)) {
    const options = { httpOnly: true, sameSite: "lax" as const, path: "/" };
    response.cookies.set(WORKSPACE_COOKIE, org, options);
    response.cookies.set(ORG_COOKIE, org, options);
  }
  return response;
}

function rememberReferral(request: NextRequest, response: NextResponse) {
  const code = readReferralCode(request.nextUrl.searchParams.get("ref"));
  if (!code) return response;
  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: REFERRAL_MAX_AGE_SECONDS,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

function stampWorkspace(request: NextRequest, response: NextResponse) {
  rememberWorkspace(request, response);
  rememberReferral(request, response);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/brand/clear") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const cleared = NextResponse.redirect(url);
    cleared.cookies.set(BRAND_HOST_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return cleared;
  }

  const stub = stubPath(pathname);
  if (stub) {
    const url = request.nextUrl.clone();
    url.pathname = stub.pathname;
    const redirected = NextResponse.redirect(url);
    if (stub.host) {
      redirected.cookies.set(BRAND_HOST_COOKIE, stub.host, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return rememberReferral(request, redirected);
  }

  const brandHost = brandHostFrom({
    header: request.headers.get("x-aat-host"),
    cookie: request.cookies.get(BRAND_HOST_COOKIE)?.value,
    forwardedHost: request.headers.get("x-forwarded-host"),
    host: request.headers.get("host"),
  });
  const brandedTarget = brandHost ? brandRedirectPath(pathname) : null;
  if (brandedTarget) {
    const url = request.nextUrl.clone();
    url.pathname = brandedTarget;
    return rememberReferral(request, NextResponse.redirect(url));
  }
  if (isMarketingPath(pathname)) return rememberReferral(request, NextResponse.next());

  if (pathname === UNLOCK_PATH || pathname.startsWith(`${UNLOCK_PATH}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = "/command-centre";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
    return redirect;
  }

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          stampWorkspace(request, response);
        },
      },
    });
    await supabase.auth.getUser();
  }

  stampWorkspace(request, response);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    "/command-centre",
    "/command-centre/:path*",
    "/agency",
    "/agency/:path*",
    "/login",
    "/intake/:path*",
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
    "/d/:path*",
    "/brand/clear",
    "/audit",
    "/signup",
    "/team/:path*",
  ],
};

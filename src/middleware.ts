import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authGateEnabled, decideAccess, supabaseAuthConfigured } from "@/lib/auth/gate";
import { authOnlyRealtime } from "@/lib/supabase/realtime";
import { BRAND_HOST_COOKIE, brandHostFrom, brandRedirectPath, isMarketingPath, stubPath } from "@/lib/brand/host";
import { AFFILIATE_COOKIE, AFFILIATE_MAX_AGE_SECONDS, readAffiliateCode } from "@/lib/commissions/calc";
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE_SECONDS, readReferralCode } from "@/lib/referrals/codes";
import { ORG_COOKIE, WORKSPACE_COOKIE } from "@/lib/tenant/types";

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

function rememberAffiliate(request: NextRequest, response: NextResponse) {
  const code = readAffiliateCode(request.nextUrl.searchParams.get("aff"));
  if (!code) return response;
  response.cookies.set(AFFILIATE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AFFILIATE_MAX_AGE_SECONDS,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

function stampWorkspace(request: NextRequest, response: NextResponse) {
  rememberWorkspace(request, response);
  rememberReferral(request, response);
  rememberAffiliate(request, response);
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
  let userId: string | null = null;
  if (supabaseAuthConfigured()) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      {
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
        realtime: authOnlyRealtime,
      },
    );
    try {
      const { data, error } = await supabase.auth.getUser();
      userId = error ? null : data.user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  const decision = decideAccess({
    pathname,
    search: request.nextUrl.search,
    authRequired: authGateEnabled(),
    userId,
  });
  if (decision.type === "unauthorized") {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  if (decision.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    url.search = "";
    url.searchParams.set("next", decision.next);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
    return rememberReferral(request, redirect);
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
    "/login/:path*",
    "/auth/:path*",
    "/api/automation/summary",
    "/api/proposals/:path*",
    "/api/invoices/:path*",
    "/api/contacts/:path*",
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
    "/api/public/audit",
  ],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
          rememberWorkspace(request, response);
        },
      },
    });
    await supabase.auth.getUser();
  }

  rememberWorkspace(request, response);
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
  ],
};

import { NextResponse, type NextRequest } from "next/server";

// The company CRM at /command-centre is intentionally open (no password gate, by owner's choice).
// Middleware only redirects the old unlock URL and keeps search engines out.
const UNLOCK_PATH = "/command-centre/unlock";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === UNLOCK_PATH || pathname.startsWith(`${UNLOCK_PATH}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = "/command-centre";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
    return redirect;
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/command-centre", "/command-centre/:path*"],
};

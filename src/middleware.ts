import { NextResponse, type NextRequest } from "next/server";
import { CRM_COOKIE, CRM_UNLOCK_PATH, isValidCrmCookie } from "@/lib/crm-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/command-centre")) {
    return NextResponse.next();
  }

  if (pathname === CRM_UNLOCK_PATH || pathname.startsWith(`${CRM_UNLOCK_PATH}/`)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(CRM_COOKIE)?.value;
  if (await isValidCrmCookie(token)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = CRM_UNLOCK_PATH;
  url.search = "";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/command-centre", "/command-centre/:path*"],
};

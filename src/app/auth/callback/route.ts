import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOwnerMembership } from "@/server/workers/owner-bootstrap";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email", "email_change"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createSupabaseServerClient();

  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchanged.error.message)}`, url.origin));
    }
  } else if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    const verified = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (verified.error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(verified.error.message)}`, url.origin));
    }
  } else {
    return NextResponse.redirect(new URL("/login?error=Missing+sign-in+code", url.origin));
  }

  const { data } = await supabase.auth.getUser();
  if (data.user) await ensureOwnerMembership({ id: data.user.id, email: data.user.email });
  return NextResponse.redirect(new URL(next, url.origin));
}

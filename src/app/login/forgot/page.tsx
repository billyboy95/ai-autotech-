import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/components/login-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeNextPath(params.next, "") : "";
  return (
    <AuthCard
      title="Forgot password"
      body="Enter the email on your Supabase Auth user. We will send a link to choose a new password. Nothing else is sent."
    >
      <ForgotPasswordForm next={next || undefined} />
      <p className="mt-4 text-sm text-slate-500">
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-[#2563EB]">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

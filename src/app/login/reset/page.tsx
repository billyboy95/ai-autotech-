import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      body="Use the link from your email so this page has a session, then save a new password. You will land in the command centre."
    >
      <ResetPasswordForm />
      <p className="mt-4 text-sm text-slate-500">
        <Link href="/login/forgot" className="font-semibold text-[#2563EB]">
          Send another reset link
        </Link>
      </p>
    </AuthCard>
  );
}

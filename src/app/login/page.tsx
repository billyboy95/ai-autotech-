import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to AI AutoTech.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <BrandLogo compact />
        </Link>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Sign in</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">
          Agency owners and client teams sign in with Supabase Auth. AI AutoTech staff land on the agency
          view. EASTC and other client users land in their own workspace. The open company CRM stays
          available at the agency workspace until you sign in.
        </p>
        <LoginForm next={next} />
        <p className="mt-4 text-sm text-slate-500">
          <Link href="/command-centre" className="font-semibold text-[#2563EB]">
            Open the agency CRM without signing in
          </Link>
        </p>
      </section>
    </main>
  );
}

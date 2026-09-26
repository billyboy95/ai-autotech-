import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvite } from "@/components/accept-invite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept invitation",
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Invitation</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Join this workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with the email address on the invitation, then accept. The link expires in 14 days.
        </p>
        <AcceptInvite token={token} />
        <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="mt-3 inline-block text-sm font-semibold text-[#2563EB]">
          Sign in first
        </Link>
      </section>
    </main>
  );
}

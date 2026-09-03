import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { UnlockForm } from "@/components/crm-unlock-form";

export const metadata: Metadata = {
  title: "Unlock CRM",
  description: "Unlock the AI AutoTech Pty Ltd company CRM.",
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <BrandLogo compact />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">CRM</p>
            <p className="text-sm font-semibold text-slate-700">AI AutoTech Pty Ltd</p>
          </div>
        </div>
        <h1 className="font-display text-xl font-bold text-[#0B1F3A]">Unlock</h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">Enter the CRM password.</p>
        <UnlockForm from={params.from ?? "/command-centre"} />
      </section>
    </main>
  );
}

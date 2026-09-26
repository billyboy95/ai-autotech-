import type { Metadata } from "next";
import { findOrgByFormKey } from "@/lib/tenant/data";
import { IntakeForm } from "@/components/intake-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enquiry",
  robots: { index: false, follow: false },
};

export default async function IntakePage({ params }: { params: Promise<{ formKey: string }> }) {
  const { formKey } = await params;
  const org = await findOrgByFormKey(formKey).catch(() => null);
  const known = formKey === "eastc" || formKey === "zentrix" || formKey === "ai-autotech";
  const name = org?.name ?? (formKey === "eastc" ? "EASTC" : formKey === "zentrix" ? "Zentrix Online" : formKey === "ai-autotech" ? "AI AutoTech" : "this workspace");
  const color = org?.primaryColor ?? (formKey === "eastc" ? "#0F3D4C" : formKey === "zentrix" ? "#111827" : "#0B1F3A");

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color }}>Enquiry</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">{name}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This form feeds only the {name} workspace.
        </p>
        {org || known ? (
          <IntakeForm formKey={org?.formKey ?? formKey} />
        ) : (
          <p className="mt-4 text-sm text-rose-700">This form key is not active yet.</p>
        )}
      </section>
    </main>
  );
}

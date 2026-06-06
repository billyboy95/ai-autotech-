import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LeadForm } from "@/components/lead-form";
import { publicPages } from "@/lib/platform-data";

export function PublicPageShell({
  title,
  description,
  items,
  sourcePage,
}: {
  title: string;
  description: string;
  items: string[];
  sourcePage: string;
}) {
  return (
    <main className="min-h-screen bg-[#F3F4F6]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo compact />
          </Link>
          <nav className="hidden gap-5 text-sm font-medium text-slate-600 lg:flex">
            {publicPages.slice(1, 6).map((page) => (
              <Link key={page.href} href={page.href} className="hover:text-[#2563EB]">
                {page.label}
              </Link>
            ))}
          </nav>
          <Link href="/#contact" className="flex h-10 items-center gap-2 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white">
            Book Call
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <h1 className="font-display text-4xl font-extrabold text-[#0B1F3A] md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_420px] lg:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{item}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Designed as a modular capability inside the AI AutoTech operating system and ready to connect with CRM, projects, reporting, and client portal workflows.
              </p>
            </article>
          ))}
        </div>
        <aside className="h-fit rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Start a discovery call</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">This form saves leads to Supabase when environment variables and schema are connected.</p>
          <div className="mt-5">
            <LeadForm sourcePage={sourcePage} />
          </div>
        </aside>
      </section>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";
import { loginCopy } from "@/lib/brand/present";
import { resolveRequestBrand } from "@/lib/brand/request";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveRequestBrand();
  const copy = loginCopy(brand);
  if (!copy.showPlatform) {
    return {
      title: { absolute: copy.title },
      description: copy.body,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: "Sign in",
    description: "Sign in to AI AutoTech.",
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;
  const brand = await resolveRequestBrand();
  const copy = loginCopy(brand);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4" data-testid="brand-login">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        {copy.showPlatform ? (
          <Link href="/" className="mb-6 flex items-center gap-3">
            <BrandLogo compact />
          </Link>
        ) : (
          <div className="mb-6" style={{ color: brand?.primaryColor }}>
            <BrandLogo compact name={brand?.productName} logoUrl={brand?.logoUrl} color={brand?.primaryColor} />
          </div>
        )}
        <h1 className="font-display text-2xl font-bold" style={{ color: brand?.primaryColor || "#0B1F3A" }}>{copy.title}</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">{copy.body}</p>
        <LoginForm next={next ?? (copy.showPlatform ? undefined : "/command-centre")} placeholder={copy.placeholder} />
        {copy.showPlatform ? (
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/command-centre" className="font-semibold text-[#2563EB]">
              Open the agency CRM without signing in
            </Link>
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/brand/clear" className="font-semibold text-slate-500">
              Exit branded preview
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}

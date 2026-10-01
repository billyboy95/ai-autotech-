import Link from "next/link";
import { INSTALL_PLATFORMS, STORE_LISTING_COPY } from "@/lib/pwa/install";

export function InstallSettingsCard() {
  return (
    <section id="pwa-install" data-testid="pwa-install-card" className="grid max-w-3xl gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Optional</p>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Install AIOS on your phone</h2>
        <p className="mt-1 text-sm text-slate-700">{STORE_LISTING_COPY}</p>
      </div>
      <ul className="grid gap-2 text-sm text-slate-700">
        {INSTALL_PLATFORMS.map((platform) => (
          <li key={platform.id}>
            <span className="font-semibold text-[#0B1F3A]">{platform.label}.</span> {platform.steps}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/command-centre/install" className="font-semibold text-[#2563EB]">
          Open install steps
        </Link>
      </p>
    </section>
  );
}

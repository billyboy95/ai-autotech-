import type { Metadata } from "next";
import { InstallIntentForm } from "@/components/pwa/install-form";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { FIXTURE_INSTALL_COPY, INSTALL_PLATFORMS, STORE_LISTING_COPY, pwaInstallDisplayMode } from "@/lib/pwa/install";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Install",
  robots: { index: false, follow: false },
};

export default async function InstallPage() {
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const mode = pwaInstallDisplayMode({ tenantMode: tenant.mode });

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <section id="pwa-install" data-testid="pwa-install" data-mode={mode} className="grid max-w-3xl gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Browser install</p>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Install AIOS on your phone</h1>
          <p className="mt-2 text-sm text-slate-700">{STORE_LISTING_COPY}</p>
        </div>
        <ol className="grid gap-3">
          {INSTALL_PLATFORMS.map((platform, index) => (
            <li key={platform.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step {index + 1}</p>
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{platform.label}</h2>
              <p className="mt-1 text-sm text-slate-700">{platform.steps}</p>
            </li>
          ))}
        </ol>
        {mode === "fixture" ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{FIXTURE_INSTALL_COPY}</p>
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            PWA_INSTALL_SHELL_ENABLED is the string true. A sandbox install intent can be stored after step 31 is applied. Nothing is sent.
          </p>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <InstallIntentForm mode={mode} orgSlug={tenant.active.slug} />
        </div>
        <p className="text-sm text-slate-600">sending_enabled stays false. This page does not call a store, an ad network, or an analytics vendor.</p>
      </section>
    </CommandShell>
  );
}

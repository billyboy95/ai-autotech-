"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { AIOS_SECTIONS } from "@/lib/aios-menu";
import type { WorkspaceOption } from "@/lib/tenant/types";

export type CommandChrome = {
  activeSlug: string;
  activeName: string;
  primaryColor: string;
  workspaces: WorkspaceOption[];
  signedIn: boolean;
  showAgencyLink: boolean;
  userEmail: string | null;
  note: string | null;
  agencyBanner: string | null;
  billingBanner: string | null;
  billingTone: "block" | "warn" | null;
  billingHref?: string | null;
  productName: string;
  logoUrl: string;
  showPlatformName: boolean;
};

const sections = AIOS_SECTIONS;

const navLink = "inline-flex h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

function linkActive(pathname: string, href: string) {
  if (href === "/command-centre" || href === "/command-centre/agents") return pathname === href;
  if (href === "/command-centre/bots") {
    return pathname === href || (pathname.startsWith(`${href}/`) && !pathname.startsWith("/command-centre/bots/agency"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CrmFrame({
  children,
  setupError,
  sendingEnabled = false,
  inboxUnread = 0,
  alertUnread = 0,
  alertsFixture = false,
  chrome,
}: {
  children: ReactNode;
  setupError?: string | null;
  sendingEnabled?: boolean;
  inboxUnread?: number;
  alertUnread?: number;
  alertsFixture?: boolean;
  chrome?: CommandChrome | null;
}) {
  const pathname = usePathname();
  const [unreadAlerts, setUnreadAlerts] = useState(alertUnread);
  useEffect(() => {
    setUnreadAlerts(alertUnread);
  }, [alertUnread]);
  useEffect(() => {
    function onUnread(event: Event) {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number") setUnreadAlerts(detail);
    }
    window.addEventListener("funnel-alerts-unread", onUnread);
    return () => window.removeEventListener("funnel-alerts-unread", onUnread);
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111827]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            {chrome?.showPlatformName === false ? (
              <BrandLogo compact name={chrome.productName} logoUrl={chrome.logoUrl} color={chrome.primaryColor} />
            ) : (
              <BrandLogo compact />
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: chrome?.primaryColor || "#2563EB" }}>
                Command centre
              </p>
              <p className="text-sm font-semibold text-slate-700">{chrome?.productName || chrome?.activeName || "Workspace"}</p>
            </div>
          </div>
          {chrome ? (
            <WorkspaceSwitcher
              activeSlug={chrome.activeSlug}
              activeName={chrome.activeName}
              workspaces={chrome.workspaces}
              signedIn={chrome.signedIn}
              showAgencyLink={chrome.showAgencyLink}
              userEmail={chrome.userEmail}
            />
          ) : null}
          <Link
            href="/command-centre/notifications"
            aria-label={alertsFixture ? `${unreadAlerts} sample alerts` : `${unreadAlerts} unread alerts`}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
          >
            <Bell size={16} />
            Alerts
            {unreadAlerts > 0 ? (
              <span className="rounded-full bg-[#2563EB] px-1.5 text-xs text-white">{unreadAlerts}</span>
            ) : null}
          </Link>
          <p
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              sendingEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
            }`}
          >
            {sendingEnabled ? "Sending is on" : "Sending is off"}
          </p>
        </div>
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 pb-3">
        <nav className="grid gap-2" aria-label="AIOS">
          <div className="flex w-max gap-1">
            {sections.map((section) => {
              const href = "href" in section ? section.href : section.links[0][0];
              const childActive = "links" in section ? section.links.some(([link]) => linkActive(pathname, link)) : false;
              const active = linkActive(pathname, href) || childActive;
              return (
                <Link
                  key={section.id}
                  href={href}
                  className={`${navLink} ${active ? "bg-[#0B1F3A] text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  {section.label}
                </Link>
              );
            })}
          </div>
          {sections.map((section) => {
            if (!("links" in section)) return null;
            const open = section.links.some(([link]) => linkActive(pathname, link));
            if (!open) return null;
            return (
              <div key={`${section.id}-sub`} className="flex w-max gap-1">
                {section.links.map(([href, label]) => {
                  const active = linkActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`${navLink} ${active ? "bg-[#2563EB] text-white" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      {label}
                      {href.endsWith("/inbox") && inboxUnread > 0 ? (
                        <span className={`ml-2 rounded-full px-1.5 text-xs ${active ? "bg-white/20 text-white" : "bg-[#2563EB] text-white"}`}>
                          {inboxUnread}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6">
        {chrome?.billingBanner ? (
          <p className={`rounded-xl border px-4 py-3 text-sm ${chrome.billingTone === "block" ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            {chrome.billingBanner}
            {chrome.billingHref ? (
              <>
                {" "}
                <Link href={chrome.billingHref} className="font-semibold underline">
                  View plans
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        {chrome?.agencyBanner ? (
          <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{chrome.agencyBanner}</p>
        ) : null}
        {chrome?.note ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{chrome.note}</p>
        ) : null}
        {setupError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{setupError}</p>
        ) : null}
        {!sendingEnabled ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Follow-ups are queued for you to read. Nothing is delivered to a lead until sending is switched on with a provider key.
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

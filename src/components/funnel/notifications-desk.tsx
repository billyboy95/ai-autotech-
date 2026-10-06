"use client";

import { useState } from "react";
import Link from "next/link";
import { markAllNotificationsRead, markNotificationRead, ensureResultsCallCalendar } from "@/app/actions/funnel";
import { PublicAuditReport } from "@/components/funnel/public-audit-report";
import { formatWhen } from "@/lib/automation/ids";
import type { NotificationDesk } from "@/lib/funnel/load";

export function NotificationsDesk({ data }: { data: NotificationDesk }) {
  const [items, setItems] = useState(data.items);
  const unread = items.filter((item) => !item.read).length;
  const fixture = data.mode === "fixture";

  function markLocal(id?: string) {
    setItems((current) => {
      const next = current.map((item) => (id && item.id !== id ? item : { ...item, read: true }));
      const nextUnread = next.filter((item) => !item.read).length;
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent("funnel-alerts-unread", { detail: nextUnread }));
      });
      return next;
    });
  }

  return (
    <div className="grid gap-4">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Alerts</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">Owner notifications</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{data.notice}</p>
        <p className="mt-3 text-sm font-semibold text-[#0B1F3A]">{unread} unread</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Inbox</h2>
          {fixture ? (
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
              onClick={() => markLocal()}
            >
              Mark all read
            </button>
          ) : (
            <form action={markAllNotificationsRead}>
              <button className="inline-flex h-11 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">
                Mark all read
              </button>
            </form>
          )}
        </div>
        <ul className="mt-4 grid gap-3">
          {items.length === 0 ? <li className="text-sm text-slate-500">No alerts yet.</li> : null}
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.kind}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0B1F3A]">{item.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatWhen(item.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={item.href} className="inline-flex h-11 items-center rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white">
                    Open
                  </Link>
                  {item.read ? (
                    <span className="inline-flex h-11 items-center text-sm text-slate-500">Read</span>
                  ) : fixture ? (
                    <button
                      type="button"
                      className="inline-flex h-11 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
                      onClick={() => markLocal(item.id)}
                    >
                      Mark read
                    </button>
                  ) : (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="inline-flex h-11 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">
                        Mark read
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {data.mode === "live" ? (
        <form action={ensureResultsCallCalendar} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Results call calendar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Agency owners can create the default Results call calendar and booking link. Running it again keeps the same link. It does not email a lead.
          </p>
          <button className="mt-3 inline-flex h-11 items-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">
            Create results call calendar
          </button>
        </form>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          The results-call calendar is an agency-owner action after this migration is applied. This preview does not run that SQL.
        </p>
      )}

      {data.report ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <PublicAuditReport
            title={data.report.title}
            narrative={data.report.narrative}
            sections={data.report.sections}
            resultsCallUrl={data.resultsCallUrl}
          />
          <p className="mt-3 text-sm text-slate-600">
            On a phone, the same report layout is at{" "}
            <Link href="/team/preview-audit" className="font-semibold text-[#2563EB]">
              /team/preview-audit
            </Link>
            . The sample is not stored.
          </p>
        </section>
      ) : null}
    </div>
  );
}

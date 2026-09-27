import Link from "next/link";
import { markConnectAccount } from "@/app/actions/connect";
import { CONNECT_STATE_LABEL, type ConnectState } from "@/lib/connect/accounts";
import type { ConnectCard } from "@/lib/connect/load";

const buttonClass = "inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

const badgeClass: Record<ConnectState, string> = {
  connect: "bg-slate-100 text-slate-800",
  needs_keys: "bg-amber-100 text-amber-950",
  connected: "bg-emerald-100 text-emerald-900",
};

export function AccountCards({
  orgSlug,
  cards,
  notice,
  preview,
}: {
  orgSlug: string;
  cards: ConnectCard[];
  notice?: string | null;
  preview: boolean;
}) {
  return (
    <div data-testid="connect-accounts" className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Connect accounts</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">
          After the sandbox trial, connect the accounts the full team needs. Each card is Connect, Needs keys, or Connected.
          No provider is called. Nothing is sent and nothing is charged.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Connect means not started. Needs keys means a sandbox placeholder is saved and Vault has no secret.
          Connected means every mapped channel row is connected and a secret id is stored.
        </p>
      </div>
      {preview ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fixture mode. Supabase keys are empty, so this page is a sandbox stub. Apply step 24 before progress is saved.
        </p>
      ) : null}
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <li key={card.key} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{card.label}</h2>
              <p data-connect-state={card.state} className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass[card.state]}`}>
                {CONNECT_STATE_LABEL[card.state]}
              </p>
            </div>
            <p className="text-sm text-slate-700">{card.detail}</p>
            {card.state === "connect" ? (
              <form action={markConnectAccount}>
                <input type="hidden" name="slug" value={orgSlug} />
                <input type="hidden" name="account" value={card.key} />
                <button className={buttonClass}>Connect {card.label}</button>
              </form>
            ) : (
              <p className="text-sm font-semibold text-slate-700">{CONNECT_STATE_LABEL[card.state]}. Nothing is sent.</p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-700">
        <Link href="/command-centre/import-contacts" className="font-semibold text-[#2563EB]">Import contacts</Link>
        {" "}when the accounts are on the checklist. Nothing is sent.
      </p>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import {
  approveReward,
  markRewardPaid,
  saveReferralProgram,
  saveVanityCode,
  voidReward,
  type ReferralActionState,
} from "@/app/actions/referrals";
import { CopyLink } from "@/components/referrals/copy-link";
import { formatZar, rewardTypeLabel, shareLinks, tierProgress, type RewardType } from "@/lib/referrals/codes";
import type { ReferralDesk } from "@/lib/referrals/types";

const SHARE_LABELS = [
  ["whatsapp", "WhatsApp"],
  ["facebook", "Facebook"],
  ["x", "X"],
  ["linkedin", "LinkedIn"],
  ["email", "Email"],
] as const;

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

const initialAction: ReferralActionState = { ok: false, message: "" };

function ActionNote({ state }: { state: ReferralActionState }) {
  if (!state.message) return null;
  return <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>;
}

export function ReferralsDesk({ data }: { data: ReferralDesk }) {
  const links = shareLinks(data.link, data.shareText);
  const progress = tierProgress(data.program.tiers, data.payingCount);

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Refer & earn</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">Share your link</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Friends who open your link, join, and make a first sandbox payment can earn you a ledger reward after the hold period.
          Amounts are placeholders until Billy confirms them. Rewards stay on the sandbox ledger.
        </p>
      </div>
      {data.notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{data.notice}</p> : null}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_220px]">
        <div className="grid gap-3">
          <p className="text-sm font-semibold text-[#0B1F3A]">Your link</p>
          <p className="break-all rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">{data.link}</p>
          <div className="flex flex-wrap gap-2">
            <CopyLink url={data.link} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share</p>
          <div className="flex flex-wrap gap-2">
            {SHARE_LABELS.map(([key, label]) => (
              <a
                key={key}
                href={links[key]}
                target={key === "email" ? undefined : "_blank"}
                rel={key === "email" ? undefined : "noopener noreferrer"}
                className="inline-flex h-11 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
              >
                {label}
              </a>
            ))}
          </div>
          <p className="text-sm text-slate-500">Each share link opens your own app. You send the message yourself.</p>
          <VanityForm orgSlug={data.orgSlug} preview={data.preview} />
        </div>
        <div className="grid justify-items-center gap-2">
          <p className="text-sm font-semibold text-[#0B1F3A]">QR code</p>
          {data.qrSvg ? (
            <div
              className="h-[200px] w-[200px] overflow-hidden rounded-md border border-slate-200 bg-white [&_svg]:h-full [&_svg]:w-full"
              role="img"
              aria-label="QR code for your referral link"
              dangerouslySetInnerHTML={{ __html: data.qrSvg }}
            />
          ) : null}
          <p className="text-center text-xs text-slate-500">{data.code}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Clicks", String(data.stats.clicks)],
          ["Signups", String(data.stats.signups)],
          ["Paying", String(data.stats.paying)],
          ["Earned", formatZar(data.stats.earnedCents)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Tiers</h2>
        <p className="mt-1 text-sm text-slate-600">
          {progress.current ? `You are on ${progress.current.name}.` : "You are working towards the first tier."}
          {progress.upcoming ? ` Next is ${progress.upcoming.name} at ${progress.upcoming.paidReferrals} paying referrals.` : " You have reached the top tier."}
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {data.program.tiers.map((tier) => (
            <li key={tier.name} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
              <p className="font-semibold text-[#0B1F3A]">{tier.name}</p>
              <p className="text-slate-600">{tier.paidReferrals} paying</p>
              <p className="text-slate-600">{rewardTypeLabel(tier.rewardType)} · {formatZar(tier.amountCents)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Rewards</h2>
        {data.rewards.length === 0 ? <p className="mt-2 text-sm text-slate-500">No rewards yet. A row appears after the referred organisation’s first successful sandbox payment.</p> : null}
        <ul className="mt-3 grid gap-2">
          {data.rewards.map((reward) => (
            <li key={reward.id} className="grid gap-2 rounded-md border border-slate-200 px-3 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-semibold text-[#0B1F3A]">{reward.displayCode} · {statusLabel(reward.status)}</p>
                <p className="text-slate-600">
                  {reward.rewardType === "percent_off_months"
                    ? `${reward.percentOff ?? 0}% off for ${reward.months ?? 0} months`
                    : formatZar(reward.amountCents)}
                  {" · "}
                  {rewardTypeLabel(reward.rewardType)}
                  {" · hold until "}
                  {reward.holdUntil.slice(0, 10)}
                  {reward.sandbox ? " · sandbox" : ""}
                </p>
              </div>
              {data.canAdmin ? <RewardActions orgSlug={data.orgSlug} rewardId={reward.id} status={reward.status} preview={data.preview} /> : null}
            </li>
          ))}
        </ul>
      </section>

      {data.canAdmin ? <AdminBook data={data} /> : null}
    </div>
  );
}

function VanityForm({ orgSlug, preview }: { orgSlug: string; preview: boolean }) {
  const [state, action, pending] = useActionState(saveVanityCode, initialAction);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="org" value={orgSlug} />
      <input type="hidden" name="scope" value="user" />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Custom code
        <input name="vanity" minLength={4} maxLength={16} placeholder="BILLY" disabled={preview} className="h-11 rounded-md border border-slate-200 px-3 text-sm uppercase" />
      </label>
      <button disabled={preview || pending} className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:bg-slate-300">Save code</button>
      <div className="sm:col-span-2"><ActionNote state={state} /></div>
    </form>
  );
}

function RewardActions({
  orgSlug,
  rewardId,
  status,
  preview,
}: {
  orgSlug: string;
  rewardId: string;
  status: string;
  preview: boolean;
}) {
  const [approved, approve, approving] = useActionState(approveReward, initialAction);
  const [paid, markPaid, marking] = useActionState(markRewardPaid, initialAction);
  const [voided, voidAction, voiding] = useActionState(voidReward, initialAction);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={approve}>
          <input type="hidden" name="org" value={orgSlug} />
          <input type="hidden" name="rewardId" value={rewardId} />
          <button disabled={preview || approving || status !== "pending"} className="h-10 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white disabled:bg-slate-300">Approve</button>
        </form>
        <form action={markPaid}>
          <input type="hidden" name="org" value={orgSlug} />
          <input type="hidden" name="rewardId" value={rewardId} />
          <button disabled={preview || marking || status !== "approved"} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A] disabled:text-slate-400">Mark paid</button>
        </form>
        <form action={voidAction}>
          <input type="hidden" name="org" value={orgSlug} />
          <input type="hidden" name="rewardId" value={rewardId} />
          <button disabled={preview || voiding || status === "paid" || status === "void"} className="h-10 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 disabled:text-slate-400">Void</button>
        </form>
      </div>
      <ActionNote state={approved} />
      <ActionNote state={paid} />
      <ActionNote state={voided} />
    </div>
  );
}

function AdminBook({ data }: { data: ReferralDesk }) {
  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Agency referrals</h2>
        <p className="mt-1 text-sm text-slate-600">Approve or void rewards here. Mark paid only updates the sandbox ledger.</p>
      </div>
      {data.leaderboard.length === 0 ? <p className="text-sm text-slate-500">Leaderboard fills in as referrals are recorded.</p> : (
        <ul className="grid gap-2">
          {data.leaderboard.map((row) => (
            <li key={row.code} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <span className="font-semibold text-[#0B1F3A]">{row.code}</span>
              <span className="text-slate-600">{row.clicks} clicks · {row.signups} signups · {row.paying} paying</span>
            </li>
          ))}
        </ul>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {data.referrals.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="py-2 pr-3 font-semibold text-[#0B1F3A]">{row.displayCode}</td>
                <td className="py-2 pr-3">{statusLabel(row.status)}</td>
                <td className="py-2 pr-3">{row.source}</td>
                <td className="py-2">{row.clickedAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProgramForm data={data} />
    </section>
  );
}

function ProgramForm({ data }: { data: ReferralDesk }) {
  const [state, action, pending] = useActionState(saveReferralProgram, initialAction);
  const program = data.program;
  const tiers = program.tiers.slice(0, 3);
  while (tiers.length < 3) {
    tiers.push({ name: `Tier ${tiers.length + 1}`, paidReferrals: tiers.length + 1, rewardType: "account_credit", amountCents: 50000 });
  }
  return (
    <form action={action} className="grid gap-3 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-[#0B1F3A]">Programme settings</h3>
      <p className="text-sm text-slate-600">Placeholder amounts. Billy confirms the live figures before anyone is paid.</p>
      <input type="hidden" name="org" value={data.orgSlug} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="enabled" defaultChecked={program.enabled} disabled={!data.canEditProgram} />
        Programme on
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hold days" name="holdDays" defaultValue={String(program.holdDays)} disabled={!data.canEditProgram} />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Default reward
          <select name="rewardType" defaultValue={program.rewardType} disabled={!data.canEditProgram} className="h-11 rounded-md border border-slate-200 px-3 text-sm font-normal">
            <option value="account_credit">Account credit (ZAR)</option>
            <option value="percent_off_months">Percent off for months</option>
            <option value="cash_commission">Cash commission (ZAR)</option>
          </select>
        </label>
        <Field label="Account credit (ZAR)" name="accountCredit" defaultValue={money(program.accountCreditCents)} disabled={!data.canEditProgram} />
        <Field label="Cash commission (ZAR)" name="cashCommission" defaultValue={money(program.cashCommissionCents)} disabled={!data.canEditProgram} />
        <Field label="Percent off" name="percentOff" defaultValue={String(program.percentOff)} disabled={!data.canEditProgram} />
        <Field label="Percent-off months" name="percentOffMonths" defaultValue={String(program.percentOffMonths)} disabled={!data.canEditProgram} />
      </div>
      <div className="grid gap-3">
        {tiers.map((tier, index) => (
          <div key={tier.name + index} className="grid gap-2 sm:grid-cols-4">
            <Field label={`Tier ${index + 1} name`} name={`tier${index + 1}Name`} defaultValue={tier.name} disabled={!data.canEditProgram} />
            <Field label="Paying referrals" name={`tier${index + 1}Paid`} defaultValue={String(tier.paidReferrals)} disabled={!data.canEditProgram} />
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Type
              <select name={`tier${index + 1}Type`} defaultValue={tier.rewardType} disabled={!data.canEditProgram} className="h-11 rounded-md border border-slate-200 px-3 text-sm font-normal">
                {(["account_credit", "percent_off_months", "cash_commission"] as RewardType[]).map((type) => (
                  <option key={type} value={type}>{rewardTypeLabel(type)}</option>
                ))}
              </select>
            </label>
            <Field label="Amount (ZAR)" name={`tier${index + 1}Amount`} defaultValue={money(tier.amountCents)} disabled={!data.canEditProgram} />
          </div>
        ))}
      </div>
      <button disabled={!data.canEditProgram || pending} className="h-11 w-full rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:bg-slate-300 sm:w-fit">Save programme</button>
      <ActionNote state={state} />
    </form>
  );
}

function Field({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue: string; disabled: boolean }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input name={name} defaultValue={defaultValue} disabled={disabled} className="h-11 rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-800" />
    </label>
  );
}

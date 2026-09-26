"use client";

import { useActionState } from "react";
import { pushSnapshot, type ProvisionState } from "@/app/actions/provision";

const initial: ProvisionState = { ok: false, message: "", report: [] };

export function SnapshotPushForm({ snapshotId, snapshotName }: { snapshotId: string; snapshotName: string }) {
  const [state, action, pending] = useActionState(pushSnapshot, initial);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="snapshotId" value={snapshotId} />
      <button disabled={pending} className="h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Pushing…" : `Push update to loaded workspaces`}
      </button>
      <p className="text-xs text-slate-500">Updates {snapshotName}. Client-edited assets are skipped. Nothing is sent.</p>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
      {state.report.length ? (
        <ul className="grid gap-1 text-sm" data-testid="snapshot-push-report">
          {state.report.slice(0, 80).map((row) => (
            <li key={`${row.org_id ?? "org"}-${row.kind}-${row.asset_key}`}>
              <span className="font-semibold text-[#0B1F3A]">{row.result}</span>
              <span className="text-slate-500"> · {row.kind} · {row.asset_key}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

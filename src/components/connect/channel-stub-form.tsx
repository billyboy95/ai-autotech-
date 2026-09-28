"use client";

import { useActionState } from "react";
import { submitChannelStub } from "@/app/actions/channel-stub";
import { EMPTY_CHANNEL_STUB_ACTION, type ChannelStubAccount } from "@/lib/connect/channel-stub";

const buttonClass = "inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:w-fit";

export function ChannelStubForm({
  accountKey,
  orgSlug,
}: {
  accountKey: ChannelStubAccount;
  orgSlug: string;
}) {
  const [state, act] = useActionState(submitChannelStub, EMPTY_CHANNEL_STUB_ACTION);
  return (
    <form action={act} className="grid gap-2">
      <input type="hidden" name="slug" value={orgSlug} />
      <input type="hidden" name="account" value={accountKey} />
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button name="intent" value="save" className={`${buttonClass} bg-[#2563EB] text-white`}>Save sandbox stub</button>
        <button name="intent" value="send_test" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Send test</button>
      </div>
      {state.message ? (
        <p data-testid="channel-stub-result" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          {`${state.message} Outbox queued: 0.`}
        </p>
      ) : null}
    </form>
  );
}

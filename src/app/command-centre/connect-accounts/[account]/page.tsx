import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelStubForm } from "@/components/connect/channel-stub-form";
import { MetaStubForm } from "@/components/connect/meta-stub-form";
import { SocialStubForm } from "@/components/connect/social-stub-form";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { accountByKey } from "@/lib/connect/accounts";
import {
  CHANNEL_STUB_LABEL,
  channelStubExplanation,
  isChannelStubAccount,
  type ChannelStubAccount,
  type ChannelStubStatus,
} from "@/lib/connect/channel-stub";
import { loadConnectAccounts } from "@/lib/connect/load";
import { isMetaStubAccount, META_STUB_LABEL, type MetaStubAccount, type MetaStubStatus } from "@/lib/connect/meta-stub";
import {
  isSocialStubAccount,
  SOCIAL_STUB_LABEL,
  socialStubExplanation,
  type SocialStubAccount,
  type SocialStubStatus,
} from "@/lib/connect/social-stub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect stub",
  robots: { index: false, follow: false },
};

const badgeClass: Record<MetaStubStatus, string> = {
  not_connected: "bg-slate-100 text-slate-800",
  sandbox_stub: "bg-sky-100 text-sky-950",
  needs_provider_keys: "bg-amber-100 text-amber-950",
};

export default async function ConnectStubPage({
  params,
}: {
  params: Promise<{ account: string }>;
}) {
  const { account } = await params;
  if (isMetaStubAccount(account)) return <MetaConnectStub account={account} />;
  if (isChannelStubAccount(account)) return <ChannelConnectStub account={account} />;
  if (isSocialStubAccount(account)) return <SocialConnectStub account={account} />;
  notFound();
}

async function MetaConnectStub({ account }: { account: MetaStubAccount }) {
  const spec = accountByKey(account);
  if (!spec) notFound();
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const data = await loadConnectAccounts({ mode: tenant.mode, orgId: tenant.active.id });
  const card = data.cards.find((item) => item.key === account);
  const badges: MetaStubStatus[] = card?.metaStub ?? ["not_connected"];

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div data-testid="meta-connect-stub" className="grid min-w-0 max-w-2xl gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{spec.label}</h1>
          <p className="mt-1 text-sm text-slate-700">
            This is a sandbox stub. Billy must add Meta app credentials later. No OAuth runs on this page and no key is stored.
          </p>
        </div>
        <StubBadges badges={badges} kind="meta" />
        <p className="text-sm text-slate-700">
          Status badges are Not connected, Sandbox stub, and Needs provider keys. Provider keys are missing, so Send test is a dry run only and is refused. Outbox queued: 0.
        </p>
        {data.preview ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Fixture only. Nothing is stored until META_CONNECT_STUB_ENABLED is true and step 26 is applied. No key is stored and nothing is sent.
          </p>
        ) : null}
        {data.notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{data.notice}</p> : null}
        <MetaStubForm accountKey={account} orgSlug={tenant.active.slug} />
        <p className="text-sm text-slate-700">
          <Link href="/command-centre/connect-accounts" className="font-semibold text-[#2563EB]">Back to connect accounts</Link>. Nothing is sent.
        </p>
      </div>
    </CommandShell>
  );
}

async function ChannelConnectStub({ account }: { account: ChannelStubAccount }) {
  const spec = accountByKey(account);
  if (!spec) notFound();
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const data = await loadConnectAccounts({ mode: tenant.mode, orgId: tenant.active.id });
  const card = data.cards.find((item) => item.key === account);
  const badges: ChannelStubStatus[] = card?.channelStub ?? ["not_connected"];

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div data-testid="channel-connect-stub" className="grid min-w-0 max-w-2xl gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{spec.label}</h1>
          <p className="mt-1 text-sm text-slate-700">
            {`This is a sandbox stub. ${channelStubExplanation(account)}`}
          </p>
        </div>
        <StubBadges badges={badges} kind="channel" />
        <p className="text-sm text-slate-700">
          Status badges are Not connected, Sandbox stub, and Needs provider keys. Provider keys are missing, so Send test is a dry run only and is refused. Outbox queued: 0.
        </p>
        {data.preview ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Fixture only. Nothing is stored until EMAIL_SMS_CONNECT_STUB_ENABLED is true and step 27 is applied. No key is stored and nothing is sent.
          </p>
        ) : null}
        {data.notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{data.notice}</p> : null}
        <ChannelStubForm accountKey={account} orgSlug={tenant.active.slug} />
        <p className="text-sm text-slate-700">
          <Link href="/command-centre/connect-accounts" className="font-semibold text-[#2563EB]">Back to connect accounts</Link>. Nothing is sent.
        </p>
      </div>
    </CommandShell>
  );
}

async function SocialConnectStub({ account }: { account: SocialStubAccount }) {
  const spec = accountByKey(account);
  if (!spec) notFound();
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const data = await loadConnectAccounts({ mode: tenant.mode, orgId: tenant.active.id });
  const card = data.cards.find((item) => item.key === account);
  const badges: SocialStubStatus[] = card?.socialStub ?? ["not_connected"];

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div data-testid="social-connect-stub" className="grid min-w-0 max-w-2xl gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{spec.label}</h1>
          <p className="mt-1 text-sm text-slate-700">
            {`This is a sandbox stub. ${socialStubExplanation(account)}`}
          </p>
        </div>
        <StubBadges badges={badges} kind="social" />
        <p className="text-sm text-slate-700">
          Status badges are Not connected, Sandbox stub, and Needs provider keys. Provider keys are missing, so send, test, and publish are refused. Outbox queued: 0. Nothing is posted.
        </p>
        {data.preview ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Fixture only. Nothing is stored until TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED is true and step 28 is applied. No key is stored and nothing is posted.
          </p>
        ) : null}
        {data.notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{data.notice}</p> : null}
        <SocialStubForm accountKey={account} orgSlug={tenant.active.slug} />
        <p className="text-sm text-slate-700">
          <Link href="/command-centre/connect-accounts" className="font-semibold text-[#2563EB]">Back to connect accounts</Link>. Nothing is posted.
        </p>
      </div>
    </CommandShell>
  );
}

function StubBadges({
  badges,
  kind,
}: {
  badges: Array<MetaStubStatus | ChannelStubStatus | SocialStubStatus>;
  kind: "meta" | "channel" | "social";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((status) => (
        <p
          key={status}
          data-meta-stub={kind === "meta" ? status : undefined}
          data-channel-stub={kind === "channel" ? status : undefined}
          data-social-stub={kind === "social" ? status : undefined}
          className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass[status]}`}
        >
          {kind === "meta" ? META_STUB_LABEL[status] : kind === "channel" ? CHANNEL_STUB_LABEL[status] : SOCIAL_STUB_LABEL[status]}
        </p>
      ))}
    </div>
  );
}

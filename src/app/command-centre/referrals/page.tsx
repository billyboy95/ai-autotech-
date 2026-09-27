import type { Metadata } from "next";
import { ReferralsDesk } from "@/components/referrals/referrals-desk";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadReferralDesk } from "@/lib/referrals/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referrals",
  robots: { index: false, follow: false },
};

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, desk] = await Promise.all([
    loadCommandData(),
    loadReferralDesk(params.org),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <ReferralsDesk data={desk} />
    </CommandShell>
  );
}

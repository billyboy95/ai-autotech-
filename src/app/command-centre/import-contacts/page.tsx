import type { Metadata } from "next";
import { ImportWizard } from "@/components/connect/import-wizard";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import contacts",
  robots: { index: false, follow: false },
};

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export default async function ImportContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const previewMode = !configured() || tenant.mode !== "member";
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <ImportWizard orgSlug={tenant.active.slug} notice={params.notice} previewMode={previewMode} />
    </CommandShell>
  );
}

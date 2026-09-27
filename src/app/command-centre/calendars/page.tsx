import type { Metadata } from "next";
import { CalendarsDesk } from "@/components/calendars/calendars-desk";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadCalendarDesk } from "@/lib/calendars/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendars",
  robots: { index: false, follow: false },
};

export default async function CalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; id?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, desk] = await Promise.all([
    loadCommandData(),
    loadCalendarDesk({ org: params.org, calendarId: params.id, notice: params.notice }),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <CalendarsDesk data={desk} />
    </CommandShell>
  );
}

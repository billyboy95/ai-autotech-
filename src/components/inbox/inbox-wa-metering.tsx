import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import { freeServiceStartNote, outboundWaMessageMeter, serviceCounterText } from "@/lib/inbox/wa-metering";
import type { InboxWaServiceMeter } from "@/lib/inbox/types";

export function InboxWaMetering({
  enabled,
  meters,
  currentConnectionId,
}: {
  enabled: boolean;
  meters: readonly InboxWaServiceMeter[];
  currentConnectionId: string | null;
}) {
  if (!enabled) return null;
  const note = freeServiceStartNote(meters[0]?.monthKey ?? "");
  const timezone = meters[0]?.timezone || "Africa/Johannesburg";
  return (
    <div data-testid="inbox-wa-metering" className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Free service messages · {timezone}
      </p>
      {meters.length === 0 ? (
        <p data-testid="inbox-wa-service-counter" className="mt-1 text-sm text-slate-600">
          Connect a WhatsApp number to see this month&apos;s free service messages.
        </p>
      ) : (
        <ul className="mt-1 grid gap-1">
          {meters.map((meter) => (
            <li
              key={meter.connectionId}
              data-testid="inbox-wa-service-counter"
              data-connection={meter.connectionId}
              data-used={meter.used == null ? "" : String(meter.used)}
              data-allowance={String(meter.allowance)}
              data-current={meter.connectionId === currentConnectionId ? "true" : "false"}
              className="text-sm text-slate-700"
            >
              {serviceCounterText(meter)}
            </li>
          ))}
        </ul>
      )}
      {note ? (
        <p data-testid="inbox-wa-meter-note" className="mt-1 text-xs text-slate-500">
          {note}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-slate-500">Display only. Nothing is sent.</p>
    </div>
  );
}

export function InboxWaMessageMeter({
  message,
  now,
}: {
  message: { direction: string; channel: string; waCategory: string; costCents: number };
  now: string;
}) {
  const at = new Date(now);
  const meter = outboundWaMessageMeter(message, Number.isNaN(at.getTime()) ? new Date() : at);
  if (!meter) return null;
  return (
    <p
      data-testid="inbox-wa-message-meter"
      data-category={meter.category}
      data-source={meter.source}
      data-cents={String(meter.cents)}
      className="mt-1 text-xs text-slate-200"
    >
      {meter.label}
    </p>
  );
}

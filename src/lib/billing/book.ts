import type { BillingEventInput, OrgSubscription, SubscriptionStatus } from "@/lib/billing/types";

export const DUNNING_MS = 7 * 24 * 60 * 60 * 1000;

export type BillingOrgState = {
  id: string;
  status: string;
  sendingEnabled: boolean;
};

export type OutboxRow = {
  id: string;
  orgId: string;
  status: string;
};

export type UsageLedgerRow = {
  orgId: string;
  meter: string;
  quantity: number;
  unitCostCents: number;
  occurredAt: string;
};

export type RateMarkup = {
  orgId: string | null;
  meter: string;
  markupMultiplier: number;
};

export type BillingBook = {
  plans: { code: string; priceCents: number }[];
  subscriptions: OrgSubscription[];
  events: { providerEventId: string }[];
  orgs: BillingOrgState[];
  outbox: OutboxRow[];
};

export function emptyBook(plans: { code: string; priceCents: number }[] = []): BillingBook {
  return { plans, subscriptions: [], events: [], orgs: [], outbox: [] };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function addMonth(iso: string) {
  const date = new Date(iso);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

export function applyBillingEvent(book: BillingBook, event: BillingEventInput) {
  if (event.payload.sandbox !== true) {
    throw new Error("live charges are disabled");
  }
  const planCode = event.payload.planCode || book.subscriptions.find((item) => item.orgId === event.orgId)?.planCode;
  const paymentStatus = event.payload.paymentStatus;
  if (paymentStatus === "COMPLETE" || event.type === "subscription.cancel") {
    if (!planCode || !book.plans.some((item) => item.code === planCode)) throw new Error("unknown plan");
  }
  if (paymentStatus === "COMPLETE") {
    const plan = book.plans.find((item) => item.code === planCode);
    if (event.payload.amountCents == null) throw new Error("amount required");
    if (!plan || event.payload.amountCents !== plan.priceCents) throw new Error("amount mismatch");
  }

  if (book.events.some((item) => item.providerEventId === event.providerEventId)) {
    const current = book.subscriptions.find((item) => item.orgId === event.orgId);
    return {
      book,
      duplicate: true as const,
      status: current?.status ?? null,
      charged: false as const,
      sendingEnabled: false as const,
    };
  }

  const next = clone(book);
  next.events.push({ providerEventId: event.providerEventId });

  let status: SubscriptionStatus | null = null;
  if (event.type === "subscription.cancel") status = "cancelled";
  else if (paymentStatus === "COMPLETE") status = "active";
  else if (paymentStatus === "FAILED") status = "past_due";

  if (status && planCode) {
    const occurred = event.payload.occurredAt || new Date().toISOString();
    const existing = next.subscriptions.find((item) => item.orgId === event.orgId);
    const periodEnd = status === "active" ? addMonth(occurred) : existing?.currentPeriodEnd ?? null;
    const row: OrgSubscription = {
      orgId: event.orgId,
      planCode,
      provider: event.provider,
      providerCustomerRef: existing?.providerCustomerRef ?? null,
      providerToken: event.payload.token || existing?.providerToken || null,
      status,
      currentPeriodEnd: periodEnd,
      nextChargeAt: periodEnd,
      pastDueAt: status === "past_due" ? existing?.pastDueAt || occurred : status === "active" ? null : existing?.pastDueAt ?? null,
      suspendedAt: status === "active" ? null : existing?.suspendedAt ?? null,
      sandbox: true,
    };
    if (existing) {
      next.subscriptions = next.subscriptions.map((item) => (item.orgId === event.orgId ? row : item));
    } else {
      next.subscriptions.push(row);
    }
    if (status === "active") {
      next.orgs = next.orgs.map((org) =>
        org.id === event.orgId && org.status === "suspended" ? { ...org, status: "active" } : org,
      );
    }
  }

  const org = next.orgs.find((item) => item.id === event.orgId);
  return {
    book: next,
    duplicate: false as const,
    status,
    charged: false as const,
    sendingEnabled: false as const,
    orgSendingEnabled: org ? org.sendingEnabled : false,
  };
}

export function applyDunning(book: BillingBook, now: Date) {
  const next = clone(book);
  const suspended = new Set<string>();
  next.subscriptions = next.subscriptions.map((sub) => {
    if (sub.status !== "past_due" || !sub.pastDueAt) return sub;
    if (new Date(sub.pastDueAt).getTime() > now.getTime() - DUNNING_MS) return sub;
    suspended.add(sub.orgId);
    return { ...sub, status: "suspended" as const, suspendedAt: now.toISOString() };
  });
  next.orgs = next.orgs.map((org) => {
    if (!suspended.has(org.id) || org.status === "archived") return org;
    return { ...org, status: "suspended", sendingEnabled: false };
  });
  next.outbox = next.outbox.map((row) => {
    if (!suspended.has(row.orgId)) return row;
    if (row.status !== "queued" && row.status !== "approved") return row;
    return { ...row, status: "held" };
  });
  return next;
}

export function markupFor(cards: RateMarkup[], orgId: string, meter: string) {
  const specific = cards.find((card) => card.orgId === orgId && card.meter === meter);
  const fallback = cards.find((card) => card.orgId == null && card.meter === meter);
  return specific?.markupMultiplier ?? fallback?.markupMultiplier ?? 1;
}

/** Sum of quantity × unit cost × rate-card markup, rounded per ledger row. */
export function monthlyUsageReport(input: {
  orgId: string;
  from: string;
  to: string;
  ledger: UsageLedgerRow[];
  cards: RateMarkup[];
}) {
  const from = new Date(input.from).getTime();
  const to = new Date(input.to).getTime();
  const totals = new Map<string, { quantity: number; amountCents: number }>();
  for (const row of input.ledger) {
    if (row.orgId !== input.orgId) continue;
    const at = new Date(row.occurredAt).getTime();
    if (at < from || at >= to) continue;
    const markup = markupFor(input.cards, input.orgId, row.meter);
    const amount = Math.round(row.quantity * row.unitCostCents * markup);
    const current = totals.get(row.meter) ?? { quantity: 0, amountCents: 0 };
    current.quantity += row.quantity;
    current.amountCents += amount;
    totals.set(row.meter, current);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([meter, total]) => ({ meter, quantity: total.quantity, amountCents: total.amountCents }));
}

export function usageTotalCents(lines: { amountCents: number }[]) {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

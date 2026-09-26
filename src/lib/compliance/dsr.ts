import { stopAddress } from "@/lib/compliance/stop";

export type ContactRecord = {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string;
  whatsappE164: string;
  company: string;
  tags: string[];
  custom: Record<string, unknown>;
  leadId: string | null;
  clientId: string | null;
  erasedAt: string | null;
};

export type ConsentRecord = {
  id?: string;
  channel: string;
  purpose: string;
  status: string;
  basis: string;
  source: string;
  evidence?: Record<string, unknown>;
  capturedAt?: string;
  withdrawnAt?: string | null;
};

export type SuppressionRecord = {
  channel: string;
  address: string;
  reason: string;
};

export function contactExport(input: {
  contact: ContactRecord;
  consents: ConsentRecord[];
  suppressions: SuppressionRecord[];
  messages: unknown[];
  dataRequests: unknown[];
}) {
  return {
    exportedAt: new Date().toISOString(),
    contact: input.contact,
    consents: input.consents,
    suppressions: input.suppressions,
    messages: input.messages,
    dataRequests: input.dataRequests,
  };
}

export function eraseContact(contact: ContactRecord, now: Date) {
  const channels = ["email", "sms", "whatsapp"] as const;
  const suppressions: SuppressionRecord[] = [];
  for (const channel of channels) {
    const values = channel === "email" ? [contact.email] : [contact.phoneE164, contact.whatsappE164];
    for (const value of values) {
      const address = stopAddress(channel, value);
      if (!address) continue;
      if (suppressions.some((item) => item.channel === channel && item.address === address)) continue;
      suppressions.push({ channel, address, reason: "dsr_delete" });
    }
  }
  const erased: ContactRecord = {
    ...contact,
    firstName: "Erased",
    lastName: "",
    email: "",
    phoneE164: "",
    whatsappE164: "",
    company: "",
    tags: [],
    custom: {},
    erasedAt: now.toISOString(),
  };
  return {
    contact: erased,
    suppressions,
    dataRequest: {
      contactId: contact.id,
      type: "delete" as const,
      status: "completed" as const,
      requestedAt: now.toISOString(),
      completedAt: now.toISOString(),
    },
  };
}

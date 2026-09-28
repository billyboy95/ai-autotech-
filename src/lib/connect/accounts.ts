export const CONNECT_ACCOUNT_KEYS = ["gmail", "whatsapp", "sms", "meta", "google_calendar", "tiktok", "linkedin"] as const;

export type ConnectAccountKey = (typeof CONNECT_ACCOUNT_KEYS)[number];

export type ConnectState = "connect" | "needs_keys" | "connected";

export type ChannelTarget = {
  channel: "email" | "whatsapp" | "sms" | "facebook" | "instagram";
  provider: "resend" | "meta_cloud" | "smsportal" | "meta";
};

export type ConnectAccount = {
  key: ConnectAccountKey;
  label: string;
  detail: string;
  channels: ChannelTarget[];
};

export const CONNECT_STATE_LABEL: Record<ConnectState, string> = {
  connect: "Connect",
  needs_keys: "Needs keys",
  connected: "Connected",
};

/** Full account list. The checklist does not drop accounts down to a smaller set. */
export const CONNECT_ACCOUNTS: ConnectAccount[] = [
  {
    key: "gmail",
    label: "Email / Gmail",
    detail: "Email via Resend or SMTP. This card is a sandbox stub. Billy adds those keys later. No email is sent.",
    channels: [{ channel: "email", provider: "resend" }],
  },
  {
    key: "whatsapp",
    label: "WhatsApp (Meta Cloud)",
    detail: "Meta Cloud API. Needs keys in Vault before it can connect. No Meta call is made.",
    channels: [{ channel: "whatsapp", provider: "meta_cloud" }],
  },
  {
    key: "sms",
    label: "SMS",
    detail: "SMSPortal, BulkSMS, or Clickatell. These names are placeholders. Billy adds the keys later. No SMS is sent.",
    channels: [{ channel: "sms", provider: "smsportal" }],
  },
  {
    key: "meta",
    label: "Facebook / Instagram",
    detail: "Meta pages. Needs keys in Vault. Nothing is published.",
    channels: [
      { channel: "facebook", provider: "meta" },
      { channel: "instagram", provider: "meta" },
    ],
  },
  {
    key: "google_calendar",
    label: "Calendar (Google)",
    detail: "Google Calendar. The checklist records progress. No Google call is made.",
    channels: [],
  },
  {
    key: "tiktok",
    label: "TikTok",
    detail: "TikTok. This card is a sandbox stub. Billy adds the keys later. No OAuth runs, nothing is posted, and no ad is bought.",
    channels: [],
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    detail: "LinkedIn. This card is a sandbox stub. Billy adds the keys later. No OAuth runs and nothing is posted.",
    channels: [],
  },
];

export function accountByKey(key: string): ConnectAccount | null {
  return CONNECT_ACCOUNTS.find((account) => account.key === key) ?? null;
}

export type StoredConnection = {
  channel: string;
  provider: string;
  status: string;
  hasSecret: boolean;
};

/**
 * Connect: not started.
 * Needs keys: a checklist row or a channel placeholder exists, and Vault has no secret.
 * Connected: every mapped channel row is connected and has a secret id.
 * Calendar has no channel_connections row, so it stays on Connect or Needs keys.
 * TikTok and LinkedIn use the step 28 sandbox stub and are not written here.
 */
export function resolveConnectState(input: {
  account: ConnectAccount;
  checklistStatus: string | null;
  connections: StoredConnection[];
}): ConnectState {
  const matched = input.account.channels.map((target) => bestConnection(input.connections, target.channel, target.provider));
  const connected = input.account.channels.length > 0
    && matched.every((row) => row?.status === "connected" && row.hasSecret);
  if (connected) return "connected";
  const started = input.checklistStatus === "needs_keys"
    || matched.some((row) => row && (row.status === "pending" || row.status === "error" || row.status === "connected" || row.hasSecret));
  if (started) return "needs_keys";
  return "connect";
}

function bestConnection(rows: StoredConnection[], channel: string, provider: string) {
  const matches = rows.filter((row) => row.channel === channel && row.provider === provider);
  return matches.find((row) => row.status === "connected" && row.hasSecret) ?? matches[0] ?? null;
}

export function missingConnectMigration(message: string) {
  return /does not exist|schema cache|could not find|connect_checklist|contact_import_drafts|mark_connect_account|save_contact_import_draft/i.test(message);
}

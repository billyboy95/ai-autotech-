export type ChannelConnectMode = "fixture" | "sandbox";

export type ChannelStubStatus = "not_connected" | "sandbox_stub" | "needs_provider_keys";

export const CHANNEL_STUB_LABEL: Record<ChannelStubStatus, string> = {
  not_connected: "Not connected",
  sandbox_stub: "Sandbox stub",
  needs_provider_keys: "Needs provider keys",
};

export const CHANNEL_STUB_ACCOUNTS = ["gmail", "sms"] as const;

export type ChannelStubAccount = (typeof CHANNEL_STUB_ACCOUNTS)[number];

/** Unset, blank, or any value other than true does not store an email or SMS stub. */
export function channelConnectMode(env: NodeJS.ProcessEnv = process.env): ChannelConnectMode {
  return String(env.EMAIL_SMS_CONNECT_STUB_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function channelConnectDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): ChannelConnectMode {
  if (input.tenantMode !== "member") return "fixture";
  return channelConnectMode(input.env);
}

export function isChannelStubAccount(key: string): key is ChannelStubAccount {
  return key === "gmail" || key === "sms";
}

/**
 * No row: Not connected.
 * A stored stub is Sandbox stub, and Needs provider keys while no credential is stored.
 * This phase never stores a credential.
 */
export function channelStubBadges(input: { stubStored: boolean; providerKeysPresent: boolean }): ChannelStubStatus[] {
  if (!input.stubStored) return ["not_connected"];
  const badges: ChannelStubStatus[] = ["sandbox_stub"];
  if (!input.providerKeysPresent) badges.push("needs_provider_keys");
  return badges;
}

export function channelStubExplanation(account: ChannelStubAccount) {
  if (account === "gmail") {
    return "Billy must add Resend or SMTP keys later. No OAuth runs on this page and no key is stored.";
  }
  return "Billy must add SMSPortal, BulkSMS, or Clickatell keys later. These names are placeholders. No OAuth runs on this page and no key is stored.";
}

/** Send test never calls Resend, SMTP, or an SMS provider. Missing keys are an explicit refuse. */
export function refuseChannelTestSend(input: { providerKeysPresent: boolean }) {
  if (!input.providerKeysPresent) {
    return {
      refused: true as const,
      queued: 0 as const,
      sent: 0 as const,
      message: "Provider keys are missing. Send test is a dry run only and is refused. Nothing was queued.",
    };
  }
  return {
    refused: true as const,
    queued: 0 as const,
    sent: 0 as const,
    message: "Send test does not call the provider. Nothing was queued.",
  };
}

export const EMPTY_CHANNEL_STUB_ACTION = {
  id: "",
  intent: "",
  stored: false,
  refused: false,
  queued: 0 as const,
  sent: 0 as const,
  message: "",
};

export function missingChannelStubMigration(message: string) {
  return /channel_connect_stubs|save_channel_connect_stub|refuse_channel_test_send|schema cache|could not find the function/i.test(message);
}

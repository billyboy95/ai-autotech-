export type SocialConnectMode = "fixture" | "sandbox";

export type SocialStubStatus = "not_connected" | "sandbox_stub" | "needs_provider_keys";

export const SOCIAL_STUB_LABEL: Record<SocialStubStatus, string> = {
  not_connected: "Not connected",
  sandbox_stub: "Sandbox stub",
  needs_provider_keys: "Needs provider keys",
};

export const SOCIAL_STUB_ACCOUNTS = ["tiktok", "linkedin"] as const;

export type SocialStubAccount = (typeof SOCIAL_STUB_ACCOUNTS)[number];

/** Unset, blank, or any value other than true does not store a TikTok or LinkedIn stub. */
export function socialConnectMode(env: NodeJS.ProcessEnv = process.env): SocialConnectMode {
  return String(env.TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function socialConnectDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): SocialConnectMode {
  if (input.tenantMode !== "member") return "fixture";
  return socialConnectMode(input.env);
}

export function isSocialStubAccount(key: string): key is SocialStubAccount {
  return key === "tiktok" || key === "linkedin";
}

/**
 * No row: Not connected.
 * A stored stub is Sandbox stub, and Needs provider keys while no credential is stored.
 * This phase never stores a credential.
 */
export function socialStubBadges(input: { stubStored: boolean; providerKeysPresent: boolean }): SocialStubStatus[] {
  if (!input.stubStored) return ["not_connected"];
  const badges: SocialStubStatus[] = ["sandbox_stub"];
  if (!input.providerKeysPresent) badges.push("needs_provider_keys");
  return badges;
}

export function socialStubExplanation(account: SocialStubAccount) {
  if (account === "tiktok") {
    return "Billy must add TikTok keys later. No OAuth runs on this page and no key is stored. Nothing is posted and no ad is bought.";
  }
  return "Billy must add LinkedIn keys later. No OAuth runs on this page and no key is stored. Nothing is posted.";
}

function connectIntentLabel(intent: string) {
  const value = intent.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (value === "send test" || value === "test") return "Send test";
  if (value === "post now") return "Post now";
  if (value === "go live" || value === "golive") return "Go live";
  if (value === "send") return "Send";
  return "Publish";
}

/** Send, test, and publish never call TikTok or LinkedIn. Missing keys are an explicit refuse. */
export function refuseSocialConnectSend(input: { providerKeysPresent: boolean; intent: string }) {
  const label = connectIntentLabel(input.intent);
  if (!input.providerKeysPresent) {
    return {
      refused: true as const,
      queued: 0 as const,
      posted: 0 as const,
      message: `Provider keys are missing. ${label} is refused. Billy adds the keys later. Nothing was posted.`,
    };
  }
  return {
    refused: true as const,
    queued: 0 as const,
    posted: 0 as const,
    message: `This stub does not call the provider. ${label} is refused. Nothing was posted.`,
  };
}

export const EMPTY_SOCIAL_STUB_ACTION = {
  id: "",
  intent: "",
  stored: false,
  refused: false,
  queued: 0 as const,
  posted: 0 as const,
  message: "",
};

export function missingSocialStubMigration(message: string) {
  return /social_connect_stubs|save_social_connect_stub|refuse_social_connect_send|schema cache|could not find the function/i.test(message);
}

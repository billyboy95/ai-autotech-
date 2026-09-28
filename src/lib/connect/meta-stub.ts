export type MetaConnectMode = "fixture" | "sandbox";

export type MetaStubStatus = "not_connected" | "sandbox_stub" | "needs_provider_keys";

export const META_STUB_LABEL: Record<MetaStubStatus, string> = {
  not_connected: "Not connected",
  sandbox_stub: "Sandbox stub",
  needs_provider_keys: "Needs provider keys",
};

export const META_STUB_ACCOUNTS = ["whatsapp", "meta"] as const;

export type MetaStubAccount = (typeof META_STUB_ACCOUNTS)[number];

/** Unset, blank, or any value other than true does not store a stub. */
export function metaConnectMode(env: NodeJS.ProcessEnv = process.env): MetaConnectMode {
  return String(env.META_CONNECT_STUB_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function metaConnectDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): MetaConnectMode {
  if (input.tenantMode !== "member") return "fixture";
  return metaConnectMode(input.env);
}

export function isMetaStubAccount(key: string): key is MetaStubAccount {
  return key === "whatsapp" || key === "meta";
}

/**
 * No row: Not connected.
 * A stored stub is Sandbox stub, and Needs provider keys while no Meta credential is stored.
 * This phase never stores a credential.
 */
export function metaStubBadges(input: { stubStored: boolean; providerKeysPresent: boolean }): MetaStubStatus[] {
  if (!input.stubStored) return ["not_connected"];
  const badges: MetaStubStatus[] = ["sandbox_stub"];
  if (!input.providerKeysPresent) badges.push("needs_provider_keys");
  return badges;
}

/** Send test never calls Meta. Missing keys are an explicit refuse, and nothing is queued. */
export function refuseMetaTestSend(input: { providerKeysPresent: boolean }) {
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
    message: "Send test does not call Meta. Nothing was queued.",
  };
}

export const EMPTY_META_STUB_ACTION = {
  id: "",
  intent: "",
  stored: false,
  refused: false,
  queued: 0 as const,
  sent: 0 as const,
  message: "",
};

export function missingMetaStubMigration(message: string) {
  return /meta_connect_stubs|save_meta_connect_stub|refuse_meta_test_send|schema cache|could not find the function/i.test(message);
}

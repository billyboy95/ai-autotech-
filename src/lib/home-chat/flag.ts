export type HomeChatMode = "fixture" | "sandbox";

/** Unset, blank, or any value other than true is fixture-only. Drafts are not stored. */
export function homeChatMode(env: NodeJS.ProcessEnv = process.env): HomeChatMode {
  return String(env.HOME_CHAT_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function homeChatDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): HomeChatMode {
  if (input.tenantMode !== "member") return "fixture";
  return homeChatMode(input.env);
}

export function missingHomeChatMigration(message: string) {
  return /save_home_chat_draft|home_chat_drafts|schema cache|could not find the function/i.test(message);
}

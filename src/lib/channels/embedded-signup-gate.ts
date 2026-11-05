import {
  EMBEDDED_SIGNUP_BLOCKED,
  EMBEDDED_SIGNUP_CHECKLIST,
  EMBEDDED_SIGNUP_COEXISTENCE,
  EMBEDDED_SIGNUP_HEADING,
  EMBEDDED_SIGNUP_OFFICIAL_ONLY,
  EMBEDDED_SIGNUP_PREVIEW,
  EMBEDDED_SIGNUP_SCAFFOLD,
  type EmbeddedSignupHidden,
  type EmbeddedSignupShown,
} from "@/lib/channels/embedded-signup";

const PUBLIC_APP_ID = /^\d{8,20}$/;

/** Off unless the env value is the exact string `true`. */
export function whatsappEmbeddedSignupEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WHATSAPP_EMBEDDED_SIGNUP_ENABLED === "true";
}

/**
 * Public numeric Meta app id. Read only when the flag is on.
 * Secrets and non-numeric values are ignored and are not returned.
 * Server-only: the client panel must not import this module.
 */
export function publicMetaAppId(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!whatsappEmbeddedSignupEnabled(env)) return null;
  const keys = ["NEXT_PUBLIC_META_APP_ID", "META_APP_ID"] as const;
  for (const key of keys) {
    const value = env[key];
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (PUBLIC_APP_ID.test(id)) return id;
  }
  return null;
}

export function embeddedSignupPanel(env: NodeJS.ProcessEnv = process.env): EmbeddedSignupHidden | EmbeddedSignupShown {
  if (!whatsappEmbeddedSignupEnabled(env)) return { visible: false };
  const ready = publicMetaAppId(env) !== null;
  return {
    visible: true,
    ready,
    heading: EMBEDDED_SIGNUP_HEADING,
    officialOnly: EMBEDDED_SIGNUP_OFFICIAL_ONLY,
    coexistence: EMBEDDED_SIGNUP_COEXISTENCE,
    blockedMessage: ready ? null : EMBEDDED_SIGNUP_BLOCKED,
    checklist: EMBEDDED_SIGNUP_CHECKLIST,
    buttonLabel: EMBEDDED_SIGNUP_HEADING,
    previewMessage: EMBEDDED_SIGNUP_PREVIEW,
    scaffold: EMBEDDED_SIGNUP_SCAFFOLD,
  };
}

/**
 * Draft UI for Meta Embedded Signup + coexistence.
 * The flag is off unless the value is the exact string `true`.
 * This module does not call Meta, does not write channel_connections,
 * and does not turn sending_enabled on.
 */

export const EMBEDDED_SIGNUP_HEADING = "Connect with Meta Embedded Signup";

export const EMBEDDED_SIGNUP_OFFICIAL_ONLY =
  "AI AutoTech will not use unofficial WhatsApp Web/QR session hijacking. Official API only.";

export const EMBEDDED_SIGNUP_COEXISTENCE =
  "Official WhatsApp Cloud API, with coexistence so the WhatsApp Business app stays on the same number.";

export const EMBEDDED_SIGNUP_BLOCKED = "needs Meta Tech Provider / Billy keys";

export const EMBEDDED_SIGNUP_PREVIEW =
  "Preview only. Meta login did not run. The channel stays not connected. sending_enabled stays off.";

export const EMBEDDED_SIGNUP_CHECKLIST = [
  { id: "portfolio", label: "Meta Business portfolio" },
  { id: "tech_provider", label: "Tech Provider" },
  { id: "coexistence", label: "Coexistence" },
  { id: "webhook", label: "Webhook later" },
] as const;

/** Client wiring only. launch stays false, so the browser does not load the SDK or start OAuth. */
export const EMBEDDED_SIGNUP_SCAFFOLD = {
  sdkHost: "connect.facebook.net",
  sdkPath: "/en_US/sdk.js",
  featureType: "whatsapp_business_app_onboarding",
  sessionInfoVersion: "3",
  launch: false,
  marksConnected: false,
  setsSendingEnabled: false,
} as const;

export type EmbeddedSignupHidden = { visible: false };

export type EmbeddedSignupShown = {
  visible: true;
  ready: boolean;
  heading: typeof EMBEDDED_SIGNUP_HEADING;
  officialOnly: typeof EMBEDDED_SIGNUP_OFFICIAL_ONLY;
  coexistence: typeof EMBEDDED_SIGNUP_COEXISTENCE;
  blockedMessage: typeof EMBEDDED_SIGNUP_BLOCKED | null;
  checklist: typeof EMBEDDED_SIGNUP_CHECKLIST;
  buttonLabel: typeof EMBEDDED_SIGNUP_HEADING;
  previewMessage: typeof EMBEDDED_SIGNUP_PREVIEW;
  scaffold: typeof EMBEDDED_SIGNUP_SCAFFOLD;
};

export type EmbeddedSignupPreview = {
  connected: false;
  sendingEnabled: false;
  oauthStarted: false;
  providerCalls: 0;
  launched: false;
  message: string;
};

/** Local preview. Never starts OAuth, never marks a channel connected, never sends. */
export function previewEmbeddedSignupClick(input: { ready: boolean }): EmbeddedSignupPreview {
  if (!input.ready) {
    return {
      connected: false,
      sendingEnabled: false,
      oauthStarted: false,
      providerCalls: 0,
      launched: false,
      message: EMBEDDED_SIGNUP_BLOCKED,
    };
  }
  return {
    connected: false,
    sendingEnabled: false,
    oauthStarted: false,
    providerCalls: 0,
    launched: false,
    message: EMBEDDED_SIGNUP_PREVIEW,
  };
}

import React from "react"; // node:test compiles JSX with the classic runtime.
import { WhatsAppEmbeddedSignupPanel } from "@/components/connect/whatsapp-embedded-signup";
import { embeddedSignupPanel } from "@/lib/channels/embedded-signup-gate";

/** Server gate. With the flag unset, this renders nothing. */
export function WhatsAppEmbeddedSignupSlot({
  surface,
  env = process.env,
}: {
  surface: "settings" | "whatsapp";
  env?: NodeJS.ProcessEnv;
}) {
  const panel = embeddedSignupPanel(env);
  if (!panel.visible) return null;
  return <WhatsAppEmbeddedSignupPanel panel={panel} surface={surface} />;
}

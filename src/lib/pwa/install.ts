export type PwaInstallMode = "fixture" | "sandbox";

export const INSTALL_PLATFORMS = [
  {
    id: "ios",
    label: "iOS Safari",
    steps: "Open the command centre in Safari, tap Share, then Add to Home Screen.",
  },
  {
    id: "android",
    label: "Android Chrome",
    steps: "Open the command centre in Chrome, open the menu, then choose Install app or Add to Home screen.",
  },
  {
    id: "windows",
    label: "Windows",
    steps: "Open the command centre in Edge or Chrome, then use the browser install icon or the Apps menu to install the PWA.",
  },
] as const;

export type InstallPlatform = (typeof INSTALL_PLATFORMS)[number]["id"] | "other";

export const FIXTURE_INSTALL_COPY =
  "Fixture only. This page does not write an install event until PWA_INSTALL_SHELL_ENABLED is true and step 31 is applied.";

export const STORE_LISTING_COPY =
  "No store listing is live. Google Play, the Apple App Store, and the Microsoft Store are not submitted. Paid developer accounts need Billy's explicit yes. Nothing is bought on this page.";

/** Unset, blank, or any value other than true does not store an install event. */
export function pwaInstallMode(env: NodeJS.ProcessEnv = process.env): PwaInstallMode {
  return String(env.PWA_INSTALL_SHELL_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function pwaInstallDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): PwaInstallMode {
  if (input.tenantMode !== "member") return "fixture";
  return pwaInstallMode(input.env);
}

export function parseInstallPlatform(value: string): InstallPlatform | null {
  const platform = value.trim().toLowerCase();
  if (platform === "ios" || platform === "android" || platform === "windows" || platform === "other") return platform;
  return null;
}

export function planInstallIntent(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  platform: string;
}): { mode: PwaInstallMode; platform: InstallPlatform | null; write: boolean; message: string } {
  const mode = pwaInstallDisplayMode(input);
  const platform = parseInstallPlatform(input.platform);
  if (mode !== "sandbox") {
    return { mode: "fixture", platform, write: false, message: FIXTURE_INSTALL_COPY };
  }
  if (!platform) {
    return {
      mode,
      platform: null,
      write: false,
      message: "Choose iOS, Android, or Windows. Nothing was written.",
    };
  }
  return {
    mode,
    platform,
    write: true,
    message: "Sandbox install intent can be stored on this workspace. Nothing is sent.",
  };
}

export function missingInstallEventMigration(message: string) {
  return /record_install_intent|install_events|schema cache|could not find the function/i.test(message);
}

export function installEventAccepted(payload: {
  stored?: boolean;
  sandbox?: boolean;
  charged?: boolean;
  intent?: string;
  surface?: string;
  sending_enabled?: boolean;
} | null) {
  return Boolean(
    payload
    && payload.stored === true
    && payload.sandbox === true
    && payload.charged === false
    && payload.intent === "install_intent"
    && payload.surface === "browser"
    && payload.sending_enabled !== true,
  );
}

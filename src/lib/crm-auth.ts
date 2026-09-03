const TOKEN_MESSAGE = "ai-autotech-crm-session-v1";

export const CRM_COOKIE = "crm_session";
export const CRM_UNLOCK_PATH = "/command-centre/unlock";

function encoder() {
  return new TextEncoder();
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualString(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function crmSessionToken(password = process.env.CRM_PASSWORD) {
  if (!password) {
    throw new Error("CRM_PASSWORD is not set. Add it to the server environment to lock the company CRM.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder().encode(TOKEN_MESSAGE));
  return toHex(signature);
}

export async function isValidCrmCookie(value: string | undefined) {
  const password = process.env.CRM_PASSWORD;
  if (!password || !value) {
    return false;
  }

  const expected = await crmSessionToken(password);
  return timingSafeEqualString(value, expected);
}

export function safeCrmRedirect(from: string | null | undefined) {
  if (from && from.startsWith("/command-centre") && !from.startsWith("//")) {
    return from;
  }
  return "/command-centre";
}

export function crmCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CRM_COOKIE,
  CRM_UNLOCK_PATH,
  crmCookieOptions,
  crmSessionToken,
  isValidCrmCookie,
  safeCrmRedirect,
  timingSafeEqualString,
} from "@/lib/crm-auth";

export type UnlockState = {
  ok: boolean;
  message: string;
};

export async function unlockCrm(_state: UnlockState, formData: FormData): Promise<UnlockState> {
  const expected = process.env.CRM_PASSWORD;
  if (!expected) {
    return { ok: false, message: "CRM_PASSWORD is not configured on the server." };
  }

  const password = String(formData.get("password") ?? "");
  const matches =
    password.length === expected.length && timingSafeEqualString(password, expected);
  if (!matches) {
    return { ok: false, message: "Wrong password." };
  }

  const store = await cookies();
  store.set(CRM_COOKIE, await crmSessionToken(expected), crmCookieOptions());
  redirect(safeCrmRedirect(String(formData.get("from") ?? "")));
}

export async function requireCrmSession() {
  const store = await cookies();
  const token = store.get(CRM_COOKIE)?.value;
  if (!(await isValidCrmCookie(token))) {
    redirect(CRM_UNLOCK_PATH);
  }
}

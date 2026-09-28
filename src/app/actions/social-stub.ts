"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  isSocialStubAccount,
  missingSocialStubMigration,
  refuseSocialConnectSend,
  socialConnectDisplayMode,
} from "@/lib/connect/social-stub";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type SocialStubActionState = {
  id: string;
  intent: string;
  stored: boolean;
  refused: boolean;
  queued: 0;
  posted: 0;
  message: string;
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

function secretish(formData: FormData) {
  return ["secret", "api_key", "token", "key", "merchant_key", "access_token", "password", "client_secret"].some((name) => String(formData.get(name) ?? "").trim());
}

type SavedStub = {
  sandbox?: boolean;
  charged?: boolean;
  secret_stored?: boolean;
  provider_keys_present?: boolean;
  status?: string;
  sending_enabled?: boolean;
  queued?: number;
  posted?: number;
};

export async function submitSocialStub(_state: SocialStubActionState, formData: FormData): Promise<SocialStubActionState> {
  const intent = String(formData.get("intent") ?? "");
  const account = String(formData.get("account") ?? "");
  const base = {
    id: crypto.randomUUID(),
    intent,
    queued: 0 as const,
    posted: 0 as const,
  };

  if (secretish(formData)) {
    return {
      ...base,
      stored: false,
      refused: true,
      message: "No key is stored. Nothing was posted.",
    };
  }
  if (!isSocialStubAccount(account)) {
    return {
      ...base,
      stored: false,
      refused: true,
      message: "That account is not a TikTok or LinkedIn stub. Nothing was stored and nothing was posted.",
    };
  }

  if (intent !== "save") {
    const refused = refuseSocialConnectSend({ providerKeysPresent: false, intent: intent || "publish" });
    const { tenant } = await loadCommandData();
    const mode = socialConnectDisplayMode({ tenantMode: tenant.mode });
    if (mode === "sandbox" && tenant.mode === "member" && canManage(tenant.role)) {
      const supabase = await createSupabaseServerClient();
      const saved = await supabase.rpc("refuse_social_connect_send", {
        p_org: tenant.active.id,
        p_account_key: account,
        p_intent: intent,
      });
      const payload = saved.data as { refused?: boolean; queued?: number; posted?: number; provider_keys_present?: boolean; sending_enabled?: boolean } | null;
      if (
        !saved.error
        && (!payload
          || payload.refused !== true
          || Number(payload.queued ?? 0) !== 0
          || Number(payload.posted ?? 0) !== 0
          || payload.provider_keys_present === true
          || payload.sending_enabled === true)
      ) {
        return { ...base, stored: false, refused: true, message: refused.message };
      }
    }
    return { ...base, stored: false, refused: true, message: refused.message };
  }

  const { tenant } = await loadCommandData();
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;
  const mode = socialConnectDisplayMode({ tenantMode: tenant.mode });
  if (mode !== "sandbox" || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      ...base,
      stored: false,
      refused: false,
      message: "Fixture only. The sandbox stub was not stored. No key was stored and nothing was posted.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("save_social_connect_stub", {
    p_org: tenant.active.id,
    p_account_key: account,
  });
  if (saved.error) {
    const message = missingSocialStubMigration(saved.error.message)
      ? "Apply step 28 before a connect stub is stored. No key was stored and nothing was posted."
      : `${saved.error.message} Nothing was posted.`;
    return { ...base, stored: false, refused: true, message };
  }
  const payload = saved.data as SavedStub | null;
  if (
    !payload
    || payload.sandbox !== true
    || payload.charged === true
    || payload.secret_stored === true
    || payload.provider_keys_present === true
    || payload.sending_enabled === true
    || payload.status !== "sandbox_stub"
    || Number(payload.queued ?? 0) !== 0
    || Number(payload.posted ?? 0) !== 0
  ) {
    return { ...base, stored: false, refused: true, message: "The connect stub was refused. No key was stored and nothing was posted." };
  }

  revalidatePath("/command-centre/connect-accounts");
  revalidatePath(`/command-centre/connect-accounts/${account}`);
  return {
    ...base,
    stored: true,
    refused: false,
    message: "Sandbox stub saved. Needs provider keys. No key was stored and nothing was posted.",
  };
}

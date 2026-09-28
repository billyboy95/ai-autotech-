"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/tenant/context";
import {
  isZentrixOutboundIntent,
  missingZentrixPackMigration,
  refuseZentrixOutbound,
  zentrixPackConfirmationOk,
  zentrixPackDisplayMode,
} from "@/lib/zentrix/pack";

export type ApplyZentrixState = {
  ok: boolean;
  stored: boolean;
  refused: boolean;
  queued: 0;
  sent: 0;
  message: string;
};

const fixtureMessage =
  "Fixture only. Apply supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql, then set ZENTRIX_WORKSPACE_PACK_ENABLED to true and sign in as an agency owner or staff member. Nothing was stored. Sending stays off.";

const empty: ApplyZentrixState = {
  ok: false,
  stored: false,
  refused: false,
  queued: 0,
  sent: 0,
  message: "",
};

type PackPayload = {
  slug?: string;
  sending_enabled?: boolean;
  sandbox?: boolean;
  charged?: boolean;
  secret_stored?: boolean;
  provider_keys_present?: boolean;
  published?: boolean;
  queued?: number;
  sent?: number;
  stores?: Array<{ store_key?: string; priority?: boolean; purpose?: string; sandbox?: boolean; charged?: boolean }>;
};

type RefusePayload = {
  refused?: boolean;
  queued?: number;
  posted?: number;
  sent?: number;
  published?: boolean;
  charged?: boolean;
  ad_spend?: boolean;
  sending_enabled?: boolean;
  secret_stored?: boolean;
  provider_keys_present?: boolean;
};

function refusedState(message: string): ApplyZentrixState {
  return { ...empty, refused: true, message };
}

export async function applyZentrixWorkspacePack(
  _state: ApplyZentrixState,
  formData: FormData,
): Promise<ApplyZentrixState> {
  const intent = String(formData.get("intent") ?? "apply");
  const workspace = await resolveWorkspace();
  const mode = zentrixPackDisplayMode({ tenantMode: workspace.mode });

  if (isZentrixOutboundIntent(intent)) {
    const local = refuseZentrixOutbound(intent);
    if (mode === "sandbox" && workspace.mode === "member" && workspace.canManageAgency) {
      const supabase = await createSupabaseServerClient();
      const saved = await supabase.rpc("refuse_zentrix_outbound", {
        p_org: workspace.active.id,
        p_intent: intent.trim().toLowerCase().replace(/[\s-]+/g, "_"),
      });
      const payload = saved.data as RefusePayload | null;
      if (
        saved.error
        || !payload
        || payload.refused !== true
        || Number(payload.queued ?? 0) !== 0
        || Number(payload.posted ?? 0) !== 0
        || Number(payload.sent ?? 0) !== 0
        || payload.published === true
        || payload.charged === true
        || payload.ad_spend === true
        || payload.sending_enabled === true
        || payload.secret_stored === true
        || payload.provider_keys_present === true
      ) {
        return refusedState(local.message);
      }
    }
    return refusedState(local.message);
  }

  if (mode !== "sandbox" || workspace.mode !== "member") {
    return { ...empty, message: fixtureMessage };
  }
  if (!workspace.canManageAgency) {
    return {
      ...empty,
      message: "Sign in as an agency owner or staff member to apply the Zentrix pack. Nothing was stored.",
    };
  }
  if (!zentrixPackConfirmationOk(formData.get("confirm"))) {
    return {
      ...empty,
      message: "Confirm that this applies the Zentrix pack to Zentrix Online only. Nothing was stored.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("apply_zentrix_workspace_pack");
  if (error) {
    const message = missingZentrixPackMigration(error.message)
      ? "Apply step 29 before the Zentrix pack is stored. Nothing was stored and nothing was sent."
      : `${error.message} Nothing was stored and nothing was sent.`;
    return { ...empty, message };
  }

  const applied = data as PackPayload | null;
  const stores = Array.isArray(applied?.stores) ? applied.stores : [];
  const keys = stores.map((store) => store.store_key).sort();
  const priority = stores.filter((store) => store.priority === true).map((store) => store.store_key).sort();
  const safeStores = stores.every((store) => store.sandbox === true && store.charged === false);
  if (
    applied?.slug !== "zentrix"
    || applied.sending_enabled !== false
    || applied.sandbox !== true
    || applied.charged === true
    || applied.secret_stored === true
    || applied.provider_keys_present === true
    || applied.published === true
    || Number(applied.queued ?? 0) !== 0
    || Number(applied.sent ?? 0) !== 0
    || stores.length !== 3
    || !safeStores
    || keys.join(",") !== "auto,kitchens,pets"
    || priority.join(",") !== "kitchens,pets"
  ) {
    return refusedState("The Zentrix pack was refused. Nothing was stored and nothing was sent.");
  }

  revalidatePath("/agency");
  revalidatePath("/agency/zentrix/settings");
  return {
    ok: true,
    stored: true,
    refused: false,
    queued: 0,
    sent: 0,
    message:
      "Zentrix pack applied to Zentrix Online. Pets and Kitchens are priority. Auto is QA / reference. Nothing was sent, nothing was charged, and sending stays off.",
  };
}

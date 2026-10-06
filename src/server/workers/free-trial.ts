import type { EnvLike } from "@/lib/automation/channels";
import { FREE_TRIAL_UNAVAILABLE, TRIAL_WARN_DAYS, freeTrialEnabled } from "@/lib/trial/trial";
import { callServiceRpc, createConfirmedUser } from "@/server/workers/with-org";

export type TrialRpcRow = {
  ok?: boolean;
  stored?: boolean;
  created?: boolean;
  idempotent?: boolean;
  slug?: string;
  lead_id?: string;
  ends_at?: string;
  status?: string;
  sending_enabled?: boolean;
  charged?: boolean;
  paused?: number;
  warned?: number;
  deleted?: number;
};

export async function startPublicTrial(input: {
  snapshotId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  days: number;
  ipHash: string;
  honeypot: string;
  env?: EnvLike;
}) {
  if (!freeTrialEnabled(input.env)) {
    return {
      ok: false as const,
      stored: false as const,
      created: false as const,
      message: FREE_TRIAL_UNAVAILABLE,
      sendingEnabled: false as const,
      charged: false as const,
    };
  }
  const result = await callServiceRpc("start_free_trial", {
    p_snapshot_id: input.snapshotId,
    p_business_name: input.businessName,
    p_contact_name: input.contactName,
    p_email: input.email,
    p_phone: input.phone,
    p_popia: true,
    p_days: input.days,
    p_ip_hash: input.ipHash,
    p_honeypot: input.honeypot,
    p_now: new Date().toISOString(),
  });
  if (!result.configured) {
    return {
      ok: false as const,
      stored: false as const,
      created: false as const,
      message: "Trial storage is not configured. Nothing was created.",
      sendingEnabled: false as const,
      charged: false as const,
    };
  }
  if (result.error) {
    const text = result.error.message;
    return {
      ok: false as const,
      stored: false as const,
      created: false as const,
      message: /already used a free trial/i.test(text)
        ? "This email already used a free trial. Nothing new was created."
        : /does not exist|schema cache|could not find|start_free_trial/i.test(text)
          ? "Apply supabase/migrations/20261112120200_phase5p_free_trial.sql before a trial is created. Nothing was written."
          : text,
      sendingEnabled: false as const,
      charged: false as const,
    };
  }
  const row = (result.data ?? {}) as TrialRpcRow;
  if (row.sending_enabled !== false && row.stored !== false) {
    return {
      ok: false as const,
      stored: false as const,
      created: false as const,
      message: "The trial was not created. Sending stays off.",
      sendingEnabled: false as const,
      charged: false as const,
    };
  }
  return {
    ok: true as const,
    stored: row.stored !== false,
    created: Boolean(row.created),
    idempotent: Boolean(row.idempotent),
    slug: row.slug ? String(row.slug) : "",
    leadId: row.lead_id ? String(row.lead_id) : "",
    endsAt: row.ends_at ? String(row.ends_at) : "",
    message: row.stored === false ? "Your trial request was received." : "",
    sendingEnabled: false as const,
    charged: false as const,
  };
}

export async function provisionTrialUser(email: string, password: string) {
  return createConfirmedUser(email, password);
}

export async function runTrialCron(env: EnvLike = process.env, now = new Date()) {
  if (!freeTrialEnabled(env)) {
    return {
      ok: true as const,
      skipped: true,
      paused: 0,
      warned: 0,
      deleted: 0,
      charged: false as const,
      reason: "FREE_TRIAL_ENABLED is not the string true.",
    };
  }
  const result = await callServiceRpc("expire_free_trials", {
    p_now: now.toISOString(),
    p_warn_days: TRIAL_WARN_DAYS,
  });
  if (!result.configured) {
    return {
      ok: true as const,
      skipped: true,
      paused: 0,
      warned: 0,
      deleted: 0,
      charged: false as const,
      reason: "Supabase service role is not configured. No trial was paused.",
    };
  }
  if (result.error) {
    return {
      ok: false as const,
      skipped: false,
      paused: 0,
      warned: 0,
      deleted: 0,
      charged: false as const,
      error: result.error.message,
    };
  }
  const row = (result.data ?? {}) as TrialRpcRow;
  return {
    ok: true as const,
    skipped: false,
    paused: Number(row.paused ?? 0),
    warned: Number(row.warned ?? 0),
    deleted: Number(row.deleted ?? 0),
    charged: false as const,
  };
}

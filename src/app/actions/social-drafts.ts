"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  EMPTY_SOCIAL_DRAFT_ACTION,
  isPublishIntent,
  johannesburgTimestamp,
  missingSocialDraftMigration,
  planSocialDraft,
  refuseSocialPublish,
  socialDraftsDisplayMode,
  week1Topic,
  type SocialDraft,
  type SocialDraftPlatform,
} from "@/lib/social/drafts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type SocialDraftActionState = typeof EMPTY_SOCIAL_DRAFT_ACTION;

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

type SavedDraft = {
  id?: string;
  topic_key?: string;
  platform?: string;
  status?: string;
  scheduled_for?: string | null;
  sandbox?: boolean;
  charged?: boolean;
  published?: boolean;
  queued?: number;
  posted?: number;
  sent?: number;
  sending_enabled?: boolean;
};

function refusedState(intent: string, message: string): SocialDraftActionState {
  return {
    id: crypto.randomUUID(),
    intent,
    stored: false,
    refused: true,
    queued: 0,
    posted: 0,
    message,
    draft: null,
  };
}

export async function submitSocialDraft(_state: SocialDraftActionState, formData: FormData): Promise<SocialDraftActionState> {
  const intent = String(formData.get("intent") ?? "");
  const planned = planSocialDraft({
    intent,
    topicKey: String(formData.get("topicKey") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    body: String(formData.get("body") ?? ""),
    scheduledLocal: String(formData.get("scheduledFor") ?? ""),
  });

  if (planned.refused || isPublishIntent(intent)) {
    const message = isPublishIntent(intent) ? refuseSocialPublish(intent).message : planned.message;
    const { tenant } = await loadCommandData();
    const mode = socialDraftsDisplayMode({ tenantMode: tenant.mode });
    const slug = String(formData.get("slug") ?? "");
    const sameWorkspace = !slug || slug === tenant.active.slug;
    if (mode === "sandbox" && tenant.mode === "member" && canManage(tenant.role) && sameWorkspace && isPublishIntent(intent)) {
      const supabase = await createSupabaseServerClient();
      const normalized = intent.trim().toLowerCase().replace(/[_-]+/g, " ");
      const rpcIntent = normalized === "post now" ? "post_now" : normalized === "go live" ? "go_live" : "publish";
      const saved = await supabase.rpc("refuse_social_publish", {
        p_org: tenant.active.id,
        p_intent: rpcIntent,
      });
      const payload = saved.data as { refused?: boolean; queued?: number; posted?: number; sent?: number; published?: boolean; sending_enabled?: boolean } | null;
      if (
        !saved.error
        && (!payload
          || payload.refused !== true
          || Number(payload.queued ?? 0) !== 0
          || Number(payload.posted ?? 0) !== 0
          || Number(payload.sent ?? 0) !== 0
          || payload.published === true
          || payload.sending_enabled === true)
      ) {
        return refusedState(intent, refuseSocialPublish(intent).message);
      }
    }
    return refusedState(intent, message);
  }

  const { tenant } = await loadCommandData();
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;
  const mode = socialDraftsDisplayMode({ tenantMode: tenant.mode });
  if (mode !== "sandbox" || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace || !planned.draft) {
    return {
      id: crypto.randomUUID(),
      intent,
      stored: false,
      refused: false,
      queued: 0,
      posted: 0,
      message: "Fixture only. The draft was not stored. Nothing was posted.",
      draft: planned.draft,
    };
  }

  const scheduledFor = planned.draft.status === "scheduled" ? johannesburgTimestamp(planned.draft.scheduledLocal) : null;
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("save_social_draft", {
    p_org: tenant.active.id,
    p_topic_key: planned.draft.topicKey,
    p_platform: planned.draft.platform,
    p_body: planned.draft.body,
    p_scheduled_for: scheduledFor,
  });
  if (saved.error) {
    const message = missingSocialDraftMigration(saved.error.message)
      ? "Apply step 28 before a social draft is stored. Nothing was posted."
      : `${saved.error.message} Nothing was posted.`;
    return refusedState(intent, message);
  }

  const payload = saved.data as SavedDraft | null;
  const topic = payload ? week1Topic(String(payload.topic_key ?? "")) : null;
  const platform = String(payload?.platform ?? "");
  const validPlatform = platform === "facebook" || platform === "instagram" || platform === "linkedin" || platform === "tiktok";
  if (
    !payload
    || !topic
    || !validPlatform
    || payload.sandbox !== true
    || payload.charged === true
    || payload.published === true
    || payload.sending_enabled === true
    || Number(payload.queued ?? 0) !== 0
    || Number(payload.posted ?? 0) !== 0
    || Number(payload.sent ?? 0) !== 0
    || (planned.draft.status === "scheduled" ? payload.status !== "scheduled" : payload.status !== "draft")
  ) {
    return refusedState(intent, "The draft was refused. Nothing was posted.");
  }

  const draft: SocialDraft = {
    ...planned.draft,
    id: String(payload.id ?? ""),
    platform: platform as SocialDraftPlatform,
    status: payload.status === "scheduled" ? "scheduled" : "draft",
    stored: true,
  };
  revalidatePath("/command-centre/social");
  return {
    id: crypto.randomUUID(),
    intent,
    stored: true,
    refused: false,
    queued: 0,
    posted: 0,
    message: planned.message,
    draft,
  };
}

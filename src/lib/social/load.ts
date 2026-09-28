import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mergeWeek1Drafts,
  missingSocialDraftMigration,
  socialDraftsDisplayMode,
  toJohannesburgLocal,
  week1Topic,
  type SocialDraft,
  type SocialDraftMode,
  type SocialDraftPlatform,
} from "@/lib/social/drafts";

export type SocialDraftPage = {
  mode: SocialDraftMode;
  drafts: SocialDraft[];
  notice: string | null;
};

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isPlatform(value: string): value is SocialDraftPlatform {
  return value === "facebook" || value === "instagram" || value === "linkedin" || value === "tiktok";
}

export async function loadSocialDrafts(input: { mode: string; orgId: string }): Promise<SocialDraftPage> {
  const display = socialDraftsDisplayMode({ tenantMode: input.mode });
  if (!configured() || display !== "sandbox" || input.orgId.startsWith("preview-")) {
    return { mode: "fixture", drafts: mergeWeek1Drafts([]), notice: null };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await supabase
    .from("social_drafts")
    .select("id, topic_key, platform, body, scheduled_for, status")
    .eq("org_id", input.orgId);
  if (saved.error) {
    return {
      mode: "sandbox",
      drafts: mergeWeek1Drafts([]),
      notice: missingSocialDraftMigration(saved.error.message)
        ? "Sandbox stub. Apply step 28 before a social draft is stored. Nothing is posted."
        : saved.error.message,
    };
  }

  const stored: SocialDraft[] = [];
  for (const row of saved.data ?? []) {
    const topic = week1Topic(String(row.topic_key));
    const platform = String(row.platform);
    if (!topic || !isPlatform(platform)) continue;
    const scheduledFor = row.scheduled_for ? String(row.scheduled_for) : null;
    stored.push({
      id: String(row.id),
      topicKey: topic.key,
      day: topic.day,
      title: topic.title,
      platform,
      body: String(row.body),
      scheduledFor,
      scheduledLocal: toJohannesburgLocal(scheduledFor),
      status: row.status === "scheduled" ? "scheduled" : "draft",
      stored: true,
    });
  }

  return { mode: "sandbox", drafts: mergeWeek1Drafts(stored), notice: null };
}

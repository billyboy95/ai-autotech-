export type SocialDraftMode = "fixture" | "sandbox";

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok"] as const;

export type SocialDraftPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialDraftStatus = "draft" | "scheduled";

export type Week1Topic = {
  key: string;
  day: string;
  title: string;
  body: string;
};

/** Starter topics for week 1. Each one stays a draft until Billy approves a send, which this phase does not do. */
export const WEEK_1_TOPICS: Week1Topic[] = [
  {
    key: "week1-intro",
    day: "Monday",
    title: "Introduce the business",
    body: "Week 1, Monday. Introduce who we help and what we do. This is a sandbox draft. Nothing is published.",
  },
  {
    key: "week1-problem",
    day: "Tuesday",
    title: "One problem we solve",
    body: "Week 1, Tuesday. Name one problem the customer has. This is a sandbox draft. Nothing is published.",
  },
  {
    key: "week1-how",
    day: "Wednesday",
    title: "How it works",
    body: "Week 1, Wednesday. A short how-it-works. This is a sandbox draft. Nothing is published.",
  },
  {
    key: "week1-proof",
    day: "Thursday",
    title: "Proof without a real name",
    body: "Week 1, Thursday. A placeholder result. No customer name is used. This is a sandbox draft. Nothing is published.",
  },
  {
    key: "week1-offer",
    day: "Friday",
    title: "Offer a conversation",
    body: "Week 1, Friday. Invite a conversation. This is a sandbox draft. Nothing is published.",
  },
];

export type SocialDraft = {
  id: string;
  topicKey: string;
  day: string;
  title: string;
  platform: SocialDraftPlatform;
  body: string;
  scheduledFor: string | null;
  scheduledLocal: string;
  status: SocialDraftStatus;
  stored: boolean;
};

export type SocialDraftPlan = {
  refused: boolean;
  queued: 0;
  posted: 0;
  message: string;
  draft: SocialDraft | null;
};

export const EMPTY_SOCIAL_DRAFT_ACTION = {
  id: "",
  intent: "",
  stored: false,
  refused: false,
  queued: 0 as const,
  posted: 0 as const,
  message: "",
  draft: null as SocialDraft | null,
};

/** Unset, blank, or any value other than true does not store a social draft. */
export function socialDraftsMode(env: NodeJS.ProcessEnv = process.env): SocialDraftMode {
  return String(env.SOCIAL_DRAFTS_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function socialDraftsDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): SocialDraftMode {
  if (input.tenantMode !== "member") return "fixture";
  return socialDraftsMode(input.env);
}

export function week1Topic(key: string) {
  return WEEK_1_TOPICS.find((topic) => topic.key === key) ?? null;
}

export function isSocialDraftPlatform(value: string): value is SocialDraftPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export function isPublishIntent(intent: string) {
  const value = intent.trim().toLowerCase().replace(/[_-]+/g, " ");
  return value === "publish" || value === "post now" || value === "go live" || value === "golive" || value === "post";
}

export function publishIntentLabel(intent: string) {
  const value = intent.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (value === "post now") return "Post now";
  if (value === "go live" || value === "golive") return "Go live";
  if (value === "post") return "Post";
  return "Publish";
}

/** Publish, Post now, and Go live never post. Billy has to approve sends, and this phase does not do that. */
export function refuseSocialPublish(intent: string) {
  return {
    refused: true as const,
    queued: 0 as const,
    posted: 0 as const,
    message: `Billy must approve sends. ${publishIntentLabel(intent)} is refused. Nothing was posted.`,
  };
}

export function fixtureSocialDrafts(): SocialDraft[] {
  return WEEK_1_TOPICS.map((topic) => fixtureDraft(topic));
}

export function mergeWeek1Drafts(stored: SocialDraft[]): SocialDraft[] {
  const byTopic = new Map(stored.map((draft) => [draft.topicKey, draft]));
  return WEEK_1_TOPICS.map((topic) => byTopic.get(topic.key) ?? fixtureDraft(topic));
}

/** datetime-local in Africa/Johannesburg (SAST, UTC+2, no daylight saving). */
export function johannesburgTimestamp(local: string): string | null {
  const value = local.trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const iso = `${value}:00+02:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
}

export function toJohannesburgLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const local = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? local : "";
}

export function planSocialDraft(input: {
  intent: string;
  topicKey: string;
  platform: string;
  body: string;
  scheduledLocal: string;
}): SocialDraftPlan {
  if (isPublishIntent(input.intent)) {
    const refused = refuseSocialPublish(input.intent);
    return { ...refused, draft: null };
  }

  const intent = input.intent.trim().toLowerCase();
  if (intent !== "save" && intent !== "schedule") {
    return {
      refused: true,
      queued: 0,
      posted: 0,
      message: "Sandbox draft only. Nothing was posted.",
      draft: null,
    };
  }

  const topic = week1Topic(input.topicKey);
  if (!topic) {
    return {
      refused: true,
      queued: 0,
      posted: 0,
      message: "Choose a week 1 topic. Nothing was posted.",
      draft: null,
    };
  }
  if (!isSocialDraftPlatform(input.platform)) {
    return {
      refused: true,
      queued: 0,
      posted: 0,
      message: "Choose Facebook, Instagram, LinkedIn, or TikTok. Nothing was posted.",
      draft: null,
    };
  }

  const body = input.body.trim();
  if (!body || body.length > 2000) {
    return {
      refused: true,
      queued: 0,
      posted: 0,
      message: "Write the draft before saving. Nothing was posted.",
      draft: null,
    };
  }

  const scheduledFor = intent === "schedule" ? johannesburgTimestamp(input.scheduledLocal) : null;
  if (intent === "schedule" && !scheduledFor) {
    return {
      refused: true,
      queued: 0,
      posted: 0,
      message: "Choose a local time before scheduling. Nothing was posted.",
      draft: null,
    };
  }

  const draft: SocialDraft = {
    id: "",
    topicKey: topic.key,
    day: topic.day,
    title: topic.title,
    platform: input.platform,
    body,
    scheduledFor,
    scheduledLocal: scheduledFor ? input.scheduledLocal.trim() : "",
    status: scheduledFor ? "scheduled" : "draft",
    stored: false,
  };
  return {
    refused: false,
    queued: 0,
    posted: 0,
    message: scheduledFor
      ? "Scheduled locally. Nothing was posted."
      : "Sandbox draft saved. Nothing was posted.",
    draft,
  };
}

export function missingSocialDraftMigration(message: string) {
  return /social_drafts|save_social_draft|refuse_social_publish|schema cache|could not find the function/i.test(message);
}

function fixtureDraft(topic: Week1Topic): SocialDraft {
  return {
    id: "",
    topicKey: topic.key,
    day: topic.day,
    title: topic.title,
    platform: "facebook",
    body: topic.body,
    scheduledFor: null,
    scheduledLocal: "",
    status: "draft",
    stored: false,
  };
}

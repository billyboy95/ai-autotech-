import { isSendEnabled, type EnvLike } from "@/lib/automation/channels";
import { newId } from "@/lib/automation/ids";
import type { AutomationState, SocialPlatform, SocialPost, TrackedClick } from "@/lib/automation/types";

const FIXED_HOSTS = new Set(["aiautotech.co.za", "www.aiautotech.co.za"]);

export type PublishResult = {
  status: "queued" | "published" | "failed";
  provider: string;
  providerId: string;
  error: string;
  copyText: string;
  publishedAt: string | null;
};

export function queueSocialPost(
  state: AutomationState,
  input: {
    platform: SocialPlatform;
    body: string;
    mediaUrl?: string;
    linkUrl?: string;
    scheduledFor: string;
    utmSource?: string;
    utmCampaign?: string;
  },
  env: EnvLike = process.env,
): AutomationState {
  const post: SocialPost = {
    id: newId("post"),
    platform: input.platform,
    body: input.body.trim(),
    mediaUrl: (input.mediaUrl || "").trim(),
    linkUrl: (input.linkUrl || "").trim() || "https://aiautotech.co.za/audit",
    scheduledFor: input.scheduledFor,
    status: "queued",
    utmSource: (input.utmSource || "").trim() || input.platform,
    utmCampaign: (input.utmCampaign || "").trim() || "social",
    copyText: "",
    provider: "copy",
    providerId: "",
    error: "",
    publishedAt: null,
    createdAt: new Date().toISOString(),
  };
  post.copyText = buildCopyText(post, env);
  return { ...state, socialPosts: [post, ...state.socialPosts] };
}

export function approveSocialPost(state: AutomationState, postId: string): AutomationState {
  return {
    ...state,
    socialPosts: state.socialPosts.map((post) =>
      post.id === postId && (post.status === "queued" || post.status === "failed") ? { ...post, status: "approved", error: "" } : post,
    ),
  };
}

export function cancelSocialPost(state: AutomationState, postId: string): AutomationState {
  return {
    ...state,
    socialPosts: state.socialPosts.map((post) =>
      post.id === postId && post.status !== "published" ? { ...post, status: "cancelled" } : post,
    ),
  };
}

export function recordClick(
  state: AutomationState,
  input: { postId?: string | null; utmSource: string; utmCampaign: string; utmMedium: string; destination: string },
  now: Date,
): AutomationState {
  const click: TrackedClick = {
    id: newId("clk"),
    postId: input.postId || null,
    utmSource: input.utmSource,
    utmCampaign: input.utmCampaign,
    utmMedium: input.utmMedium,
    destination: input.destination,
    leadId: null,
    createdAt: now.toISOString(),
  };
  return { ...state, clicks: [...state.clicks, click] };
}

export function claimClick(state: AutomationState, leadId: string, utmSource: string, campaign: string) {
  if (!campaign) return { state, click: undefined as TrackedClick | undefined };
  const candidates = state.clicks
    .filter((click) => !click.leadId && click.utmCampaign === campaign)
    .filter((click) => !utmSource || !click.utmSource || click.utmSource === utmSource)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const click = candidates[0];
  if (!click) return { state, click: undefined as TrackedClick | undefined };
  return {
    click,
    state: {
      ...state,
      clicks: state.clicks.map((item) => (item.id === click.id ? { ...item, leadId } : item)),
    },
  };
}

export async function publishDuePosts(
  state: AutomationState,
  now: Date,
  env: EnvLike = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<AutomationState> {
  const socialPosts = state.socialPosts.map((post) => {
    if (post.status === "cancelled" || post.status === "published") return post;
    return { ...post, copyText: post.copyText || buildCopyText(post, env) };
  });
  if (!isSendEnabled(env)) return { ...state, socialPosts };

  let next: AutomationState = { ...state, socialPosts };
  for (const post of socialPosts) {
    if (post.status !== "queued" && post.status !== "approved") continue;
    if (new Date(post.scheduledFor).getTime() > now.getTime()) continue;
    const result = await publishPost(post, env, fetchImpl, now);
    next = {
      ...next,
      socialPosts: next.socialPosts.map((item) =>
        item.id === post.id
          ? {
              ...item,
              status: result.status === "published" ? "published" : result.status === "failed" ? "failed" : item.status,
              provider: result.provider,
              providerId: result.providerId,
              error: result.error,
              copyText: result.copyText || item.copyText,
              publishedAt: result.publishedAt,
            }
          : item,
      ),
    };
  }
  return next;
}

export async function publishPost(
  post: SocialPost,
  env: EnvLike = process.env,
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<PublishResult> {
  const copyText = buildCopyText(post, env);
  if (!isSendEnabled(env)) {
    return { status: "queued", provider: "copy", providerId: "", error: "", copyText, publishedAt: null };
  }
  if (post.platform === "facebook") return publishFacebook(post, env, fetchImpl, now, copyText);
  if (post.platform === "instagram") return publishInstagram(post, env, fetchImpl, now, copyText);
  return publishLinkedIn(post, env, fetchImpl, now, copyText);
}

export function buildCopyText(post: SocialPost, env: EnvLike = process.env) {
  const link = trackedUrl(post, env);
  return [post.body.trim(), link, `Copy and post this on ${post.platform}.`].filter(Boolean).join("\n\n");
}

export function trackedUrl(post: Pick<SocialPost, "id" | "linkUrl" | "utmSource" | "utmCampaign" | "platform">, env: EnvLike = process.env) {
  const site = (env.NEXT_PUBLIC_SITE_URL || "https://ai-autotech-crm.vercel.app").replace(/\/$/, "");
  const params = new URLSearchParams({
    to: post.linkUrl || "https://aiautotech.co.za/audit",
    utm_source: post.utmSource || post.platform,
    utm_medium: "social",
    utm_campaign: post.utmCampaign || "social",
  });
  if (post.id) params.set("post", post.id);
  return `${site}/api/public/go?${params.toString()}`;
}

export function resolvePublicRedirect(to: string, env: EnvLike = process.env, extraOrigins: string[] = []): string | null {
  const raw = to.trim();
  if (!raw || raw.startsWith("//") || /[\s<>]/.test(raw)) return null;
  let target: URL;
  if (raw.startsWith("/")) {
    const site = (env.NEXT_PUBLIC_SITE_URL || "https://aiautotech.co.za").replace(/\/$/, "");
    try {
      target = new URL(raw, site);
    } catch {
      return null;
    }
  } else {
    try {
      target = new URL(raw);
    } catch {
      return null;
    }
  }
  if (target.protocol !== "https:") return null;
  if (target.username || target.password) return null;
  const allowed = new Set(FIXED_HOSTS);
  for (const origin of [env.NEXT_PUBLIC_SITE_URL, env.NEXT_PUBLIC_CALENDLY_URL, ...extraOrigins]) {
    const host = hostOf(origin);
    if (host) allowed.add(host);
  }
  if (!allowed.has(target.hostname.toLowerCase())) return null;
  return target.toString();
}

function hostOf(value: string | undefined) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function publishFacebook(post: SocialPost, env: EnvLike, fetchImpl: typeof fetch, now: Date, copyText: string): Promise<PublishResult> {
  const pageId = env.META_PAGE_ID || "";
  const token = env.META_PAGE_ACCESS_TOKEN || "";
  if (!pageId || !token) {
    return failed("facebook", "Set META_PAGE_ID and META_PAGE_ACCESS_TOKEN.", copyText);
  }
  const version = env.META_GRAPH_VERSION || env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const body = new URLSearchParams({ message: post.body, link: trackedUrl(post, env), access_token: token });
  const response = await fetchImpl(`https://graph.facebook.com/${version}/${pageId}/feed`, { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!response.ok) return failed("facebook", payload.error?.message || `Facebook returned ${response.status}`, copyText);
  return published("facebook", payload.id || "", copyText, now);
}

async function publishInstagram(post: SocialPost, env: EnvLike, fetchImpl: typeof fetch, now: Date, copyText: string): Promise<PublishResult> {
  const igId = env.META_IG_USER_ID || "";
  const token = env.META_PAGE_ACCESS_TOKEN || "";
  if (!igId || !token) return failed("instagram", "Set META_IG_USER_ID and META_PAGE_ACCESS_TOKEN.", copyText);
  if (!post.mediaUrl) {
    return failed("instagram", "Instagram needs a public image URL. Copy and post it by hand.", copyText);
  }
  const version = env.META_GRAPH_VERSION || env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const caption = `${post.body}\n\n${trackedUrl(post, env)}`.trim();
  const created = await fetchImpl(`https://graph.facebook.com/${version}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: post.mediaUrl, caption, access_token: token }),
  });
  const container = (await created.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!created.ok || !container.id) return failed("instagram", container.error?.message || `Instagram returned ${created.status}`, copyText);
  const publishedResponse = await fetchImpl(`https://graph.facebook.com/${version}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const payload = (await publishedResponse.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!publishedResponse.ok) return failed("instagram", payload.error?.message || `Instagram publish returned ${publishedResponse.status}`, copyText);
  return published("instagram", payload.id || "", copyText, now);
}

async function publishLinkedIn(post: SocialPost, env: EnvLike, fetchImpl: typeof fetch, now: Date, copyText: string): Promise<PublishResult> {
  const token = env.LINKEDIN_ACCESS_TOKEN || "";
  const author = env.LINKEDIN_AUTHOR_URN || "";
  if (!token || !author) return failed("linkedin", "Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN.", copyText);
  const version = env.LINKEDIN_VERSION || "202502";
  const link = trackedUrl(post, env);
  const response = await fetchImpl("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": version,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      author,
      commentary: `${post.body}\n\n${link}`.trim(),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { article: { source: link, title: post.utmCampaign || "AI AutoTech" } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    const headerId = response.headers.get("x-restli-id") || "";
    if (!headerId) return failed("linkedin", payload.message || `LinkedIn returned ${response.status}`, copyText);
    return published("linkedin", headerId, copyText, now);
  }
  return published("linkedin", payload.id || response.headers.get("x-restli-id") || "", copyText, now);
}

function failed(provider: string, error: string, copyText: string): PublishResult {
  return { status: "failed", provider, providerId: "", error, copyText, publishedAt: null };
}

function published(provider: string, providerId: string, copyText: string, now: Date): PublishResult {
  return { status: "published", provider, providerId, error: "", copyText, publishedAt: now.toISOString() };
}

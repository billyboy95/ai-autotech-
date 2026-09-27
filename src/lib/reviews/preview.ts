import { REVIEW_REQUEST_BODY, reviewPublicPath, reviewRequestConsentText } from "@/lib/reviews/plan";
import type { PublicReviewPage, ReviewDesk } from "@/lib/reviews/types";

const PREVIEW_ORGS = {
  "ai-autotech": "AI AutoTech Pty Ltd",
  eastc: "East Sea Technocentric Varsity (EASTC)",
  zentrix: "Zentrix Online",
} as const;

export function previewReviewDesk(orgSlug: string, siteUrl: string): ReviewDesk {
  const slug = orgSlug in PREVIEW_ORGS ? orgSlug : "ai-autotech";
  const senderName = PREVIEW_ORGS[slug as keyof typeof PREVIEW_ORGS];
  return {
    preview: true,
    notice: "Preview workspace. Connect Supabase to save reviews. Nothing is stored and nothing is sent.",
    canManage: false,
    orgSlug: slug,
    senderName,
    siteUrl,
    publicPath: reviewPublicPath(slug),
    consentText: reviewRequestConsentText(senderName),
    defaultBody: REVIEW_REQUEST_BODY,
    average: 5,
    count: 1,
    ratingFilter: null,
    reviews: [{
      id: "preview-review",
      rating: 5,
      comment: "Preview only. Nothing is stored.",
      source: "public",
      reviewerName: "Preview guest",
      publicToken: "preview",
      createdAt: "2026-09-01T08:00:00.000Z",
      respondedAt: null,
      responseNote: "",
    }],
    requests: [],
    templates: [],
  };
}

export function previewPublicReview(key: string): PublicReviewPage {
  const slug = key in PREVIEW_ORGS ? key : "";
  if (!slug) {
    return { kind: "missing", preview: true, key, message: "This review page is not active." };
  }
  const senderName = PREVIEW_ORGS[slug as keyof typeof PREVIEW_ORGS];
  return {
    kind: "form",
    preview: true,
    key: slug,
    orgName: senderName,
    orgSlug: slug,
    senderName,
    average: 5,
    count: 1,
    recent: [{
      rating: 5,
      comment: "Preview only. Nothing is stored.",
      name: "Preview guest",
      source: "public",
      createdAt: "2026-09-01T08:00:00.000Z",
    }],
  };
}

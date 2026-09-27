import { filterByRating, canManageReviews, missingReviewTable, reviewAggregate, reviewPublicPath, REVIEW_REQUEST_BODY, reviewRequestConsentText } from "@/lib/reviews/plan";
import { previewReviewDesk } from "@/lib/reviews/preview";
import type { ReviewDesk, ReviewRow } from "@/lib/reviews/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

function asReview(row: {
  id: string;
  rating: number;
  comment: string;
  source: string;
  reviewer_name: string;
  public_token: string;
  created_at: string;
  responded_at: string | null;
  response_note: string;
}): ReviewRow {
  return {
    id: String(row.id),
    rating: Number(row.rating),
    comment: String(row.comment || ""),
    source: String(row.source || "manual"),
    reviewerName: String(row.reviewer_name || ""),
    publicToken: String(row.public_token || ""),
    createdAt: String(row.created_at || ""),
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    responseNote: String(row.response_note || ""),
  };
}

export async function loadReviewDesk(input: {
  org?: string | null;
  rating?: string | null;
  notice?: string | null;
}): Promise<ReviewDesk> {
  const tenant = await safeResolveWorkspace(input.org);
  const preview = previewReviewDesk(tenant.active.slug, siteUrl());
  const filteredPreview = filterByRating(preview.reviews, input.rating);
  preview.reviews = filteredPreview.rows;
  preview.ratingFilter = filteredPreview.rating;
  if (input.notice) preview.notice = input.notice;
  const connected = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!connected || tenant.mode !== "member" || !tenant.scoped || tenant.active.id.startsWith("preview-")) {
    return preview;
  }

  const senderName = tenant.active.senderName || tenant.active.name;
  const desk: ReviewDesk = {
    ...preview,
    preview: false,
    notice: input.notice ?? null,
    canManage: canManageReviews(tenant.role),
    orgSlug: tenant.active.slug,
    senderName,
    publicPath: reviewPublicPath(tenant.active.slug),
    consentText: reviewRequestConsentText(senderName),
    defaultBody: REVIEW_REQUEST_BODY,
    average: null,
    count: 0,
    reviews: [],
    requests: [],
    templates: [],
  };

  try {
    const supabase = await createSupabaseServerClient();
    const [reviews, requests, templates, aggregate] = await Promise.all([
      supabase
        .from("reviews")
        .select("id, rating, comment, source, reviewer_name, public_token, created_at, responded_at, response_note")
        .eq("org_id", tenant.active.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("review_requests")
        .select("id, channel, to_address, status, public_token, created_at")
        .eq("org_id", tenant.active.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("review_templates")
        .select("id, name, channel, subject, body")
        .eq("org_id", tenant.active.id)
        .eq("active", true)
        .order("name"),
      supabase.rpc("review_aggregate", { p_org: tenant.active.id }),
    ]);
    const failed = reviews.error || requests.error || templates.error;
    if (failed) {
      desk.notice = missingReviewTable(failed.message)
        ? "Review tables are not in this database yet. Apply phase 3c before saving. Nothing was stored and nothing was sent."
        : failed.message;
      desk.canManage = false;
      return desk;
    }
    const rows = (reviews.data ?? []).map((row) => asReview(row));
    const summary = reviewAggregate(rows);
    const payload = aggregate.data as { count?: number | string; average?: number | string | null } | null;
    if (!aggregate.error && payload && payload.count != null) {
      desk.count = Number(payload.count) || 0;
      desk.average = payload.average == null || payload.average === "" ? null : Number(payload.average);
    } else {
      desk.count = summary.count;
      desk.average = summary.average;
    }
    const filtered = filterByRating(rows, input.rating);
    desk.reviews = filtered.rows;
    desk.ratingFilter = filtered.rating;
    desk.requests = (requests.data ?? []).map((row) => ({
      id: String(row.id),
      channel: String(row.channel),
      toAddress: String(row.to_address || ""),
      status: String(row.status || "draft"),
      publicToken: String(row.public_token || ""),
      createdAt: String(row.created_at || ""),
    }));
    desk.templates = (templates.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      channel: String(row.channel),
      subject: String(row.subject || ""),
      body: String(row.body || ""),
    }));
    return desk;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reviews could not be loaded.";
    desk.notice = missingReviewTable(message)
      ? "Review tables are not in this database yet. Apply phase 3c before saving. Nothing was stored and nothing was sent."
      : message;
    desk.canManage = false;
    return desk;
  }
}

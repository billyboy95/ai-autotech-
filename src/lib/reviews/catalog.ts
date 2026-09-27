import type { PublicReviewPage, ReviewCatalog } from "@/lib/reviews/types";

function asNumber(value: unknown, fallback: number | null = null) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function pageFromCatalog(key: string, payload: ReviewCatalog, preview: boolean): PublicReviewPage {
  if (payload.kind !== "org") {
    return { kind: "missing", preview, key, message: "This review page is not active." };
  }
  const recent = (payload.recent ?? []).map((row) => ({
    rating: asNumber(row.rating, 0) ?? 0,
    comment: String(row.comment || ""),
    name: String(row.name || ""),
    source: String(row.source || "public"),
    createdAt: String(row.createdAt || ""),
  }));
  return {
    kind: "form",
    preview,
    key,
    orgName: String(payload.orgName || "Workspace"),
    orgSlug: String(payload.orgSlug || key),
    senderName: String(payload.senderName || payload.orgName || "This workspace"),
    average: asNumber(payload.average, null),
    count: asNumber(payload.count, 0) ?? 0,
    recent,
  };
}

import { pageFromCatalog } from "@/lib/reviews/catalog";
import { missingReviewTable } from "@/lib/reviews/plan";
import { previewPublicReview } from "@/lib/reviews/preview";
import type { PublicReviewPage } from "@/lib/reviews/types";
import { fetchReviewCatalog, serviceConfigured } from "@/server/workers/reviews";

export async function loadPublicReview(key: string): Promise<PublicReviewPage> {
  const safe = key.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(safe)) {
    return { kind: "missing", preview: false, key: safe, message: "This review page is not active." };
  }
  if (!serviceConfigured()) return previewPublicReview(safe);
  const loaded = await fetchReviewCatalog(safe);
  if (!loaded.configured) return previewPublicReview(safe);
  if (loaded.error) {
    return {
      kind: "missing",
      preview: false,
      key: safe,
      message: missingReviewTable(loaded.error)
        ? "Reviews are not available until the review migration is applied. Nothing was stored."
        : "This review page could not be loaded.",
    };
  }
  if (!loaded.payload) return { kind: "missing", preview: false, key: safe, message: "This review page is not active." };
  return pageFromCatalog(safe, loaded.payload, false);
}

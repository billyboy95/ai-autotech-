import type { ReviewCatalog } from "@/lib/reviews/types";
import { openServiceDatabase } from "@/server/workers/service-db";
import { serviceConfigured } from "@/server/workers/with-org";

export { serviceConfigured };

export async function fetchReviewCatalog(key: string) {
  const db = openServiceDatabase();
  if (!db) return { configured: false as const, payload: null, error: null as string | null };
  const result = await db.rpc("public_review_catalog", { p_key: key });
  if (result.error) return { configured: true as const, payload: null, error: result.error.message };
  return { configured: true as const, payload: (result.data ?? null) as ReviewCatalog | null, error: null as string | null };
}

export async function submitPublicReviewRecord(input: { key: string; rating: number; name: string; comment: string }) {
  const db = openServiceDatabase();
  if (!db) return { configured: false as const, data: null, error: null as string | null };
  const result = await db.rpc("submit_public_review", {
    p_key: input.key,
    p_rating: input.rating,
    p_name: input.name,
    p_comment: input.comment,
  });
  if (result.error) return { configured: true as const, data: null, error: result.error.message };
  return {
    configured: true as const,
    data: result.data as { ok?: boolean; review_id?: string; public_token?: string } | null,
    error: null as string | null,
  };
}

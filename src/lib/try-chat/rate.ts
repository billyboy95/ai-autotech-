export const TRY_RATE_WINDOW_MS = 60_000;
export const TRY_RATE_MAX = 10;

export function recentTryHits(hits: number[], now: number) {
  return hits.filter((hit) => now - hit < TRY_RATE_WINDOW_MS);
}

/** True when this bucket already has 10 hits in the last minute. */
export function tryRateLimited(priorHits: number[], now: number) {
  return recentTryHits(priorHits, now).length >= TRY_RATE_MAX;
}

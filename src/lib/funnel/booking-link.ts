/** Website booking page used when the workspace has no active CRM booking link. */
export const RESULTS_CALL_FALLBACK = "https://aiautotech.co.za/book/";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function resultsCallHref(slug: string | null | undefined) {
  const safe = String(slug ?? "").trim().toLowerCase();
  if (!SLUG.test(safe)) return RESULTS_CALL_FALLBACK;
  return `/book/${safe}`;
}

/** Prefer the results-call link. Any other active CRM link is still a CRM booking link. */
export function pickBookingSlug(links: { slug: string; name?: string }[]) {
  const active = links
    .map((link) => ({ slug: String(link.slug || "").trim().toLowerCase(), name: String(link.name || "") }))
    .filter((link) => SLUG.test(link.slug));
  const preferred = active.find((link) => link.slug.startsWith("results-call") || link.name === "Results call");
  return preferred?.slug || active[0]?.slug || null;
}

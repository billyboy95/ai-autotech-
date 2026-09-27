import { pageFromCatalog } from "@/lib/calendars/catalog";
import { missingCalendarTable } from "@/lib/calendars/book";
import { previewPublicBooking } from "@/lib/calendars/preview";
import type { PublicBookingPage } from "@/lib/calendars/types";
import { fetchBookingCatalog, serviceConfigured } from "@/server/workers/booking";

export async function loadPublicBooking(slug: string): Promise<PublicBookingPage> {
  const safe = slug.toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(safe)) {
    return { kind: "missing", preview: false, slug: safe, message: "This booking link is not active." };
  }
  if (!serviceConfigured()) return previewPublicBooking(safe);
  const loaded = await fetchBookingCatalog(safe);
  if (!loaded.configured) return previewPublicBooking(safe);
  if (loaded.error) {
    return {
      kind: "missing",
      preview: false,
      slug: safe,
      message: missingCalendarTable(loaded.error)
        ? "Booking is not available until the calendar migration is applied. Nothing was stored."
        : "This booking page could not be loaded.",
    };
  }
  if (!loaded.payload) return { kind: "missing", preview: false, slug: safe, message: "This booking link is not active." };
  return pageFromCatalog(safe, loaded.payload, false);
}

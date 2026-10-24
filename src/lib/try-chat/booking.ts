export const TEST_CALENDAR_NAME = "TEST";
export const TEST_EVENT_NAME = "TEST";
export const TEST_BOOKING_CONSENT = "Sandbox test booking. No confirmation is sent.";

export type SandboxBookingPlan = {
  sandbox: true;
  calendarName: typeof TEST_CALENDAR_NAME;
  eventName: typeof TEST_EVENT_NAME;
  label: "TEST";
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: 30;
  locationMode: "phone";
  locationDetail: "TEST";
  consentText: typeof TEST_BOOKING_CONSENT;
  notes: "TEST sandbox booking. No confirmation is sent. No payment was taken.";
};

function nextTestSlot(now: Date) {
  const start = new Date(now.getTime());
  start.setUTCHours(7, 0, 0, 0);
  if (start.getTime() <= now.getTime()) start.setUTCDate(start.getUTCDate() + 1);
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

export function planSandboxBooking(input: {
  name: string;
  phone: string;
  email: string;
  when: string;
  now: Date;
}): { ok: true; plan: SandboxBookingPlan } | { ok: false; message: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Who should the TEST booking be for? Send a name. Nothing was booked." };
  const parsed = Date.parse(input.when);
  const starts = Number.isFinite(parsed) && parsed > input.now.getTime() ? new Date(parsed) : nextTestSlot(input.now);
  const ends = new Date(starts.getTime() + 30 * 60_000);
  return {
    ok: true,
    plan: {
      sandbox: true,
      calendarName: TEST_CALENDAR_NAME,
      eventName: TEST_EVENT_NAME,
      label: "TEST",
      guestName: name.slice(0, 120),
      guestPhone: input.phone.trim().slice(0, 40),
      guestEmail: input.email.trim().toLowerCase().slice(0, 160),
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      durationMinutes: 30,
      locationMode: "phone",
      locationDetail: "TEST",
      consentText: TEST_BOOKING_CONSENT,
      notes: "TEST sandbox booking. No confirmation is sent. No payment was taken.",
    },
  };
}

export function bookingReply(plan: SandboxBookingPlan) {
  return `Booked a TEST appointment for ${plan.guestName}. It is on the TEST calendar. No confirmation was sent and no payment was taken.`;
}

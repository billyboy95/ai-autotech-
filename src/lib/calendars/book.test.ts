import assert from "node:assert/strict";
import test from "node:test";
import { planBooking } from "@/lib/calendars/book";
import { bookingConsentText } from "@/lib/calendars/consent";

const consent = bookingConsentText("AI AutoTech Pty Ltd");
const slot = "2026-10-05T07:00:00.000Z";

test("booking without consent is rejected", () => {
  const planned = planBooking({
    consent: false,
    consentText: consent,
    expectedConsentText: consent,
    name: "Thabo Ndlovu",
    phone: "0820000000",
    email: "thabo@example.com",
    startsAt: slot,
    slots: [slot],
  });
  assert.equal(planned.ok, false);
  if (!planned.ok) assert.match(planned.error, /Consent is required/);
});

test("booking with consent accepts an open slot and does not describe a send", () => {
  const planned = planBooking({
    consent: true,
    consentText: consent,
    expectedConsentText: consent,
    name: "Thabo Ndlovu",
    phone: "",
    email: "thabo@example.com",
    startsAt: slot,
    slots: [slot],
  });
  assert.equal(planned.ok, true);
  if (planned.ok) assert.equal(planned.startsAt, slot);
  assert.equal("outbox" in planned, false);
});

test("a changed consent sentence is rejected", () => {
  const planned = planBooking({
    consent: true,
    consentText: "I agree to marketing messages from this workspace today.",
    expectedConsentText: consent,
    name: "Thabo Ndlovu",
    phone: "0820000000",
    email: "",
    startsAt: slot,
    slots: [slot],
  });
  assert.equal(planned.ok, false);
});

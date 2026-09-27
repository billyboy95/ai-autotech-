import assert from "node:assert/strict";
import test from "node:test";
import { openSlots, zonedTimeToUtc } from "@/lib/calendars/slots";

const weekly = [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }];

test("Johannesburg 09:00 is 07:00 UTC", () => {
  const utc = zonedTimeToUtc("2026-10-05", 9 * 60, "Africa/Johannesburg");
  assert.equal(utc.toISOString(), "2026-10-05T07:00:00.000Z");
});

test("weekly hours yield slots inside the window", () => {
  const slots = openSlots({
    timezone: "Africa/Johannesburg",
    fromDate: "2026-10-05",
    days: 1,
    durationMinutes: 20,
    bufferBefore: 0,
    bufferAfter: 0,
    weekly,
    exceptions: [],
    busy: [],
    now: new Date("2026-10-01T00:00:00.000Z"),
    stepMinutes: 20,
  });
  assert.deepEqual(slots, [
    "2026-10-05T07:00:00.000Z",
    "2026-10-05T07:20:00.000Z",
    "2026-10-05T07:40:00.000Z",
  ]);
});

test("a closed exception removes that day", () => {
  const slots = openSlots({
    timezone: "Africa/Johannesburg",
    fromDate: "2026-10-05",
    days: 1,
    durationMinutes: 20,
    bufferBefore: 0,
    bufferAfter: 0,
    weekly,
    exceptions: [{ date: "2026-10-05", available: false, startMinute: null, endMinute: null }],
    busy: [],
    now: new Date("2026-10-01T00:00:00.000Z"),
    stepMinutes: 20,
  });
  assert.deepEqual(slots, []);
});

test("a booked slot and its buffer are not offered again", () => {
  const slots = openSlots({
    timezone: "Africa/Johannesburg",
    fromDate: "2026-10-05",
    days: 1,
    durationMinutes: 20,
    bufferBefore: 0,
    bufferAfter: 10,
    weekly,
    exceptions: [],
    busy: [{
      startsAt: "2026-10-05T07:00:00.000Z",
      endsAt: "2026-10-05T07:20:00.000Z",
      bufferBefore: 0,
      bufferAfter: 10,
    }],
    now: new Date("2026-10-01T00:00:00.000Z"),
    stepMinutes: 20,
  });
  assert.deepEqual(slots, ["2026-10-05T07:40:00.000Z"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { mapOutreachCsv, parseCsv } from "@/lib/outreach/csv";
import { fixtureProspects } from "@/lib/outreach/fixture";
import { canMoveTo, furthestStep, prospectFromRow, summariseFunnel } from "@/lib/outreach/funnel";

test("funnel counts are cumulative and conversion is from the previous step", () => {
  const s = summariseFunnel(fixtureProspects());
  const by = Object.fromEntries(s.steps.map((step) => [step.stage, step]));
  assert.equal(s.total, 11);
  assert.equal(by.not_contacted.reached, 11);
  assert.equal(by.sent.reached, 9);
  assert.equal(by.replied.reached, 6);
  assert.equal(by.booked_call1.reached, 5);
  assert.equal(by.showed.reached, 3);
  assert.equal(by.call2.reached, 2);
  assert.equal(by.closed.reached, 1);
  assert.equal(by.replied.fromPrevious, 66.7);
  assert.equal(by.closed.fromSent, 11.1);
  assert.equal(s.lost, 1);
  assert.equal(s.doNotContact, 1);
  assert.equal(s.sentPerClose, 9);
});

test("a lost prospect keeps the steps it passed", () => {
  const lost = prospectFromRow({ id: "x", business: "X", stage: "lost", sent_at: "2026-10-01", replied_at: "2026-10-02" });
  assert.equal(furthestStep(lost), 2);
});

test("empty funnel has no conversion rates", () => {
  const s = summariseFunnel([]);
  assert.equal(s.steps[1].fromPrevious, null);
  assert.equal(s.sentPerClose, null);
});

test("do-not-contact blocks sending but still allows logging a reply", () => {
  assert.equal(canMoveTo({ doNotContact: true, stage: "not_contacted" }, "sent"), false);
  assert.equal(canMoveTo({ doNotContact: true, stage: "sent" }, "replied"), true);
  assert.equal(canMoveTo({ doNotContact: false, stage: "not_contacted" }, "sent"), true);
});

test("csv parser handles quotes, commas and the brokers.csv headers", () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""q"""\n1,2,3\n'), [["a", "b, c", 'd "q"'], ["1", "2", "3"]]);
  const rows = mapOutreachCsv(
    '\uFEFF#,Business,FSP number (from own site),Area,Website,Public business email,Phone,Personalisation hook (compliment),Channel,Priority\n' +
      '1,"Reef Insurance Brokers",,Benoni,https://reefinsurance.co.za/,INFO@reefinsurance.co.za,+27 11 845 8000,"Since 1983, referrals",email,A\n' +
      '2,Statfin,,Benoni,,,+27 11 425 2730,,phone / site form,Z\n',
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].email, "info@reefinsurance.co.za");
  assert.equal(rows[0].hook, "Since 1983, referrals");
  assert.equal(rows[0].priority, "A");
  assert.equal(rows[1].channel, "form");
  assert.equal(rows[1].priority, "B");
});

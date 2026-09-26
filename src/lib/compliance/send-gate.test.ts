import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSend } from "./send-gate";

const base = {
  sendingEnabled: true,
  channel: "whatsapp" as const,
  purpose: "marketing" as const,
  senderName: "EASTC",
  suppressed: false,
  consent: "opted_in" as const,
  basis: "consent" as const,
  body: "Your campus visit is booked.",
};

test("sending off blocks the message before consent is considered", () => {
  const decision = evaluateSend({ ...base, sendingEnabled: false });
  assert.equal(decision.allowed, false);
  assert.equal(decision.status, "blocked_sending");
});

test("marketing without opt-in is blocked and a suppression wins", () => {
  const cold = evaluateSend({ ...base, consent: "none", basis: null });
  assert.equal(cold.status, "blocked_consent");
  const stopped = evaluateSend({ ...base, suppressed: true });
  assert.equal(stopped.allowed, false);
  assert.equal(stopped.status, "blocked_consent");
});

test("an existing customer can receive marketing until they opt out", () => {
  const ok = evaluateSend({ ...base, consent: "none", basis: "existing_customer" });
  assert.equal(ok.allowed, true);
  assert.match(ok.body, /EASTC: reply STOP to opt out/);
  const left = evaluateSend({ ...base, consent: "opted_out", basis: "existing_customer" });
  assert.equal(left.allowed, false);
});

test("every allowed sms or email names the sender and offers an opt-out", () => {
  const sms = evaluateSend({ ...base, channel: "sms", purpose: "service" });
  assert.match(sms.body, /EASTC: reply STOP to opt out/);
  const email = evaluateSend({ ...base, channel: "email", purpose: "transactional", consent: "none" });
  assert.equal(email.allowed, true);
  assert.match(email.body, /EASTC/);
  assert.match(email.body, /opt out/i);
});

test("a blank sender name blocks the send", () => {
  const decision = evaluateSend({ ...base, senderName: "  " });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /sender name/i);
});

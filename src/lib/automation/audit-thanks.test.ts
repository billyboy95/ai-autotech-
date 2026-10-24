import assert from "node:assert/strict";
import test from "node:test";
import { crmLeadMirror, intakeContactRow } from "@/lib/aios/public-intake";
import { isSendEnabled } from "@/lib/automation/channels";
import { companyTemplateLabel, normalizeCompany } from "@/lib/automation/company";
import { captureLead, createInitialState, queueSequenceStep, templateVars } from "@/lib/automation/engine";
import { flushOutbox } from "@/lib/automation/flush";
import { DEFAULT_SETTINGS, emptyLead, type OutboxMessage } from "@/lib/automation/types";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const HELD_LEAD = "mvjh8i4k9cs8";
const HELD_WHATSAPP = "msg_0af8626eb239";
const HELD_EMAIL = "msg_67e94fb273c9";
const HELD_WHATSAPP_BODY = "Hi Sam, it's Billy from AI AutoTech. Thanks for getting in touch about None. I've got your details.";
const HELD_EMAIL_BODY = "Hi Sam,\n\nBilly here from AI AutoTech. Thanks for reaching out about None.";

function heldMessage(input: {
  id: string;
  channel: "whatsapp" | "email";
  templateKey: string;
  toAddress: string;
  subject: string;
  body: string;
}): OutboxMessage {
  return {
    id: input.id,
    leadId: HELD_LEAD,
    prospectId: null,
    templateKey: input.templateKey,
    channel: input.channel,
    toAddress: input.toAddress,
    subject: input.subject,
    body: input.body,
    status: "queued",
    scheduledFor: NOW.toISOString(),
    sentAt: null,
    provider: "outbox",
    providerId: "",
    error: "",
    waLink: input.channel === "whatsapp" ? "https://wa.me/27820000095?text=held" : "",
    category: "service",
    costUsd: null,
    costZar: null,
    costCategory: "",
    purpose: "service",
    createdAt: NOW.toISOString(),
  };
}

function heldState() {
  const state = createInitialState();
  return {
    ...state,
    leads: [
      emptyLead({
        id: HELD_LEAD,
        name: "Sam Example",
        company: "None",
        phone: "0820000095",
        email: "sam@example.co.za",
        whatsapp: "0820000095",
        enrolled: true,
        createdAt: NOW.toISOString(),
      }),
    ],
    outbox: [
      heldMessage({
        id: HELD_WHATSAPP,
        channel: "whatsapp",
        templateKey: "ack_whatsapp",
        toAddress: "0820000095",
        subject: "",
        body: HELD_WHATSAPP_BODY,
      }),
      heldMessage({
        id: HELD_EMAIL,
        channel: "email",
        templateKey: "ack_email",
        toAddress: "sam@example.co.za",
        subject: "None — we have your details",
        body: HELD_EMAIL_BODY,
      }),
    ],
  };
}

test("blank company sentinels become an empty stored name and a graceful template phrase", () => {
  for (const value of ["", "   ", "None", "none", "NONE", "N/A", "n/a", "N.A.", null, undefined]) {
    assert.equal(normalizeCompany(value), "");
    assert.equal(companyTemplateLabel(value), "your business");
  }
  assert.equal(normalizeCompany("Naidoo Co"), "Naidoo Co");
  assert.equal(companyTemplateLabel("Naidoo Co"), "Naidoo Co");

  const mirror = crmLeadMirror({
    id: "lead-blank",
    name: "Amina Khan",
    company: "None",
    phone: "0820000001",
    email: "amina@example.co.za",
    notes: "AI Business Audit",
    source: "audit",
    ord: -1,
  });
  assert.equal(mirror.company, "");
  const contact = intakeContactRow({
    name: "Amina Khan",
    email: "amina@example.co.za",
    phone: "0820000001",
    company: "N/A",
    leadId: "lead-blank",
    source: "audit",
  });
  assert.equal(contact.company, "");
});

test("a new audit thank-you says about your business and stays queued", () => {
  for (const company of ["None", "none", "N/A", "N.A.", ""]) {
    const state = captureLead(
      createInitialState(),
      {
        id: `lead-${company || "blank"}`,
        name: "Amina Khan",
        company,
        phone: "0820000001",
        email: "amina@example.co.za",
        source: "audit",
      },
      NOW,
    );
    assert.equal(state.leads[0]?.company, "");
    const whatsapp = state.outbox.find((message) => message.templateKey === "ack_whatsapp");
    const email = state.outbox.find((message) => message.templateKey === "ack_email");
    assert.match(whatsapp?.body || "", /about your business/);
    assert.match(email?.body || "", /about your business/);
    assert.equal(email?.subject, "your business — we have your details");
    assert.equal((whatsapp?.body || "").includes("None"), false);
    assert.equal((email?.body || "").includes("N/A"), false);
    assert.equal(whatsapp?.status, "queued");
    assert.equal(email?.status, "queued");
  }

  const named = captureLead(
    createInitialState(),
    {
      id: "lead-named",
      name: "Amina Khan",
      company: "Naidoo Co",
      phone: "0820000001",
      email: "amina@example.co.za",
      source: "audit",
    },
    NOW,
  );
  assert.equal(named.leads[0]?.company, "Naidoo Co");
  assert.match(named.outbox.find((message) => message.templateKey === "ack_whatsapp")?.body || "", /about Naidoo Co/);
});

test("a later message for a stored None company is phrased for new rows only", () => {
  const state = createInitialState();
  const lead = emptyLead({
    id: "lead-stored-none",
    name: "Amina Khan",
    company: "None",
    phone: "0820000001",
    email: "amina@example.co.za",
    whatsapp: "0820000001",
    enrolled: true,
    createdAt: NOW.toISOString(),
  });
  const queued = queueSequenceStep({ ...state, leads: [lead] }, lead.id, "ack", NOW);
  assert.equal(queued.leads[0]?.company, "None");
  assert.equal(templateVars(lead, DEFAULT_SETTINGS).company, "your business");
  assert.match(queued.outbox.find((message) => message.templateKey === "ack_whatsapp")?.body || "", /about your business/);
  assert.equal(state.outbox.length, 0);
});

test("already queued thank-yous for mvjh8i4k9cs8 stay queued and are not dispatched", async () => {
  const before = heldState();
  const recaptured = captureLead(
    before,
    {
      id: HELD_LEAD,
      name: "Sam Example",
      company: "",
      phone: "0820000095",
      email: "sam@example.co.za",
      source: "audit",
    },
    NOW,
  );
  assert.equal(recaptured, before);

  const stepped = queueSequenceStep(recaptured, HELD_LEAD, "ack", NOW);
  assert.equal(stepped.outbox.filter((message) => message.leadId === HELD_LEAD).length, 2);
  assert.equal(stepped.outbox.find((message) => message.id === HELD_WHATSAPP)?.body, HELD_WHATSAPP_BODY);
  assert.equal(stepped.outbox.find((message) => message.id === HELD_EMAIL)?.body, HELD_EMAIL_BODY);
  assert.equal(stepped.outbox.find((message) => message.id === HELD_EMAIL)?.subject, "None — we have your details");

  let calls = 0;
  const flushed = await flushOutbox(stepped, NOW, {}, async () => {
    calls += 1;
    return { status: "sent", provider: "resend", providerId: "should-not-send", waLink: "", error: "" };
  });
  assert.equal(isSendEnabled({}), false);
  assert.equal(calls, 0);
  for (const id of [HELD_WHATSAPP, HELD_EMAIL]) {
    const original = stepped.outbox.find((message) => message.id === id);
    const after = flushed.outbox.find((message) => message.id === id);
    assert.equal(after?.status, "queued");
    assert.equal(after?.body, original?.body);
    assert.equal(after?.subject, original?.subject);
    assert.equal(after?.sentAt, null);
    assert.equal(after?.provider, "outbox");
  }
});

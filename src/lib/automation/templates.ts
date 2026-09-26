import type { MessageTemplate } from "@/lib/automation/types";

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    key: "ack_whatsapp",
    channel: "whatsapp",
    name: "Instant acknowledgement (WhatsApp)",
    subject: "",
    active: true,
    body: "Hi {{firstName}}, it's Billy from AI AutoTech. Thanks for getting in touch about {{company}}. I've got your details and I'll look at where automation can take work off your team.\n\nBook a short audit here: {{bookingUrl}}\n\nIf the link is awkward, just reply and I'll send times.",
  },
  {
    key: "ack_email",
    channel: "email",
    name: "Instant acknowledgement (email)",
    subject: "{{company}} — we have your details",
    active: true,
    body: "Hi {{firstName}},\n\nBilly here from AI AutoTech. Thanks for reaching out about {{company}}. I've received it and I'll review where an AI employee or a cleaner follow-up process would help.\n\nBook a 20-minute audit: {{bookingUrl}}\n\nIf none of those times work, reply to this email and I'll fit around you.\n\nBilly\nAI AutoTech Pty Ltd",
  },
  {
    key: "nudge_day1_whatsapp",
    channel: "whatsapp",
    name: "Day 1 nudge (WhatsApp)",
    subject: "",
    active: true,
    body: "Hi {{firstName}}, Billy again. Just checking my note about {{company}} landed. The usual first win is WhatsApp and lead follow-up, so nothing sits unanswered.\n\nHere's the booking link: {{bookingUrl}}",
  },
  {
    key: "nudge_day1_email",
    channel: "email",
    name: "Day 1 nudge (email)",
    subject: "Quick follow-up for {{company}}",
    active: true,
    body: "Hi {{firstName}},\n\nChecking you saw my note about {{company}}. If you want the audit, here is the link again: {{bookingUrl}}\n\nBilly\nAI AutoTech Pty Ltd",
  },
  {
    key: "nudge_day3_whatsapp",
    channel: "whatsapp",
    name: "Day 3 nudge (WhatsApp)",
    subject: "",
    active: true,
    body: "Hi {{firstName}}, a short nudge from AI AutoTech. Teams that book the audit this week usually want the inbox and follow-up handled for them. 20 minutes with me: {{bookingUrl}}",
  },
  {
    key: "nudge_day3_email",
    channel: "email",
    name: "Day 3 nudge (email)",
    subject: "Still worth a look for {{company}}?",
    active: true,
    body: "Hi {{firstName}},\n\nStill happy to walk through {{company}} whenever it suits you. Booking link: {{bookingUrl}}\n\nBilly\nAI AutoTech Pty Ltd",
  },
  {
    key: "nudge_day7_whatsapp",
    channel: "whatsapp",
    name: "Day 7 nudge (WhatsApp)",
    subject: "",
    active: true,
    body: "Hi {{firstName}}, last note from me on {{company}} unless you want to pick it up. I won't keep pinging you. Reply \"later\" if the timing is off, or book here: {{bookingUrl}}",
  },
  {
    key: "nudge_day7_email",
    channel: "email",
    name: "Day 7 nudge (email)",
    subject: "Last note on the {{company}} audit",
    active: true,
    body: "Hi {{firstName}},\n\nThis is my last follow-up on {{company}}. If you want the audit, book here: {{bookingUrl}}. If now is the wrong time, reply \"later\" and I'll leave it.\n\nBilly\nAI AutoTech Pty Ltd",
  },
  {
    key: "audit_reminder_whatsapp",
    channel: "whatsapp",
    name: "Audit reminder (WhatsApp)",
    subject: "",
    active: true,
    body: "Hi {{firstName}}, reminder from Billy at AI AutoTech. Your audit for {{company}} is coming up{{when}}. Reply if you need to move it.",
  },
  {
    key: "audit_reminder_email",
    channel: "email",
    name: "Audit reminder (email)",
    subject: "Reminder: {{company}} audit",
    active: true,
    body: "Hi {{firstName}},\n\nYour AI AutoTech audit for {{company}} is coming up{{when}}. Reply if you need a different time.\n\nBilly\nAI AutoTech Pty Ltd",
  },
  {
    key: "proposal_followup_whatsapp",
    channel: "whatsapp",
    name: "Proposal follow-up (WhatsApp)",
    subject: "",
    active: true,
    body: "Hi {{firstName}}, Billy from AI AutoTech. The proposal for {{company}} has been with you for a few days. Happy to walk through the price and what we deliver. Reply here, or book: {{bookingUrl}}",
  },
  {
    key: "proposal_followup_email",
    channel: "email",
    name: "Proposal follow-up (email)",
    subject: "Following up on the {{company}} proposal",
    active: true,
    body: "Hi {{firstName}},\n\nChecking in on the proposal for {{company}}. I can walk through the price and the handover whenever you're ready.\n\nBilly\nAI AutoTech Pty Ltd",
  },
];

export const STEP_TEMPLATES = {
  ack: ["ack_whatsapp", "ack_email"],
  day1: ["nudge_day1_whatsapp", "nudge_day1_email"],
  day3: ["nudge_day3_whatsapp", "nudge_day3_email"],
  day7: ["nudge_day7_whatsapp", "nudge_day7_email"],
  audit_reminder: ["audit_reminder_whatsapp", "audit_reminder_email"],
  proposal_followup: ["proposal_followup_whatsapp", "proposal_followup_email"],
} as const;

export type SequenceStep = keyof typeof STEP_TEMPLATES;

export const STEP_INDEX: Record<"ack" | "day1" | "day3" | "day7", number> = {
  ack: 1,
  day1: 2,
  day3: 3,
  day7: 4,
};

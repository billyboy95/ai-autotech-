import type {
  SnapshotAgentTeam,
  SnapshotAiReply,
  SnapshotCalendar,
  SnapshotField,
  SnapshotKnowledge,
  SnapshotPayloadV2,
  SnapshotService,
  SnapshotTag,
  SnapshotTemplate,
  SnapshotWebsite,
  SnapshotWorkflow,
} from "@/lib/snapshots/payload";

export const RESTAURANT_SNAPSHOT_ID = "a2c00000-0000-4000-8000-000000000003";

export const RESTAURANT_AGENT_SLUGS = [
  "receptionist",
  "reminder-drafts",
  "review-replies",
  "social-posting",
  "offer-manager",
] as const;

export const AGENCY_AGENT_SLUGS = [
  "inbound-lead",
  "outbound-sales",
  "proposal-writer",
  "onboarding",
  "ads",
  "social-posting",
  "support-replies",
  "blog-drafts",
] as const;

const DRAFT_NOTE = "This is a draft and is not sent.";

function draftWorkflow(assetKey: string, name: string, trigger: string, text: string, triggerExtra: Record<string, unknown> = {}): SnapshotWorkflow {
  return {
    asset_key: assetKey,
    name,
    active: false,
    trigger_type: trigger,
    trigger: triggerExtra,
    steps: [
      { id: "note", title: "Draft only", action: { kind: "notify_user", text }, next: "end" },
      { id: "end", title: "End", action: { kind: "end" } },
    ],
  };
}

export const AGENCY_DRAFT_WORKFLOWS: SnapshotWorkflow[] = [
  draftWorkflow(
    "workflow:agency:new-lead-draft",
    "New lead draft",
    "lead.created",
    "A new lead arrived for {{business.name}}. This note is a draft. Nothing is sent.",
  ),
  draftWorkflow(
    "workflow:agency:audit-booked-draft",
    "Audit booked draft",
    "appointment.booked",
    "An audit was booked for {{business.name}}. This note is a draft. Nothing is sent.",
  ),
  draftWorkflow(
    "workflow:agency:no-reply-draft",
    "No reply draft",
    "message.no_reply",
    "No reply yet for {{business.name}}. This note is a draft. Nothing is sent.",
    { after_hours: 24 },
  ),
];

const BURGER_MENU: SnapshotService[] = [
  { name: "Classic burger", price_label: "R89" },
  { name: "Cheese burger", price_label: "R99" },
  { name: "Chips", price_label: "R35" },
  { name: "Milkshake", price_label: "R45" },
];

const AGENCY_SERVICES: SnapshotService[] = [
  { name: "Free audit", price_label: "Quote" },
  { name: "CRM setup", price_label: "Quote" },
  { name: "Lead follow-up", price_label: "Quote" },
];

function website(services: SnapshotService[]): SnapshotWebsite {
  return {
    business_name: "{{business.name}}",
    colours: { primary: "{{business.primary_colour}}", accent: "{{business.accent_colour}}" },
    logo_url: "{{business.logo_url}}",
    phone: "{{business.phone}}",
    email: "{{business.email}}",
    address: "{{business.address}}",
    hours: "{{business.hours}}",
    services,
    booking_url: "{{business.booking_url}}",
  };
}

function aiReply(prompt: string): SnapshotAiReply {
  return {
    enabled: false,
    mode: "draft_only",
    tone: "Warm and short.",
    system_prompt: prompt,
    max_auto_per_hour: 0,
    require_human_before_send: true,
  };
}

function team(slug: string, agents: readonly string[]): SnapshotAgentTeam {
  return { template_slug: slug, sandbox: true, charged: false, agents: [...agents] };
}

function week(start: number, end: number, days: number[]) {
  return days.map((weekday) => ({ weekday, start_minute: start, end_minute: end }));
}

function calendar(input: {
  assetKey: string;
  name: string;
  description: string;
  weekly: SnapshotCalendar["weekly"];
  eventKey: string;
  eventName: string;
  minutes: number;
  locationMode: SnapshotCalendar["event_types"][number]["location_mode"];
  location: string;
  bookingKey: string;
  slugSuffix: string;
  consent: string;
}): SnapshotCalendar {
  return {
    asset_key: input.assetKey,
    name: input.name,
    timezone: "Africa/Johannesburg",
    description: input.description,
    active: true,
    weekly: input.weekly,
    event_types: [
      {
        asset_key: input.eventKey,
        name: input.eventName,
        duration_minutes: input.minutes,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        location_mode: input.locationMode,
        location_detail: input.location,
        booking: {
          asset_key: input.bookingKey,
          slug_suffix: input.slugSuffix,
          active: true,
          consent_text: input.consent,
        },
      },
    ],
  };
}

export const AGENCY_V2_EXTRAS = {
  tags: [
    { asset_key: "tag:agency:new-lead", name: "New lead", color: "#0B1F3A" },
    { asset_key: "tag:agency:audit", name: "Audit", color: "#2563EB" },
    { asset_key: "tag:agency:proposal", name: "Proposal", color: "#0F766E" },
  ] satisfies SnapshotTag[],
  calendars: [
    calendar({
      assetKey: "calendar:agency:audit",
      name: "Audit calls",
      description: "Short audit calls for {{business.name}}.",
      weekly: week(480, 1020, [1, 2, 3, 4, 5]),
      eventKey: "event:agency:audit",
      eventName: "Audit call",
      minutes: 20,
      locationMode: "phone",
      location: "Phone call",
      bookingKey: "booking:agency:audit",
      slugSuffix: "audit",
      consent: "I agree that {{business.name}} may store my name and phone number for this audit call. Nothing is sent automatically.",
    }),
  ],
  ai_reply: aiReply(
    "Draft replies for {{business.name}}. Hours: {{business.hours}}. Address: {{business.address}}. Do not invent prices. Do not send.",
  ),
  ai_knowledge: {
    entries: [
      { asset_key: "kb:agency:hours", title: "Hours", body: "{{business.name}} is open {{business.hours}}." },
      { asset_key: "kb:agency:services", title: "Services", body: "{{business.services_text}}" },
      { asset_key: "kb:agency:find-us", title: "Find us", body: "{{business.name}} is at {{business.address}}. Phone {{business.phone}}." },
    ],
  } satisfies SnapshotKnowledge,
  agent_team: team("ai-automation-agency", AGENCY_AGENT_SLUGS),
  website: website(AGENCY_SERVICES),
};

function restaurantTemplate(key: string, channel: SnapshotTemplate["channel"], name: string, subject: string, body: string): SnapshotTemplate {
  return {
    asset_key: `template:restaurant:${key}`,
    channel,
    name,
    subject,
    body,
    active: false,
  };
}

const RESTAURANT_TEMPLATES: SnapshotTemplate[] = [
  restaurantTemplate(
    "booking-whatsapp",
    "whatsapp",
    "Booking confirmation",
    "",
    `Hi {{firstName}}, {{business.name}} is holding a table. Address: {{business.address}}. Hours: {{business.hours}}. ${DRAFT_NOTE}`,
  ),
  restaurantTemplate(
    "booking-email",
    "email",
    "Booking confirmation",
    "Table at {{business.name}}",
    `Hi {{firstName}}, {{business.name}} is holding a table at {{business.address}}. ${DRAFT_NOTE}`,
  ),
  restaurantTemplate(
    "booking-sms",
    "sms",
    "Booking confirmation",
    "",
    `{{business.name}} is holding a table. ${DRAFT_NOTE}`,
  ),
  restaurantTemplate(
    "review-whatsapp",
    "whatsapp",
    "Review request",
    "",
    `Hi {{firstName}}, how was {{business.name}}? This review request is a draft and is not sent.`,
  ),
  restaurantTemplate(
    "winback-email",
    "email",
    "Win-back",
    "We miss you at {{business.name}}",
    `Hi {{firstName}}, {{business.name}} would like to see you again. Hours: {{business.hours}}. ${DRAFT_NOTE}`,
  ),
  restaurantTemplate(
    "winback-sms",
    "sms",
    "Win-back",
    "",
    `{{business.name}} win-back note. ${DRAFT_NOTE}`,
  ),
];

const RESTAURANT_FIELDS: SnapshotField[] = [
  { asset_key: "field:restaurant:party", entity: "lead", field_key: "party_size", label: "Party size", field_type: "text", options: [], required: false, position: 1 },
  { asset_key: "field:restaurant:seating", entity: "lead", field_key: "seating", label: "Seating", field_type: "text", options: [], required: false, position: 2 },
  { asset_key: "field:restaurant:favourite", entity: "lead", field_key: "favourite_order", label: "Favourite order", field_type: "text", options: [], required: false, position: 3 },
];

export const RESTAURANT_PAYLOAD: SnapshotPayloadV2 = {
  version: 2,
  pipelines: [
    {
      asset_key: "pipeline:restaurant",
      name: "Restaurant",
      is_default: true,
      stages: [
        { asset_key: "stage:restaurant:enquiry", name: "Enquiry", position: 1, is_won: false, is_lost: false },
        { asset_key: "stage:restaurant:held", name: "Booking held", position: 2, is_won: false, is_lost: false },
        { asset_key: "stage:restaurant:seated", name: "Seated", position: 3, is_won: false, is_lost: false },
        { asset_key: "stage:restaurant:review", name: "Review asked", position: 4, is_won: false, is_lost: false },
        { asset_key: "stage:restaurant:regular", name: "Regular", position: 5, is_won: true, is_lost: false },
        { asset_key: "stage:restaurant:lost", name: "Lost", position: 6, is_won: false, is_lost: true },
      ],
    },
  ],
  message_templates: RESTAURANT_TEMPLATES,
  sequences: [
    {
      asset_key: "sequence:restaurant:booking",
      name: "Booking confirmation",
      active: false,
      steps: [
        { asset_key: "step:restaurant:booking:whatsapp", position: 1, delay_hours: 0, channel: "whatsapp", template_asset_key: "template:restaurant:booking-whatsapp" },
        { asset_key: "step:restaurant:booking:email", position: 2, delay_hours: 0, channel: "email", template_asset_key: "template:restaurant:booking-email" },
        { asset_key: "step:restaurant:booking:sms", position: 3, delay_hours: 0, channel: "sms", template_asset_key: "template:restaurant:booking-sms" },
      ],
    },
    {
      asset_key: "sequence:restaurant:review",
      name: "Review request",
      active: false,
      steps: [
        { asset_key: "step:restaurant:review:whatsapp", position: 1, delay_hours: 24, channel: "whatsapp", template_asset_key: "template:restaurant:review-whatsapp" },
      ],
    },
    {
      asset_key: "sequence:restaurant:winback",
      name: "Win-back",
      active: false,
      steps: [
        { asset_key: "step:restaurant:winback:email", position: 1, delay_hours: 168, channel: "email", template_asset_key: "template:restaurant:winback-email" },
        { asset_key: "step:restaurant:winback:sms", position: 2, delay_hours: 168, channel: "sms", template_asset_key: "template:restaurant:winback-sms" },
      ],
    },
  ],
  custom_fields: RESTAURANT_FIELDS,
  workflows: [
    draftWorkflow(
      "workflow:restaurant:booking-confirmation",
      "Booking confirmation",
      "appointment.booked",
      "Draft a booking confirmation for {{business.name}}. Nothing is sent.",
    ),
    draftWorkflow(
      "workflow:restaurant:review-request",
      "Review request",
      "lead.stage_changed",
      "Draft a review request for {{business.name}}. Nothing is sent.",
    ),
    draftWorkflow(
      "workflow:restaurant:win-back",
      "Win-back",
      "message.no_reply",
      "Draft a win-back note for {{business.name}}. Nothing is sent.",
      { after_hours: 168 },
    ),
  ],
  tags: [
    { asset_key: "tag:restaurant:walk-in", name: "Walk-in", color: "#0B1F3A" },
    { asset_key: "tag:restaurant:booking", name: "Booking", color: "#2563EB" },
    { asset_key: "tag:restaurant:no-show", name: "No-show", color: "#B45309" },
    { asset_key: "tag:restaurant:regular", name: "Regular", color: "#0F766E" },
    { asset_key: "tag:restaurant:review", name: "Review", color: "#7C3AED" },
  ],
  calendars: [
    calendar({
      assetKey: "calendar:restaurant:tables",
      name: "Table bookings",
      description: "Covers for {{business.name}}.",
      weekly: week(660, 1260, [0, 1, 2, 3, 4, 5, 6]),
      eventKey: "event:restaurant:table",
      eventName: "Table booking",
      minutes: 90,
      locationMode: "in_person",
      location: "{{business.address}}",
      bookingKey: "booking:restaurant:table",
      slugSuffix: "table",
      consent: "I agree that {{business.name}} may store my name and phone number to hold this table. Nothing is sent automatically.",
    }),
  ],
  ai_reply: aiReply(
    "Draft replies for {{business.name}}, a restaurant. Hours: {{business.hours}}. Address: {{business.address}}. Use the menu in the knowledge base. Do not invent prices. Do not send.",
  ),
  ai_knowledge: {
    entries: [
      { asset_key: "kb:restaurant:hours", title: "Hours", body: "{{business.name}} is open {{business.hours}}." },
      { asset_key: "kb:restaurant:menu", title: "Menu", body: "{{business.services_text}}" },
      {
        asset_key: "kb:restaurant:find-us",
        title: "Find us",
        body: "{{business.name}} is at {{business.address}}. Phone {{business.phone}}. Mail {{business.email}}.",
      },
    ],
  },
  agent_team: team("restaurant-food", RESTAURANT_AGENT_SLUGS),
  website: website(BURGER_MENU),
};

export const RESTAURANT_SNAPSHOT = {
  id: RESTAURANT_SNAPSHOT_ID,
  name: "Restaurant / burger joint",
  description: "Table bookings, a menu, draft follow-ups, and a sandbox restaurant team. Applying it does not send anything.",
};

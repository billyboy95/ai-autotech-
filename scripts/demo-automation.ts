import { applyInbound, applyStageRules, captureLead, markWon, setStage, updateSettings } from "@/lib/automation/engine";
import { proveAutomation } from "@/lib/automation/scenario";
import { writeDemoState } from "@/lib/automation/service";

const proved = proveAutomation();
for (const line of proved.log) console.log(`PROOF ${line}`);

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

let state = updateSettings(proved.state, {
  ...proved.state.settings,
  bookingUrl: "https://cal.com/ai-autotech/audit",
});

state = captureLead(
  state,
  {
    id: "lead-nomsa",
    name: "Nomsa Khumalo",
    company: "Khumalo Retail",
    phone: "0715550142",
    email: "nomsa@khumalo-retail.example",
    source: "highlevel_event",
    qrSource: "billy_phone_qr",
    companySize: "40",
    website: "https://khumalo.example",
    answers: { teamSize: "40", pain: "manual whatsapp follow-up" },
    recommendations: [{}, {}, {}],
  },
  now,
);

state = captureLead(
  state,
  {
    id: "lead-fatima",
    name: "Fatima Essop",
    company: "Essop Accountants",
    phone: "0825550110",
    email: "fatima@essop.example",
    source: "website_contact",
    companySize: "8",
  },
  daysAgo(1),
);
state = applyStageRules(state, daysAgo(1), {}, "lead-fatima");

state = captureLead(
  state,
  {
    id: "lead-sipho",
    name: "Sipho Dlamini",
    company: "Dlamini Logistics",
    phone: "0835550177",
    email: "sipho@dlamini-logistics.example",
    source: "website_contact",
    companySize: "18",
  },
  daysAgo(2),
);
state = applyStageRules(state, daysAgo(2), {}, "lead-sipho");
state = applyInbound(
  state,
  { type: "booking.created", leadId: "lead-sipho", startsAt: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString() },
  daysAgo(1),
);

state = captureLead(
  state,
  {
    id: "lead-pieter",
    name: "Pieter Venter",
    company: "Venter Workshops",
    phone: "0825550133",
    email: "pieter@venter.example",
    source: "public_form",
  },
  daysAgo(4),
);
state = applyStageRules(state, daysAgo(4), {}, "lead-pieter");
state = applyInbound(
  state,
  { type: "booking.created", leadId: "lead-pieter", startsAt: daysAgo(1).toISOString() },
  daysAgo(3),
);

state = captureLead(
  state,
  {
    id: "lead-lerato",
    name: "Lerato Mokoena",
    company: "Mokoena Spa",
    phone: "0725550188",
    email: "lerato@mokoena-spa.example",
    source: "website_contact",
  },
  daysAgo(6),
);
state = setStage(state, "lead-lerato", "Audit done", daysAgo(1));

state = captureLead(
  state,
  {
    id: "lead-johan",
    name: "Johan Botha",
    company: "Botha Farming",
    phone: "0845550166",
    email: "johan@botha-farming.example",
    source: "website_contact",
    companySize: "60",
  },
  daysAgo(8),
);
state = setStage(state, "lead-johan", "Proposal sent", daysAgo(5), { valueZar: 24000 });

state = captureLead(
  state,
  {
    id: "lead-ayesha",
    name: "Ayesha Patel",
    company: "Patel Logistics",
    phone: "0795550121",
    email: "ayesha@patel-logistics.example",
    source: "highlevel_event",
    qrSource: "billy_phone_qr",
    companySize: "25",
    answers: { teamSize: "25", pain: "inbox overload" },
  },
  daysAgo(12),
);
state = markWon(
  state,
  "lead-ayesha",
  { valueZar: 32000, whatSold: "AI employee for the inbox", deliveredBy: "Billy" },
  daysAgo(1),
);

writeDemoState(state);
const stages = state.leads.map((lead) => `${lead.name}=${lead.stage}`).join(", ");
console.log(`DEMO ${state.leads.length} leads. ${stages}`);
console.log(`DEMO outbox ${state.outbox.length}. handover tasks ${state.tasks.length}.`);

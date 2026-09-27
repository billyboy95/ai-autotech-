import type { SetupQuestion } from "@/lib/bots/catalog-types";

export const SETUP_QUESTION_BANK: SetupQuestion[] = [
  { id: "tone", label: "What tone should this agent use?", kind: "choice", options: ["Warm", "Plain", "Formal", "Brief"] },
  { id: "hours", label: "What are the working hours?", kind: "text" },
  { id: "offers", label: "What do you offer?", kind: "text" },
  { id: "pricing", label: "How should prices be described?", kind: "text" },
  { id: "faqs", label: "What do people ask most?", kind: "text" },
  { id: "booking-rules", label: "What are the booking rules?", kind: "text" },
  { id: "target-audience", label: "Who is this for?", kind: "text" },
  { id: "brand-voice", label: "How should the brand sound?", kind: "text" },
  { id: "channels", label: "Which channel should this agent use?", kind: "choice", options: ["WhatsApp", "Email", "Phone", "Instagram", "Facebook", "YouTube", "TikTok", "Website", "Walk-in"] },
  { id: "knowledge-pack", label: "What should this agent know?", kind: "text" },
  { id: "calendar", label: "Which calendar should bookings use?", kind: "text" },
  { id: "whatsapp-number", label: "Which WhatsApp number should this agent use? It is connected after payment.", kind: "text" },
];

const BY_DEPARTMENT: Record<string, string[]> = {
  sales: ["tone", "offers", "pricing", "target-audience", "channels", "knowledge-pack", "whatsapp-number"],
  marketing: ["tone", "offers", "target-audience", "brand-voice", "channels", "knowledge-pack"],
  branding: ["brand-voice", "target-audience", "tone"],
  admin: ["tone", "hours", "faqs", "knowledge-pack", "calendar"],
  operations: ["hours", "offers", "faqs", "knowledge-pack"],
  "customer-service": ["tone", "hours", "faqs", "channels", "knowledge-pack", "whatsapp-number"],
  booking: ["tone", "hours", "booking-rules", "channels", "knowledge-pack", "calendar", "whatsapp-number"],
  finance: ["tone", "pricing", "hours"],
  hr: ["tone", "hours", "faqs"],
  onboarding: ["tone", "offers", "faqs", "hours", "knowledge-pack", "calendar"],
  reputation: ["tone", "brand-voice", "channels"],
  social: ["brand-voice", "channels", "target-audience", "hours"],
  ads: ["offers", "pricing", "target-audience", "channels"],
  content: ["brand-voice", "target-audience", "tone", "channels", "knowledge-pack"],
  ecommerce: ["offers", "pricing", "faqs", "channels", "knowledge-pack"],
  "it-support": ["tone", "hours", "faqs"],
};

const bank = new Map(SETUP_QUESTION_BANK.map((question) => [question.id, question]));

export function questionsForDepartment(department: string): SetupQuestion[] {
  const ids = BY_DEPARTMENT[department] ?? ["tone", "hours"];
  return ids.map((id) => bank.get(id)).filter((question): question is SetupQuestion => Boolean(question));
}

export function agentProgressLabel(index: number, total: number, name: string) {
  return `Agent ${index + 1} of ${total}: ${name}`;
}

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
];

const BY_DEPARTMENT: Record<string, string[]> = {
  sales: ["tone", "offers", "pricing", "target-audience", "channels"],
  marketing: ["tone", "offers", "target-audience", "brand-voice", "channels"],
  branding: ["brand-voice", "target-audience", "tone"],
  admin: ["tone", "hours", "faqs"],
  operations: ["hours", "offers", "faqs"],
  "customer-service": ["tone", "hours", "faqs", "channels"],
  booking: ["tone", "hours", "booking-rules", "channels"],
  finance: ["tone", "pricing", "hours"],
  hr: ["tone", "hours", "faqs"],
  onboarding: ["tone", "offers", "faqs", "hours"],
  reputation: ["tone", "brand-voice", "channels"],
  social: ["brand-voice", "channels", "target-audience", "hours"],
  ads: ["offers", "pricing", "target-audience", "channels"],
  content: ["brand-voice", "target-audience", "tone", "channels"],
  ecommerce: ["offers", "pricing", "faqs", "channels"],
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

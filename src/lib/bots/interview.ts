import { botBySlug, templateBySlug, type SetupQuestion } from "@/lib/bots/catalog";
import { agentProgressLabel } from "@/lib/bots/setup-questions";

export type AgentQuestionStep = {
  slug: string;
  name: string;
  questions: SetupQuestion[];
};

/** Questions for each agent, skipping any question an earlier agent already asked. */
export function agentQuestionSteps(slugs: string[]): AgentQuestionStep[] {
  const seen = new Set<string>();
  return slugs.map((slug) => {
    const bot = botBySlug(slug);
    const questions = bot.setupQuestions.filter((question) => {
      if (seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    });
    return { slug: bot.slug, name: bot.name, questions };
  });
}

export { agentProgressLabel };

export type SetupAccountId = "email" | "tiktok" | "meta" | "youtube" | "whatsapp" | "linkedin" | "calendar";

export type SetupAccount = {
  id: SetupAccountId;
  label: string;
  channel: "email" | "whatsapp" | "facebook" | "instagram" | null;
  provider: "resend" | "meta_cloud" | "meta" | null;
};

const ACCOUNTS: SetupAccount[] = [
  { id: "email", label: "Gmail / email", channel: "email", provider: "resend" },
  { id: "tiktok", label: "TikTok", channel: null, provider: null },
  { id: "meta", label: "Facebook / Instagram", channel: "facebook", provider: "meta" },
  { id: "youtube", label: "YouTube", channel: null, provider: null },
  { id: "whatsapp", label: "WhatsApp", channel: "whatsapp", provider: "meta_cloud" },
  { id: "linkedin", label: "LinkedIn", channel: null, provider: null },
  { id: "calendar", label: "Calendar", channel: null, provider: null },
];

/** Accounts this team needs. Only these appear on the connect checklist. */
export function accountsForTemplate(templateSlug: string): SetupAccount[] {
  const template = templateBySlug(templateSlug);
  const needed = new Set<SetupAccountId>();
  for (const row of template.bots) {
    const bot = botBySlug(row.slug);
    const channel = bot.defaultConfig.channel;
    if (channel === "whatsapp") needed.add("whatsapp");
    if (channel === "email") needed.add("email");
    if (bot.touches.calendar || bot.engine === "calendar") needed.add("calendar");
    if (channel === "social" || bot.department === "social" || bot.department === "ads") {
      if (template.industry === "youtube") needed.add("youtube");
      else if (template.industry === "tiktok") needed.add("tiktok");
      else if (template.industry === "personal-brand") needed.add("linkedin");
      else needed.add("meta");
    }
    if (bot.department === "content" && template.industry === "youtube") needed.add("youtube");
    if (bot.department === "content" && template.industry === "tiktok") needed.add("tiktok");
    if (bot.department === "content" && template.industry === "facebook") needed.add("meta");
  }
  return ACCOUNTS.filter((account) => needed.has(account.id));
}

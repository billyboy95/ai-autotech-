import { AIOS_MENU } from "@/lib/aios-menu";
import { recommendTeam, type TeamRecommendation } from "@/lib/bots/recommend";

export type LeadAgentLink = { href: string; label: string };

export type LeadAgentReply = {
  message: string;
  links: LeadAgentLink[];
  recommendation: TeamRecommendation | null;
};

const EXTRA_PHRASES: Record<string, string[]> = {
  "/command-centre": ["home", "today"],
  "/command-centre/assistant": ["assistant"],
  "/command-centre/setup": ["setup", "set up"],
  "/command-centre/migrations": ["migrations", "pending sql"],
  "/command-centre/owner": ["owner bootstrap", "owner attach"],
  "/command-centre/install": ["install", "install aios"],
  "/command-centre/connect-accounts": ["connect accounts"],
  "/command-centre/import-contacts": ["import contacts"],
  "/command-centre/inbox": ["inbox", "messages"],
  "/command-centre/pipeline": ["pipeline", "deals"],
  "/command-centre/contacts": ["contacts"],
  "/command-centre/calendars": ["calendars", "calendar"],
  "/command-centre/reviews": ["reviews"],
  "/command-centre/outbox": ["outbox"],
  "/command-centre/campaigns": ["campaigns"],
  "/command-centre/jobs": ["jobs"],
  "/command-centre/money": ["money"],
  "/command-centre/social": ["social"],
  "/command-centre/ai-replies": ["ai replies"],
  "/command-centre/summary": ["summary"],
  "/command-centre/templates": ["message templates"],
  "/command-centre/agents": ["live agents"],
  "/command-centre/bots": ["agent store", "store"],
  "/command-centre/agents/mine": ["my agents"],
  "/command-centre/agents/templates": ["templates"],
  "/command-centre/team": ["team"],
  "/command-centre/workflows": ["automations", "workflows"],
  "/command-centre/billing": ["billing"],
  "/command-centre/referrals": ["referrals", "refer"],
  "/agency": ["agency"],
  "/command-centre/bots/agency": ["agent mrr"],
  "/command-centre/clients": ["clients"],
  "/command-centre/settings": ["settings"],
};

/** Business words the interview also understands. The value is passed to recommendTeam. */
const BUSINESSES: [string, string][] = [
  ["faceless youtube", "faceless youtube"],
  ["youtube", "faceless youtube"],
  ["facebook", "facebook page"],
  ["tiktok", "tiktok"],
  ["reels", "tiktok"],
  ["podcast", "podcast"],
  ["personal brand", "personal brand"],
  ["founder", "personal brand"],
  ["automation agency", "ai agency"],
  ["ai agency", "ai agency"],
  ["clinic", "clinic"],
  ["healthcare", "clinic"],
  ["clothing", "clothing brand"],
  ["fashion", "clothing brand"],
  ["restaurant", "restaurant"],
  ["real estate", "real estate"],
  ["school", "school"],
  ["education", "school"],
  ["salon", "salon"],
  ["beauty", "salon"],
  ["gym", "gym"],
  ["fitness", "gym"],
  ["legal", "legal"],
  ["trades", "trades"],
  ["automotive", "automotive"],
  ["ecommerce", "ecommerce"],
  ["consulting", "consulting agency"],
];

function mentions(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i").test(text);
}

function menuMatches(text: string) {
  let best = 0;
  const links: LeadAgentLink[] = [];
  for (const item of AIOS_MENU) {
    const phrases = EXTRA_PHRASES[item.href] ?? [item.label.toLowerCase()];
    const hit = phrases.reduce((longest, phrase) => (mentions(text, phrase) ? Math.max(longest, phrase.length) : longest), 0);
    if (!hit) continue;
    if (hit > best) {
      best = hit;
      links.length = 0;
      links.push(item);
    } else if (hit === best && !links.some((link) => link.href === item.href)) {
      links.push(item);
    }
  }
  return { links, length: best };
}

function businessMatch(text: string) {
  let best: { value: string; length: number } | null = null;
  for (const [phrase, value] of BUSINESSES) {
    if (!mentions(text, phrase)) continue;
    if (!best || phrase.length > best.length) best = { value, length: phrase.length };
  }
  return best;
}

/**
 * Rules-only Lead Agent. Opens the same places as the menus and can recommend a team.
 * It does not send, and it does not need an API key.
 */
export function replyToLeadAgent(raw: string): LeadAgentReply {
  const text = raw.trim().toLowerCase();
  if (!text) {
    return {
      message: "Name a page, or a business such as a clinic. Nothing is sent.",
      links: [{ href: "/command-centre/lead-agent", label: "Build the full team" }],
      recommendation: null,
    };
  }
  const menu = menuMatches(text);
  const business = businessMatch(text);
  const asksToSend = /\bsend\b/.test(text);
  if (asksToSend) {
    return {
      message: "Nothing is sent from the Lead Agent. Open the outbox to read what is waiting.",
      links: [{ href: "/command-centre/outbox", label: "Outbox" }],
      recommendation: null,
    };
  }
  if (business && business.length >= menu.length) {
    const recommendation = recommendTeam({
      business: business.value,
      stage: "starting",
      budgetCents: 500_000,
      goals: ["leads"],
      teamSize: "2-5",
      channels: [],
    });
    return {
      message: `${recommendation.templateName} is the full team. Open the Lead Agent to answer each agent's questions. Nothing is sent.`,
      links: [{ href: "/command-centre/lead-agent", label: "Build the full team" }],
      recommendation,
    };
  }
  if (menu.links.length) {
    const name = menu.links.map((link) => link.label).join(", ");
    return {
      message: `Open ${name}. Nothing is sent.`,
      links: menu.links,
      recommendation: null,
    };
  }
  return {
    message: "Try a menu name, such as Inbox, Team, or Billing. Or name a business, such as a clinic or a clothing brand. Nothing is sent.",
    links: [{ href: "/command-centre/lead-agent", label: "Build the full team" }],
    recommendation: null,
  };
}

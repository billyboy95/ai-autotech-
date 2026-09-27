/** Top-level AIOS navigation. The Lead Agent uses the same links. */
export const AIOS_SECTIONS = [
  {
    id: "home",
    label: "Home",
    links: [
      ["/command-centre", "Today"],
      ["/command-centre/assistant", "Assistant"],
      ["/command-centre/lead-agent", "Lead Agent"],
      ["/command-centre/setup", "Setup"],
      ["/command-centre/connect-accounts", "Connect accounts"],
      ["/command-centre/import-contacts", "Import contacts"],
    ],
  },
  {
    id: "crm",
    label: "CRM",
    links: [
      ["/command-centre/contacts", "Contacts"],
      ["/command-centre/pipeline", "Pipeline"],
      ["/command-centre/inbox", "Inbox"],
      ["/command-centre/calendars", "Calendars"],
      ["/command-centre/reviews", "Reviews"],
      ["/command-centre/outbox", "Outbox"],
      ["/command-centre/campaigns", "Campaigns"],
      ["/command-centre/jobs", "Jobs"],
      ["/command-centre/money", "Money"],
      ["/command-centre/social", "Social"],
      ["/command-centre/ai-replies", "AI replies"],
      ["/command-centre/summary", "Summary"],
      ["/command-centre/templates", "Message templates"],
    ],
  },
  {
    id: "agents",
    label: "Agents",
    links: [
      ["/command-centre/agents", "Live agents"],
      ["/command-centre/bots", "Agent store"],
      ["/command-centre/agents/mine", "My agents"],
      ["/command-centre/agents/templates", "Templates"],
    ],
  },
  { id: "team", label: "Team", href: "/command-centre/team" },
  { id: "automations", label: "Automations", href: "/command-centre/workflows" },
  {
    id: "billing",
    label: "Billing",
    links: [
      ["/command-centre/billing", "Billing"],
      ["/command-centre/referrals", "Referrals"],
    ],
  },
  {
    id: "agency",
    label: "Agency",
    links: [
      ["/agency", "Agency"],
      ["/command-centre/bots/agency", "Agent MRR"],
      ["/command-centre/clients", "Clients"],
      ["/command-centre/settings", "Settings"],
    ],
  },
] as const;

export type MenuLink = { href: string; label: string };

export const AIOS_MENU: MenuLink[] = AIOS_SECTIONS.flatMap((section): MenuLink[] => {
  if ("links" in section) return section.links.map(([href, label]) => ({ href, label }));
  return [{ href: section.href, label: section.label }];
});

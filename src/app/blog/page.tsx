import { PublicPageShell } from "@/components/public-page-shell";

export default function BlogPage() {
  return (
    <PublicPageShell
      title="Blog"
      description="Practical guides on automation, AI agents, CRM systems, project delivery, and digital transformation for SMEs."
      sourcePage="blog"
      items={[
        "How SMEs can start with AI agents",
        "CRM pipeline stages that actually work",
        "When to automate invoice follow-ups",
        "Client portals for service businesses",
        "Building internal operating systems",
        "Preparing for SaaS product expansion",
      ]}
    />
  );
}

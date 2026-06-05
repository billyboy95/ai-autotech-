import { PublicPageShell } from "@/components/public-page-shell";

export default function AboutPage() {
  return (
    <PublicPageShell
      title="About AI AutoTech"
      description="AI AutoTech is a Zentrix Online division building automation, AI, software, and digital transformation systems."
      sourcePage="about"
      items={[
        "South African SME focus",
        "Automation-first operations",
        "AI-assisted delivery",
        "Scalable SaaS thinking",
        "Secure client workflows",
        "Long-term platform support",
      ]}
    />
  );
}

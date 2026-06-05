import { PublicPageShell } from "@/components/public-page-shell";

export default function CaseStudiesPage() {
  return (
    <PublicPageShell
      title="Case Studies"
      description="Representative transformation stories showing how AI AutoTech improves operations, sales, service, and reporting."
      sourcePage="case-studies"
      items={[
        "Logistics dispatch automation",
        "Dental client portal",
        "Solar proposal automation",
        "Accounting invoice tracker",
        "Retail support workflow",
        "Agency delivery dashboard",
      ]}
    />
  );
}

import { PublicPageShell } from "@/components/public-page-shell";
import { AGENCY_PROMISE, AGENCY_TAGLINE, OPERATING_DIVISIONS } from "@/lib/brand/catalog";

export default function AboutPage() {
  return (
    <PublicPageShell
      title="About AI AutoTech"
      description={`${AGENCY_TAGLINE} AI AutoTech engineers digital systems that ${AGENCY_PROMISE}.`}
      sourcePage="about"
      items={OPERATING_DIVISIONS.map((name) => ({ title: name }))}
    />
  );
}

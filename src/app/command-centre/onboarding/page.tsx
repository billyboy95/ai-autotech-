import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OnboardingAliasPage() {
  redirect("/command-centre/lead-agent");
}

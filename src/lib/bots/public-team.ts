import { auditToSetup, recommendTeam, type TeamRecommendation } from "@/lib/bots/recommend";
import { isShareToken } from "@/lib/bots/share-token";
import { readAuditTeamSource } from "@/server/workers/with-org";

/** Public team card. Returns null when the token is unknown. Never includes lead contact fields. */
export async function loadPublicTeam(token: string): Promise<TeamRecommendation | null> {
  if (!isShareToken(token)) return null;
  const source = await readAuditTeamSource(token);
  if (!source) return null;
  return recommendTeam(auditToSetup({ industry: source.industry, answers: source.answers }));
}

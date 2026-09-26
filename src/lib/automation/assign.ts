import type { AssignmentRule, AutomationSettings } from "@/lib/automation/types";

export function assignOwner(
  settings: AutomationSettings,
  lead: { source: string; qrSource: string },
): { owner: string; settings: AutomationSettings; reason: string } {
  const rule = settings.rules.find((item) => ruleMatches(item, lead));
  if (rule) {
    return {
      owner: rule.owner.trim() || settings.defaultOwner || "Billy",
      settings,
      reason: rule.name || "Matching assignment rule",
    };
  }

  const team = settings.team.map((name) => name.trim()).filter(Boolean);
  if (settings.strategy === "round_robin" && team.length) {
    const index = settings.roundRobinIndex % team.length;
    const owner = team[index] || settings.defaultOwner || "Billy";
    return {
      owner,
      settings: { ...settings, roundRobinIndex: settings.roundRobinIndex + 1 },
      reason: `Round-robin (${index + 1} of ${team.length})`,
    };
  }

  return {
    owner: settings.defaultOwner.trim() || "Billy",
    settings,
    reason: "Default owner",
  };
}

function ruleMatches(rule: AssignmentRule, lead: { source: string; qrSource: string }) {
  if (!rule.active) return false;
  if (!rule.matchSource && !rule.matchQrSource) return false;
  if (rule.matchQrSource && rule.matchQrSource !== lead.qrSource) return false;
  if (rule.matchSource && rule.matchSource !== lead.source) return false;
  return true;
}

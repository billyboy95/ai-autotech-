import type { BotConfig } from "@/lib/bots/catalog-types";

export function mergeBotConfig(value: unknown, fallback: BotConfig): BotConfig {
  const row = value && typeof value === "object" ? value as Partial<BotConfig> : {};
  const hours = row.workingHours && typeof row.workingHours === "object" ? row.workingHours : fallback.workingHours;
  return {
    tone: typeof row.tone === "string" && row.tone.trim() ? row.tone.trim().slice(0, 200) : fallback.tone,
    workingHours: {
      timezone: typeof hours.timezone === "string" && hours.timezone.trim() ? hours.timezone : fallback.workingHours.timezone,
      start: typeof hours.start === "string" && hours.start.trim() ? hours.start : fallback.workingHours.start,
      end: typeof hours.end === "string" && hours.end.trim() ? hours.end : fallback.workingHours.end,
      days: Array.isArray(hours.days) ? hours.days.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6) : fallback.workingHours.days,
    },
    pipeline: typeof row.pipeline === "string" && row.pipeline.trim() ? row.pipeline.trim().slice(0, 160) : fallback.pipeline,
    stage: typeof row.stage === "string" && row.stage.trim() ? row.stage.trim().slice(0, 160) : fallback.stage,
    channel: typeof row.channel === "string" && row.channel.trim() ? row.channel.trim().slice(0, 40) : fallback.channel,
  };
}

function botsInPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const bots = (payload as { bots?: unknown }).bots;
  if (!Array.isArray(bots)) return [];
  return bots.filter((item): item is { slug?: string; config?: unknown } => Boolean(item) && typeof item === "object");
}

/** Seed an org bot from the first template payload that includes this slug. */
export function seedBotConfig(input: {
  botSlug: string;
  templates: { slug: string; payload: unknown }[];
  fallback: BotConfig;
}) {
  const ordered = [...input.templates].sort((left, right) => left.slug.localeCompare(right.slug));
  for (const template of ordered) {
    const match = botsInPayload(template.payload).find((bot) => bot.slug === input.botSlug);
    if (!match) continue;
    return {
      templateSlug: template.slug,
      config: mergeBotConfig(match.config, input.fallback),
    };
  }
  return { templateSlug: null as string | null, config: input.fallback };
}

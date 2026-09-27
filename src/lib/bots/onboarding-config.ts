import { templateBySlug } from "@/lib/bots/catalog";
import type { BotConfig } from "@/lib/bots/catalog-types";
import { configWithAnswers } from "@/lib/bots/configure";
import type { BusinessProfile } from "@/lib/bots/onboarding";
import type { SetupChannel, SetupGoal } from "@/lib/bots/recommend";

export type OnboardingBotConfig = {
  slug: string;
  config: BotConfig & {
    onboarding: {
      niche: string;
      hours: string;
      tools: string;
      goals: SetupGoal[];
      channels: SetupChannel[];
      sandbox: true;
      charged: false;
      pricePlaceholder: true;
    };
  };
};

/** Per-agent config for the sandbox trial. Server only: it follows the billing templates. */
export function onboardingBotConfigs(templateSlug: string, answers: Record<string, string>, profile: BusinessProfile): OnboardingBotConfig[] {
  const template = templateBySlug(templateSlug);
  return template.bots.map((bot) => {
    const config = configWithAnswers(bot.slug, bot.config, answers);
    return {
      slug: bot.slug,
      config: {
        ...config,
        onboarding: {
          niche: profile.niche,
          hours: profile.hours,
          tools: profile.tools,
          goals: profile.goals,
          channels: profile.channels,
          sandbox: true,
          charged: false,
          pricePlaceholder: true,
        },
      },
    };
  });
}

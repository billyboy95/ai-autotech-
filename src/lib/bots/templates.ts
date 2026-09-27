import { templateBySlug, type BotConfig, type BotStatus, type TeamTemplate } from "@/lib/bots/catalog";
import { addSandboxBotLines, openBotCheckout, type BotBillingLine, type BotLedger } from "@/lib/bots/billing";

export type AppliedPipeline = {
  assetKey: string;
  name: string;
  stages: { assetKey: string; name: string; position: number }[];
};

export type AppliedWorkflow = {
  assetKey: string;
  name: string;
  active: false;
  steps: { id: string; kind: "create_task"; title: string }[];
};

export type AppliedBot = {
  botSlug: string;
  bundleSlug: string;
  status: BotStatus;
  config: BotConfig;
  sandbox: true;
};

export type TemplateBook = {
  sendingEnabled: false;
  contacts: [];
  messages: [];
  secrets: [];
  pipelines: AppliedPipeline[];
  workflows: AppliedWorkflow[];
  bots: AppliedBot[];
  ledger: BotLedger;
};

export function emptyTemplateBook(subscriptions: { orgId: string }[] = []): TemplateBook {
  return {
    sendingEnabled: false,
    contacts: [],
    messages: [],
    secrets: [],
    pipelines: [],
    workflows: [],
    bots: [],
    ledger: { subscriptions, lines: [] },
  };
}

function mergeStages(
  current: AppliedPipeline["stages"],
  incoming: AppliedPipeline["stages"],
) {
  return incoming.reduce((list, stage) => {
    const found = list.findIndex((item) => item.assetKey === stage.assetKey);
    if (found === -1) return [...list, stage];
    return list.map((item, index) => (index === found ? stage : item));
  }, current);
}

/**
 * One-click team setup. Starts the sandbox bundle trial and upserts pipelines,
 * stages, workflows, and bot config. Re-apply does not duplicate asset keys.
 * Contacts, messages, and secrets are never copied. sendingEnabled stays false.
 */
export function applyTeamTemplate(book: TemplateBook, input: {
  orgId: string;
  orgName: string;
  templateSlug: string;
  env?: NodeJS.ProcessEnv;
}): { book: TemplateBook; lines: BotBillingLine[]; createdStages: number } {
  const template: TeamTemplate = templateBySlug(input.templateSlug);
  const opened = openBotCheckout({
    orgId: input.orgId,
    orgName: input.orgName,
    bundleSlug: template.bundleSlug,
    intent: "trial",
    env: input.env,
  });

  const before = new Set(book.pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => stage.assetKey)));
  const pipelines = template.pipelines.reduce((list, pipeline) => {
    const incoming: AppliedPipeline = {
      assetKey: pipeline.assetKey,
      name: pipeline.name,
      stages: pipeline.stages.map((stage) => ({
        assetKey: stage.assetKey,
        name: stage.name,
        position: stage.position,
      })),
    };
    const index = list.findIndex((item) => item.assetKey === incoming.assetKey);
    if (index === -1) return [...list, incoming];
    const stages = mergeStages(list[index].stages, incoming.stages);
    return list.map((item, itemIndex) => (itemIndex === index ? { ...incoming, stages } : item));
  }, book.pipelines);

  const stageKeys = pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => stage.assetKey));
  if (new Set(stageKeys).size !== stageKeys.length) throw new Error("template apply duplicated a stage");

  const workflows = template.workflows.reduce((list, flow) => {
    const next: AppliedWorkflow = { assetKey: flow.assetKey, name: flow.name, active: false, steps: flow.steps };
    const index = list.findIndex((item) => item.assetKey === flow.assetKey);
    if (index === -1) return [...list, next];
    return list.map((item, itemIndex) => (itemIndex === index ? next : item));
  }, book.workflows);
  const flowKeys = workflows.map((flow) => flow.assetKey);
  if (new Set(flowKeys).size !== flowKeys.length) throw new Error("template apply duplicated a workflow");

  const bots = template.bots.reduce((list, bot) => {
    const index = list.findIndex((item) => item.botSlug === bot.slug);
    if (index === -1) {
      const row: AppliedBot = {
        botSlug: bot.slug,
        bundleSlug: template.bundleSlug,
        status: "trial",
        config: bot.config,
        sandbox: true,
      };
      return [...list, row];
    }
    return list.map((item, itemIndex) => (
      itemIndex === index ? { ...item, config: bot.config, bundleSlug: item.bundleSlug || template.bundleSlug, sandbox: true as const } : item
    ));
  }, book.bots);

  return {
    book: {
      sendingEnabled: false,
      contacts: [],
      messages: [],
      secrets: [],
      pipelines,
      workflows,
      bots,
      ledger: opened.lines.length ? addSandboxBotLines(book.ledger, opened.lines) : book.ledger,
    },
    lines: opened.lines,
    createdStages: stageKeys.filter((key) => !before.has(key)).length,
  };
}

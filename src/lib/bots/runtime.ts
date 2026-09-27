import { assessReplyConsent } from "@/lib/ai-reply/consent";
import { evaluateSend } from "@/lib/compliance/send-gate";
import { botBySlug, type BotConfig } from "@/lib/bots/catalog";

export type BotRunKind = "ai_draft" | "outbox_draft" | "task" | "calendar_draft" | "ad_draft" | "social_draft";

export type BotArtifact = {
  kind: "draft" | "task";
  status: "draft" | "open" | "skipped";
  title: string;
  body: string;
  channel?: string;
  outboxStatus?: "draft";
};

export type BotRunResult = {
  botSlug: string;
  engine: string;
  kind: BotRunKind;
  status: "drafted" | "skipped";
  summary: string;
  artifacts: BotArtifact[];
  output: {
    kind: "draft" | "task";
    outboxStatus?: "draft";
    workflowAssetKey?: string;
    taskTitle?: string;
    draftBody?: string;
  };
};

export type BotRunInput = {
  slug: string;
  config?: Partial<BotConfig>;
  sendingEnabled: boolean;
  suppressed: boolean;
  stopped: boolean;
  consents: { channel: string; status: string }[];
  leadName?: string;
  leadId?: string | null;
  bookingPath?: string;
};

function configOf(input: BotRunInput): BotConfig {
  return { ...botBySlug(input.slug).defaultConfig, ...input.config };
}

function draftOnly(artifact: BotArtifact) {
  if (artifact.outboxStatus && artifact.outboxStatus !== "draft") {
    throw new Error("bot output cannot be queued or sent");
  }
  if (artifact.status === "draft" || artifact.status === "open" || artifact.status === "skipped") return artifact;
  throw new Error("bot output cannot be queued or sent");
}

function result(partial: Omit<BotRunResult, "artifacts"> & { artifacts: BotArtifact[] }): BotRunResult {
  const artifacts = partial.artifacts.map(draftOnly);
  if (artifacts.some((item) => item.outboxStatus && item.outboxStatus !== "draft")) {
    throw new Error("bot output cannot be queued or sent");
  }
  return { ...partial, artifacts };
}

function inbound(input: BotRunInput, config: BotConfig): BotRunResult {
  const name = input.leadName?.trim() || "there";
  const body = `Hi ${name}, thanks for getting in touch. A person on the team will follow up. This is a draft in a ${config.tone} tone. Nothing was sent.`;
  return result({
    botSlug: "inbound-lead",
    engine: "ai_reply",
    kind: "ai_draft",
    status: "drafted",
    summary: "Assigned the lead and saved an AI draft. Nothing was sent.",
    artifacts: [
      { kind: "task", status: "open", title: "Assign the inbound lead", body: "Workflow workflow:bot:inbound-assign" },
      { kind: "draft", status: "draft", title: "AI reply draft", body, channel: config.channel },
    ],
    output: {
      kind: "draft",
      workflowAssetKey: "workflow:bot:inbound-assign",
      taskTitle: "Assign the inbound lead",
      draftBody: body,
    },
  });
}

function outbound(input: BotRunInput, config: BotConfig): BotRunResult {
  const channel = config.channel === "email" || config.channel === "sms" || config.channel === "whatsapp"
    ? config.channel
    : "whatsapp";
  const consent = assessReplyConsent({
    channel,
    consents: input.consents,
    suppressed: input.suppressed,
    inboundStop: input.stopped,
  });
  if (!consent.ok) {
    return result({
      botSlug: "outbound-sales",
      engine: "outbox_draft",
      kind: "outbox_draft",
      status: "skipped",
      summary: consent.reason,
      artifacts: [],
      output: { kind: "draft" },
    });
  }
  const gate = evaluateSend({
    sendingEnabled: input.sendingEnabled,
    channel,
    purpose: "marketing",
    senderName: "Workspace",
    suppressed: input.suppressed,
    consent: "opted_in",
    basis: "consent",
    body: `Hello, here is a short note from the team. Tone: ${config.tone}.`,
  });
  const body = `${gate.body}\n\nDraft only. The bot did not queue or send this.`;
  return result({
    botSlug: "outbound-sales",
    engine: "outbox_draft",
    kind: "outbox_draft",
    status: "drafted",
    summary: input.sendingEnabled
      ? "Outreach saved as a draft. The bot does not send, even when the workspace switch is on."
      : "Outreach saved as a draft. Sending is off.",
    artifacts: [{
      kind: "draft",
      status: "draft",
      title: "Outbound draft",
      body,
      channel,
      outboxStatus: "draft",
    }],
    output: { kind: "draft", outboxStatus: "draft", draftBody: body },
  });
}

function onboarding(input: BotRunInput, config: BotConfig): BotRunResult {
  const path = input.bookingPath || "/book/ai-autotech-audit";
  const body = `Booking link draft for the onboarding call: ${path}. Tone: ${config.tone}. Nothing was sent.`;
  return result({
    botSlug: "onboarding",
    engine: "calendar",
    kind: "calendar_draft",
    status: "drafted",
    summary: "Created an onboarding task and a booking-link draft. Nothing was sent.",
    artifacts: [
      { kind: "task", status: "open", title: "Create the onboarding tasks", body: "Workflow workflow:bot:onboarding-tasks" },
      { kind: "draft", status: "draft", title: "Booking link draft", body, channel: config.channel },
    ],
    output: {
      kind: "task",
      workflowAssetKey: "workflow:bot:onboarding-tasks",
      taskTitle: "Create the onboarding tasks",
      draftBody: body,
    },
  });
}

function ads(config: BotConfig): BotRunResult {
  const body = `Ad draft. Headline: A simpler way to reply to new leads. Tone: ${config.tone}. This copy is a draft and is not published.`;
  return result({
    botSlug: "ads",
    engine: "outbox_draft",
    kind: "ad_draft",
    status: "drafted",
    summary: "Saved ad copy as a draft. Nothing was published.",
    artifacts: [{ kind: "draft", status: "draft", title: "Ad copy draft", body, channel: "ads" }],
    output: { kind: "draft", draftBody: body },
  });
}

function social(config: BotConfig): BotRunResult {
  const body = `Social draft. A short post in a ${config.tone} tone about this week's offer. This post is a draft and is not published.`;
  return result({
    botSlug: "social-posting",
    engine: "workflows",
    kind: "social_draft",
    status: "drafted",
    summary: "Saved a social post as a draft. Nothing was published.",
    artifacts: [{ kind: "draft", status: "draft", title: "Social post draft", body, channel: "social" }],
    output: {
      kind: "draft",
      workflowAssetKey: "workflow:bot:social-draft",
      draftBody: body,
    },
  });
}

function generic(input: BotRunInput, config: BotConfig): BotRunResult {
  const bot = botBySlug(input.slug);
  if (bot.capabilities.includes("outbox-draft")) {
    const drafted = outbound(input, config);
    return { ...drafted, botSlug: bot.slug, summary: drafted.status === "skipped" ? drafted.summary : `${bot.name} saved a draft. Nothing was sent.` };
  }
  if (bot.capabilities.includes("ad-copy-draft") || bot.capabilities.includes("social-post-draft") || bot.capabilities.includes("content-draft")) {
    const body = `${bot.name} draft. Tone: ${config.tone}. This is a draft and is not published.`;
    return result({
      botSlug: bot.slug,
      engine: bot.engine,
      kind: bot.capabilities.includes("ad-copy-draft") ? "ad_draft" : "social_draft",
      status: "drafted",
      summary: `${bot.name} saved a draft. Nothing was published.`,
      artifacts: [{ kind: "draft", status: "draft", title: `${bot.name} draft`, body, channel: config.channel }],
      output: { kind: "draft", draftBody: body },
    });
  }
  if (bot.engine === "calendar" || bot.capabilities.includes("calendar-link")) {
    const booked = onboarding(input, config);
    return { ...booked, botSlug: bot.slug, summary: `${bot.name} saved a task and a booking-link draft. Nothing was sent.` };
  }
  if (bot.engine === "ai_reply") {
    const name = input.leadName?.trim() || "there";
    const body = `Hi ${name}, this is a ${config.tone} draft from ${bot.name}. Nothing was sent.`;
    return result({
      botSlug: bot.slug,
      engine: bot.engine,
      kind: "ai_draft",
      status: "drafted",
      summary: `${bot.name} saved a draft. Nothing was sent.`,
      artifacts: [
        { kind: "task", status: "open", title: `Review the ${bot.name} draft`, body: bot.touches.pipelines[0] || config.pipeline },
        { kind: "draft", status: "draft", title: `${bot.name} draft`, body, channel: config.channel },
      ],
      output: { kind: "draft", taskTitle: `Review the ${bot.name} draft`, draftBody: body },
    });
  }
  return result({
    botSlug: bot.slug,
    engine: bot.engine,
    kind: "task",
    status: "drafted",
    summary: `${bot.name} saved a task. Nothing was sent.`,
    artifacts: [{ kind: "task", status: "open", title: bot.name, body: `Task for ${config.pipeline}. Nothing was sent.` }],
    output: { kind: "task", taskTitle: bot.name, workflowAssetKey: config.pipeline },
  });
}

/** Runs one bot. Output is drafts or tasks. Outbox rows stay status draft. */
export function runBot(input: BotRunInput): BotRunResult {
  const config = configOf(input);
  const bot = botBySlug(input.slug);
  if (bot.slug === "inbound-lead") return inbound(input, config);
  if (bot.slug === "outbound-sales") return outbound(input, config);
  if (bot.slug === "onboarding") return onboarding(input, config);
  if (bot.slug === "ads") return ads(config);
  if (bot.slug === "social-posting") return social(config);
  return generic(input, config);
}

export function runTouchesOutbox(run: BotRunResult) {
  return run.artifacts.some((item) => item.outboxStatus === "draft");
}

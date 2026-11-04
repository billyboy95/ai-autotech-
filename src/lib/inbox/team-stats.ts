/**
 * Team inbox stats for the current inbox view.
 * Unset, blank, or any value other than the string true keeps today's inbox:
 * no stats panel and no extra message query.
 * Counts come from conversations already listed and from messages.direction,
 * messages.created_at, messages.status, and messages.sent_by_user_id.
 * Open-conversation age uses the oldest loaded message, then last_message_at.
 * No new table. This module does not send, does not call Meta, and does not
 * turn sending_enabled on.
 */

import type { InboxTeamStats, InboxTeamStatsAgent } from "@/lib/inbox/types";

export const INBOX_TEAM_STATS_FLAG = "INBOX_TEAM_STATS_ENABLED";
export const INBOX_TEAM_STATS_SLA_HOURS = 24;
export const INBOX_TEAM_STATS_MESSAGE_CAP = 2000;

const SLA_MS = INBOX_TEAM_STATS_SLA_HOURS * 60 * 60 * 1000;
const REPLY_STATUS = new Set(["queued", "held", "sent"]);

export type TeamStatsConversation = {
  id: string;
  status: string;
  assignedUserId: string | null;
  contactName: string;
  lastMessageAt: string | null;
};

export type TeamStatsMessage = {
  conversationId: string;
  direction: "in" | "out";
  createdAt: string;
  status: string;
  sentByUserId: string | null;
};

export type TeamStatsMember = {
  userId: string;
  role: string;
};

export function inboxTeamStatsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_TEAM_STATS_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function formatDurationMs(ms: number) {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function buildInboxTeamStats(input: {
  now: Date;
  conversations: readonly TeamStatsConversation[];
  messages: readonly TeamStatsMessage[];
  members: readonly TeamStatsMember[];
  userId: string | null;
  messagesLoaded?: boolean;
  truncated?: boolean;
  slaMs?: number;
}): InboxTeamStats {
  const now = input.now.getTime();
  const slaMs = input.slaMs ?? SLA_MS;
  const open = input.conversations.filter((item) => item.status !== "closed");
  const openIds = new Set(open.map((item) => item.id));
  const messagesByConversation = new Map<string, TeamStatsMessage[]>();
  for (const message of input.messages) {
    if (!openIds.has(message.conversationId)) continue;
    const list = messagesByConversation.get(message.conversationId);
    if (list) list.push(message);
    else messagesByConversation.set(message.conversationId, [message]);
  }

  const assignedCounts = new Map<string, number>();
  let unassigned = 0;
  const samples: number[] = [];
  let awaitingFirstReply = 0;
  const slaBreaches: InboxTeamStats["slaBreaches"] = [];

  for (const conversation of open) {
    if (conversation.assignedUserId) {
      assignedCounts.set(conversation.assignedUserId, (assignedCounts.get(conversation.assignedUserId) ?? 0) + 1);
    } else {
      unassigned += 1;
    }
    const messages = messagesByConversation.get(conversation.id) ?? [];
    const response = firstResponseMs(messages);
    if (response.inbound) {
      if (response.ms == null) awaitingFirstReply += 1;
      else samples.push(response.ms);
    }
    const age = openAgeMs(messages, conversation.lastMessageAt, now);
    if (age != null && age >= slaMs) {
      slaBreaches.push({
        conversationId: conversation.id,
        contactName: conversation.contactName,
        ageMs: age,
      });
    }
  }
  slaBreaches.sort((a, b) => b.ageMs - a.ageMs || a.contactName.localeCompare(b.contactName));

  const replyCounts = new Map<string, number>();
  let unattributed = 0;
  for (const message of input.messages) {
    if (!openIds.has(message.conversationId) || !isReply(message)) continue;
    if (message.sentByUserId) replyCounts.set(message.sentByUserId, (replyCounts.get(message.sentByUserId) ?? 0) + 1);
    else unattributed += 1;
  }

  const roles = new Map(input.members.map((member) => [member.userId, member.role]));
  const agentIds = new Set<string>([...roles.keys(), ...assignedCounts.keys(), ...replyCounts.keys()]);
  const agents: InboxTeamStatsAgent[] = [...agentIds].map((userId) => ({
    key: userId,
    label: agentLabel(userId, roles.get(userId), input.userId),
    assigned: assignedCounts.get(userId) ?? 0,
    replies: replyCounts.get(userId) ?? 0,
  }));
  agents.sort((a, b) => b.assigned - a.assigned || b.replies - a.replies || a.label.localeCompare(b.label));
  if (unassigned > 0) {
    agents.push({ key: "unassigned", label: "Unassigned", assigned: unassigned, replies: 0 });
  }
  if (unattributed > 0) {
    agents.push({ key: "unattributed", label: "Replies with no agent", assigned: 0, replies: unattributed });
  }

  return {
    slaHours: Math.round(slaMs / 3_600_000),
    medianFirstResponseMs: median(samples),
    repliedCount: samples.length,
    awaitingFirstReply,
    openCount: open.length,
    slaBreaches,
    agents,
    messagesLoaded: input.messagesLoaded !== false,
    truncated: input.truncated === true,
  };
}

function isReply(message: TeamStatsMessage) {
  return message.direction === "out" && REPLY_STATUS.has(message.status);
}

function firstResponseMs(messages: readonly TeamStatsMessage[]) {
  const ordered = timed(messages);
  const firstIn = ordered.find((item) => item.message.direction === "in");
  if (!firstIn) return { inbound: false, ms: null as number | null };
  const reply = ordered.find((item) => isReply(item.message) && item.time >= firstIn.time);
  if (!reply) return { inbound: true, ms: null as number | null };
  return { inbound: true, ms: reply.time - firstIn.time };
}

function openAgeMs(messages: readonly TeamStatsMessage[], lastMessageAt: string | null, now: number) {
  const times = timed(messages).map((item) => item.time);
  const last = lastMessageAt ? timeOf(lastMessageAt) : null;
  if (last != null) times.push(last);
  if (!times.length) return null;
  const age = now - Math.min(...times);
  return age >= 0 ? age : null;
}

function timed(messages: readonly TeamStatsMessage[]) {
  return messages
    .map((message) => ({ message, time: timeOf(message.createdAt) }))
    .filter((item): item is { message: TeamStatsMessage; time: number } => item.time != null)
    .sort((a, b) => a.time - b.time);
}

function timeOf(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function agentLabel(userId: string, role: string | undefined, currentUserId: string | null) {
  const short = userId.slice(0, 8);
  if (userId === currentUserId) return role ? `You · ${role}` : "You";
  if (role) return `${role} · ${short}`;
  return `Agent · ${short}`;
}

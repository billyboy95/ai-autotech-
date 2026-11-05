import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { previewInbox } from "@/lib/inbox/preview";
import { matchesInboxList, parseInboxFilter } from "@/lib/inbox/rules";
import {
  inboxSnoozeEnabled,
  INBOX_SNOOZE_SIDE_EFFECTS,
  isSnoozeActive,
  planInboxSnooze,
  snoozeUntil,
} from "@/lib/inbox/snooze";

const NOW = new Date("2026-11-05T08:00:00.000Z");
const USER = "user-1";

function row(id: string, snoozedUntil: string | null, extra?: { assignedUserId?: string | null; status?: string; channel?: string }) {
  return {
    id,
    status: extra?.status ?? "open",
    assignedUserId: extra?.assignedUserId === undefined ? USER : extra.assignedUserId,
    channel: extra?.channel ?? "whatsapp",
    snoozedUntil,
  };
}

function visible(rows: ReturnType<typeof row>[], filter: "open" | "mine" | "unassigned" | "snoozed", snoozeEnabled: boolean, now = NOW) {
  return rows
    .filter((item) => matchesInboxList({
      status: item.status,
      assignedUserId: item.assignedUserId,
      channel: item.channel,
      filter: snoozeEnabled ? filter : parseInboxFilter(filter, { snoozeEnabled }),
      channelFilter: "",
      userId: USER,
      snoozedUntil: item.snoozedUntil,
      now,
      snoozeEnabled,
    }))
    .map((item) => item.id);
}

test("INBOX_SNOOZE_ENABLED is on only for the exact string true", () => {
  assert.equal(inboxSnoozeEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxSnoozeEnabled({ INBOX_SNOOZE_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxSnoozeEnabled({ INBOX_SNOOZE_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  assert.equal(inboxSnoozeEnabled({ INBOX_SNOOZE_ENABLED: "true" } as NodeJS.ProcessEnv), true);
  for (const value of ["True", "TRUE", "1", "yes", "false", "on"]) {
    assert.equal(inboxSnoozeEnabled({ INBOX_SNOOZE_ENABLED: value } as NodeJS.ProcessEnv), false, value);
  }
});

test("flag off keeps an active snooze on the open list and ignores the snoozed filter", () => {
  const rows = [
    row("open", null),
    row("active", new Date(NOW.getTime() + 60 * 60 * 1000).toISOString()),
    row("expired", new Date(NOW.getTime() - 1000).toISOString()),
  ];
  assert.deepEqual(visible(rows, "open", false), ["open", "active", "expired"]);
  assert.deepEqual(visible(rows, "snoozed", false), ["open", "active", "expired"]);
  assert.equal(parseInboxFilter("snoozed"), "open");
  assert.equal(parseInboxFilter("snoozed", { snoozeEnabled: false }), "open");
  const preview = previewInbox({ filter: "snoozed" });
  const open = previewInbox({});
  assert.equal(preview.snoozeEnabled, false);
  assert.equal(preview.filter, "open");
  assert.deepEqual(preview.conversations.map((item) => item.contactName), open.conversations.map((item) => item.contactName));
  assert.equal(preview.conversations.some((item) => item.contactName === "Sipho Dlamini"), false);
});

test("flag on hides an active snooze from Open and shows it on Snoozed", () => {
  const activeUntil = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
  const rows = [
    row("open", null),
    row("active", activeUntil),
    row("expired", new Date(NOW.getTime() - 1000).toISOString()),
    row("closed", activeUntil, { status: "closed" }),
  ];
  assert.deepEqual(visible(rows, "open", true), ["open", "expired"]);
  assert.deepEqual(visible(rows, "mine", true), ["open", "expired"]);
  assert.deepEqual(visible([row("other", null, { assignedUserId: "user-2" })], "mine", true), []);
  assert.deepEqual(visible(rows, "snoozed", true), ["active"]);
  assert.equal(isSnoozeActive(activeUntil, NOW), true);
  assert.equal(isSnoozeActive(new Date(NOW.getTime() - 1000).toISOString(), NOW), false);
  assert.equal(isSnoozeActive(null, NOW), false);

  const openPreview = previewInbox({ snoozeEnabled: true });
  assert.equal(openPreview.snoozeEnabled, true);
  assert.equal(openPreview.conversations.some((item) => item.contactName === "Sipho Dlamini"), false);
  assert.equal(openPreview.conversations.some((item) => item.contactName === "Naledi Khumalo"), true);
  const snoozedPreview = previewInbox({ snoozeEnabled: true, filter: "snoozed" });
  assert.deepEqual(snoozedPreview.conversations.map((item) => item.contactName), ["Sipho Dlamini"]);
  assert.equal(snoozedPreview.thread?.contact?.name, "Sipho Dlamini");
  assert.ok(snoozedPreview.thread?.snoozeLabel);
});

test("clearing a snooze puts the thread back on Open and writes no outbox", () => {
  const snoozed = planInboxSnooze({ preset: "1h", now: NOW });
  assert.equal(snoozed.ok, true);
  if (!snoozed.ok) return;
  assert.equal(snoozed.snoozedUntil, new Date(NOW.getTime() + 60 * 60 * 1000).toISOString());
  assert.equal(snoozed.sends, false);
  assert.equal(snoozed.outboxInsert, false);
  assert.equal(snoozed.consentChange, false);
  assert.equal("row" in snoozed, false);
  assert.deepEqual(visible([row("active", snoozed.snoozedUntil)], "open", true), []);

  const cleared = planInboxSnooze({ preset: "clear", now: NOW });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  assert.equal(cleared.snoozedUntil, null);
  assert.equal(cleared.outboxInsert, false);
  assert.equal(cleared.sends, false);
  assert.match(cleared.notice, /Nothing was sent/);
  assert.deepEqual(visible([row("active", cleared.snoozedUntil)], "open", true), ["active"]);
  assert.deepEqual(visible([row("active", cleared.snoozedUntil)], "snoozed", true), []);
  assert.deepEqual(INBOX_SNOOZE_SIDE_EFFECTS, { sends: false, outboxInsert: false, consentChange: false });

  const refused = planInboxSnooze({ preset: "next-month", now: NOW });
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.outboxInsert, false);
  assert.equal(refused.sends, false);
});

test("snooze presets use Johannesburg times and stay in the future", () => {
  assert.equal(snoozeUntil("1h", NOW), "2026-11-05T09:00:00.000Z");
  assert.equal(snoozeUntil("later_today", NOW), "2026-11-05T16:00:00.000Z");
  assert.equal(snoozeUntil("tomorrow", NOW), "2026-11-06T07:00:00.000Z");
  assert.equal(snoozeUntil("next_week", NOW), "2026-11-09T07:00:00.000Z");
  assert.equal(snoozeUntil("clear", NOW), null);

  const evening = new Date("2026-11-05T16:00:00.000Z");
  assert.equal(snoozeUntil("later_today", evening), "2026-11-06T07:00:00.000Z");
  const monday = new Date("2026-11-09T06:00:00.000Z");
  assert.equal(snoozeUntil("next_week", monday), "2026-11-16T07:00:00.000Z");
  const sunday = new Date("2026-11-08T10:00:00.000Z");
  assert.equal(snoozeUntil("next_week", sunday), "2026-11-09T07:00:00.000Z");
});

test("the snooze action does not insert outbox, send, or change consent", () => {
  const source = readFileSync(new URL("../../app/actions/inbox.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function snoozeInboxConversation");
  const end = source.indexOf("export async function markInboxRead");
  assert.ok(start > 0 && end > start);
  const body = source.slice(start, end);
  assert.equal(/crm_outbox/.test(body), false);
  assert.equal(/sending_enabled/.test(body), false);
  assert.equal(/consent/.test(body), false);
  assert.equal(/deliverMessage|provider/.test(body), false);
  assert.match(body, /inboxSnoozeEnabled/);
  assert.match(body, /snoozed_until/);
});

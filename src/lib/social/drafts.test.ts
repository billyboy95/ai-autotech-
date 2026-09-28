import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  WEEK_1_TOPICS,
  fixtureSocialDrafts,
  isPublishIntent,
  johannesburgTimestamp,
  mergeWeek1Drafts,
  planSocialDraft,
  refuseSocialPublish,
  socialDraftsDisplayMode,
  socialDraftsMode,
  toJohannesburgLocal,
} from "@/lib/social/drafts";

test("social drafts stay fixture-only until SOCIAL_DRAFTS_ENABLED is true", () => {
  assert.equal(socialDraftsMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(socialDraftsMode({ SOCIAL_DRAFTS_ENABLED: "" }), "fixture");
  assert.equal(socialDraftsMode({ SOCIAL_DRAFTS_ENABLED: "false" }), "fixture");
  assert.equal(socialDraftsMode({ SOCIAL_DRAFTS_ENABLED: "true" }), "sandbox");
  assert.equal(socialDraftsDisplayMode({ tenantMode: "preview", env: { SOCIAL_DRAFTS_ENABLED: "true" } }), "fixture");
  assert.equal(socialDraftsDisplayMode({ tenantMode: "member", env: { SOCIAL_DRAFTS_ENABLED: "true" } }), "sandbox");
});

test("week 1 topics are the fixture draft list and can be edited locally", () => {
  const fixtures = fixtureSocialDrafts();
  assert.equal(fixtures.length, WEEK_1_TOPICS.length);
  assert.deepEqual(fixtures.map((draft) => draft.topicKey), WEEK_1_TOPICS.map((topic) => topic.key));
  assert.equal(fixtures.every((draft) => draft.status === "draft" && draft.stored === false && draft.scheduledFor === null), true);
  assert.equal(fixtures[0]?.title, "Introduce the business");

  const saved = planSocialDraft({
    intent: "save",
    topicKey: "week1-problem",
    platform: "linkedin",
    body: "Week 1. Edited problem draft.",
    scheduledLocal: "2026-09-28T09:00",
  });
  assert.equal(saved.refused, false);
  assert.equal(saved.queued, 0);
  assert.equal(saved.posted, 0);
  assert.equal(saved.draft?.status, "draft");
  assert.equal(saved.draft?.scheduledFor, null);
  assert.equal(saved.draft?.platform, "linkedin");
  assert.match(saved.message, /Nothing was posted/);

  const scheduled = planSocialDraft({
    intent: "schedule",
    topicKey: "week1-offer",
    platform: "tiktok",
    body: "Week 1. Offer a conversation.",
    scheduledLocal: "2026-09-28T09:00",
  });
  assert.equal(scheduled.refused, false);
  assert.equal(scheduled.draft?.status, "scheduled");
  assert.equal(scheduled.draft?.scheduledFor, "2026-09-28T09:00:00+02:00");
  assert.equal(johannesburgTimestamp("2026-09-28T09:00"), "2026-09-28T09:00:00+02:00");
  assert.equal(toJohannesburgLocal("2026-09-28T07:00:00.000Z"), "2026-09-28T09:00");
  assert.match(scheduled.message, /Scheduled locally/);
  assert.match(scheduled.message, /Nothing was posted/);

  const merged = mergeWeek1Drafts([scheduled.draft!]);
  assert.equal(merged.find((draft) => draft.topicKey === "week1-offer")?.status, "scheduled");
  assert.equal(merged.find((draft) => draft.topicKey === "week1-intro")?.status, "draft");
});

test("publish, post now, and go live are refused", () => {
  assert.equal(isPublishIntent("publish"), true);
  assert.equal(isPublishIntent("post_now"), true);
  assert.equal(isPublishIntent("go_live"), true);
  assert.equal(isPublishIntent("save"), false);
  assert.equal(isPublishIntent("schedule"), false);

  for (const intent of ["publish", "post_now", "go live"]) {
    const refused = refuseSocialPublish(intent);
    assert.equal(refused.refused, true);
    assert.equal(refused.queued, 0);
    assert.equal(refused.posted, 0);
    assert.match(refused.message, /Billy must approve sends/);
    assert.match(refused.message, /refused/);
    assert.match(refused.message, /Nothing was posted/);

    const planned = planSocialDraft({
      intent,
      topicKey: "week1-intro",
      platform: "facebook",
      body: "Week 1. Introduce the business.",
      scheduledLocal: "2026-09-28T09:00",
    });
    assert.equal(planned.refused, true);
    assert.equal(planned.queued, 0);
    assert.equal(planned.posted, 0);
    assert.equal(planned.draft, null);
    assert.match(planned.message, /Billy must approve sends/);
  }
});

test("social draft copy does not phase the team, turn sending on, or call a provider", () => {
  const files = [
    "src/lib/social/drafts.ts",
    "src/lib/social/load.ts",
    "src/app/actions/social-drafts.ts",
    "src/components/social/drafts-panel.tsx",
    "src/app/command-centre/social/page.tsx",
    "docs/social-drafts.md",
    "supabase/migrations/20261103120000_phase5g_social_drafts.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.linkedin|tiktok\.com|oauth2|store_channel_secret|crm_outbox/i.test(text), false, file);
    assert.equal(/pg_cron|cron\.schedule/i.test(text), false, file);
  }
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step27 = order.indexOf("27. `supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql`");
  const step28 = order.indexOf("28. `supabase/migrations/20261103120000_phase5g_social_drafts.sql`");
  assert.ok(step27 >= 0);
  assert.ok(step28 > step27);
});

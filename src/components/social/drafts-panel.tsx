"use client";

import { useState } from "react";
import { useActionState } from "react";
import { submitSocialDraft } from "@/app/actions/social-drafts";
import {
  EMPTY_SOCIAL_DRAFT_ACTION,
  SOCIAL_PLATFORMS,
  WEEK_1_TOPICS,
  week1Topic,
  type SocialDraft,
  type SocialDraftMode,
  type SocialDraftPlatform,
} from "@/lib/social/drafts";

const buttonClass = "inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:w-fit";

const PLATFORM_LABEL: Record<SocialDraftPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

export function SocialDraftsPanel({
  mode,
  orgSlug,
  drafts,
  notice,
}: {
  mode: SocialDraftMode;
  orgSlug: string;
  drafts: SocialDraft[];
  notice?: string | null;
}) {
  const [state, act] = useActionState(submitSocialDraft, EMPTY_SOCIAL_DRAFT_ACTION);
  const first = drafts[0] ?? null;
  const [topicKey, setTopicKey] = useState(first?.topicKey ?? WEEK_1_TOPICS[0].key);
  const [platform, setPlatform] = useState<SocialDraftPlatform>(first?.platform ?? "facebook");
  const [body, setBody] = useState(first?.body ?? WEEK_1_TOPICS[0].body);
  const [scheduledFor, setScheduledFor] = useState(first?.scheduledLocal ?? "");
  const shown = drafts.map((draft) => (state.draft && state.stored && state.draft.topicKey === draft.topicKey ? { ...draft, ...state.draft, stored: true } : draft));

  function editDraft(draft: SocialDraft) {
    setTopicKey(draft.topicKey);
    setPlatform(draft.platform);
    setBody(draft.body);
    setScheduledFor(draft.scheduledLocal);
  }

  function onTopic(key: string) {
    const topic = week1Topic(key);
    if (!topic) return;
    setTopicKey(topic.key);
    setBody(topic.body);
    setScheduledFor("");
  }

  return (
    <section data-testid="social-drafts" data-queued="0" data-posted="0" className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Sandbox social drafts</h2>
        <p className="mt-1 text-sm text-slate-700">
          Week 1 topics can be edited and scheduled in this workspace. Publish, Post now, and Go live are refused. Billy must approve sends. Nothing is posted.
        </p>
      </div>
      {mode === "fixture" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fixture only. These drafts are not stored until SOCIAL_DRAFTS_ENABLED is true and step 28 is applied. Nothing is posted.
        </p>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Sandbox drafts can be stored and scheduled locally. Billy must approve sends. Nothing is posted.
        </p>
      )}
      <p className="text-sm text-slate-700">Billy must approve sends. Publish, Post now, and Go live are refused. Nothing is posted. Outbox queued: 0.</p>
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}
      <ul className="grid gap-2">
        {shown.map((draft) => (
          <li key={draft.topicKey} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800">
            <p className="font-semibold text-[#0B1F3A]">{`${draft.day}: ${draft.title}`}</p>
            <p className="mt-1 text-slate-600">{`${PLATFORM_LABEL[draft.platform]} · ${draft.status === "scheduled" ? "Scheduled locally" : "Draft"}${draft.scheduledLocal ? ` · ${draft.scheduledLocal} Johannesburg` : ""}`}</p>
            <p className="mt-1 whitespace-pre-wrap">{draft.body}</p>
            <button type="button" onClick={() => editDraft(draft)} className="mt-2 text-sm font-semibold text-[#2563EB]">
              Edit draft
            </button>
          </li>
        ))}
      </ul>
      <form action={act} className="grid gap-3">
        <input type="hidden" name="slug" value={orgSlug} />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Week 1 topic
          <select
            name="topicKey"
            value={topicKey}
            onChange={(event) => onTopic(event.target.value)}
            className="h-10 rounded-md border border-slate-200 px-2 text-sm font-normal"
          >
            {WEEK_1_TOPICS.map((topic) => (
              <option key={topic.key} value={topic.key}>{`${topic.day}: ${topic.title}`}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Platform
          <select
            name="platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as SocialDraftPlatform)}
            className="h-10 rounded-md border border-slate-200 px-2 text-sm font-normal"
          >
            {SOCIAL_PLATFORMS.map((item) => (
              <option key={item} value={item}>{PLATFORM_LABEL[item]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Draft
          <textarea
            name="body"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Schedule locally (Johannesburg)
          <input
            name="scheduledFor"
            type="datetime-local"
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal"
          />
        </label>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button name="intent" value="save" className={`${buttonClass} bg-[#0B1F3A] text-white`}>Save draft</button>
          <button name="intent" value="schedule" className={`${buttonClass} bg-[#2563EB] text-white`}>Schedule locally</button>
          <button name="intent" value="publish" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Publish</button>
          <button name="intent" value="post_now" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Post now</button>
          <button name="intent" value="go_live" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Go live</button>
        </div>
      </form>
      {state.message ? (
        <p data-testid="social-draft-result" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          {`${state.message} Outbox queued: 0.`}
        </p>
      ) : null}
    </section>
  );
}

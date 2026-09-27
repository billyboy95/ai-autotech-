"use client";

import { useState, type ReactNode } from "react";
import { polishTeamCopy } from "@/app/actions/bots";
import { TeamRecommendationView } from "@/components/bots/team-recommendation";
import {
  recommendTeam,
  type SetupAnswers,
  type SetupChannel,
  type SetupGoal,
  type SetupStage,
  type SetupTeamSize,
  type TeamRecommendation,
} from "@/lib/bots/recommend";

const BUSINESSES = [
  "Clinic",
  "Clothing brand",
  "Faceless YouTube",
  "Facebook page",
  "TikTok",
  "Podcast",
  "Personal brand",
  "Restaurant",
  "Real estate",
  "Gym",
  "AI agency",
];

const STAGES: { id: SetupStage; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "starting", label: "Starting" },
  { id: "running", label: "Running" },
];

const BUDGETS = [
  { label: "R2,000", cents: 200_000 },
  { label: "R5,000", cents: 500_000 },
  { label: "R8,000", cents: 800_000 },
  { label: "R15,000", cents: 1_500_000 },
];

const GOALS: { id: SetupGoal; label: string }[] = [
  { id: "leads", label: "Leads" },
  { id: "sales", label: "Sales" },
  { id: "content", label: "Content" },
  { id: "admin", label: "Admin load" },
];

const SIZES: { id: SetupTeamSize; label: string }[] = [
  { id: "solo", label: "Just me" },
  { id: "2-5", label: "2–5" },
  { id: "6-20", label: "6–20" },
  { id: "20+", label: "20+" },
];

const CHANNELS: { id: SetupChannel; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "website", label: "Website" },
  { id: "walk-in", label: "Walk-in" },
];

type Draft = {
  business: string;
  note: string;
  extra: string;
  stage: SetupStage | "";
  budgetCents: number | null;
  budgetText: string;
  goals: SetupGoal[];
  teamSize: SetupTeamSize | "";
  channels: SetupChannel[];
};

const emptyDraft: Draft = {
  business: "",
  note: "",
  extra: "",
  stage: "",
  budgetCents: null,
  budgetText: "",
  goals: [],
  teamSize: "",
  channels: [],
};

function budgetFrom(draft: Draft) {
  const typed = Number(draft.budgetText.replace(/[^\d]/g, ""));
  if (Number.isFinite(typed) && typed > 0) return Math.round(typed * 100);
  return draft.budgetCents ?? 0;
}

function answersFrom(draft: Draft): SetupAnswers {
  const business = [draft.business, draft.note, draft.extra].map((item) => item.trim()).filter(Boolean).join(" ");
  return {
    business: business || "business",
    stage: draft.stage || "starting",
    budgetCents: budgetFrom(draft),
    goals: draft.goals.length ? draft.goals : ["leads"],
    teamSize: draft.teamSize || "2-5",
    channels: draft.channels,
  };
}

function Chip({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-md px-3 text-sm font-semibold ${selected ? "bg-[#0B1F3A] text-white" : "border border-slate-200 bg-white text-[#0B1F3A]"}`}
    >
      {children}
    </button>
  );
}

export function SetupInterview({
  orgSlug,
  polishEnabled,
  notice,
}: {
  orgSlug: string;
  polishEnabled: boolean;
  notice?: string;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [recommendation, setRecommendation] = useState<TeamRecommendation | null>(null);

  function finish(next: Draft) {
    const team = recommendTeam(answersFrom(next));
    setRecommendation(team);
    setStep(7);
    if (!polishEnabled) return;
    const body = new FormData();
    body.set("recommendation", JSON.stringify(team));
    void polishTeamCopy(body).then((whys) => {
      if (!whys) return;
      setRecommendation((current) => {
        if (!current) return current;
        const count = current.start.length + current.later.length;
        if (whys.length !== count) return current;
        return {
          ...current,
          start: current.start.map((agent, index) => ({ ...agent, why: whys[index] })),
          later: current.later.map((agent, index) => ({ ...agent, why: whys[current.start.length + index] })),
        };
      });
    });
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Lead Agent</h1>
        <p className="text-sm text-slate-500">A short interview for any business, including a new channel or a clinic. The recommendation is rules-based. Nothing is sent.</p>
      </div>
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{notice}</p> : null}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {step === 0 ? (
          <Question title="What kind of business, or what are you starting?" hint="Question 1 of 7">
            <div className="flex flex-wrap gap-2">
              {BUSINESSES.map((label) => (
                <Chip key={label} selected={draft.business === label} onClick={() => setDraft({ ...draft, business: label })}>{label}</Chip>
              ))}
            </div>
            <input
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="Or type it"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            />
            <Next disabled={!draft.business && !draft.note.trim()} onClick={() => setStep(1)} />
          </Question>
        ) : null}
        {step === 1 ? (
          <Question title="What stage is it at?" hint="Question 2 of 7">
            <div className="flex flex-wrap gap-2">
              {STAGES.map((item) => (
                <Chip key={item.id} selected={draft.stage === item.id} onClick={() => setDraft({ ...draft, stage: item.id })}>{item.label}</Chip>
              ))}
            </div>
            <Next disabled={!draft.stage} onClick={() => setStep(2)} />
          </Question>
        ) : null}
        {step === 2 ? (
          <Question title="What can you spend on agents each month?" hint="Question 3 of 7. Rand.">
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((item) => (
                <Chip key={item.cents} selected={draft.budgetCents === item.cents && !draft.budgetText} onClick={() => setDraft({ ...draft, budgetCents: item.cents, budgetText: "" })}>{item.label}</Chip>
              ))}
            </div>
            <input
              value={draft.budgetText}
              onChange={(event) => setDraft({ ...draft, budgetText: event.target.value })}
              placeholder="Or type a rand amount"
              inputMode="numeric"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            />
            <Next disabled={!draft.budgetCents && !draft.budgetText.trim()} onClick={() => setStep(3)} />
          </Question>
        ) : null}
        {step === 3 ? (
          <Question title="What should the team take on first?" hint="Question 4 of 7. Pick any that fit.">
            <div className="flex flex-wrap gap-2">
              {GOALS.map((item) => (
                <Chip
                  key={item.id}
                  selected={draft.goals.includes(item.id)}
                  onClick={() => setDraft({
                    ...draft,
                    goals: draft.goals.includes(item.id) ? draft.goals.filter((goal) => goal !== item.id) : [...draft.goals, item.id],
                  })}
                >{item.label}</Chip>
              ))}
            </div>
            <Next disabled={draft.goals.length === 0} onClick={() => setStep(4)} />
          </Question>
        ) : null}
        {step === 4 ? (
          <Question title="How big is the human team?" hint="Question 5 of 7">
            <div className="flex flex-wrap gap-2">
              {SIZES.map((item) => (
                <Chip key={item.id} selected={draft.teamSize === item.id} onClick={() => setDraft({ ...draft, teamSize: item.id })}>{item.label}</Chip>
              ))}
            </div>
            <Next disabled={!draft.teamSize} onClick={() => setStep(5)} />
          </Question>
        ) : null}
        {step === 5 ? (
          <Question title="Which channels do you already use?" hint="Question 6 of 7. Pick any.">
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((item) => (
                <Chip
                  key={item.id}
                  selected={draft.channels.includes(item.id)}
                  onClick={() => setDraft({
                    ...draft,
                    channels: draft.channels.includes(item.id)
                      ? draft.channels.filter((channel) => channel !== item.id)
                      : [...draft.channels, item.id],
                  })}
                >{item.label}</Chip>
              ))}
            </div>
            <Next disabled={draft.channels.length === 0} onClick={() => setStep(6)} />
          </Question>
        ) : null}
        {step === 6 ? (
          <Question title="Anything else the Lead Agent should weigh?" hint="Question 7 of 7. Optional.">
            <input
              value={draft.extra}
              onChange={(event) => setDraft({ ...draft, extra: event.target.value })}
              placeholder="Optional note"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            />
            <Next disabled={false} onClick={() => finish(draft)} label="See the team" />
          </Question>
        ) : null}
        {step === 7 && recommendation ? (
          <div className="grid gap-4">
            <TeamRecommendationView recommendation={recommendation} orgSlug={orgSlug} build />
            <button type="button" onClick={() => { setStep(0); setRecommendation(null); }} className="h-10 justify-self-start rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A]">
              Start again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Lead Agent</p>
        <h2 className="mt-1 font-display text-lg font-bold text-[#0B1F3A]">{title}</h2>
        <p className="text-sm text-slate-500">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Next({ disabled, onClick, label = "Continue" }: { disabled: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="h-10 justify-self-start rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:opacity-40">
      {label}
    </button>
  );
}

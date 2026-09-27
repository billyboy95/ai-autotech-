"use client";

import { useState } from "react";
import { polishTeamCopy } from "@/app/actions/bots";
import { Advanced } from "@/components/ui/advanced";
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

const BUDGETS = [
  { label: "R2,000", cents: 200_000 },
  { label: "R5,000", cents: 500_000 },
  { label: "R8,000", cents: 800_000 },
  { label: "R15,000", cents: 1_500_000 },
];

const STAGES: { id: SetupStage; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "starting", label: "Starting" },
  { id: "running", label: "Running" },
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

const chipClass = "inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

function Chip({
  pressed,
  children,
  onClick,
}: {
  pressed: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${chipClass} ${pressed ? "bg-[#0B1F3A] text-white" : "border border-slate-300 bg-white text-[#0B1F3A]"}`}
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
  const [business, setBusiness] = useState("");
  const [note, setNote] = useState("");
  const [budgetCents, setBudgetCents] = useState(500_000);
  const [stage, setStage] = useState<SetupStage>("starting");
  const [goals, setGoals] = useState<SetupGoal[]>([]);
  const [teamSize, setTeamSize] = useState<SetupTeamSize>("2-5");
  const [channels, setChannels] = useState<SetupChannel[]>([]);
  const [recommendation, setRecommendation] = useState<TeamRecommendation | null>(null);

  function answers(next: Partial<SetupAnswers> & { business: string; note?: string }): SetupAnswers {
    const typed = next.note ?? note;
    return {
      business: [next.business, typed].map((item) => item.trim()).filter(Boolean).join(" ") || "business",
      stage: next.stage ?? stage,
      budgetCents: next.budgetCents ?? budgetCents,
      goals: next.goals ?? (goals.length ? goals : ["leads"]),
      teamSize: next.teamSize ?? teamSize,
      channels: next.channels ?? channels,
    };
  }

  function show(next: SetupAnswers) {
    const team = recommendTeam(next);
    setRecommendation(team);
    if (!polishEnabled) return;
    const body = new FormData();
    body.set("recommendation", JSON.stringify(team));
    void polishTeamCopy(body).then((whys) => {
      if (!whys) return;
      setRecommendation((current) => {
        if (!current) return current;
        if (whys.length !== current.start.length + current.later.length) return current;
        return {
          ...current,
          start: current.start.map((agent, index) => ({ ...agent, why: whys[index] ?? agent.why })),
          later: current.later.map((agent, index) => ({ ...agent, why: whys[current.start.length + index] ?? agent.why })),
        };
      });
    });
  }

  function pickBusiness(label: string) {
    setBusiness(label);
    show(answers({ business: label }));
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Lead Agent</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">Pick the business, then build the team. The R5,000 budget is already selected. That is two clicks. Change the budget first if you need to. Nothing is sent.</p>
      </div>
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-[#0B1F3A]">What are you building?</legend>
          <div className="flex flex-wrap gap-2">
            {BUSINESSES.map((label) => (
              <Chip key={label} pressed={business === label} onClick={() => pickBusiness(label)}>{label}</Chip>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="setup-business">
            Or type it
            <input
              id="setup-business"
              value={note}
              onChange={(event) => {
                const value = event.target.value;
                setNote(value);
                if (business || value.trim()) show(answers({ business: business || value, note: value }));
              }}
              className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-800"
            />
          </label>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-[#0B1F3A]">Monthly budget</legend>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((item) => (
              <Chip
                key={item.cents}
                pressed={budgetCents === item.cents}
                onClick={() => {
                  setBudgetCents(item.cents);
                  if (business || note.trim()) show(answers({ business: business || note, budgetCents: item.cents }));
                }}
              >{item.label}</Chip>
            ))}
          </div>
        </fieldset>

        {recommendation ? (
          <>
            <TeamRecommendationView recommendation={recommendation} orgSlug={orgSlug} build />
            <Advanced>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-[#0B1F3A]">Stage</legend>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((item) => (
                    <Chip key={item.id} pressed={stage === item.id} onClick={() => { setStage(item.id); show(answers({ business: business || note, stage: item.id })); }}>{item.label}</Chip>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-[#0B1F3A]">Goals</legend>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((item) => (
                    <Chip
                      key={item.id}
                      pressed={goals.includes(item.id)}
                      onClick={() => {
                        const next = goals.includes(item.id) ? goals.filter((goal) => goal !== item.id) : [...goals, item.id];
                        setGoals(next);
                        show(answers({ business: business || note, goals: next.length ? next : ["leads"] }));
                      }}
                    >{item.label}</Chip>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-[#0B1F3A]">Team size</legend>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map((item) => (
                    <Chip key={item.id} pressed={teamSize === item.id} onClick={() => { setTeamSize(item.id); show(answers({ business: business || note, teamSize: item.id })); }}>{item.label}</Chip>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-[#0B1F3A]">Channels</legend>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((item) => (
                    <Chip
                      key={item.id}
                      pressed={channels.includes(item.id)}
                      onClick={() => {
                        const next = channels.includes(item.id) ? channels.filter((channel) => channel !== item.id) : [...channels, item.id];
                        setChannels(next);
                        show(answers({ business: business || note, channels: next }));
                      }}
                    >{item.label}</Chip>
                  ))}
                </div>
              </fieldset>
            </Advanced>
          </>
        ) : (
          <p className="text-sm text-slate-700">Choose a business above. The team shows here, then you build it.</p>
        )}
      </div>
    </div>
  );
}

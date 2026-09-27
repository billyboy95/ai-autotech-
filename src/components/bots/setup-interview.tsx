"use client";

import { useState } from "react";
import { buildRecommendedTeam } from "@/app/actions/bots";
import { TeamRecommendationView } from "@/components/bots/team-recommendation";
import { agentQuestionSteps, agentProgressLabel } from "@/lib/bots/interview";
import {
  recommendTeam,
  type SetupAnswers,
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

const chipClass = "inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";
const primaryClass = "inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

function Chip({ pressed, children, onClick }: { pressed: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`${chipClass} ${pressed ? "bg-[#0B1F3A] text-white" : "border border-slate-300 bg-white text-[#0B1F3A]"}`}>
      {children}
    </button>
  );
}

export function SetupInterview({ orgSlug, notice }: { orgSlug: string; notice?: string }) {
  const [business, setBusiness] = useState("");
  const [note, setNote] = useState("");
  const [budgetCents, setBudgetCents] = useState(500_000);
  const [stage, setStage] = useState<SetupStage>("starting");
  const [goals, setGoals] = useState<SetupGoal[]>([]);
  const [teamSize, setTeamSize] = useState<SetupTeamSize>("2-5");
  const [recommendation, setRecommendation] = useState<TeamRecommendation | null>(null);
  const [agentIndex, setAgentIndex] = useState(0);
  const [phase, setPhase] = useState<"business" | "agents" | "pay">("business");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const steps = recommendation ? agentQuestionSteps(recommendation.agents.map((agent) => agent.slug)) : [];
  const step = steps[agentIndex];

  function businessAnswers(nextBusiness: string): SetupAnswers {
    return {
      business: [nextBusiness, note].map((item) => item.trim()).filter(Boolean).join(" ") || "business",
      stage,
      budgetCents,
      goals: goals.length ? goals : ["leads"],
      teamSize,
      channels: [],
    };
  }

  function continueFromBusiness() {
    const team = recommendTeam(businessAnswers(business || note));
    setRecommendation(team);
    setAgentIndex(0);
    setPhase("agents");
  }

  function setAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function nextAgent() {
    if (agentIndex + 1 >= steps.length) {
      setPhase("pay");
      return;
    }
    setAgentIndex((index) => index + 1);
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Lead Agent</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">Answer the business questions, then each agent&apos;s questions. Shared answers are not asked again. The full team is configured after the sandbox payment. Nothing is sent.</p>
      </div>
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}

      {phase === "business" ? (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#0B1F3A]">What are you building?</legend>
            <div className="flex flex-wrap gap-2">
              {BUSINESSES.map((label) => (
                <Chip key={label} pressed={business === label} onClick={() => setBusiness(label)}>{label}</Chip>
              ))}
            </div>
            <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="setup-business">
              Or type it
              <input id="setup-business" value={note} onChange={(event) => setNote(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-800" />
            </label>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#0B1F3A]">Stage</legend>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((item) => (
                <Chip key={item.id} pressed={stage === item.id} onClick={() => setStage(item.id)}>{item.label}</Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#0B1F3A]">Monthly budget</legend>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((item) => (
                <Chip key={item.cents} pressed={budgetCents === item.cents} onClick={() => setBudgetCents(item.cents)}>{item.label}</Chip>
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
                  onClick={() => setGoals((current) => current.includes(item.id) ? current.filter((goal) => goal !== item.id) : [...current, item.id])}
                >{item.label}</Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#0B1F3A]">Team size</legend>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((item) => (
                <Chip key={item.id} pressed={teamSize === item.id} onClick={() => setTeamSize(item.id)}>{item.label}</Chip>
              ))}
            </div>
          </fieldset>
          {business || note.trim() ? (
            <button type="button" className={`${primaryClass} w-fit`} onClick={continueFromBusiness}>Continue</button>
          ) : (
            <p className="text-sm text-slate-700">Choose a business above. The questions for that team come next.</p>
          )}
        </div>
      ) : null}

      {phase === "agents" && step && recommendation ? (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-[#0B1F3A]" aria-live="polite">{agentProgressLabel(agentIndex, steps.length, step.name)}</p>
          {step.questions.length ? (
            <div className="grid gap-3">
              {step.questions.map((question) => (
                <fieldset key={question.id} className="grid gap-2">
                  <legend className="text-sm font-semibold text-slate-700">{question.label}</legend>
                  {question.kind === "choice" && question.options ? (
                    <div className="flex flex-wrap gap-2">
                      {question.options.map((option) => (
                        <Chip key={option} pressed={answers[question.id] === option} onClick={() => setAnswer(question.id, option)}>{option}</Chip>
                      ))}
                    </div>
                  ) : (
                    <input id={`setup-${question.id}`} aria-label={question.label} value={answers[question.id] ?? ""} onChange={(event) => setAnswer(question.id, event.target.value)} className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-800" />
                  )}
                </fieldset>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-700">{step.name} uses the answers you already gave. Nothing else to ask.</p>
          )}
          {step.questions.length ? <p className="text-sm text-slate-700">Leave a box blank to keep the default.</p> : null}
          <button type="button" className={`${primaryClass} w-fit`} onClick={nextAgent}>
            {agentIndex + 1 >= steps.length ? "Review the full team" : "Next agent"}
          </button>
        </div>
      ) : null}

      {phase === "pay" && recommendation ? (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <TeamRecommendationView recommendation={recommendation} />
          <form action={buildRecommendedTeam} className="grid gap-2">
            <input type="hidden" name="slug" value={orgSlug} />
            <input type="hidden" name="template" value={recommendation.templateSlug} />
            <input type="hidden" name="answers" value={JSON.stringify(answers)} />
            <input type="hidden" name="return_to" value="/command-centre/setup" />
            <button className={`${primaryClass} w-fit`}>Pay in the sandbox</button>
          </form>
          <p className="text-sm text-slate-700">This configures every agent, the pipelines, the workflows, and the templates. Nothing is sent.</p>
        </div>
      ) : null}
    </div>
  );
}

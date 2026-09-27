"use client";

import { useState } from "react";
import Link from "next/link";
import { startLeadOnboardingTeam } from "@/app/actions/onboarding";
import { TeamRecommendationView } from "@/components/bots/team-recommendation";
import { templateBySlug } from "@/lib/bots/catalog";
import { agentProgressLabel, agentQuestionSteps } from "@/lib/bots/interview";
import {
  CHANNEL_LABELS,
  GOAL_LABELS,
  LEAD_ONBOARDING_INTRO,
  ONBOARDING_NICHES,
  recommendFullTeam,
  type BusinessProfile,
} from "@/lib/bots/onboarding";
import { SETUP_CHANNELS, SETUP_GOALS, type SetupChannel, type SetupGoal, type TeamRecommendation } from "@/lib/bots/recommend";

const chipClass = "inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";
const primaryClass = "inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";
const fieldClass = "rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-800";

type Phase = "niche" | "goals" | "channels" | "hours" | "tools" | "team" | "agents" | "review";
type Line = { role: "agent" | "you"; text: string };

function Chip({ pressed, children, onClick }: { pressed: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`${chipClass} ${pressed ? "bg-[#0B1F3A] text-white" : "border border-slate-300 bg-white text-[#0B1F3A]"}`}>
      {children}
    </button>
  );
}

function teamName(slug: string) {
  try {
    return templateBySlug(slug).name;
  } catch {
    return "Your team";
  }
}

export function LeadOnboardingChat({
  orgSlug,
  notice,
  started = false,
  teamSlug = "",
}: {
  orgSlug: string;
  notice?: string;
  started?: boolean;
  teamSlug?: string;
}) {
  const [phase, setPhase] = useState<Phase>("niche");
  const [niche, setNiche] = useState("");
  const [nicheLabel, setNicheLabel] = useState("");
  const [note, setNote] = useState("");
  const [goals, setGoals] = useState<SetupGoal[]>([]);
  const [channels, setChannels] = useState<SetupChannel[]>([]);
  const [hours, setHours] = useState("");
  const [tools, setTools] = useState("");
  const [recommendation, setRecommendation] = useState<TeamRecommendation | null>(null);
  const [agentIndex, setAgentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [log, setLog] = useState<Line[]>([{ role: "agent", text: LEAD_ONBOARDING_INTRO }]);

  const steps = recommendation ? agentQuestionSteps(recommendation.agents.map((agent) => agent.slug)) : [];
  const step = steps[agentIndex];
  const profile: BusinessProfile = {
    niche: note.trim() || niche,
    goals,
    channels,
    hours: hours.trim(),
    tools: tools.trim(),
  };

  function say(text: string) {
    setLog((current) => [...current, { role: "agent", text }]);
  }

  function hear(text: string) {
    setLog((current) => [...current, { role: "you", text }]);
  }

  function continueNiche() {
    const business = note.trim() || niche;
    if (!business) return;
    hear(note.trim() || nicheLabel || business);
    say("What are the goals? Every agent on the matched team is included.");
    setPhase("goals");
  }

  function continueGoals() {
    if (!goals.length) return;
    hear(goals.map((goal) => GOAL_LABELS[goal]).join(", "));
    say("Which channels do you use?");
    setPhase("channels");
  }

  function continueChannels() {
    if (!channels.length) return;
    hear(channels.map((channel) => CHANNEL_LABELS[channel]).join(", "));
    say("What are the working hours?");
    setPhase("hours");
  }

  function continueHours() {
    hear(hours.trim() || "Hours not specified");
    say("Which tools do you already use? Nothing is connected in this sandbox trial.");
    setPhase("tools");
  }

  function continueTools() {
    hear(tools.trim() || "No tools listed");
    let team: TeamRecommendation;
    try {
      team = recommendFullTeam({ ...profile, tools: tools.trim(), hours: hours.trim() });
    } catch {
      say("I could not match that niche to a catalogue team. Type the niche again.");
      setPhase("niche");
      return;
    }
    setRecommendation(team);
    setAnswers((current) => ({ ...current, hours: current.hours || hours.trim() }));
    say(`${team.templateName} is the full team. ${team.agents.length} agents. Nothing is held back.`);
    setPhase("team");
  }

  function continueAgent() {
    if (!step || !recommendation) return;
    const answered = step.questions
      .map((question) => answers[question.id]?.trim())
      .filter((value): value is string => Boolean(value));
    hear(answered.length ? answered.join(" · ") : `${step.name} keeps the defaults`);
    if (agentIndex + 1 >= steps.length) {
      say("Here is the full monthly estimate. ZAR excluding VAT. Placeholder. Start this team records the sandbox trial.");
      setPhase("review");
      return;
    }
    const next = steps[agentIndex + 1];
    say(next ? agentProgressLabel(agentIndex + 1, steps.length, next.name) : "Next agent");
    setAgentIndex((index) => index + 1);
  }

  if (started) {
    return (
      <div data-testid="lead-onboarding" className="grid gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Lead Agent</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-700">{LEAD_ONBOARDING_INTRO}</p>
        </div>
        {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}
        <section className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Sandbox trial recorded</h2>
          <p className="text-sm text-slate-700">
            {teamName(teamSlug)} is the full team on a sandbox trial. No charge was sent. Sending stays off.
            Next, connect accounts and import contacts. Nothing is sent.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/command-centre/connect-accounts" className={primaryClass}>Connect accounts</Link>
            <Link href="/command-centre/import-contacts" className={primaryClass}>Import contacts</Link>
          </div>
          <Link href="/command-centre/bots" className="text-sm font-semibold text-[#2563EB]">Open the agent store</Link>
          <Link href="/command-centre/lead-agent" className="text-sm font-semibold text-[#2563EB]">Answer again</Link>
        </section>
      </div>
    );
  }

  return (
    <div data-testid="lead-onboarding" className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Lead Agent</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">One conversation for the full team. Prices are placeholders, ZAR excluding VAT.</p>
      </div>
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}
      <ol className="grid gap-2">
        {log.map((entry, index) => (
          <li key={`${entry.role}-${index}`} className={`max-w-2xl rounded-lg px-3 py-2 ${entry.role === "agent" ? "border border-slate-200 bg-white" : "bg-[#0B1F3A] text-white"}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">{entry.role === "agent" ? "Lead Agent" : "You"}</p>
            <p className="mt-1 text-sm">{entry.text}</p>
          </li>
        ))}
      </ol>

      {phase === "niche" ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#0B1F3A]">What is the niche?</legend>
            <div className="flex flex-wrap gap-2">
              {ONBOARDING_NICHES.map((item) => (
                <Chip
                  key={item.templateSlug}
                  pressed={niche === item.business && !note.trim()}
                  onClick={() => {
                    setNiche(item.business);
                    setNicheLabel(item.label);
                    setNote("");
                  }}
                >{item.label}</Chip>
              ))}
            </div>
            <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="lead-niche">
              Or type it
              <input id="lead-niche" value={note} onChange={(event) => setNote(event.target.value)} className={`h-11 ${fieldClass}`} />
            </label>
          </fieldset>
          {profile.niche ? (
            <button type="button" className={`${primaryClass} w-fit`} onClick={continueNiche}>Continue</button>
          ) : (
            <p className="text-sm text-slate-700">Choose a niche. The full matched team comes after the business questions.</p>
          )}
        </section>
      ) : null}

      {phase === "goals" ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#0B1F3A]">What are the goals?</legend>
            <div className="flex flex-wrap gap-2">
              {SETUP_GOALS.map((goal) => (
                <Chip
                  key={goal}
                  pressed={goals.includes(goal)}
                  onClick={() => setGoals((current) => current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal])}
                >{GOAL_LABELS[goal]}</Chip>
              ))}
            </div>
          </fieldset>
          {goals.length ? (
            <button type="button" className={`${primaryClass} w-fit`} onClick={continueGoals}>Continue</button>
          ) : (
            <p className="text-sm text-slate-700">Choose at least one goal. The full team still includes every agent.</p>
          )}
        </section>
      ) : null}

      {phase === "channels" ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#0B1F3A]">Which channels do you use?</legend>
            <div className="flex flex-wrap gap-2">
              {SETUP_CHANNELS.map((channel) => (
                <Chip
                  key={channel}
                  pressed={channels.includes(channel)}
                  onClick={() => setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel])}
                >{CHANNEL_LABELS[channel]}</Chip>
              ))}
            </div>
          </fieldset>
          {channels.length ? (
            <button type="button" className={`${primaryClass} w-fit`} onClick={continueChannels}>Continue</button>
          ) : (
            <p className="text-sm text-slate-700">Choose at least one channel. Accounts are connected after payment.</p>
          )}
        </section>
      ) : null}

      {phase === "hours" ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold text-[#0B1F3A]" htmlFor="lead-hours">
            What are the working hours?
            <input id="lead-hours" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="08:00-17:00" className={`h-11 ${fieldClass}`} />
          </label>
          <button type="button" className={`${primaryClass} w-fit`} onClick={continueHours}>Continue</button>
        </section>
      ) : null}

      {phase === "tools" ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold text-[#0B1F3A]" htmlFor="lead-tools">
            Which tools do you already use?
            <textarea id="lead-tools" value={tools} onChange={(event) => setTools(event.target.value)} placeholder="WhatsApp Business, Google Calendar, Shopify" className={`min-h-24 py-2 ${fieldClass}`} />
          </label>
          <p className="text-sm text-slate-700">List them only. Nothing is connected in this sandbox trial.</p>
          <button type="button" className={`${primaryClass} w-fit`} onClick={continueTools}>Recommend the full team</button>
        </section>
      ) : null}

      {phase === "team" && recommendation ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <TeamRecommendationView recommendation={recommendation} />
          <p className="text-sm text-slate-700">ZAR excluding VAT. The next step asks each agent before the price is confirmed.</p>
          <button
            type="button"
            className={`${primaryClass} w-fit`}
            onClick={() => {
              say(agentProgressLabel(0, steps.length, steps[0]?.name || "Agent"));
              setAgentIndex(0);
              setPhase("agents");
            }}
          >Ask each agent</button>
        </section>
      ) : null}

      {phase === "agents" && step && recommendation ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#0B1F3A]" aria-live="polite">{agentProgressLabel(agentIndex, steps.length, step.name)}</p>
          {step.questions.length ? (
            <div className="grid gap-3">
              {step.questions.map((question) => (
                <fieldset key={question.id} className="grid gap-2">
                  <legend className="text-sm font-semibold text-slate-700">{question.label}</legend>
                  {question.kind === "choice" && question.options ? (
                    <div className="flex flex-wrap gap-2">
                      {question.options.map((option) => (
                        <Chip key={option} pressed={answers[question.id] === option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}>{option}</Chip>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      id={`lead-${step.slug}-${question.id}`}
                      aria-label={question.label}
                      value={answers[question.id] ?? ""}
                      onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                      className={`min-h-20 py-2 ${fieldClass}`}
                    />
                  )}
                </fieldset>
              ))}
              <p className="text-sm text-slate-700">Leave a box blank to keep the default. The next agent waits until you continue.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-700">{step.name} uses the answers you already gave. Continue to the next agent.</p>
          )}
          <button type="button" className={`${primaryClass} w-fit`} onClick={continueAgent}>
            {agentIndex + 1 >= steps.length ? "See the full price" : "Next agent"}
          </button>
        </section>
      ) : null}

      {phase === "review" && recommendation ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <TeamRecommendationView recommendation={recommendation} />
          <p className="text-sm text-slate-700">
            Monthly total is platform plus every agent, minus the team discount. ZAR excluding VAT. Placeholder until Billy publishes the sheet.
            Start this team records a sandbox trial. No charge is sent. Accounts and contacts wait until the subscription is paid.
          </p>
          <form action={startLeadOnboardingTeam} className="grid gap-2">
            <input type="hidden" name="slug" value={orgSlug} />
            <input type="hidden" name="profile" value={JSON.stringify(profile)} />
            <input type="hidden" name="answers" value={JSON.stringify(answers)} />
            <button className={`${primaryClass} w-fit`}>Start this team</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

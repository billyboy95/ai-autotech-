"use client";

import type { DragEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { setLeadStage } from "@/app/actions/automation";
import { formatZar } from "@/lib/automation/ids";
import { HOT_SCORE } from "@/lib/automation/score";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/automation/types";

export type PipelineCard = {
  id: string;
  name: string;
  company: string;
  phone: string;
  stage: PipelineStage;
  ownerName: string;
  score: number;
  valueZar: number;
  source: string;
  qrSource: string;
};

const tone: Record<PipelineStage, string> = {
  New: "border-slate-300",
  Contacted: "border-blue-400",
  "Audit booked": "border-cyan-500",
  "Audit done": "border-indigo-500",
  "Proposal sent": "border-violet-500",
  Won: "border-emerald-500",
  Lost: "border-rose-400",
  "Onboarding/Handover": "border-amber-500",
};

export function PipelineBoard({ leads }: { leads: PipelineCard[] }) {
  const [error, setError] = useState("");

  async function move(id: string, stage: PipelineStage) {
    setError("");
    const result = await setLeadStage(id, stage);
    if (!result.ok) setError(result.error || "Could not move that lead.");
  }

  return (
    <div data-testid="pipeline-board">
      {error ? <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {PIPELINE_STAGES.map((stage) => {
          const cards = leads
            .filter((lead) => lead.stage === stage)
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
          return (
            <section
              key={stage}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-100/80"
              onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
              onDrop={(event: DragEvent<HTMLElement>) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain");
                if (id) void move(id, stage);
              }}
            >
              <header className="flex items-center justify-between px-3 py-3">
                <h2 className="text-sm font-semibold text-[#0B1F3A]">{stage}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{cards.length}</span>
              </header>
              <div className="grid gap-2 px-2 pb-3">
                {cards.length === 0 ? <p className="px-2 py-4 text-xs text-slate-400">Nothing in this stage.</p> : null}
                {cards.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", lead.id)}
                    className={`rounded-lg border-l-4 bg-white p-3 shadow-sm ${tone[stage]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/command-centre/leads/${lead.id}`} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">
                        {lead.name}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          lead.score >= HOT_SCORE ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {lead.score}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{lead.company || "No business name"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {lead.ownerName || "Unassigned"}
                      {lead.valueZar ? ` · ${formatZar(lead.valueZar)}` : ""}
                    </p>
                    {lead.qrSource === "billy_phone_qr" ? (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#2563EB]">Phone QR</p>
                    ) : null}
                    <label className="mt-3 grid gap-1 text-[11px] font-semibold text-slate-500">
                      Move
                      <select
                        value={lead.stage}
                        onChange={(event) => void move(lead.id, event.target.value as PipelineStage)}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800"
                      >
                        {PIPELINE_STAGES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

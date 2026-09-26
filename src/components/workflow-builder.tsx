"use client";

import { useMemo, useState } from "react";
import { previewWorkflow } from "@/app/actions/workflows";
import type { SnapshotWorkflow } from "@/lib/snapshots/payload";

type ContactOption = { id: string; name: string; stage: string };

type HistoryEntry = {
  contactId: string;
  at: string;
  steps: Array<{ id: string; title: string; status: string; detail: string }>;
};

const ACTION_KINDS = [
  "send_message",
  "move_stage",
  "assign_owner",
  "add_tag",
  "remove_tag",
  "create_task",
  "update_field",
  "wait",
  "notify_user",
  "webhook_out",
  "handover",
  "end",
] as const;

export function WorkflowBuilder({
  workflows,
  contacts,
  sendingEnabled,
}: {
  workflows: SnapshotWorkflow[];
  contacts: ContactOption[];
  sendingEnabled: boolean;
}) {
  const [assetKey, setAssetKey] = useState(
    workflows.find((item) => item.asset_key === "workflow:pipeline-cron")?.asset_key || workflows[0]?.asset_key || "",
  );
  const [drafts, setDrafts] = useState<Record<string, SnapshotWorkflow>>(() =>
    Object.fromEntries(workflows.map((workflow) => [workflow.asset_key, workflow])),
  );
  const [contactId, setContactId] = useState(contacts[0]?.id || "");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const workflow = drafts[assetKey] || workflows[0];
  const contactHistory = useMemo(
    () => history.filter((entry) => entry.contactId === (contactId.trim() || "sample-contact")),
    [history, contactId],
  );

  if (!workflow) {
    return <p className="text-sm text-slate-600">No workflows are loaded yet.</p>;
  }

  function updateSteps(steps: SnapshotWorkflow["steps"]) {
    setDrafts((current) => ({ ...current, [workflow.asset_key]: { ...workflow, steps } }));
  }

  async function testWithContact() {
    setPending(true);
    setError("");
    const result = await previewWorkflow(workflow.asset_key, contactId, JSON.stringify(workflow.steps));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.sent) {
      setError("Dry run tried to send. It was blocked.");
      return;
    }
    setHistory((current) => [
      {
        contactId: contactId.trim() || "sample-contact",
        at: new Date().toISOString(),
        steps: result.steps,
      },
      ...current,
    ]);
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Workflows</h1>
        <p className="text-sm text-slate-500">
          Vertical steps for this workspace. Phase 1 automations stay in place until WORKFLOW_ENGINE_ENABLED is turned on. Sending stays off.
          {sendingEnabled ? " The workspace sending switch is on; this dry run still does not deliver anything." : ""}
        </p>
      </div>

      <label className="grid max-w-md gap-1 text-xs font-semibold text-slate-600">
        Workflow
        <select
          value={workflow.asset_key}
          onChange={(event) => setAssetKey(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium"
        >
          {workflows.map((item) => (
            <option key={item.asset_key} value={item.asset_key}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trigger</p>
        <h2 className="mt-1 font-display text-lg font-bold text-[#0B1F3A]">{workflow.trigger_type}</h2>
        <p className="text-sm text-slate-600">{workflow.name}</p>
        <p className="mt-2 text-xs text-slate-500">{workflow.active ? "Active when the engine flag is on" : "Inactive"} · {workflow.asset_key}</p>
      </section>

      <ol className="grid gap-3">
        {workflow.steps.map((item, index) => {
          const step = item as { id?: string; title?: string; yes?: string; no?: string; next?: string; action?: { kind?: string } };
          return (
            <li key={step.id || index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                <span className="text-xs text-slate-500">{step.id}</span>
              </div>
              <p className="mt-1 font-semibold text-[#0B1F3A]">{step.title || step.id}</p>
              {step.action?.kind ? (
                <label className="mt-3 grid max-w-xs gap-1 text-xs font-semibold text-slate-600">
                  Action
                  <select
                    value={step.action.kind}
                    onChange={(event) => {
                      const steps = workflow.steps.map((entry, entryIndex) => {
                        if (entryIndex !== index) return entry;
                        const current = entry as { action?: { kind?: string } };
                        return { ...current, action: { ...current.action, kind: event.target.value } };
                      });
                      updateSteps(steps);
                    }}
                    className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium"
                  >
                    {ACTION_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Condition</p>
              )}
              {step.yes || step.no ? (
                <div className="mt-3 grid gap-2 border-l-2 border-slate-200 pl-3 text-sm">
                  {step.yes ? <p><span className="font-semibold text-emerald-800">Yes</span> → {step.yes}</p> : null}
                  {step.no ? <p><span className="font-semibold text-rose-800">No</span> → {step.no}</p> : null}
                </div>
              ) : null}
              {step.next ? <p className="mt-2 text-sm text-slate-600">Next → {step.next}</p> : null}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="h-10 w-fit rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-[#0B1F3A]"
        onClick={() => {
          const id = `step-${workflow.steps.length + 1}`;
          updateSteps([
            ...workflow.steps.filter((entry) => (entry as { id?: string }).id !== "end"),
            { id, title: "New step", action: { kind: "notify_user", text: "New step" }, next: "end" },
            workflow.steps.find((entry) => (entry as { id?: string }).id === "end") || { id: "end", title: "End", action: { kind: "end" } },
          ]);
        }}
      >
        Add step
      </button>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Test with contact</h2>
        <p className="text-sm text-slate-500">Resolves the steps for one contact. It does not send, and it does not call a provider.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Contact
            <input
              list="workflow-contacts"
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              placeholder="Contact id"
              className="h-10 w-64 rounded-md border border-slate-200 px-3 text-sm font-medium"
            />
          </label>
          <datalist id="workflow-contacts">
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} · {contact.stage}
              </option>
            ))}
          </datalist>
          <button
            type="button"
            disabled={pending}
            onClick={testWithContact}
            className="h-10 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Resolving…" : "Test with contact"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Run history</h2>
        <p className="text-sm text-slate-500">Dry runs for {contactId.trim() || "sample-contact"}. These are not deliveries.</p>
        {contactHistory.length === 0 ? <p className="mt-3 text-sm text-slate-500">No dry runs for this contact yet.</p> : null}
        <ul className="mt-3 grid gap-3">
          {contactHistory.map((entry) => (
            <li key={`${entry.at}-${entry.contactId}`} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">{entry.at}</p>
              <ul className="mt-2 grid gap-1 text-sm">
                {entry.steps.map((step) => (
                  <li key={`${entry.at}-${step.id}`}>
                    <span className="font-semibold text-[#0B1F3A]">{step.title}</span>
                    <span className="text-slate-500"> · {step.status}</span>
                    {step.detail && step.detail !== "{}" ? <span className="text-slate-500"> · {step.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

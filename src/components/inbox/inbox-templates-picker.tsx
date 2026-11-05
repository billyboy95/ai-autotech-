import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import { templatesForPicker } from "@/lib/inbox/templates-picker";
import type { InboxTemplateOption } from "@/lib/inbox/types";

export function InboxTemplatesPicker({
  enabled,
  templates,
  open,
  onToggle,
  onPick,
}: {
  enabled: boolean;
  templates: readonly InboxTemplateOption[];
  open: boolean;
  onToggle: () => void;
  onPick: (template: InboxTemplateOption) => void;
}) {
  if (!enabled) return null;
  const rows = templatesForPicker(templates);
  return (
    <div data-testid="inbox-templates-picker" data-open={open ? "true" : "false"} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="inbox-templates-picker-toggle"
          aria-expanded={open}
          onClick={onToggle}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0B1F3A]"
        >
          Templates
        </button>
        <p className="text-xs text-slate-500">Fills the reply only. Nothing is queued and nothing is sent.</p>
      </div>
      {open && rows.length === 0 ? (
        <p data-testid="inbox-templates-picker-empty" className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-500">
          No templates for this workspace.
        </p>
      ) : null}
      {open && rows.length > 0 ? (
        <ul data-testid="inbox-templates-picker-list" className="grid max-h-60 gap-1 overflow-y-auto">
          {rows.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                data-testid="inbox-template-option"
                data-template={template.id}
                onClick={() => onPick(template)}
                className="flex w-full flex-wrap items-baseline gap-x-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-[#0B1F3A]"
              >
                <span className="font-semibold">{template.name}</span>
                <span data-testid="inbox-template-channel" className="text-xs uppercase tracking-wide text-slate-500">{template.channel}</span>
                {template.waCategory ? (
                  <span data-testid="inbox-template-category" className="text-xs text-slate-500">{template.waCategory}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

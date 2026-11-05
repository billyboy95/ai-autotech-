import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.

import { normalizeTagKey, tagFilterChips } from "@/lib/inbox/tag-filter";

export function InboxTagFilter({
  enabled,
  tags,
  selected,
  onToggle,
  onClear,
}: {
  enabled: boolean;
  tags: readonly string[];
  selected: readonly string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  if (!enabled) return null;
  const chips = tagFilterChips(tags, selected);
  const chosen = new Set(selected.map((tag) => normalizeTagKey(tag)));
  return (
    <div data-testid="inbox-tag-filter" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</span>
      {chips.length === 0 ? (
        <span data-testid="inbox-tag-filter-none" className="text-sm text-slate-500">No tags on this list.</span>
      ) : chips.map((tag) => {
        const on = chosen.has(normalizeTagKey(tag));
        return (
          <button
            key={tag.toLowerCase()}
            type="button"
            data-testid="inbox-tag-chip"
            data-tag={tag}
            aria-pressed={on}
            onClick={() => onToggle(tag)}
            className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold ${on ? "bg-[#0B1F3A] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {tag}
          </button>
        );
      })}
      {selected.length > 0 ? (
        <button
          type="button"
          data-testid="inbox-tag-clear"
          onClick={onClear}
          className="inline-flex h-9 items-center rounded-full bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
        >
          Clear tags
        </button>
      ) : null}
      <span className="text-xs font-normal text-slate-500">Any chosen tag. Filters this list only. Nothing is sent.</span>
    </div>
  );
}

export function InboxTagFilterEmpty({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p data-testid="inbox-tag-filter-empty" className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
      No conversations match these tags.
    </p>
  );
}

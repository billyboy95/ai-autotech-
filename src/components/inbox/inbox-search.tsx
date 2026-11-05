import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.

export function InboxConversationSearch({
  enabled,
  query,
  onQuery,
}: {
  enabled: boolean;
  query: string;
  onQuery: (value: string) => void;
}) {
  if (!enabled) return null;
  return (
    <label data-testid="inbox-search-field" className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-500 shadow-sm">
      Search conversations
      <input
        type="search"
        data-testid="inbox-search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Name, phone, email, or message"
        autoComplete="off"
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900"
      />
      <span className="font-normal">Filters this list only. Nothing is sent.</span>
    </label>
  );
}

export function InboxSearchEmpty({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p data-testid="inbox-search-empty" className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
      No conversations match this search.
    </p>
  );
}

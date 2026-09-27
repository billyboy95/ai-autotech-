"use client";

import { useId, useState, type ReactNode } from "react";

export function Advanced({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-[#0B1F3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]"
      >
        {open ? "Hide advanced" : "Advanced"}
      </button>
      <div id={panelId} hidden={!open} className="mt-3 grid gap-3">
        {children}
      </div>
    </div>
  );
}

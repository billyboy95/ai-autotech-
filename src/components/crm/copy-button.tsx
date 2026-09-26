"use client";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
      onClick={() => {
        void navigator.clipboard.writeText(text);
      }}
    >
      {label}
    </button>
  );
}

"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="h-11 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          return;
        } catch {
          // Some mobile browsers block the async clipboard API until a fallback runs.
        }
        try {
          const input = document.createElement("textarea");
          input.value = url;
          input.setAttribute("readonly", "");
          input.style.position = "fixed";
          input.style.left = "-9999px";
          document.body.appendChild(input);
          input.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(input);
          setCopied(ok);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

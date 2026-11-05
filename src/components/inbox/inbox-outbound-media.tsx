"use client";

import React, { useState } from "react"; // Classic JSX runtime for the node test. Next builds this file either way.

import {
  OUTBOUND_MEDIA_ACCEPT,
  attachOutboundMedia,
  safeOutboundPreviewUrl,
  type OutboundMediaDraft,
} from "@/lib/inbox/outbound-media";

export function InboxOutboundMedia({
  enabled,
  pending,
  onAttach,
  onRemove,
}: {
  enabled: boolean;
  pending: OutboundMediaDraft | null;
  onAttach: (next: OutboundMediaDraft) => void;
  onRemove: () => void;
}) {
  const [rejection, setRejection] = useState("");
  if (!enabled) return null;
  const preview = pending?.kind === "image" ? safeOutboundPreviewUrl(pending.previewUrl) : "";
  return (
    <div data-testid="inbox-outbound-media" className="grid gap-2">
      <label className="grid gap-1 text-xs font-semibold text-slate-500">
        Attach
        <input
          type="file"
          accept={OUTBOUND_MEDIA_ACCEPT}
          data-testid="inbox-outbound-media-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const draft = attachOutboundMedia({ name: file.name, type: file.type, size: file.size });
            if (!draft) {
              setRejection("Choose one image or one document. Nothing was attached.");
              return;
            }
            setRejection("");
            const previewUrl = draft.kind === "image" ? objectPreview(file) : "";
            onAttach(previewUrl ? { ...draft, previewUrl } : draft);
          }}
          className="block w-full text-sm font-normal text-slate-700 file:mr-3 file:h-9 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:text-sm file:font-semibold file:text-[#0B1F3A]"
        />
      </label>
      <p className="text-xs text-slate-500">
        One image or one document stays on the queued reply. Nothing is uploaded and nothing is sent.
      </p>
      {rejection ? (
        <p data-testid="inbox-outbound-media-rejected" className="text-sm text-amber-800">{rejection}</p>
      ) : null}
      {pending ? (
        <div
          data-testid="inbox-outbound-media-chip"
          data-kind={pending.kind}
          data-filename={pending.filename}
          data-mime={pending.mime}
          className="flex max-w-full flex-wrap items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-[#0B1F3A] ring-1 ring-slate-200"
        >
          {preview ? (
            // Local preview only. The image optimizer would fetch the file. The queued row stores the name and mime.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={pending.filename}
              data-testid="inbox-outbound-media-preview"
              className="max-h-16 max-w-24 rounded-md object-cover"
            />
          ) : null}
          <span className="min-w-0 truncate font-semibold">{pending.filename}</span>
          <span className="truncate text-xs font-normal text-slate-500">{pending.mime}</span>
          <button
            type="button"
            data-testid="inbox-outbound-media-remove"
            onClick={() => {
              setRejection("");
              onRemove();
            }}
            className="ml-auto h-8 rounded-md border border-slate-200 px-2 text-xs font-semibold text-[#0B1F3A]"
          >
            Remove
          </button>
          <input type="hidden" name="outboundMediaKind" value={pending.kind} />
          <input type="hidden" name="outboundMediaFilename" value={pending.filename} />
          <input type="hidden" name="outboundMediaMime" value={pending.mime} />
        </div>
      ) : null}
    </div>
  );
}

function objectPreview(file: File) {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return "";
  try {
    return safeOutboundPreviewUrl(URL.createObjectURL(file));
  } catch {
    return "";
  }
}

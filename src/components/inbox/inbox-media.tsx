"use client";

import React, { useState } from "react"; // Classic JSX runtime for the node test. Next builds this file either way.

import type { InboxAttachment } from "@/lib/inbox/media";

export function InboxMessageMedia({
  enabled,
  attachments,
}: {
  enabled: boolean;
  attachments: readonly InboxAttachment[];
}) {
  if (!enabled || attachments.length === 0) return null;
  return (
    <div data-testid="inbox-message-media" className="mt-2 grid gap-2">
      {attachments.map((item) => (
        item.kind === "image" && item.url
          ? <InboxImage key={item.id} item={item} />
          : <InboxFileChip key={item.id} item={item} />
      ))}
    </div>
  );
}

function InboxImage({ item }: { item: InboxAttachment }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  if (broken) return <InboxFallback item={item} />;
  const name = item.filename || "Image";
  return (
    <div data-testid="inbox-media-image" data-filename={item.filename}>
      <button
        type="button"
        aria-expanded={open}
        data-open={open ? "true" : "false"}
        aria-label={open ? `Close image ${name}` : `Open image ${name}`}
        onClick={() => setOpen((current) => !current)}
        className="block max-w-full text-left"
      >
        {/* Stored address only. The image optimizer would fetch the file. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={name}
          data-testid={open ? "inbox-media-large" : "inbox-media-thumb"}
          className={open ? "max-h-80 max-w-full rounded-md object-contain" : "max-h-24 max-w-32 rounded-md object-cover"}
          onError={() => setBroken(true)}
        />
      </button>
      {item.filename || item.mime ? (
        <p className="mt-1 text-xs opacity-80">{[item.filename, item.mime].filter(Boolean).join(" · ")}</p>
      ) : null}
    </div>
  );
}

function InboxFileChip({ item }: { item: InboxAttachment }) {
  if (!item.url) return <InboxFallback item={item} />;
  const filename = item.filename || "Document";
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="inbox-media-file"
      data-filename={item.filename}
      data-mime={item.mime}
      className="inline-flex max-w-full flex-col rounded-md bg-white px-3 py-2 text-sm text-[#0B1F3A] ring-1 ring-slate-200"
    >
      <span className="truncate font-semibold">{filename}</span>
      {item.mime ? <span className="truncate text-xs font-normal text-slate-500">{item.mime}</span> : null}
    </a>
  );
}

function InboxFallback({ item }: { item: InboxAttachment }) {
  const detail = [item.filename, item.mime].filter(Boolean).join(" · ");
  return (
    <span data-testid="inbox-media-fallback" className="inline-flex max-w-full rounded-md bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
      Attachment unavailable{detail ? ` · ${detail}` : ""}
    </span>
  );
}

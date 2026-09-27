"use client";

import { useActionState } from "react";
import { submitPublicReview, type ReviewFormState } from "@/app/actions/reviews";
import type { PublicReviewPage } from "@/lib/reviews/types";

const initial: ReviewFormState = { ok: false, message: "" };

function stars(value: number | null) {
  if (value == null) return "No reviews yet";
  return `${value.toFixed(1)} / 5`;
}

export function ReviewForm({ page }: { page: Extract<PublicReviewPage, { kind: "form" }> }) {
  const [state, action, pending] = useActionState(submitPublicReview, initial);
  return (
    <div className="mt-4 grid gap-4">
      <p className="text-sm text-slate-600">
        {stars(page.average)} · {page.count} {page.count === 1 ? "review" : "reviews"}
      </p>
      {page.recent.length ? (
        <ul className="grid gap-2">
          {page.recent.map((review, index) => (
            <li key={`${review.createdAt}-${index}`} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <p className="font-semibold text-[#0B1F3A]">{review.rating} / 5 · {review.name || "Guest"}</p>
              {review.comment ? <p className="mt-1 text-slate-600">{review.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <form action={action} className="grid gap-3">
        <input type="hidden" name="key" value={page.key} />
        <fieldset className="grid gap-2">
          <legend className="text-xs font-semibold text-slate-600">Rating</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <label key={rating} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
                <input type="radio" name="rating" value={rating} required />
                {rating}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Name
          <input name="name" maxLength={80} autoComplete="name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Comment
          <textarea name="comment" maxLength={500} rows={4} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <label className="absolute -left-[9999px]" aria-hidden="true">
          Company website
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
        {state.message ? (
          <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>{state.message}</p>
        ) : null}
        <button disabled={pending} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:bg-slate-300">
          Leave a review
        </button>
        <p className="text-xs text-slate-500">No message is sent when you submit this review.</p>
      </form>
    </div>
  );
}

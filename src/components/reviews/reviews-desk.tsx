import { createReviewRequest, markReviewResponded, recordReview, saveReviewTemplate } from "@/app/actions/reviews";
import { CopyButton } from "@/components/crm/copy-button";
import { reviewPublicPath } from "@/lib/reviews/plan";
import type { ReviewDesk } from "@/lib/reviews/types";

function absolute(siteUrl: string, path: string) {
  return siteUrl ? `${siteUrl}${path}` : path;
}

function ratingLabel(average: number | null, count: number) {
  if (!count || average == null) return "No reviews yet";
  return `${average.toFixed(1)} / 5 from ${count} ${count === 1 ? "review" : "reviews"}`;
}

export function ReviewsDesk({ data }: { data: ReviewDesk }) {
  const link = absolute(data.siteUrl, data.publicPath);
  const filters = [0, 1, 2, 3, 4, 5];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Reviews</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Collect a star rating and a short comment. A review request is a draft in the outbox only when consent is stored. Nothing is sent. review.received is deferred, so a new review does not start a workflow and seeded workflows stay valid.
        </p>
      </div>
      {data.notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{data.notice}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Public review link</h2>
        <p className="mt-1 text-sm text-slate-600">{ratingLabel(data.average, data.count)}</p>
        <p className="mt-2 break-all text-sm text-slate-700">{link}</p>
        <div className="mt-3">
          <CopyButton text={link} label="Copy public review link" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Reviews</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((rating) => {
            const params = new URLSearchParams();
            params.set("org", data.orgSlug);
            if (rating) params.set("rating", String(rating));
            const active = rating === 0 ? data.ratingFilter == null : data.ratingFilter === rating;
            return (
              <a
                key={rating}
                href={`/command-centre/reviews?${params.toString()}`}
                className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold ${active ? "bg-[#0B1F3A] text-white" : "border border-slate-200 text-slate-700"}`}
              >
                {rating === 0 ? "All ratings" : `${rating} star`}
              </a>
            );
          })}
        </div>
        {data.reviews.length === 0 ? <p className="mt-3 text-sm text-slate-500">No reviews for this filter.</p> : null}
        <ul className="mt-3 grid gap-3">
          {data.reviews.map((review) => (
            <li key={review.id} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
              <p className="font-semibold text-[#0B1F3A]">
                {review.rating} / 5 · {review.reviewerName || "Guest"} · {review.source}
              </p>
              {review.comment ? <p className="mt-1 text-slate-600">{review.comment}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{review.respondedAt ? "Responded" : "Not responded"}</p>
              <form action={markReviewResponded} className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <input type="hidden" name="org" value={data.orgSlug} />
                <input type="hidden" name="reviewId" value={review.id} />
                {data.ratingFilter ? <input type="hidden" name="ratingFilter" value={data.ratingFilter} /> : null}
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Internal note
                  <input name="responseNote" defaultValue={review.responseNote} maxLength={500} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <button disabled={!data.canManage || Boolean(review.respondedAt)} className="h-10 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white disabled:bg-slate-300">
                  Mark responded
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Record a review</h2>
        <p className="mt-1 text-sm text-slate-500">Use this for a rating you already have. It does not send a message.</p>
        <form action={recordReview} className="mt-3 grid gap-2">
          <input type="hidden" name="org" value={data.orgSlug} />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Rating
            <select name="rating" required disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Source
            <select name="source" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option value="manual">Manual</option>
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Name
            <input name="name" maxLength={80} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Comment
            <textarea name="comment" maxLength={500} rows={3} disabled={!data.canManage} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button disabled={!data.canManage} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:bg-slate-300">Save review</button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Draft a review request</h2>
        <p className="mt-1 text-sm text-slate-500">
          Consent is stored on the contact, then one outbox row is saved as draft. It is not queued and it is not sent.
        </p>
        {data.requests.length ? (
          <ul className="mt-3 grid gap-2">
            {data.requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{request.channel} · {request.toAddress} · {request.status}</span>
                <CopyButton text={absolute(data.siteUrl, reviewPublicPath(request.publicToken))} label="Copy link" />
              </li>
            ))}
          </ul>
        ) : null}
        <form action={createReviewRequest} className="mt-3 grid gap-2">
          <input type="hidden" name="org" value={data.orgSlug} />
          <input type="hidden" name="consentText" value={data.consentText} />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Channel
            <select name="channel" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Mobile or email
            <input name="address" required disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Name
            <input name="name" maxLength={80} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Subject
            <input name="subject" maxLength={200} placeholder="How did we do?" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          {data.templates.length ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Template
              <select name="templateId" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
                <option value="">None</option>
                {data.templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name} · {template.channel}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Message
            <textarea name="body" required rows={4} defaultValue={data.defaultBody} disabled={!data.canManage} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input name="consent" type="checkbox" required disabled={!data.canManage} className="mt-1" />
            <span>{data.consentText}</span>
          </label>
          <button disabled={!data.canManage} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:bg-slate-300">Save draft</button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Review template</h2>
        <form action={saveReviewTemplate} className="mt-3 grid gap-2">
          <input type="hidden" name="org" value={data.orgSlug} />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Name
            <input name="name" required minLength={2} maxLength={80} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Channel
            <select name="channel" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Subject
            <input name="subject" maxLength={200} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Body
            <textarea name="body" required rows={3} defaultValue={data.defaultBody} disabled={!data.canManage} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button disabled={!data.canManage} className="h-10 w-fit rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A] disabled:bg-slate-100">Save template</button>
        </form>
      </section>
    </div>
  );
}

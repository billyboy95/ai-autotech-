import type { Metadata } from "next";
import { approveSocial, cancelSocial, queueSocialPostForm } from "@/app/actions/automation";
import { CopyButton } from "@/components/crm/copy-button";
import { CrmFrame } from "@/components/crm/frame";
import { formatWhen } from "@/lib/automation/ids";
import { loadCommandData } from "@/lib/automation/page-data";
import { trackedUrl } from "@/lib/automation/social";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Social | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function SocialPage() {
  const { workspace, sendingEnabled } = await loadCommandData();
  const posts = workspace.state.socialPosts.slice().sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

  return (
    <CrmFrame setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div data-testid="social-calendar" className="grid min-w-0 grid-cols-1 gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Social calendar</h1>
          <p className="text-sm text-slate-500">
            Facebook, Instagram, and LinkedIn stay queued until sending is on. Copy and post is always available.
          </p>
        </div>

        <form action={queueSocialPostForm} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Platform
              <select name="platform" className="h-10 rounded-md border border-slate-200 px-2 text-sm font-normal">
                <option value="facebook">Facebook Page</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Publish at (Johannesburg)
              <input name="scheduledFor" type="datetime-local" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              UTM source
              <input name="utmSource" placeholder="facebook" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              UTM campaign
              <input name="utmCampaign" placeholder="spring-audit" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal" />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Post
            <textarea name="body" rows={4} required className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal" placeholder="What should go on the feed" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Image URL (required for Instagram once sending is on)
            <input name="mediaUrl" placeholder="https://aiautotech.co.za/images/post.jpg" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Destination
            <input name="linkUrl" defaultValue="https://aiautotech.co.za/audit" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal" />
          </label>
          <button className="h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Queue post</button>
        </form>

        <div className="grid gap-3">
          {posts.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No posts queued.</p> : null}
          {posts.map((post) => {
            const copy = post.copyText || post.body;
            return (
              <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {post.platform} · {post.status} · {formatWhen(post.scheduledFor)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{post.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {post.utmSource || post.platform} / {post.utmCampaign || "social"}
                </p>
                <p className="mt-1 break-all text-xs text-[#2563EB]">{trackedUrl(post)}</p>
                {post.error ? <p className="mt-2 text-sm text-rose-700">{post.error}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton text={copy} label="Copy & post" />
                  {post.status === "queued" || post.status === "failed" ? (
                    <form action={approveSocial}>
                      <input type="hidden" name="id" value={post.id} />
                      <button className="h-9 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white">Approve</button>
                    </form>
                  ) : null}
                  {post.status !== "published" && post.status !== "cancelled" ? (
                    <form action={cancelSocial}>
                      <input type="hidden" name="id" value={post.id} />
                      <button className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600">Cancel</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </CrmFrame>
  );
}

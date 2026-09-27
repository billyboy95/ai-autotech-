"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { workspaceWriteBlock } from "@/lib/billing/guard";
import {
  canManageReviews,
  missingReviewTable,
  normalizeReviewAddress,
  planManualReview,
  planPublicReview,
  planReviewRequest,
  reviewPublicPath,
  reviewRequestConsentText,
} from "@/lib/reviews/plan";
import { loadPublicReview } from "@/lib/reviews/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { serviceConfigured, submitPublicReviewRecord } from "@/server/workers/reviews";

export type ReviewFormState = { ok: boolean; message: string };

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function back(org: string, notice: string, rating = ""): never {
  const params = new URLSearchParams();
  if (org) params.set("org", org);
  if (rating) params.set("rating", rating);
  if (notice) params.set("notice", notice);
  const query = params.toString();
  redirect(query ? `/command-centre/reviews?${query}` : "/command-centre/reviews");
}

function fail(message: string) {
  const lower = message.toLowerCase();
  if (missingReviewTable(message)) return "Review tables are not in this database yet. Apply phase 3c. Nothing was stored and nothing was sent.";
  if (lower.includes("consent required")) return "Consent is required before a review request can be drafted. Nothing was written to the outbox.";
  if (lower.includes("consent refused") || lower.includes("suppressed")) return "This person has opted out or is suppressed. Nothing was written to the outbox.";
  if (lower.includes("not allowed")) return "Only an agency owner, agency staff member, or client admin can change reviews.";
  if (lower.includes("review request drafts are not sent")) return "Review requests stay drafts. Nothing was sent.";
  if (lower.includes("workspace is suspended")) return "This workspace is suspended. Nothing was stored and nothing was sent.";
  return message;
}

async function guard(formData: FormData) {
  const slug = text(formData, "org");
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.requiresLogin && slug) {
    redirect(`/login?next=${encodeURIComponent(`/command-centre/reviews?org=${slug}`)}`);
  }
  if (
    workspace.mode !== "member"
    || !workspace.scoped
    || workspace.active.id.startsWith("preview-")
    || !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return { workspace, error: "Preview workspace. Connect Supabase before saving a review. Nothing was stored and nothing was sent." };
  }
  if (slug && workspace.active.slug !== slug) {
    return { workspace, error: "That workspace is outside your account." };
  }
  if (!canManageReviews(workspace.role)) {
    return { workspace, error: "Only an agency owner, agency staff member, or client admin can change reviews." };
  }
  const blocked = await workspaceWriteBlock(workspace.active.id);
  if (blocked) return { workspace, error: blocked };
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect(`/login?next=${encodeURIComponent(`/command-centre/reviews?org=${workspace.active.slug}`)}`);
  return { workspace, error: null, supabase };
}

export async function createReviewRequest(formData: FormData) {
  const gate = await guard(formData);
  const org = gate.workspace.active.slug;
  if (gate.error || !gate.supabase) back(org, gate.error || "Could not draft the review request.");
  const senderName = gate.workspace.active.senderName || gate.workspace.active.name;
  const channel = text(formData, "channel");
  const address = text(formData, "address");
  const consentText = reviewRequestConsentText(senderName);
  let existingConsent: "opted_in" | "opted_out" | "requested" | "none" = "none";
  let suppressed = false;
  const supabase = gate.supabase;
  const normalizedChannel = channel === "email" || channel === "sms" ? channel : "";
  const normalizedAddress = normalizedChannel ? normalizeReviewAddress(normalizedChannel, address) : null;
  if (normalizedChannel && normalizedAddress) {
    const listed = await supabase
      .from("contact_consents")
      .select("status")
      .eq("org_id", gate.workspace.active.id)
      .eq("channel", normalizedChannel)
      .eq("purpose", "marketing")
      .eq("address", normalizedAddress)
      .order("captured_at", { ascending: false })
      .limit(1);
    const status = listed.data?.[0]?.status;
    if (status === "opted_in" || status === "opted_out" || status === "requested") existingConsent = status;
    const blocked = await supabase
      .from("suppressions")
      .select("id")
      .eq("org_id", gate.workspace.active.id)
      .eq("channel", normalizedChannel)
      .eq("address", normalizedAddress)
      .limit(1);
    suppressed = Boolean(blocked.data?.length);
  }
  const templateId = text(formData, "templateId");
  let templateBody = "";
  let templateSubject = "";
  if (templateId) {
    const template = await supabase
      .from("review_templates")
      .select("body, subject, channel")
      .eq("id", templateId)
      .eq("org_id", gate.workspace.active.id)
      .maybeSingle();
    if (template.data && (!normalizedChannel || template.data.channel === normalizedChannel)) {
      templateBody = String(template.data.body || "");
      templateSubject = String(template.data.subject || "");
    }
  }
  const plan = planReviewRequest({
    channel,
    address,
    name: text(formData, "name"),
    subject: text(formData, "subject") || templateSubject,
    body: text(formData, "body") || templateBody,
    senderName,
    consent: formData.get("consent") === "on",
    consentText: text(formData, "consentText"),
    expectedConsentText: consentText,
    existingConsent,
    suppressed,
  });
  if (!plan.ok) back(org, plan.error);
  const saved = await supabase.rpc("create_review_request_draft", {
    p_org: gate.workspace.active.id,
    p_channel: plan.channel,
    p_address: plan.address,
    p_name: text(formData, "name"),
    p_subject: plan.subject,
    p_body: plan.body,
    p_consent: true,
    p_consent_text: plan.consentText,
    p_contact_id: text(formData, "contactId") || null,
    p_lead_id: text(formData, "leadId") || null,
  });
  if (saved.error || !saved.data || saved.data.sent === true || saved.data.status !== "draft") {
    back(org, fail(saved.error?.message || "The review request could not be drafted. Nothing was sent."));
  }
  revalidatePath("/command-centre/reviews");
  const token = String(saved.data.public_token || "");
  back(org, `Draft saved. Public link ${reviewPublicPath(token)}. Nothing was sent.`);
}

export async function recordReview(formData: FormData) {
  const gate = await guard(formData);
  const org = gate.workspace.active.slug;
  if (gate.error || !gate.supabase) back(org, gate.error || "Could not save the review.");
  const plan = planManualReview({
    rating: text(formData, "rating"),
    name: text(formData, "name"),
    comment: text(formData, "comment"),
    source: text(formData, "source") || "manual",
  });
  if (!plan.ok) back(org, plan.error);
  const saved = await gate.supabase.from("reviews").insert({
    org_id: gate.workspace.active.id,
    rating: plan.rating,
    comment: plan.comment,
    source: plan.source,
    reviewer_name: plan.name,
  }).select("id").single();
  if (saved.error) back(org, fail(saved.error.message));
  revalidatePath("/command-centre/reviews");
  revalidatePath("/r/[orgSlugOrToken]", "page");
  back(org, "Review saved. Nothing was sent.");
}

export async function markReviewResponded(formData: FormData) {
  const gate = await guard(formData);
  const org = gate.workspace.active.slug;
  const rating = text(formData, "ratingFilter");
  if (gate.error || !gate.supabase) back(org, gate.error || "Could not update the review.", rating);
  const id = text(formData, "reviewId");
  if (!id) back(org, "Choose a review.", rating);
  const note = text(formData, "responseNote").slice(0, 500);
  const saved = await gate.supabase
    .from("reviews")
    .update({ responded_at: new Date().toISOString(), response_note: note })
    .eq("id", id)
    .eq("org_id", gate.workspace.active.id);
  if (saved.error) back(org, fail(saved.error.message), rating);
  revalidatePath("/command-centre/reviews");
  back(org, "Marked as responded. Nothing was sent.", rating);
}

export async function saveReviewTemplate(formData: FormData) {
  const gate = await guard(formData);
  const org = gate.workspace.active.slug;
  if (gate.error || !gate.supabase) back(org, gate.error || "Could not save the template.");
  const channel = text(formData, "channel");
  const name = text(formData, "name");
  const body = text(formData, "body");
  if (channel !== "email" && channel !== "sms") back(org, "Choose email or SMS for the template.");
  if (name.length < 2 || name.length > 80) back(org, "Enter a template name.");
  if (body.length < 2 || body.length > 2000) back(org, "Enter a template message.");
  const saved = await gate.supabase.from("review_templates").insert({
    org_id: gate.workspace.active.id,
    name,
    channel,
    subject: text(formData, "subject").slice(0, 200),
    body,
    active: true,
  });
  if (saved.error) back(org, fail(saved.error.message));
  revalidatePath("/command-centre/reviews");
  back(org, "Template saved. Nothing was sent.");
}

function publicError(message: string) {
  const textValue = message.toLowerCase();
  if (textValue.includes("rating required")) return "Choose a rating from 1 to 5.";
  if (textValue.includes("comment too long")) return "Keep the comment under 500 characters.";
  if (textValue.includes("name too long")) return "The name is too long.";
  if (textValue.includes("not active")) return "This review page is not active.";
  if (missingReviewTable(message)) return "Reviews are not available until the review migration is applied. Nothing was stored.";
  return "The review could not be saved. Nothing was sent.";
}

export async function submitPublicReview(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const key = text(formData, "key").toLowerCase();
  const page = await loadPublicReview(key);
  if (page.kind !== "form") return { ok: false, message: "This review page is not active." };
  const plan = planPublicReview({
    rating: text(formData, "rating"),
    name: text(formData, "name"),
    comment: text(formData, "comment"),
    honeypot: text(formData, "company_website"),
  });
  if (!plan.ok) return { ok: false, message: plan.error };
  if (page.preview || !serviceConfigured()) {
    return { ok: true, message: "Preview review accepted. Nothing was stored and no message was sent." };
  }
  const saved = await submitPublicReviewRecord({
    key,
    rating: plan.rating,
    name: plan.name,
    comment: plan.comment,
  });
  if (!saved.configured) {
    return { ok: true, message: "Preview review accepted. Nothing was stored and no message was sent." };
  }
  if (saved.error || !saved.data?.ok) return { ok: false, message: publicError(saved.error || "The review could not be saved.") };
  return { ok: true, message: "Thank you. Your review was saved. No message was sent." };
}

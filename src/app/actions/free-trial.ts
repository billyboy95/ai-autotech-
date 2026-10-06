"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trialIpHash } from "@/lib/trial/ip";
import {
  FREE_TRIAL_UNAVAILABLE,
  decideTrialStart,
  freeTrialEnabled,
  trialRateLimited,
  TRIAL_RATE_WINDOW_MS,
} from "@/lib/trial/trial";
import { provisionTrialUser, startPublicTrial } from "@/server/workers/free-trial";

export type TrialStartState = {
  ok: boolean;
  message: string;
};

const hits = new Map<string, number[]>();

function clientIp(headerStore: Headers) {
  return (
    headerStore.get("x-real-ip") ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function limited(ipHash: string, now = Date.now()) {
  const recent = (hits.get(ipHash) ?? []).filter((hit) => now - hit < TRIAL_RATE_WINDOW_MS);
  const blocked = trialRateLimited(recent, now);
  if (!blocked) recent.push(now);
  hits.set(ipHash, recent);
  return blocked;
}

function checked(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "yes";
}

export async function startFreeTrial(_state: TrialStartState, formData: FormData): Promise<TrialStartState> {
  if (!freeTrialEnabled()) {
    return { ok: false, message: FREE_TRIAL_UNAVAILABLE };
  }
  const honeypot = `${formData.get("website") ?? ""}${formData.get("_honey") ?? ""}`;
  const headerStore = await headers();
  const ipHash = trialIpHash(clientIp(headerStore));
  if (limited(ipHash)) {
    return { ok: false, message: "Too many trial requests. Please try again later." };
  }
  const decision = decideTrialStart({
    snapshotId: String(formData.get("niche") ?? ""),
    businessName: String(formData.get("business") ?? ""),
    contactName: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
    popia: checked(formData.get("popia")),
    honeypot,
    limited: false,
  });
  if (!decision.ok) return { ok: false, message: decision.message };
  if (decision.code === "honeypot") return { ok: true, message: decision.message };

  const created = await startPublicTrial({
    snapshotId: decision.snapshotId,
    businessName: decision.swap.name,
    contactName: String(formData.get("name") ?? "").trim(),
    email: decision.email,
    phone: decision.swap.phone,
    days: decision.days,
    ipHash,
    honeypot: "",
  });
  if (!created.ok || !created.stored) {
    return { ok: created.ok, message: created.message };
  }

  const slug = created.slug;
  const signInHint = slug
    ? `Sign in with ${decision.email}, then open /start/open. The workspace is ${slug}.`
    : `Sign in with ${decision.email}, then open /start/open.`;
  const ready = `${decision.swap.name} is ready. ${signInHint} Sending stays off. Nothing was charged. No email was sent.`;

  if (!created.created) {
    return { ok: true, message: ready };
  }

  const account = await provisionTrialUser(decision.email, String(formData.get("password") ?? ""));
  if (account.reason !== "created") {
    return { ok: true, message: ready };
  }

  const supabase = await createSupabaseServerClient();
  const signed = await supabase.auth.signInWithPassword({
    email: decision.email,
    password: String(formData.get("password") ?? ""),
  });
  if (signed.error || !signed.data.user) {
    return { ok: true, message: ready };
  }
  const claim = await supabase.rpc("claim_free_trial");
  if (claim.error || !slug) {
    return { ok: true, message: ready };
  }
  redirect(`/command-centre?org=${encodeURIComponent(slug)}`);
}

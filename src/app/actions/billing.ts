"use server";

import { revalidatePath } from "next/cache";
import { createPayfastProvider } from "@/lib/billing/payfast";
import { emptyBook } from "@/lib/billing/book";
import { isBillingSandboxEnabled, mockItnAllowed } from "@/lib/billing/flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";
import { callServiceRpc } from "@/server/workers/with-org";

export type BillingActionState = {
  ok: boolean;
  message: string;
  checkout?: {
    actionUrl: string;
    fields: Record<string, string>;
  } | null;
};

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

async function manageableWorkspace(slug: string) {
  const workspace = await resolveWorkspace(slug);
  if (workspace.mode !== "member" || workspace.active.slug !== slug || !canManage(workspace.role)) {
    return null;
  }
  return workspace;
}

export async function createCheckoutSession(
  _state: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  return {
    ok: false,
    message: "Stripe checkout is disabled. Use the PayFast sandbox on workspace billing. No charge was sent.",
  };
}

export async function preparePayfastCheckout(
  _state: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await manageableWorkspace(slug);
  if (!workspace) return { ok: false, message: "Sign in as a workspace admin to open sandbox checkout." };
  if (!isBillingSandboxEnabled()) {
    return { ok: false, message: "Billing sandbox is off. Set BILLING_SANDBOX=true. No charge was sent." };
  }
  const planCode = String(formData.get("plan_code") ?? "");
  const supabase = await createSupabaseServerClient();
  const plan = await supabase.from("plans").select("code, name, price_cents, interval").eq("code", planCode).maybeSingle();
  if (plan.error || !plan.data) return { ok: false, message: "That plan is not available. No charge was sent." };
  const email = String(formData.get("email") ?? "").trim();
  const provider = createPayfastProvider(emptyBook(), process.env);
  const checkout = provider.createCheckout(
    { id: workspace.active.id, name: workspace.active.name, email: email || undefined, slug },
    {
      code: String(plan.data.code),
      name: String(plan.data.name),
      priceCents: Number(plan.data.price_cents),
      interval: String(plan.data.interval) === "year" ? "year" : "month",
      currency: "ZAR",
    },
  );
  if (!checkout.actionUrl || !checkout.fields) return { ok: false, message: checkout.message };
  return {
    ok: true,
    message: checkout.message,
    checkout: { actionUrl: checkout.actionUrl, fields: checkout.fields },
  };
}

export async function recordSandboxItn(
  _state: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await manageableWorkspace(slug);
  if (!workspace) return { ok: false, message: "Sign in as a workspace admin to record a sandbox ITN." };
  if (!mockItnAllowed()) {
    return { ok: false, message: "Mock ITN is off. No charge was sent and the subscription was not changed." };
  }
  const planCode = String(formData.get("plan_code") ?? "starter");
  const supabase = await createSupabaseServerClient();
  const plan = await supabase.from("plans").select("price_cents").eq("code", planCode).maybeSingle();
  if (plan.error || !plan.data) return { ok: false, message: "That plan is not available. No charge was sent." };
  const cents = Number(plan.data.price_cents);
  const saved = await callServiceRpc("apply_billing_event", {
    p_org: workspace.active.id,
    p_provider: "payfast",
    p_event_id: `sandbox-itn-${workspace.active.id}-${Date.now()}`,
    p_type: "itn",
    p_payload: {
      sandbox: "true",
      payment_status: "COMPLETE",
      plan_code: planCode,
      amount_cents: cents,
      token: `sandbox-token-${workspace.active.id}`,
      occurred_at: new Date().toISOString(),
    },
  });
  if (!saved.configured) {
    return { ok: false, message: "Supabase service role is not configured, so the mock ITN was not stored. No charge was sent." };
  }
  if (saved.error) return { ok: false, message: saved.error.message };
  revalidatePath("/command-centre/billing");
  revalidatePath(`/agency/${slug}/settings`);
  revalidatePath("/agency");
  return { ok: true, message: "Sandbox ITN applied. The workspace subscription is active. No charge was sent." };
}

export async function createYocoSandboxLink(
  _state: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await manageableWorkspace(slug);
  if (!workspace) return { ok: false, message: "Sign in as a workspace admin to draft a Yoco link." };
  const rands = Number(String(formData.get("amount_rands") ?? "").replace(/,/g, ""));
  if (!Number.isFinite(rands) || rands <= 0) return { ok: false, message: "Enter a once-off amount in rands. No charge was sent." };
  const cents = Math.round(rands * 100);
  const description = String(formData.get("description") ?? "Once-off invoice").trim() || "Once-off invoice";
  const supabase = await createSupabaseServerClient();
  const created = await supabase.rpc("create_yoco_sandbox_link", {
    p_org: workspace.active.id,
    p_amount_cents: cents,
    p_description: description,
  });
  if (created.error) {
    return { ok: false, message: created.error.message };
  }
  const reference = String((created.data as { reference?: string } | null)?.reference || "");
  revalidatePath("/command-centre/billing");
  revalidatePath(`/agency/${slug}/settings`);
  return {
    ok: true,
    message: reference
      ? `Yoco sandbox draft ${reference} was saved. Yoco was not called and no charge was sent.`
      : "Yoco sandbox draft was saved. No charge was sent.",
  };
}

import { supabaseAuthConfigured } from "@/lib/auth/gate";
import { isSendEnabled } from "@/lib/automation/channels";
import { isBillingSandboxEnabled, PAYFAST_SANDBOX_MERCHANT_ID } from "@/lib/billing/flag";
import { pwaInstallMode } from "@/lib/pwa/install";
import { zentrixPackMode } from "@/lib/zentrix/pack";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AGENCY_SLUG } from "@/lib/tenant/types";

export type OpsCheckStatus = "ok" | "blocked" | "needs_billy" | "pending" | "optional";

export type OpsCheck = {
  id: string;
  label: string;
  status: OpsCheckStatus;
  detail: string;
  href?: string;
  hrefLabel?: string;
};

export type AgencyOwnerClaim = "preview" | "yes" | "no" | "unknown";

export type PayfastMerchantState = "unset" | "sandbox" | "refused";

export type OpsReadinessInput = {
  claim: AgencyOwnerClaim;
  ownerEmailsSet: boolean;
  cronSecretPresent: boolean;
  workspaceSendingEnabled: boolean;
  automationSendEnabled: boolean;
  billingSandbox: boolean;
  payfastMerchant: PayfastMerchantState;
  zentrixPackEnabled: boolean;
  pwaInstallEnabled: boolean;
};

export function cronSecretPresent(env: NodeJS.ProcessEnv = process.env) {
  return String(env.CRON_SECRET ?? "").trim().length > 0;
}

export function ownerEmailsSet(env: NodeJS.ProcessEnv = process.env) {
  return String(env.OWNER_EMAILS ?? "").trim().length > 0;
}

/** Sandbox merchant id is the published PayFast test id. Any other id is refused and is not returned. */
export function payfastMerchantState(env: NodeJS.ProcessEnv = process.env): PayfastMerchantState {
  const id = String(env.PAYFAST_MERCHANT_ID ?? "").trim();
  if (!id) return "unset";
  if (id === PAYFAST_SANDBOX_MERCHANT_ID) return "sandbox";
  return "refused";
}

export function buildOpsReadiness(input: OpsReadinessInput): OpsCheck[] {
  const ownerDetail = ownerEmailsSetDetail(input.ownerEmailsSet);
  const claimDetail =
    input.claim === "yes"
      ? `Current user has agency_owner on ${AGENCY_SLUG}. ${ownerDetail}`
      : input.claim === "no"
        ? `Current user does not have agency_owner on ${AGENCY_SLUG}. ${ownerDetail}`
        : input.claim === "unknown"
          ? `Agency owner claim could not be read. Needs Billy. ${ownerDetail}`
          : `Preview. This is not a live agency_owner claim on ${AGENCY_SLUG}. ${ownerDetail}`;

  const sendingOff = !input.workspaceSendingEnabled && !input.automationSendEnabled;
  const billingOk = input.billingSandbox && input.payfastMerchant === "sandbox";

  return [
    {
      id: "migrations",
      label: "Supabase migrations",
      status: "pending",
      detail:
        "Steps 20 through 29 are still unapplied. Step 30 is also unapplied. Step 31 is also unapplied. Step 32 is also unapplied. Do not claim this SQL is applied. Paste each file from supabase/APPLY-ORDER.md after Billy re-authenticates Supabase.",
    },
    {
      id: "agency-owner",
      label: "Agency owner",
      status: input.claim === "yes" ? "ok" : input.claim === "no" ? "blocked" : input.claim === "unknown" ? "needs_billy" : "pending",
      detail: claimDetail,
    },
    {
      id: "cron-secret",
      label: "CRON_SECRET",
      status: input.cronSecretPresent ? "ok" : "needs_billy",
      detail: input.cronSecretPresent
        ? "CRON_SECRET is present. The value is not shown."
        : "CRON_SECRET is missing. Needs Billy. The value is not shown.",
    },
    {
      id: "channel-keys",
      label: "Channel keys",
      status: "needs_billy",
      detail: "Meta, SMS, and email channel keys need Billy. No secret is read or shown on this checklist.",
    },
    {
      id: "sending",
      label: "Sending",
      status: sendingOff ? "ok" : "blocked",
      detail: sendingOff
        ? "sending_enabled stays false. This checklist does not turn it on."
        : "sending_enabled must stay false. This checklist does not change it.",
    },
    {
      id: "billing",
      label: "PayFast sandbox",
      status: billingOk ? "ok" : "needs_billy",
      detail: billingDetail(input),
    },
    {
      id: "education-pack",
      label: "Education pack",
      status: "pending",
      detail: "Apply Education pack to EASTC after step 21 is applied. This checklist does not apply it.",
      href: "/agency#education-pack",
      hrefLabel: "Apply Education pack to EASTC",
    },
    {
      id: "zentrix-pack",
      label: "Zentrix pack",
      status: "pending",
      detail: input.zentrixPackEnabled
        ? "Apply Zentrix pack to Zentrix Online. ZENTRIX_WORKSPACE_PACK_ENABLED is the string true. This checklist does not apply the pack."
        : "Apply Zentrix pack to Zentrix Online. Leave ZENTRIX_WORKSPACE_PACK_ENABLED unset until step 29 is applied. Set it to the string true only after that. This checklist does not apply the pack.",
      href: "/agency#zentrix-pack",
      hrefLabel: "Apply Zentrix pack",
    },
    {
      id: "pwa-install",
      label: "PWA install",
      status: "optional",
      detail: input.pwaInstallEnabled
        ? "Optional. Not a go-live blocker. Browser install only. No store listing is live. PWA_INSTALL_SHELL_ENABLED is the string true. An install intent can be stored after step 31 is applied. This checklist does not write one."
        : "Optional. Not a go-live blocker. Browser install only. No store listing is live. PWA_INSTALL_SHELL_ENABLED is unset, so the install page stays fixture-only and writes nothing.",
      href: "/command-centre/install",
      hrefLabel: "Install AIOS on your phone",
    },
    {
      id: "setup-wizard",
      label: "Setup wizard",
      status: "pending",
      detail:
        "The setup / go-live wizard lists steps 20 through 31, owner attach, CRON_SECRET, channels, PayFast, and the phase 5 flags. SETUP_WIZARD_ENABLED stays unset. This checklist does not write.",
      href: "/command-centre/setup",
      hrefLabel: "Open setup wizard",
    },
  ];
}

function ownerEmailsSetDetail(set: boolean) {
  return set
    ? "OWNER_EMAILS is set on the server. The list is not shown."
    : "OWNER_EMAILS is unset. The server uses the documented default. The address is not shown.";
}

function billingDetail(input: OpsReadinessInput) {
  if (input.payfastMerchant === "refused") {
    return "BILLING_SANDBOX stays a sandbox switch. PayFast merchant id is not the sandbox merchant. Needs Billy. The id is not shown. No charge is sent from this checklist.";
  }
  if (!input.billingSandbox) {
    return "BILLING_SANDBOX is unset or not true. PayFast sandbox is off. Needs Billy. No charge is sent from this checklist.";
  }
  if (input.payfastMerchant === "unset") {
    return "BILLING_SANDBOX is true. PayFast merchant id is unset. Needs Billy before a sandbox checkout. No charge is sent from this checklist.";
  }
  return "BILLING_SANDBOX is true. PayFast is on the sandbox merchant. No charge is sent from this checklist.";
}

export async function loadAgencyOwnerClaim(mode: string): Promise<AgencyOwnerClaim> {
  if (mode !== "member" || !supabaseAuthConfigured()) return "preview";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return "unknown";
    const org = await supabase.from("organizations").select("id").eq("slug", AGENCY_SLUG).maybeSingle();
    if (org.error || !org.data?.id) return "unknown";
    const membership = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", org.data.id)
      .maybeSingle();
    if (membership.error) return "unknown";
    return membership.data?.role === "agency_owner" ? "yes" : "no";
  } catch {
    return "unknown";
  }
}

export async function loadOpsReadiness(input: {
  mode: string;
  workspaceSendingEnabled: boolean;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env ?? process.env;
  const claim = input.env ? claimFromEnvMode(input.mode) : await loadAgencyOwnerClaim(input.mode);
  return buildOpsReadiness({
    claim,
    ownerEmailsSet: ownerEmailsSet(env),
    cronSecretPresent: cronSecretPresent(env),
    workspaceSendingEnabled: input.workspaceSendingEnabled,
    automationSendEnabled: isSendEnabled(env),
    billingSandbox: isBillingSandboxEnabled(env),
    payfastMerchant: payfastMerchantState(env),
    zentrixPackEnabled: zentrixPackMode(env) === "sandbox",
    pwaInstallEnabled: pwaInstallMode(env) === "sandbox",
  });
}

function claimFromEnvMode(mode: string): AgencyOwnerClaim {
  return mode === "member" ? "unknown" : "preview";
}

export function opsStatusLabel(status: OpsCheckStatus) {
  if (status === "ok") return "Ready";
  if (status === "blocked") return "Blocked";
  if (status === "needs_billy") return "Needs Billy";
  if (status === "optional") return "Optional";
  return "Pending";
}

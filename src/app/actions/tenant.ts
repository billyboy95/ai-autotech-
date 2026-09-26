"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/tenant/context";
import { addMembership, createClientWorkspace, findOrgBySlug, setShopifyPlanStatus, updateWorkspace } from "@/lib/tenant/data";
import { parseSettings } from "@/lib/tenant/rows";
import { MEMBERSHIP_ROLES, ORG_COOKIE, WORKSPACE_COOKIE, type MembershipRole } from "@/lib/tenant/types";

export type TenantActionState = {
  ok: boolean;
  message: string;
};

function canEdit(role: string | null, mode: string) {
  return mode === "preview" ? false : role === "agency_owner" || role === "agency_staff" || role === "client_admin";
}

export async function openWorkspace(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const workspace = await resolveWorkspace(slug);
  if (workspace.requiresLogin) {
    redirect(`/login?next=${encodeURIComponent(`/command-centre?org=${slug}`)}`);
  }
  const store = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, path: "/" };
  store.set(WORKSPACE_COOKIE, workspace.active.slug, options);
  store.set(ORG_COOKIE, workspace.active.slug, options);
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser().then((result) => result.data.user).catch(() => null);
  if (user) {
    await supabase.from("user_prefs").upsert({
      user_id: user.id,
      active_org_id: workspace.active.id,
      updated_at: new Date().toISOString(),
    });
  }
  redirect(`/command-centre?org=${workspace.active.slug}`);
}

export async function createWorkspace(
  _state: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  const workspace = await resolveWorkspace();
  if (workspace.mode === "preview") {
    return { ok: false, message: "Connect Supabase and apply the tenancy migration before creating a live workspace." };
  }
  if (!workspace.canManageAgency) {
    return { ok: false, message: "Sign in as an agency owner or staff member to create a client workspace." };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Give the workspace a name." };
  const requested = String(formData.get("blueprint") ?? "agency");
  const blueprintKey = requested === "education" || requested === "ecommerce" ? requested : "agency";
  const agency = workspace.workspaces.find((item) => item.orgType === "agency");
  const parent = agency ? await findOrgBySlug(agency.slug) : workspace.active.orgType === "agency" ? workspace.active : null;
  if (!parent) return { ok: false, message: "The AI AutoTech agency workspace is not available yet." };

  try {
    const created = await createClientWorkspace({
      name,
      slug: String(formData.get("slug") ?? ""),
      location: String(formData.get("location") ?? ""),
      domain: String(formData.get("domain") ?? ""),
      blueprintKey,
      parentId: parent.id,
    });
    revalidatePath("/agency");
    redirect(`/agency/${created.slug}/settings`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, message: error instanceof Error ? error.message : "Could not create the workspace." };
  }
}

export async function saveWorkspaceSettings(
  _state: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await resolveWorkspace(slug);
  if (workspace.mode !== "member" || workspace.active.slug !== slug) {
    return { ok: false, message: "Sign in with access to this workspace before saving." };
  }
  if (!canEdit(workspace.role, workspace.mode)) {
    return { ok: false, message: "You can view this workspace, but only an admin can change settings." };
  }

  const current = parseSettings(workspace.active.settings);
  const settings = {
    channels: {
      whatsapp: {
        phoneNumberId: String(formData.get("whatsappPhoneNumberId") ?? current.channels.whatsapp.phoneNumberId),
        displayPhone: String(formData.get("whatsappDisplayPhone") ?? current.channels.whatsapp.displayPhone),
      },
      email: {
        fromAddress: String(formData.get("emailFrom") ?? current.channels.email.fromAddress),
        provider: String(formData.get("emailProvider") ?? current.channels.email.provider),
      },
      sms: {
        senderId: String(formData.get("smsSenderId") ?? current.channels.sms.senderId),
      },
    },
    shopify: {
      adminAccessToken: String(formData.get("shopifyAdminAccessToken") ?? current.shopify.adminAccessToken),
      webhookSecret: String(formData.get("shopifyWebhookSecret") ?? current.shopify.webhookSecret),
      apiVersion: String(formData.get("shopifyApiVersion") ?? current.shopify.apiVersion) || "2025-01",
    },
  };

  try {
    await updateWorkspace(workspace.active.id, {
      name: String(formData.get("name") ?? workspace.active.name).trim() || workspace.active.name,
      legal_name: String(formData.get("legalName") ?? ""),
      location: String(formData.get("location") ?? ""),
      domain: String(formData.get("domain") ?? ""),
      logo_url: String(formData.get("logoUrl") ?? ""),
      primary_color: String(formData.get("primaryColor") ?? workspace.active.primaryColor),
      accent_color: String(formData.get("accentColor") ?? workspace.active.accentColor),
      sender_name: String(formData.get("senderName") ?? workspace.active.senderName),
      information_officer: {
        name: String(formData.get("informationOfficerName") ?? ""),
        email: String(formData.get("informationOfficerEmail") ?? ""),
      },
      ...(workspace.role === "agency_owner"
        ? { sending_enabled: formData.get("sendingEnabled") === "on" }
        : {}),
      settings,
    });
    const hasShopify = Boolean(settings.shopify.adminAccessToken.trim() || settings.shopify.webhookSecret.trim());
    await setShopifyPlanStatus(workspace.active.id, hasShopify ? "credentials_saved" : "not_connected");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save settings." };
  }

  revalidatePath(`/agency/${slug}/settings`);
  revalidatePath("/agency");
  revalidatePath("/command-centre");
  return { ok: true, message: "Workspace settings saved." };
}

export async function addWorkspaceMember(
  _state: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await resolveWorkspace(slug);
  if (workspace.mode !== "member" || !canEdit(workspace.role, workspace.mode) || workspace.active.slug !== slug) {
    return { ok: false, message: "Sign in as an agency or client admin to add users." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "client_user");
  if (!email.includes("@")) return { ok: false, message: "Enter the person's email." };
  if (!MEMBERSHIP_ROLES.includes(role as MembershipRole)) return { ok: false, message: "Choose a valid role." };
  if ((role === "agency_owner" || role === "agency_staff") && workspace.role !== "agency_owner") {
    return { ok: false, message: "Only an agency owner can grant agency roles." };
  }
  if (workspace.active.orgType === "client" && (role === "agency_owner" || role === "agency_staff")) {
    return { ok: false, message: "Agency roles belong on the AI AutoTech workspace." };
  }

  try {
    await addMembership(workspace.active.id, email, role as MembershipRole);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not add that user." };
  }
  revalidatePath(`/agency/${slug}/settings`);
  return { ok: true, message: `${email} can now open this workspace.` };
}

export async function createInvitation(
  _state: TenantActionState,
  formData: FormData,
): Promise<TenantActionState> {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await resolveWorkspace(slug);
  if (workspace.mode !== "member" || !canEdit(workspace.role, workspace.mode) || workspace.active.slug !== slug) {
    return { ok: false, message: "Sign in as an admin to invite someone." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "client_user");
  if (!email.includes("@")) return { ok: false, message: "Enter the person's email." };
  if (!MEMBERSHIP_ROLES.includes(role as MembershipRole)) return { ok: false, message: "Choose a valid role." };
  if ((role === "agency_owner" || role === "agency_staff") && workspace.role !== "agency_owner") {
    return { ok: false, message: "Only an agency owner can invite agency roles." };
  }
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  const token = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("invitations").insert({
    org_id: workspace.active.id,
    email,
    role,
    token_hash: tokenHash,
    invited_by: user.data.user?.id ?? null,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Share this link with ${email}: /invite/${token}` };
}

export async function acceptInvitation(token: string): Promise<TenantActionState> {
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) return { ok: false, message: "Sign in with the invited email, then accept." };
  const { error } = await supabase.rpc("accept_invitation", { raw_token: token });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Invitation accepted. Open the workspace from the switcher." };
}

"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveWorkspace } from "@/lib/tenant/context";
import { addMembership, createClientWorkspace, findOrgBySlug, updateWorkspace } from "@/lib/tenant/data";
import { parseSettings } from "@/lib/tenant/rows";
import { MEMBERSHIP_ROLES, WORKSPACE_COOKIE, type MembershipRole } from "@/lib/tenant/types";

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
  store.set(WORKSPACE_COOKIE, workspace.active.slug, { httpOnly: true, sameSite: "lax", path: "/" });
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
  const blueprintKey = String(formData.get("blueprint") ?? "agency") === "education" ? "education" : "agency";
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
      settings,
    });
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

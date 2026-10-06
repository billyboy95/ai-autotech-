"use server";

import { revalidatePath } from "next/cache";
import {
  duplicateIdempotencyKey,
  FIXTURE_DUPLICATE_COPY,
  normalizeSwap,
  parseServices,
  validateSwap,
  workspaceTemplatesMode,
  type BusinessSwap,
} from "@/lib/snapshots/swap";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/tenant/context";

export type DuplicateState = {
  ok: boolean;
  created: boolean;
  mode: "fixture" | "sandbox";
  message: string;
  slug: string;
};

function swapFromForm(formData: FormData): BusinessSwap {
  return normalizeSwap({
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    primary_colour: String(formData.get("primary_colour") ?? ""),
    accent_colour: String(formData.get("accent_colour") ?? ""),
    logo_url: String(formData.get("logo_url") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    hours: String(formData.get("hours") ?? ""),
    booking_url: String(formData.get("booking_url") ?? ""),
    services_text: "",
    services: parseServices(String(formData.get("services") ?? "")),
  });
}

function missingDuplicateMigration(message: string) {
  return /duplicate_workspace|does not exist|schema cache|could not find/i.test(message);
}

export async function duplicateWorkspace(_state: DuplicateState, formData: FormData): Promise<DuplicateState> {
  const workspace = await resolveWorkspace();
  const forceFixture = String(formData.get("forceFixture") ?? "") === "1";
  const mode = workspaceTemplatesMode({ tenantMode: workspace.mode, forceFixture });
  const swap = swapFromForm(formData);
  const issues = validateSwap(swap);
  if (issues.length) {
    return { ok: false, created: false, mode, message: issues[0], slug: "" };
  }

  if (mode === "fixture" || !workspace.canManageAgency) {
    return {
      ok: false,
      created: false,
      mode: "fixture",
      message: workspace.canManageAgency || workspace.mode === "preview" ? FIXTURE_DUPLICATE_COPY : "Sign in as an agency owner or staff member.",
      slug: "",
    };
  }

  const rawSource = String(formData.get("source") ?? "");
  const splitAt = rawSource.indexOf(":");
  const sourceKind = rawSource.slice(0, splitAt);
  const sourceId = rawSource.slice(splitAt + 1);
  if (sourceKind !== "snapshot" && sourceKind !== "workspace") {
    return { ok: false, created: false, mode, message: "Pick a template or a workspace.", slug: "" };
  }
  if (!sourceId) {
    return { ok: false, created: false, mode, message: "Pick a template or a workspace.", slug: "" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("duplicate_workspace", {
    p_source_kind: sourceKind,
    p_source_id: sourceId,
    p_swap: swap,
    p_idempotency_key: duplicateIdempotencyKey(sourceKind, sourceId, swap.slug),
  });
  if (error) {
    return {
      ok: false,
      created: false,
      mode,
      message: missingDuplicateMigration(error.message)
        ? "Apply supabase/migrations/20261112120000_phase5p_workspace_templates.sql before a workspace is created. Nothing was written."
        : error.message,
      slug: "",
    };
  }

  const created = data as { slug?: string; sending_enabled?: boolean; created?: boolean; idempotent?: boolean } | null;
  if (!created?.slug || created.sending_enabled !== false) {
    return { ok: false, created: false, mode, message: "The workspace was not created. Sending stays off.", slug: "" };
  }
  revalidatePath("/agency");
  revalidatePath("/agency/duplicate");
  return {
    ok: true,
    created: Boolean(created.created),
    mode,
    slug: created.slug,
    message: created.idempotent
      ? `${created.slug} already exists for this swap. Sending stays off. Nothing was charged.`
      : `${created.slug} is ready. Sending stays off. Workflows and templates are inactive drafts. Nothing was charged.`,
  };
}

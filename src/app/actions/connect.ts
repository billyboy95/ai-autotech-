"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountByKey, missingConnectMigration } from "@/lib/connect/accounts";
import { draftContacts, importSummary, previewContactImport } from "@/lib/connect/import-csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

function withNotice(path: string, message: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}notice=${encodeURIComponent(message)}`);
}

async function manageable(slug: string) {
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.mode !== "member" || workspace.active.slug !== slug || !canManage(workspace.role)) return null;
  return workspace;
}

/** Sandbox checklist only. No secret is stored and no provider is called. */
export async function markConnectAccount(formData: FormData) {
  const back = "/command-centre/connect-accounts";
  const secretish = ["secret", "api_key", "token", "key", "merchant_key"].some((name) => String(formData.get(name) ?? "").trim());
  if (secretish) withNotice(back, "No key is stored. Nothing was sent.");
  const account = accountByKey(String(formData.get("account") ?? ""));
  if (!account) withNotice(back, "That account is not on the checklist. Nothing was stored and nothing was sent.");
  const workspace = await manageable(String(formData.get("slug") ?? ""));
  if (!workspace) withNotice(back, "Sandbox stub. No account was saved, no key was stored, and nothing was sent.");

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("mark_connect_account", {
    p_org: workspace.active.id,
    p_account_key: account.key,
  });
  if (saved.error) {
    if (missingConnectMigration(saved.error.message)) {
      withNotice(back, "Sandbox stub. Apply step 24 before saving connect progress. No key was stored and nothing was sent.");
    }
    withNotice(back, saved.error.message);
  }
  const payload = saved.data as {
    sandbox?: boolean;
    charged?: boolean;
    secret_stored?: boolean;
    status?: string;
  } | null;
  if (!payload || payload.sandbox !== true || payload.charged === true || payload.secret_stored === true || payload.status !== "needs_keys") {
    withNotice(back, "The checklist was refused. No key was stored and nothing was sent.");
  }
  revalidatePath(back);
  withNotice(back, `${account.label} needs keys. No provider was called, no key was stored, and nothing was sent.`);
}

/** Stores a sandbox draft. It does not write crm_outbox and it does not send. */
export async function importContactsToSandbox(formData: FormData) {
  const back = "/command-centre/import-contacts";
  const file = formData.get("file");
  let csv = String(formData.get("csv") ?? "");
  if (!csv.trim() && file instanceof File && file.size > 0) {
    if (file.size > 500_000) withNotice(back, "That file is too large. Nothing was stored and nothing was sent.");
    csv = await file.text();
  }
  if (csv.length > 500_000) withNotice(back, "That file is too large. Nothing was stored and nothing was sent.");
  const preview = previewContactImport(csv);
  if (preview.error) withNotice(back, `${preview.error} Nothing was stored and nothing was sent.`);
  const rows = draftContacts(preview);
  if (!rows.length) withNotice(back, "No contact passed the dry run. Nothing was stored and nothing was sent.");

  const workspace = await manageable(String(formData.get("slug") ?? ""));
  if (!workspace) withNotice(back, "Sandbox stub. The import draft was not stored. Nothing was sent.");

  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("save_contact_import_draft", {
    p_org: workspace.active.id,
    p_rows: rows,
    p_summary: importSummary(preview),
  });
  if (saved.error) {
    if (missingConnectMigration(saved.error.message)) {
      withNotice(back, "Sandbox stub. Apply step 24 before importing contacts. Nothing was stored and nothing was sent.");
    }
    withNotice(back, saved.error.message);
  }
  const payload = saved.data as {
    stored?: number;
    sandbox?: boolean;
    charged?: boolean;
    sent?: boolean;
    sending_enabled?: boolean;
  } | null;
  if (!payload || payload.sandbox !== true || payload.charged === true || payload.sent === true || payload.sending_enabled === true || payload.stored !== rows.length) {
    withNotice(back, "The import draft was refused. Nothing was sent.");
  }
  revalidatePath(back);
  withNotice(back, `Imported ${payload.stored} contact${payload.stored === 1 ? "" : "s"} to the sandbox draft. Nothing was sent.`);
}

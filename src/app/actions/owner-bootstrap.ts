"use server";

import { revalidatePath } from "next/cache";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadDocumentedOwnerAuth } from "@/server/workers/owner-auth-status";
import {
  FIXTURE_OWNER_COPY,
  FIXTURE_OWNER_SQL,
  SECRET_REFUSAL_COPY,
  buildOwnerBootstrap,
  formCarriesSecret,
  missingOwnerBootstrap,
  noteAccepted,
  planOwnerBootstrapNote,
  type OwnerBootstrapMode,
} from "@/lib/owner/bootstrap";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

export type OwnerNoteState = {
  stored: boolean;
  write: boolean;
  mode: OwnerBootstrapMode;
  message: string;
};

function canManage(role: string | null) {
  return isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

export async function recordOwnerBootstrapNote(
  _state: OwnerNoteState,
  formData: FormData,
): Promise<OwnerNoteState> {
  if (formCarriesSecret(formData)) {
    return { stored: false, write: false, mode: "fixture", message: SECRET_REFUSAL_COPY };
  }

  const { tenant } = await loadCommandData();
  const plan = planOwnerBootstrapNote({ tenantMode: tenant.mode });
  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;

  if (!plan.write || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      stored: false,
      write: false,
      mode: plan.mode,
      message: plan.write ? "Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run." : plan.message || FIXTURE_OWNER_COPY,
    };
  }

  const observed = await loadDocumentedOwnerAuth(tenant.mode);
  const model = buildOwnerBootstrap({
    tenantMode: tenant.mode,
    authUser: observed.authUser,
    membership: observed.membership,
  });
  if (model.sqlText === FIXTURE_OWNER_SQL) {
    return { stored: false, write: false, mode: "fixture", message: FIXTURE_OWNER_COPY };
  }
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("record_owner_bootstrap_note", {
    p_org: tenant.active.id,
    p_owner_emails: model.ownerEmails,
    p_auth_attach: model.authAttach,
    p_checksum: model.checksum,
  });
  if (saved.error) {
    const message = missingOwnerBootstrap(saved.error.message)
      ? "Apply step 34 before a sandbox note is stored. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run."
      : "The note was not stored. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.";
    return { stored: false, write: false, mode: "sandbox", message };
  }

  const payload = saved.data as {
    stored?: boolean;
    sandbox?: boolean;
    charged?: boolean;
    status?: string;
    owner_emails?: string;
    auth_attach?: string;
    applied?: boolean;
    created_user?: boolean;
    sending_enabled?: boolean;
    secret?: unknown;
    value?: unknown;
    sql?: unknown;
    email?: unknown;
  } | null;
  if (!noteAccepted(payload)) {
    return {
      stored: false,
      write: false,
      mode: "sandbox",
      message: "The note was refused. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.",
    };
  }

  revalidatePath("/command-centre");
  revalidatePath("/command-centre/setup");
  revalidatePath("/command-centre/owner");
  revalidatePath("/agency");
  return {
    stored: true,
    write: true,
    mode: "sandbox",
    message: "Sandbox note stored. No email was stored. An Auth user was not created. owner-bootstrap.sql was not run. Nothing is sent.",
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSalesAgentsEnabled } from "@/lib/sales-agents/flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF = new Set(["agency_owner", "agency_staff", "client_admin"]);
const PATH = "/command-centre/approvals";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function staffContext() {
  if (!isSalesAgentsEnabled()) redirect(`${PATH}?notice=fixture`);
  const tenant = await safeResolveWorkspace();
  if (tenant.requiresLogin || tenant.mode !== "member" || !tenant.role || !STAFF.has(tenant.role)) {
    redirect(`/login?next=${encodeURIComponent(PATH)}`);
  }
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect(`/login?next=${encodeURIComponent(PATH)}`);
  return { supabase, orgId: tenant.active.id };
}

async function decide(formData: FormData, action: "approve" | "reject" | "edit") {
  const id = text(formData, "id");
  const { supabase, orgId } = await staffContext();
  if (!UUID.test(id) || !UUID.test(orgId)) redirect(`${PATH}?notice=ignored`);
  const saved = await supabase.rpc("decide_sales_draft", {
    p_org: orgId,
    p_draft: id,
    p_action: action,
    p_body: text(formData, "body").slice(0, 4000),
  });
  if (saved.error) redirect(`${PATH}?notice=held`);
  revalidatePath(PATH);
  revalidatePath("/command-centre/outbox");
  redirect(PATH);
}

export async function approveSalesDraft(formData: FormData) {
  await decide(formData, "approve");
}

export async function rejectSalesDraft(formData: FormData) {
  await decide(formData, "reject");
}

export async function editSalesDraft(formData: FormData) {
  await decide(formData, "edit");
}

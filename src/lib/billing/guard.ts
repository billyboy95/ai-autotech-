import { createSupabaseServerClient } from "@/lib/supabase/server";

function missingRelation(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find");
}

export async function workspaceSubscriptionStatus(orgId: string) {
  if (!orgId || orgId.startsWith("preview-")) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("org_subscriptions").select("status, past_due_at").eq("org_id", orgId).maybeSingle();
  if (error) {
    if (missingRelation(error)) return null;
    return null;
  }
  if (!data?.status) return null;
  return { status: String(data.status), pastDueAt: data.past_due_at ? String(data.past_due_at) : null };
}

export function suspendedWriteMessage(status: string | null | undefined) {
  if (status === "suspended") {
    return "This workspace is suspended. It is read-only and sending stays off until billing is settled.";
  }
  return null;
}

export async function workspaceWriteBlock(orgId: string) {
  const row = await workspaceSubscriptionStatus(orgId);
  return suspendedWriteMessage(row?.status);
}

export function billingBanner(status: string | null | undefined) {
  if (status === "suspended") {
    return {
      text: "This workspace is suspended. Sending is off and changes are read-only until billing is settled. Checkout on the billing page does not send a live charge.",
      tone: "block" as const,
    };
  }
  if (status === "past_due") {
    return {
      text: "A payment failed. This workspace is past due and will be suspended 7 days after the failed charge. Sending stays off.",
      tone: "warn" as const,
    };
  }
  return null;
}

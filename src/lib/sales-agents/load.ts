import { createSupabaseServerClient } from "@/lib/supabase/server";
import { salesAgentsDisplayMode } from "@/lib/sales-agents/flag";
import { FIXTURE_COPY, fixtureApprovalQueue, fixtureDraftId } from "@/lib/sales-agents/preview";
import type { ChecklistItem, PlannedDraft, PlannedNotice } from "@/lib/sales-agents/plan";

const CHECKLIST_KEYS = ["connect_accounts", "import_contacts", "apply_template", "book_kickoff"] as const;

function checklistKey(value: string): ChecklistItem["key"] | null {
  return (CHECKLIST_KEYS as readonly string[]).includes(value) ? (value as ChecklistItem["key"]) : null;
}

export type QueueDraft = {
  id: string;
  leadId: string;
  kind: string;
  step: string;
  channel: string;
  status: "draft" | "approved" | "rejected" | "skipped";
  skipReason: string;
  subject: string;
  body: string;
  scheduledFor: string;
};

export type ApprovalQueue = {
  mode: "fixture" | "live";
  notice: string;
  sendingEnabled: boolean;
  drafts: QueueDraft[];
  checklist: ChecklistItem[];
  summary: PlannedNotice;
};

function asStatus(value: string): QueueDraft["status"] {
  if (value === "approved" || value === "rejected" || value === "skipped") return value;
  return "draft";
}

function fromPlan(draft: PlannedDraft, index: number): QueueDraft {
  return {
    id: fixtureDraftId(draft, index),
    leadId: draft.leadId,
    kind: draft.kind,
    step: draft.step,
    channel: draft.channel,
    status: draft.status,
    skipReason: draft.skipReason,
    subject: draft.subject,
    body: draft.body,
    scheduledFor: draft.scheduledFor,
  };
}

export async function loadApprovalQueue(input: { tenantMode: string; orgId: string; sendingEnabled: boolean }): Promise<ApprovalQueue> {
  const fixture = fixtureApprovalQueue();
  const mode = salesAgentsDisplayMode({ tenantMode: input.tenantMode });
  if (mode === "fixture" || input.orgId.startsWith("preview-")) {
    return {
      mode: "fixture",
      notice: FIXTURE_COPY,
      sendingEnabled: false,
      drafts: fixture.drafts.map(fromPlan),
      checklist: fixture.checklist.items,
      summary: { ...fixture.summary, title: "Daily summary (sample)" },
    };
  }

  const base: ApprovalQueue = {
    mode: "live",
    notice: "Sending is off. Approve queues a message into the outbox. This page does not send it.",
    sendingEnabled: input.sendingEnabled,
    drafts: [],
    checklist: [],
    summary: fixture.summary,
  };

  try {
    const supabase = await createSupabaseServerClient();
    const listed = await supabase
      .from("crm_sales_drafts")
      .select("id, lead_id, kind, step, channel, status, skip_reason, subject, body, scheduled_for")
      .eq("org_id", input.orgId)
      .order("scheduled_for", { ascending: true })
      .limit(40);
    if (!listed.error && listed.data) {
      base.drafts = listed.data.map((row) => ({
        id: String(row.id),
        leadId: String(row.lead_id || ""),
        kind: String(row.kind || ""),
        step: String(row.step || ""),
        channel: String(row.channel || ""),
        status: asStatus(String(row.status || "")),
        skipReason: String(row.skip_reason || ""),
        subject: String(row.subject || ""),
        body: String(row.body || ""),
        scheduledFor: String(row.scheduled_for || ""),
      }));
    }
    const open = await supabase
      .from("crm_client_onboarding")
      .select("id")
      .eq("org_id", input.orgId)
      .order("created_at", { ascending: false })
      .limit(1);
    const checklistId = open.data?.[0]?.id ? String(open.data[0].id) : "";
    if (checklistId) {
      const items = await supabase
        .from("crm_client_onboarding_items")
        .select("item_key, title, href, detail, ord")
        .eq("checklist_id", checklistId)
        .order("ord", { ascending: true });
      if (!items.error && items.data) {
        base.checklist = items.data.flatMap((row) => {
          const key = checklistKey(String(row.item_key || ""));
          if (!key) return [];
          return [{ key, title: String(row.title || key), href: String(row.href || ""), detail: String(row.detail || "") }];
        });
      }
    }
    const waiting = base.drafts.filter((item) => item.status === "draft").length;
    base.summary = {
      kind: "summary",
      title: "Approval queue",
      body: `Drafts waiting: ${waiting}\nSending stays off until Billy turns it on for this workspace.`,
      href: "/command-centre/approvals",
      leadId: "",
      dedupeKey: "summary:live",
    };
    if (input.sendingEnabled) {
      base.notice = "Sending is on for this workspace. Approving still only queues the outbox. This page does not send.";
    }
    return base;
  } catch {
    return { ...base, notice: "The approval queue could not be read. Nothing was sent." };
  }
}

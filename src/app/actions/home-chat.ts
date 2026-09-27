"use server";

import { revalidatePath } from "next/cache";
import { buildReport } from "@/lib/automation/report";
import type { LeadRecord } from "@/lib/automation/types";
import { loadCommandData } from "@/lib/automation/page-data";
import {
  answerHomeChat,
  emptySnapshot,
  fixtureSnapshot,
  type HomeChatDraft,
  type HomeChatPerson,
  type HomeChatSnapshot,
  type HomeChatState,
} from "@/lib/home-chat/engine";
import { homeChatDisplayMode, missingHomeChatMigration } from "@/lib/home-chat/flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole } from "@/lib/tenant/types";

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

function peopleFromLeads(leads: LeadRecord[]): HomeChatPerson[] {
  return leads.map((lead) => ({
    id: lead.id,
    kind: "lead" as const,
    name: lead.name,
    company: lead.company,
    phone: lead.phone || lead.whatsapp,
    email: lead.email,
    stage: lead.stage,
    score: lead.score,
    valueZar: lead.valueZar || 0,
  }));
}

function snapshotFromPeople(people: HomeChatPerson[], report: ReturnType<typeof buildReport>): HomeChatSnapshot {
  return {
    people,
    pipelineValueZar: report.pipelineValueZar,
    newToday: report.newToday,
    perStage: report.perStage.map((row) => ({ stage: row.stage, count: row.count, valueZar: row.valueZar })),
    stuck: report.stuck.map((row) => ({ id: row.id, name: row.name, stage: row.stage, reason: row.reason })),
  };
}

async function loadContactPeople(orgId: string): Promise<HomeChatPerson[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, email, phone_e164, company")
    .eq("org_id", orgId)
    .is("erased_at", null)
    .limit(200);
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    kind: "contact" as const,
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.replace(/\s+/g, " ").trim() || "Contact",
    company: String(row.company ?? ""),
    phone: String(row.phone_e164 ?? ""),
    email: String(row.email ?? ""),
    stage: "",
    score: 0,
    valueZar: 0,
  }));
}

function mergePeople(leads: HomeChatPerson[], contacts: HomeChatPerson[]) {
  const emails = new Set(leads.map((person) => person.email.trim().toLowerCase()).filter(Boolean));
  const phones = new Set(leads.map((person) => person.phone.replace(/\D/g, "")).filter((phone) => phone.length >= 8));
  const extra = contacts.filter((person) => {
    const email = person.email.trim().toLowerCase();
    const phone = person.phone.replace(/\D/g, "");
    if (email && emails.has(email)) return false;
    if (phone.length >= 8 && phones.has(phone)) return false;
    return true;
  });
  return [...leads, ...extra];
}

type SavedDraft = {
  status?: string;
  sandbox?: boolean;
  charged?: boolean;
  sent?: boolean;
  queued?: boolean;
  outbox_id?: string | null;
  outbox_status?: string | null;
};

async function storeDraft(orgId: string, draft: HomeChatDraft) {
  const supabase = await createSupabaseServerClient();
  const saved = await supabase.rpc("save_home_chat_draft", {
    p_org: orgId,
    p_kind: draft.kind,
    p_title: draft.title.slice(0, 160),
    p_body: draft.body.slice(0, 2000),
    p_lead_ref: draft.leadRef.slice(0, 80),
    p_lead_name: draft.leadName.slice(0, 120),
    p_channel: draft.channel,
  });
  if (saved.error) return { ok: false as const, missing: missingHomeChatMigration(saved.error.message), message: saved.error.message };
  const payload = saved.data as SavedDraft | null;
  if (
    !payload
    || payload.sandbox !== true
    || payload.charged === true
    || payload.sent === true
    || payload.queued === true
    || payload.status !== "draft"
    || (payload.outbox_status != null && payload.outbox_status !== "draft")
  ) {
    return { ok: false as const, missing: false, message: "The draft was refused. Nothing was sent." };
  }
  return { ok: true as const, outboxId: payload.outbox_id || "" };
}

export async function askHomeChat(_state: HomeChatState, formData: FormData): Promise<HomeChatState> {
  const request = String(formData.get("request") ?? "").trim().slice(0, 500);
  const { workspace, tenant } = await loadCommandData();
  const mode = homeChatDisplayMode({ tenantMode: tenant.mode });
  const live = peopleFromLeads(workspace.state.leads);
  let snapshot: HomeChatSnapshot;
  if (live.length || tenant.mode === "member") {
    const report = buildReport(workspace.state, new Date(), false);
    const contacts = tenant.mode === "member" ? await loadContactPeople(tenant.active.id) : [];
    snapshot = snapshotFromPeople(mergePeople(live, contacts), report);
  } else {
    snapshot = fixtureSnapshot();
  }
  if (!snapshot.people.length && tenant.mode !== "preview") snapshot = emptySnapshot();
  const answer = answerHomeChat(request, snapshot);
  const base: HomeChatState = {
    ...answer,
    id: crypto.randomUUID(),
    request,
    mode,
    persisted: false,
  };
  if (!answer.drafts.length) return base;

  const slug = String(formData.get("slug") ?? "");
  const sameWorkspace = !slug || slug === tenant.active.slug;
  if (mode !== "sandbox" || tenant.mode !== "member" || !canManage(tenant.role) || !sameWorkspace) {
    return {
      ...base,
      message: `${answer.message} Fixture only. This draft is not stored.`,
    };
  }

  let outboxId = "";
  for (const draft of answer.drafts) {
    const stored = await storeDraft(tenant.active.id, draft);
    if (!stored.ok) {
      const message = stored.missing
        ? "Apply step 25 before a draft is stored. Nothing was sent."
        : stored.message.includes("Nothing was sent")
          ? stored.message
          : `${stored.message} Nothing was sent.`;
      return { ...base, message };
    }
    outboxId = stored.outboxId || outboxId;
  }

  revalidatePath("/command-centre");
  revalidatePath("/command-centre/assistant");
  revalidatePath("/command-centre/outbox");
  const storedLine = outboxId
    ? "Stored in the outbox as a draft."
    : "Stored as a sandbox draft.";
  return {
    ...base,
    persisted: true,
    message: `${answer.message} ${storedLine}`,
  };
}

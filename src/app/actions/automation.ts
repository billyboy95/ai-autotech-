"use server";

import { revalidatePath } from "next/cache";
import { nid } from "@/lib/crm-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { importProspectCsv, saveCampaign } from "@/lib/automation/campaigns";
import {
  addNote,
  advanceHandovers,
  approveMessage,
  cancelMessage,
  markWon,
  setMarketingConsent,
  setStage,
  setTaskDone,
  updateSettings,
  updateTemplate,
} from "@/lib/automation/engine";
import { approveSocialPost, cancelSocialPost, queueSocialPost } from "@/lib/automation/social";
import { newId } from "@/lib/automation/ids";
import { enrollLead, isDemoMode, mutateWorkspace, runAutomationJob } from "@/lib/automation/service";
import { normalizeStage, PIPELINE_STAGES, type AssignmentRule, type CampaignStep, type PipelineStage, type SocialPlatform } from "@/lib/automation/types";

function refresh() {
  revalidatePath("/command-centre");
  revalidatePath("/command-centre/pipeline");
  revalidatePath("/command-centre/outbox");
  revalidatePath("/command-centre/templates");
  revalidatePath("/command-centre/summary");
  revalidatePath("/command-centre/settings");
  revalidatePath("/command-centre/campaigns");
  revalidatePath("/command-centre/social");
  revalidatePath("/command-centre/leads/[id]", "page");
}

export async function addPipelineLead(formData: FormData) {
  const input = {
    id: nid(),
    name: String(formData.get("name") || "").trim() || "Unnamed",
    company: String(formData.get("company") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    source: "command_centre",
    companySize: String(formData.get("companySize") || "").trim(),
  };
  const enrolled = await enrollLead(input);
  if (!enrolled.ok) {
    if (isDemoMode()) throw new Error(enrolled.error || "Could not save the lead.");
    const supabase = createSupabaseAdminClient();
    if (!supabase) throw new Error(enrolled.error || "Lead storage is not configured.");
    const inserted = await supabase.from("crm_leads").insert({
      id: input.id,
      name: input.name,
      company: input.company,
      phone: input.phone,
      stage: "New",
      notes: [input.email, input.notes].filter(Boolean).join("\n"),
      ord: -Math.floor(Date.now() / 1000),
    });
    if (inserted.error) throw new Error(inserted.error.message);
  }
  refresh();
}

export async function setLeadStage(id: string, stage: string) {
  const nextStage = normalizeStage(stage);
  if (!(PIPELINE_STAGES as readonly string[]).includes(nextStage)) {
    return { ok: false as const, error: "Unknown stage." };
  }
  try {
    const now = new Date();
    await mutateWorkspace((state) => {
      const updated = setStage(state, id, nextStage as PipelineStage, now, {
        lostReason: nextStage === "Lost" ? "Marked lost by hand" : undefined,
      });
      if (nextStage === "Won" || nextStage === "Onboarding/Handover") return advanceHandovers(updated, now);
      return updated;
    });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not update the stage." };
  }
}

export async function updateLeadStage(formData: FormData) {
  await setLeadStage(String(formData.get("id") || ""), String(formData.get("stage") || ""));
}

export async function markLeadWon(formData: FormData) {
  const id = String(formData.get("id") || "");
  const valueZar = Number(String(formData.get("valueZar") || "0").replace(/[^\d.]/g, "")) || 0;
  const whatSold = String(formData.get("whatSold") || "").trim();
  const now = new Date();
  await mutateWorkspace((state) => advanceHandovers(markWon(state, id, { valueZar, whatSold, deliveredBy: "Billy" }, now), now));
  refresh();
}

export async function setLeadConsent(formData: FormData) {
  const id = String(formData.get("id") || "");
  const consent = String(formData.get("consent") || "") === "true";
  await mutateWorkspace((state) => setMarketingConsent(state, { leadId: id }, consent, new Date()));
  refresh();
}

export async function setProspectConsent(formData: FormData) {
  const id = String(formData.get("id") || "");
  const consent = String(formData.get("consent") || "") === "true";
  await mutateWorkspace((state) => setMarketingConsent(state, { prospectId: id }, consent, new Date()));
  refresh();
}

export async function addLeadNote(formData: FormData) {
  const id = String(formData.get("id") || "");
  const body = String(formData.get("body") || "");
  await mutateWorkspace((state) => addNote(state, id, body, new Date()));
  refresh();
}

export async function toggleOnboardingTask(formData: FormData) {
  const id = String(formData.get("id") || "");
  const done = String(formData.get("done") || "") === "true";
  await mutateWorkspace((state) => setTaskDone(state, id, done));
  refresh();
}

export async function approveOutboxMessage(formData: FormData) {
  const id = String(formData.get("id") || "");
  await mutateWorkspace((state) => approveMessage(state, id, new Date()));
  refresh();
}

export async function cancelOutboxMessage(formData: FormData) {
  const id = String(formData.get("id") || "");
  await mutateWorkspace((state) => cancelMessage(state, id, new Date()));
  refresh();
}

export async function saveTemplate(formData: FormData) {
  const key = String(formData.get("key") || "");
  await mutateWorkspace((state) =>
    updateTemplate(state, key, {
      subject: String(formData.get("subject") || ""),
      body: String(formData.get("body") || ""),
      active: formData.get("active") === "on",
    }),
  );
  refresh();
}

export async function saveAutomationSettings(formData: FormData) {
  await mutateWorkspace((state) => {
    const team = String(formData.get("team") || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const rules: AssignmentRule[] = [0, 1, 2].flatMap((index) => {
      const owner = String(formData.get(`rule_owner_${index}`) || "").trim();
      const matchSource = String(formData.get(`rule_source_${index}`) || "").trim();
      const matchQrSource = String(formData.get(`rule_qr_${index}`) || "").trim();
      if (!owner || (!matchSource && !matchQrSource)) return [];
      return [
        {
          id: String(formData.get(`rule_id_${index}`) || `rule-${index}`),
          name: String(formData.get(`rule_name_${index}`) || "Rule").trim() || "Rule",
          active: true,
          matchSource,
          matchQrSource,
          owner,
        },
      ];
    });
    return updateSettings(state, {
      ...state.settings,
      defaultOwner: String(formData.get("defaultOwner") || "Billy").trim() || "Billy",
      strategy: String(formData.get("strategy") || "") === "round_robin" ? "round_robin" : "fixed",
      team: team.length ? team : ["Billy"],
      bookingUrl: String(formData.get("bookingUrl") || "").trim(),
      proposalFollowupDays: Number(formData.get("proposalFollowupDays") || 3),
      staleGraceDays: Number(formData.get("staleGraceDays") || 2),
      stuckAfterDays: Number(formData.get("stuckAfterDays") || 3),
      checklist: String(formData.get("checklist") || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      rules,
    });
  });
  refresh();
}

export async function runAutomationsNow() {
  await runAutomationJob();
  refresh();
}

export async function importCampaignCsv(formData: FormData) {
  const file = formData.get("file");
  let csv = String(formData.get("csv") || "");
  if (file instanceof File && file.size > 0) csv = await file.text();
  const campaignId = String(formData.get("campaignId") || "");
  await mutateWorkspace((state) => {
    const imported = importProspectCsv(state, csv, new Date(), campaignId);
    if (imported.error) throw new Error(imported.error);
    if (!imported.count) throw new Error("Every row was already in that campaign.");
    return imported.state;
  });
  refresh();
}

export async function saveCampaignForm(formData: FormData) {
  const id = String(formData.get("id") || "") || newId("cmp");
  const steps: CampaignStep[] = [0, 1, 2].flatMap((index) => {
    const body = String(formData.get(`body_${index}`) || "").trim();
    if (!body) return [];
    const channel = String(formData.get(`channel_${index}`) || "whatsapp");
    return [
      {
        id: String(formData.get(`step_${index}`) || "") || newId("stp"),
        channel: channel === "email" || channel === "sms" ? channel : "whatsapp",
        delayHours: Number(formData.get(`delay_${index}`) || 0),
        subject: String(formData.get(`subject_${index}`) || ""),
        body,
      },
    ];
  });
  const statusValue = String(formData.get("status") || "active");
  await mutateWorkspace((state) =>
    saveCampaign(state, {
      id,
      name: String(formData.get("name") || "Outbound prospects"),
      status: statusValue === "paused" || statusValue === "draft" ? statusValue : "active",
      steps,
      createdAt: String(formData.get("createdAt") || "") || new Date().toISOString(),
    }),
  );
  refresh();
}

export async function queueSocialPostForm(formData: FormData) {
  const platformValue = String(formData.get("platform") || "facebook");
  const platform: SocialPlatform = platformValue === "instagram" || platformValue === "linkedin" ? platformValue : "facebook";
  const body = String(formData.get("body") || "").trim();
  if (!body) throw new Error("Write the post before queueing it.");
  await mutateWorkspace((state) =>
    queueSocialPost(state, {
      platform,
      body,
      mediaUrl: String(formData.get("mediaUrl") || ""),
      linkUrl: String(formData.get("linkUrl") || ""),
      scheduledFor: fromJohannesburg(String(formData.get("scheduledFor") || "")),
      utmSource: String(formData.get("utmSource") || ""),
      utmCampaign: String(formData.get("utmCampaign") || ""),
    }),
  );
  refresh();
}

export async function approveSocial(formData: FormData) {
  const id = String(formData.get("id") || "");
  await mutateWorkspace((state) => approveSocialPost(state, id));
  refresh();
}

export async function cancelSocial(formData: FormData) {
  const id = String(formData.get("id") || "");
  await mutateWorkspace((state) => cancelSocialPost(state, id));
  refresh();
}

function fromJohannesburg(value: string) {
  if (!value.trim()) return new Date().toISOString();
  const stamp = value.length === 16 ? `${value}:00+02:00` : value;
  const date = new Date(stamp);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

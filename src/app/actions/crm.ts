"use server";

import { revalidatePath } from "next/cache";
import { nid, readCrm, writeCrm, type CrmData } from "@/lib/crm-store";
import { requireCrmSession } from "@/app/actions/crm-auth";

async function save(mutator: (data: CrmData) => void) {
  await requireCrmSession();
  const data = await readCrm();
  mutator(data);
  await writeCrm(data);
  revalidatePath("/command-centre");
}

export async function addLead(formData: FormData) {
  await save((data) => {
    data.leads.unshift({
      id: nid(),
      name: String(formData.get("name") || "").trim() || "Unnamed",
      company: String(formData.get("company") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      stage: "New",
      notes: String(formData.get("notes") || "").trim(),
    });
  });
}

export async function setLeadStage(id: string, stage: "New" | "Talking" | "Quoted" | "Won" | "Lost") {
  await save((data) => {
    const lead = data.leads.find((item) => item.id === id);
    if (lead) lead.stage = stage;
  });
}

export async function addClient(formData: FormData) {
  await save((data) => {
    data.clients.unshift({
      id: nid(),
      name: String(formData.get("name") || "").trim() || "Unnamed",
      person: String(formData.get("person") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      whatsapp: String(formData.get("whatsapp") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
    });
  });
}

export async function addJob(formData: FormData) {
  await save((data) => {
    data.jobs.unshift({
      id: nid(),
      client: String(formData.get("client") || "").trim() || "Unknown",
      title: String(formData.get("title") || "").trim() || "Job",
      kind: (String(formData.get("kind") || "Other") as "Website" | "WhatsApp" | "AI Employee" | "Other"),
      status: "Open",
    });
  });
}

export async function setJobStatus(id: string, status: "Open" | "Doing" | "Done") {
  await save((data) => {
    const job = data.jobs.find((item) => item.id === id);
    if (job) job.status = status;
  });
}

export async function addInvoice(formData: FormData) {
  await save((data) => {
    data.invoices.unshift({
      id: nid(),
      client: String(formData.get("client") || "").trim() || "Unknown",
      amount: String(formData.get("amount") || "").trim() || "0",
      status: "Unpaid",
    });
  });
}

export async function markInvoicePaid(id: string) {
  await save((data) => {
    const invoice = data.invoices.find((item) => item.id === id);
    if (invoice) invoice.status = "Paid on Yoco";
  });
}

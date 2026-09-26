"use server";

import { revalidatePath } from "next/cache";
import { isJobKind } from "@/lib/brand/catalog";
import { insertClient, insertInvoice, insertJob, nid, updateInvoiceStatus, updateJobStatus, type Job } from "@/lib/crm-store";

function refresh() {
  revalidatePath("/command-centre");
  revalidatePath("/agency");
  revalidatePath("/command-centre/clients");
  revalidatePath("/command-centre/jobs");
  revalidatePath("/command-centre/money");
}

export async function addClient(formData: FormData) {
  await insertClient({
    id: nid(),
    name: String(formData.get("name") || "").trim() || "Unnamed",
    person: String(formData.get("person") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    whatsapp: String(formData.get("whatsapp") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
  });
  refresh();
}

export async function addJob(formData: FormData) {
  await insertJob({
    id: nid(),
    client: String(formData.get("client") || "").trim() || "Unknown",
    title: String(formData.get("title") || "").trim() || "Job",
    kind: isJobKind(String(formData.get("kind") || "")) ? (String(formData.get("kind")) as Job["kind"]) : "Professional Websites",
    status: "Open",
  });
  refresh();
}

export async function setJobStatus(id: string, status: "Open" | "Doing" | "Done") {
  await updateJobStatus(id, status);
  refresh();
}

export async function addInvoice(formData: FormData) {
  await insertInvoice({
    id: nid(),
    client: String(formData.get("client") || "").trim() || "Unknown",
    amount: String(formData.get("amount") || "").trim() || "0",
    status: "Unpaid",
  });
  refresh();
}

export async function markInvoicePaid(id: string) {
  await updateInvoiceStatus(id, "Paid on Yoco");
  refresh();
}

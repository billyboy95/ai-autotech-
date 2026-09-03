import { promises as fs } from "fs";
import path from "path";

export type Lead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  stage: "New" | "Talking" | "Quoted" | "Won" | "Lost";
  notes: string;
};

export type Client = {
  id: string;
  name: string;
  person: string;
  phone: string;
  whatsapp: string;
  notes: string;
};

export type Job = {
  id: string;
  client: string;
  title: string;
  kind: "Website" | "WhatsApp" | "AI Employee" | "Other";
  status: "Open" | "Doing" | "Done";
};

export type Invoice = {
  id: string;
  client: string;
  amount: string;
  status: "Unpaid" | "Paid on Yoco";
};

export type CrmData = {
  leads: Lead[];
  clients: Client[];
  jobs: Job[];
  invoices: Invoice[];
};

const file = path.join(process.cwd(), "data", "crm.json");

export async function readCrm(): Promise<CrmData> {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as CrmData;
}

export async function writeCrm(data: CrmData) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export function nid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

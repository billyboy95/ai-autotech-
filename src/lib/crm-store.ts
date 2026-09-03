import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

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

const SEED_CLIENT: Client = {
  id: "eastc",
  name: "EASTC Holdings",
  person: "CEO",
  phone: "",
  whatsapp: "",
  notes: "Existing work: eastech.co.za, foundation, institute",
};

const SEED_JOB: Job = {
  id: "job-sites",
  client: "EASTC Holdings",
  title: "Campus websites",
  kind: "Website",
  status: "Done",
};

type Ordered<T> = T & { ord: number };

function requireAdmin(): SupabaseClient {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error(
      "CRM store requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Filesystem JSON is not used.",
    );
  }
  return client;
}

function throwQuery(error: { message: string } | null, table: string) {
  if (error) {
    throw new Error(
      `CRM store failed on ${table}: ${error.message}. Apply supabase/migrations/20260903000000_company_crm.sql.`,
    );
  }
}

export function nid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function asLead(row: Lead): Lead {
  return {
    id: row.id,
    name: row.name ?? "",
    company: row.company ?? "",
    phone: row.phone ?? "",
    stage: row.stage,
    notes: row.notes ?? "",
  };
}

function asClient(row: Client): Client {
  return {
    id: row.id,
    name: row.name ?? "",
    person: row.person ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    notes: row.notes ?? "",
  };
}

function asJob(row: Job): Job {
  return {
    id: row.id,
    client: row.client ?? "",
    title: row.title ?? "",
    kind: row.kind,
    status: row.status,
  };
}

function asInvoice(row: Invoice): Invoice {
  return {
    id: row.id,
    client: row.client ?? "",
    amount: row.amount ?? "0",
    status: row.status,
  };
}

async function replaceTable<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
) {
  const existing = await supabase.from(table).select("id");
  throwQuery(existing.error, table);

  const keep = new Set(rows.map((row) => row.id));
  const stale = (existing.data ?? [])
    .map((row) => (row as { id: string }).id)
    .filter((id) => !keep.has(id));

  if (stale.length) {
    const deleted = await supabase.from(table).delete().in("id", stale);
    throwQuery(deleted.error, table);
  }

  if (rows.length) {
    const payload = rows.map((row, ord) => ({ ...row, ord }));
    const upserted = await supabase.from(table).upsert(payload);
    throwQuery(upserted.error, table);
  }
}

async function ensureSeed(supabase: SupabaseClient, data: CrmData): Promise<CrmData> {
  const clientUpsert = await supabase.from("crm_clients").upsert({ ...SEED_CLIENT, ord: 0 });
  throwQuery(clientUpsert.error, "crm_clients");
  const jobUpsert = await supabase.from("crm_jobs").upsert({ ...SEED_JOB, ord: 0 });
  throwQuery(jobUpsert.error, "crm_jobs");

  const clients = data.clients.some((client) => client.id === SEED_CLIENT.id)
    ? data.clients.map((client) => (client.id === SEED_CLIENT.id ? SEED_CLIENT : client))
    : [...data.clients, SEED_CLIENT];

  const jobs = data.jobs.some((job) => job.id === SEED_JOB.id)
    ? data.jobs.map((job) => (job.id === SEED_JOB.id ? SEED_JOB : job))
    : [...data.jobs, SEED_JOB];

  return { ...data, clients, jobs };
}

export async function readCrm(): Promise<CrmData> {
  const supabase = requireAdmin();

  const [leads, clients, jobs, invoices] = await Promise.all([
    supabase.from("crm_leads").select("id, name, company, phone, stage, notes").order("ord", { ascending: true }),
    supabase.from("crm_clients").select("id, name, person, phone, whatsapp, notes").order("ord", { ascending: true }),
    supabase.from("crm_jobs").select("id, client, title, kind, status").order("ord", { ascending: true }),
    supabase.from("crm_invoices").select("id, client, amount, status").order("ord", { ascending: true }),
  ]);

  throwQuery(leads.error, "crm_leads");
  throwQuery(clients.error, "crm_clients");
  throwQuery(jobs.error, "crm_jobs");
  throwQuery(invoices.error, "crm_invoices");

  return ensureSeed(supabase, {
    leads: ((leads.data ?? []) as Lead[]).map(asLead),
    clients: ((clients.data ?? []) as Client[]).map(asClient),
    jobs: ((jobs.data ?? []) as Job[]).map(asJob),
    invoices: ((invoices.data ?? []) as Invoice[]).map(asInvoice),
  });
}

export async function writeCrm(data: CrmData) {
  const supabase = requireAdmin();
  await replaceTable<Ordered<Lead>>(
    supabase,
    "crm_leads",
    data.leads.map((row, ord) => ({ ...asLead(row), ord })),
  );
  await replaceTable<Ordered<Client>>(
    supabase,
    "crm_clients",
    data.clients.map((row, ord) => ({ ...asClient(row), ord })),
  );
  await replaceTable<Ordered<Job>>(
    supabase,
    "crm_jobs",
    data.jobs.map((row, ord) => ({ ...asJob(row), ord })),
  );
  await replaceTable<Ordered<Invoice>>(
    supabase,
    "crm_invoices",
    data.invoices.map((row, ord) => ({ ...asInvoice(row), ord })),
  );
}

export async function createPublicLead(input: {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
}) {
  const data = await readCrm();
  const id = nid();
  const notes = [input.email, input.message].filter(Boolean).join("\n");

  data.leads.unshift({
    id,
    name: input.name || "Website lead",
    company: input.company,
    phone: input.phone,
    stage: "New",
    notes,
  });

  await writeCrm(data);
  return id;
}

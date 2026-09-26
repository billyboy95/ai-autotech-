import { type JobKind } from "@/lib/brand/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import { missingOrgColumn, missingTenantTable } from "@/lib/tenant/rows";
import { AGENCY_SLUG } from "@/lib/tenant/types";

export type Lead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  stage:
    | "New"
    | "Contacted"
    | "Audit booked"
    | "Audit done"
    | "Proposal sent"
    | "Won"
    | "Lost"
    | "Onboarding/Handover"
    | "Talking"
    | "Quoted";
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
  kind: JobKind;
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

type QueryError = { message: string } | null;

function throwQuery(error: QueryError, table: string) {
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

function freshOrd() {
  return -Math.floor(Date.now() / 1000);
}

function usableOrgId(orgId: string | null | undefined) {
  if (!orgId || orgId.startsWith("preview-")) return null;
  return orgId;
}

async function openService() {
  const { openServiceDatabase } = await import("@/server/workers/service-db");
  return openServiceDatabase();
}

async function signedInClient(): Promise<SupabaseClient | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const server = await createSupabaseServerClient();
    const user = await server.auth.getUser().then((result) => result.data.user).catch(() => null);
    return user ? server : null;
  } catch {
    return null;
  }
}

async function openWriter(): Promise<SupabaseClient> {
  const user = await signedInClient();
  if (user) return user;
  const service = await openService();
  if (service) return service;
  throw new Error(
    "CRM store requires a signed-in user or a configured Supabase service role. Filesystem JSON is not used.",
  );
}

async function resolveWriteOrgId(): Promise<string | null> {
  try {
    const { resolveActiveOrgId } = await import("@/lib/tenant/context");
    return usableOrgId(await resolveActiveOrgId());
  } catch {
    return null;
  }
}

async function shouldSeedAgency(supabase: SupabaseClient, orgId: string | null) {
  if (!orgId) return true;
  const org = await supabase.from("organizations").select("slug, org_type").eq("id", orgId).maybeSingle();
  if (org.error) return missingTenantTable(org.error);
  if (!org.data) return true;
  return org.data.org_type === "agency" || org.data.slug === AGENCY_SLUG;
}

async function ensureSeed(supabase: SupabaseClient, data: CrmData, orgId: string | null): Promise<CrmData> {
  if (!(await shouldSeedAgency(supabase, orgId))) return data;
  const clientRow = orgId ? { ...SEED_CLIENT, ord: 0, org_id: orgId } : { ...SEED_CLIENT, ord: 0 };
  const jobRow = orgId ? { ...SEED_JOB, ord: 0, org_id: orgId } : { ...SEED_JOB, ord: 0 };
  let clientUpsert = await supabase.from("crm_clients").upsert(clientRow);
  let jobUpsert = clientUpsert.error ? null : await supabase.from("crm_jobs").upsert(jobRow);
  if (orgId && (missingOrgColumn(clientUpsert.error) || missingOrgColumn(jobUpsert?.error))) {
    clientUpsert = await supabase.from("crm_clients").upsert({ ...SEED_CLIENT, ord: 0 });
    jobUpsert = await supabase.from("crm_jobs").upsert({ ...SEED_JOB, ord: 0 });
  }
  if (clientUpsert.error || jobUpsert?.error) {
    if (missingTenantTable(clientUpsert.error) || missingOrgColumn(clientUpsert.error)) return data;
    throwQuery(clientUpsert.error, "crm_clients");
    throwQuery(jobUpsert?.error ?? null, "crm_jobs");
  }

  const clients = data.clients.some((client) => client.id === SEED_CLIENT.id)
    ? data.clients.map((client) => (client.id === SEED_CLIENT.id ? SEED_CLIENT : client))
    : [...data.clients, SEED_CLIENT];
  const jobs = data.jobs.some((job) => job.id === SEED_JOB.id)
    ? data.jobs.map((job) => (job.id === SEED_JOB.id ? SEED_JOB : job))
    : [...data.jobs, SEED_JOB];
  return { ...data, clients, jobs };
}

async function listClassic(client: SupabaseClient, orgId: string | null) {
  const select = (table: string, columns: string) => {
    const query = client.from(table).select(columns).order("ord", { ascending: true });
    return orgId ? query.eq("org_id", orgId) : query;
  };
  return Promise.all([
    select("crm_leads", "id, name, company, phone, stage, notes"),
    select("crm_clients", "id, name, person, phone, whatsapp, notes"),
    select("crm_jobs", "id, client, title, kind, status"),
    select("crm_invoices", "id, client, amount, status"),
  ]);
}

function listsFailed(rows: Array<{ error: QueryError }>) {
  return rows.some((row) => row.error);
}

export async function readCrm(orgId?: string | null): Promise<CrmData> {
  const requested = orgId === undefined ? await resolveWriteOrgId() : usableOrgId(orgId);
  const user = await signedInClient();
  let reader = user ?? (await openService());
  if (!reader) {
    throw new Error(
      "CRM store requires a signed-in user or a configured Supabase service role. Filesystem JSON is not used.",
    );
  }

  let rows = await listClassic(reader, requested);
  if (requested && rows.some((row) => missingOrgColumn(row.error))) {
    rows = await listClassic(reader, null);
  }
  const schemaGap = rows.some((row) => missingOrgColumn(row.error) || missingTenantTable(row.error));
  if (listsFailed(rows) && (!user || schemaGap)) {
    const service = await openService();
    if (service) {
      reader = service;
      rows = await listClassic(service, null);
    }
  }

  const [leads, clients, jobs, invoices] = rows;
  throwQuery(leads.error, "crm_leads");
  throwQuery(clients.error, "crm_clients");
  throwQuery(jobs.error, "crm_jobs");
  throwQuery(invoices.error, "crm_invoices");

  const seededOrg = rows.some((row) => missingOrgColumn(row.error)) ? null : requested;
  return ensureSeed(reader, {
    leads: ((leads.data ?? []) as unknown as Lead[]).map(asLead),
    clients: ((clients.data ?? []) as unknown as Client[]).map(asClient),
    jobs: ((jobs.data ?? []) as unknown as Job[]).map(asJob),
    invoices: ((invoices.data ?? []) as unknown as Invoice[]).map(asInvoice),
  }, seededOrg);
}

async function insertOne(table: string, row: Record<string, unknown>, client?: SupabaseClient) {
  if (client) {
    const inserted = await client.from(table).insert(row);
    throwQuery(inserted.error, table);
    return;
  }
  const orgId = await resolveWriteOrgId();
  const supabase = await openWriter();
  const inserted = await supabase.from(table).insert(orgId ? { ...row, org_id: orgId } : row);
  if (orgId && missingOrgColumn(inserted.error)) {
    const retry = await supabase.from(table).insert(row);
    throwQuery(retry.error, table);
    return;
  }
  throwQuery(inserted.error, table);
}

async function updateOne(table: string, id: string, patch: Record<string, unknown>, client?: SupabaseClient) {
  if (client) {
    const updated = await client.from(table).update(patch).eq("id", id);
    throwQuery(updated.error, table);
    return;
  }
  const orgId = await resolveWriteOrgId();
  const supabase = await openWriter();
  const run = (filter: boolean) => {
    const query = supabase.from(table).update(patch).eq("id", id);
    return filter && orgId ? query.eq("org_id", orgId) : query;
  };
  const updated = await run(Boolean(orgId));
  if (orgId && missingOrgColumn(updated.error)) {
    const retry = await run(false);
    throwQuery(retry.error, table);
    return;
  }
  throwQuery(updated.error, table);
}

export async function writeCrm(data: CrmData, client?: SupabaseClient) {
  const supabase = client ?? (await openWriter());
  const orgId = client ? null : await resolveWriteOrgId();
  const stamp = <T extends { id: string }>(rows: T[]) =>
    orgId ? rows.map((row) => ({ ...row, org_id: orgId })) : rows;
  const save = async (table: string, rows: Array<{ id: string }>) => {
    if (!rows.length) return;
    const upserted = await supabase.from(table).upsert(rows);
    if (orgId && missingOrgColumn(upserted.error)) {
      const retry = await supabase.from(table).upsert(rows.map((row) => {
        const copy = { ...row };
        delete (copy as { org_id?: string }).org_id;
        return copy;
      }));
      throwQuery(retry.error, table);
      return;
    }
    throwQuery(upserted.error, table);
  };
  await save("crm_leads", stamp(data.leads.map((row, ord) => ({ ...asLead(row), ord }))));
  await save("crm_clients", stamp(data.clients.map((row, ord) => ({ ...asClient(row), ord }))));
  await save("crm_jobs", stamp(data.jobs.map((row, ord) => ({ ...asJob(row), ord }))));
  await save("crm_invoices", stamp(data.invoices.map((row, ord) => ({ ...asInvoice(row), ord }))));
}

export async function insertClient(row: Client, client?: SupabaseClient) {
  await insertOne("crm_clients", { ...asClient(row), ord: freshOrd() }, client);
}

export async function insertJob(row: Job, client?: SupabaseClient) {
  await insertOne("crm_jobs", { ...asJob(row), ord: freshOrd() }, client);
}

export async function updateJobStatus(id: string, status: Job["status"], client?: SupabaseClient) {
  await updateOne("crm_jobs", id, { status }, client);
}

export async function insertInvoice(row: Invoice, client?: SupabaseClient) {
  await insertOne("crm_invoices", { ...asInvoice(row), ord: freshOrd() }, client);
}

export async function updateInvoiceStatus(id: string, status: Invoice["status"], client?: SupabaseClient) {
  await updateOne("crm_invoices", id, { status }, client);
}

export async function createPublicLead(
  input: {
    name: string;
    email: string;
    phone: string;
    company: string;
    message: string;
  },
  client?: SupabaseClient,
) {
  const id = nid();
  const notes = [input.email, input.message].filter(Boolean).join("\n");
  const row = {
    id,
    name: input.name || "Website lead",
    company: input.company,
    phone: input.phone,
    stage: "New" as const,
    notes,
    ord: freshOrd(),
  };
  if (client) {
    const inserted = await client.from("crm_leads").insert(row);
    throwQuery(inserted.error, "crm_leads");
    return id;
  }
  const { agencyOrgId, insertForOrg } = await import("@/server/workers/with-org");
  let orgId: string | null = null;
  try {
    orgId = await agencyOrgId();
  } catch {
    orgId = null;
  }
  const saved = await insertForOrg(orgId, "crm_leads", row);
  throwQuery(saved.error, "crm_leads");
  return id;
}

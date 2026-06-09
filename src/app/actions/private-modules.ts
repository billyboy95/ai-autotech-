"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOrganizationId } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ModuleActionState = {
  ok: boolean;
  message: string;
};

const baseSchema = z.object({
  module: z.enum(["leads", "clients", "projects", "proposals", "invoices", "agents", "support_tickets"]),
  id: z.string().trim().optional(),
});

const moduleSchemas = {
  leads: z.object({
    full_name: z.string().trim().min(2),
    company_name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: z.string().trim().optional(),
    business_type: z.string().trim().optional(),
    service_interest: z.string().trim().optional(),
    message: z.string().trim().optional(),
    lead_status: z.string().trim().default("New Lead"),
  }),
  clients: z.object({
    company_name: z.string().trim().min(2),
    industry: z.string().trim().optional(),
    status: z.string().trim().default("Active"),
  }),
  projects: z.object({
    name: z.string().trim().min(2),
    stage: z.string().trim().default("Discovery"),
    progress: z.coerce.number().min(0).max(100).default(0),
    deadline: z.string().trim().optional(),
    client_visible_update: z.string().trim().optional(),
  }),
  proposals: z.object({
    title: z.string().trim().min(2),
    status: z.string().trim().default("Draft"),
    total: z.coerce.number().min(0).default(0),
  }),
  invoices: z.object({
    invoice_number: z.string().trim().min(2),
    status: z.string().trim().default("Draft"),
    total: z.coerce.number().min(0).default(0),
    due_date: z.string().trim().optional(),
  }),
  agents: z.object({
    name: z.string().trim().min(2),
    agent_type: z.string().trim().min(2),
    status: z.string().trim().default("Running"),
    performance_score: z.coerce.number().min(0).max(100).default(0),
    connected_tools: z.string().trim().optional(),
  }),
  support_tickets: z.object({
    title: z.string().trim().min(2),
    priority: z.string().trim().default("Medium"),
    status: z.string().trim().default("Open"),
    client_visible_update: z.string().trim().optional(),
  }),
};

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""),
  );
}

export async function upsertPrivateModule(
  _state: ModuleActionState,
  formData: FormData,
): Promise<ModuleActionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, message: "Add Supabase environment variables before saving records." };
  }

  const base = baseSchema.safeParse(Object.fromEntries(formData));

  if (!base.success) {
    return { ok: false, message: "Choose a supported module before saving." };
  }

  const schema = moduleSchemas[base.data.module];
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();
  const payload = cleanPayload(parsed.data as Record<string, unknown>);

  if (organizationId) {
    payload.organization_id = organizationId;
  }

  if (base.data.module === "agents" && typeof payload.connected_tools === "string") {
    payload.connected_tools = payload.connected_tools
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);
  }

  if (base.data.module === "clients") {
    const { company_name, industry, status } = payload;
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert(cleanPayload({ name: company_name, industry, status, organization_id: organizationId }))
      .select("id")
      .single();

    if (companyError) {
      return { ok: false, message: companyError.message };
    }

    const { error } = await supabase.from("clients").insert(
      cleanPayload({
        company_id: company?.id,
        status,
        organization_id: organizationId,
      }),
    );

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath("/command-centre");
    return { ok: true, message: "Client created." };
  }

  const table = base.data.module;
  const query = base.data.id
    ? supabase.from(table).update(payload).eq("id", base.data.id)
    : supabase.from(table).insert(payload);

  const { error } = await query;

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/command-centre");
  return { ok: true, message: base.data.id ? "Record updated." : "Record created." };
}

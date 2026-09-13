import { getOrganizationSubscription, type OrganizationSubscription } from "@/lib/billing";
import { listRecentDocuments, type StoredDocument } from "@/lib/documents";
import { applyOrganizationFilter, getCurrentOrganizationId } from "@/lib/organization";
import { reports, roleMatrix } from "@/lib/platform-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export type DashboardStatus = "live" | "empty" | "error" | "unconfigured";

export type DashboardKpi = {
  label: string;
  value: string;
  delta: string;
  tone: string;
};

export type DashboardPipelineStage = {
  stage: string;
  count: number;
  value: number;
};

export type DashboardRevenuePoint = {
  month: string;
  revenue: number;
  leads: number;
};

export type DashboardProject = {
  client: string;
  project: string;
  stage: string;
  progress: number;
  owner: string;
  due: string;
};

export type DashboardAgent = {
  name: string;
  type: string;
  status: string;
  tasks: number;
  score: number;
  tools: string;
};

export type DashboardTicket = {
  title: string;
  client: string;
  priority: string;
  status: string;
};

export type DashboardData = {
  dataSource: "supabase";
  status: DashboardStatus;
  message: string;
  kpis: DashboardKpi[];
  pipeline: DashboardPipelineStage[];
  revenueData: DashboardRevenuePoint[];
  projects: DashboardProject[];
  agents: DashboardAgent[];
  tickets: DashboardTicket[];
  documents: StoredDocument[];
  subscription: OrganizationSubscription | null;
  reports: typeof reports;
  roleMatrix: typeof roleMatrix;
};

const leadStages = [
  "New Lead",
  "Qualified",
  "Discovery Booked",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
  "Onboarding",
];

type LeadRow = { lead_status: string | null; created_at: string | null };
type InvoiceRow = { id: string; status: string | null; total: number | string | null; due_date: string | null };
type PaymentRow = { amount: number | string | null; paid_at: string | null };
type ProjectRow = {
  id: string;
  name: string;
  stage: string;
  progress: number | string | null;
  deadline: string | null;
  clients?: { companies?: { name?: string } | Array<{ name?: string }> } | Array<{ companies?: { name?: string } | Array<{ name?: string }> }>;
};
type AgentRow = {
  name: string;
  agent_type: string;
  status: string;
  performance_score: number | string | null;
  connected_tools: string[] | null;
};
type TicketRow = {
  title: string;
  priority: string;
  status: string;
  clients?: { companies?: { name?: string } | Array<{ name?: string }> } | Array<{ companies?: { name?: string } | Array<{ name?: string }> }>;
};
type SupabaseQueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
};
type SupabaseListQuery<T> = PromiseLike<SupabaseQueryResult<T>> & {
  eq: (column: string, value: string) => SupabaseListQuery<T>;
};

const defaultKpis: DashboardKpi[] = [
  { label: "Monthly Revenue", value: formatCurrency(0), delta: "No payments yet", tone: "text-slate-500" },
  { label: "Leads Generated", value: "0", delta: "No tenant leads yet", tone: "text-slate-500" },
  { label: "Active Clients", value: "0", delta: "No active clients yet", tone: "text-slate-500" },
  { label: "Active Projects", value: "0", delta: "No active projects yet", tone: "text-slate-500" },
  { label: "Open Invoices", value: formatCurrency(0), delta: "No invoices yet", tone: "text-slate-500" },
  { label: "AI Agents Running", value: "0", delta: "No agents configured", tone: "text-slate-500" },
  { label: "Conversion Rate", value: "0%", delta: "No won leads yet", tone: "text-slate-500" },
  { label: "MRR / ARR", value: formatCurrency(0), delta: formatCurrency(0), tone: "text-slate-500" },
];

function emptyDashboardData(
  status: DashboardStatus,
  message: string,
  subscription: OrganizationSubscription | null = null,
  documents: StoredDocument[] = [],
): DashboardData {
  return {
    dataSource: "supabase",
    status,
    message,
    kpis: defaultKpis,
    pipeline: leadStages.map((stage) => ({ stage, count: 0, value: 0 })),
    revenueData: [],
    projects: [],
    agents: [],
    tickets: [],
    documents,
    subscription,
    reports,
    roleMatrix,
  };
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { month: "short" }).format(new Date(value));
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return emptyDashboardData("unconfigured", "Add Supabase environment variables to load tenant dashboard data.");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const organizationId = await getCurrentOrganizationId();
    const [subscription, documents] = await Promise.all([getOrganizationSubscription(), listRecentDocuments()]);

    if (!organizationId) {
      return emptyDashboardData("empty", "Join an organization to load private dashboard data.", subscription, documents);
    }

    const orgFilter = <T,>(query: SupabaseListQuery<T>) => applyOrganizationFilter(query, organizationId);

    const [
      leadsResult,
      clientsResult,
      projectsResult,
      invoicesResult,
      agentsResult,
      ticketsResult,
      revenueResult,
    ] = await Promise.all([
      orgFilter(supabase.from("leads").select("lead_status, created_at", { count: "exact" }) as unknown as SupabaseListQuery<LeadRow>),
      orgFilter(supabase.from("clients").select("id", { count: "exact" }) as unknown as SupabaseListQuery<{ id: string }>),
      orgFilter(
        supabase
          .from("projects")
          .select("id, name, stage, progress, deadline, clients(companies(name))", { count: "exact" })
          .order("updated_at", { ascending: false })
          .limit(6) as unknown as SupabaseListQuery<ProjectRow>,
      ),
      orgFilter(supabase.from("invoices").select("id, status, total, due_date", { count: "exact" }) as unknown as SupabaseListQuery<InvoiceRow>),
      orgFilter(
        supabase
          .from("agents")
          .select("name, agent_type, status, performance_score, connected_tools")
          .order("updated_at", { ascending: false })
          .limit(6) as unknown as SupabaseListQuery<AgentRow>,
      ),
      orgFilter(
        supabase
          .from("support_tickets")
          .select("title, priority, status, clients(companies(name))")
          .order("updated_at", { ascending: false })
          .limit(6) as unknown as SupabaseListQuery<TicketRow>,
      ),
      orgFilter(supabase.from("payments").select("amount, paid_at").not("paid_at", "is", null) as unknown as SupabaseListQuery<PaymentRow>),
    ]);

    const firstError = [
      leadsResult.error,
      clientsResult.error,
      projectsResult.error,
      invoicesResult.error,
      agentsResult.error,
      ticketsResult.error,
      revenueResult.error,
    ].find(Boolean);

    if (firstError) {
      return emptyDashboardData("error", firstError.message, subscription, documents);
    }

    const leads = (leadsResult.data ?? []) as LeadRow[];
    const invoiceRows = (invoicesResult.data ?? []) as InvoiceRow[];
    const paymentRows = (revenueResult.data ?? []) as PaymentRow[];
    const monthlyRevenue = paymentRows.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const openInvoiceTotal = invoiceRows
      .filter((invoice) => invoice.status !== "Paid" && invoice.status !== "Cancelled")
      .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
    const wonLeads = leads.filter((lead) => lead.lead_status === "Won").length;
    const conversionRate = leads.length ? Math.round((wonLeads / leads.length) * 100) : 0;

    const pipeline = leadStages.map((stage) => ({
      stage,
      count: leads.filter((lead) => lead.lead_status === stage).length,
      value: 0,
    }));

    const revenueByMonth = new Map<string, number>();
    paymentRows.forEach((payment) => {
      const key = monthLabel(String(payment.paid_at));
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(payment.amount ?? 0));
    });

    const projects = ((projectsResult.data ?? []) as ProjectRow[]).map((project) => {
      const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;
      const company = client ? (Array.isArray(client.companies) ? client.companies[0] : client.companies) : null;

      return {
        client: company?.name ?? "Unassigned client",
        project: project.name,
        stage: project.stage,
        progress: Number(project.progress ?? 0),
        owner: "Team",
        due: project.deadline ? new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short" }).format(new Date(project.deadline)) : "No date",
      };
    });

    const liveAgents = ((agentsResult.data ?? []) as AgentRow[]).map((agent) => ({
      name: agent.name,
      type: agent.agent_type,
      status: agent.status,
      tasks: 0,
      score: Number(agent.performance_score ?? 0),
      tools: (agent.connected_tools ?? []).join(", ") || "No tools",
    }));

    const tickets = ((ticketsResult.data ?? []) as TicketRow[]).map((ticket) => {
      const client = Array.isArray(ticket.clients) ? ticket.clients[0] : ticket.clients;
      const company = client ? (Array.isArray(client.companies) ? client.companies[0] : client.companies) : null;

      return {
        title: ticket.title,
        client: company?.name ?? "Unassigned client",
        priority: ticket.priority,
        status: ticket.status,
      };
    });

    const revenueData = Array.from(revenueByMonth.entries()).map(([month, revenue]) => ({ month, revenue, leads: leads.length }));
    const hasData =
      Number(leadsResult.count ?? 0) > 0 ||
      Number(clientsResult.count ?? 0) > 0 ||
      Number(projectsResult.count ?? 0) > 0 ||
      invoiceRows.length > 0 ||
      liveAgents.length > 0 ||
      tickets.length > 0 ||
      documents.length > 0;

    return {
      dataSource: "supabase",
      status: hasData ? "live" : "empty",
      message: hasData ? "Tenant-scoped Supabase queries are active." : "Your organization is connected, but no private records exist yet.",
      kpis: [
        { label: "Monthly Revenue", value: formatCurrency(monthlyRevenue), delta: "Live payments", tone: "text-emerald-700" },
        { label: "Leads Generated", value: String(leadsResult.count ?? leads.length), delta: "Tenant scoped", tone: "text-blue-700" },
        { label: "Active Clients", value: String(clientsResult.count ?? 0), delta: "Tenant scoped", tone: "text-cyan-700" },
        { label: "Active Projects", value: String(projectsResult.count ?? 0), delta: "Live", tone: "text-amber-700" },
        { label: "Open Invoices", value: formatCurrency(openInvoiceTotal), delta: `${invoiceRows.length} invoices`, tone: "text-rose-700" },
        { label: "AI Agents Running", value: String(liveAgents.length), delta: "Configured", tone: "text-indigo-700" },
        { label: "Conversion Rate", value: `${conversionRate}%`, delta: `${wonLeads} won`, tone: "text-emerald-700" },
        { label: "MRR / ARR", value: formatCurrency(monthlyRevenue), delta: formatCurrency(monthlyRevenue * 12), tone: "text-slate-700" },
      ],
      pipeline,
      revenueData,
      projects,
      agents: liveAgents,
      tickets,
      documents,
      subscription,
      reports,
      roleMatrix,
    };
  } catch (error) {
    return emptyDashboardData("error", error instanceof Error ? error.message : "Dashboard queries failed.");
  }
}

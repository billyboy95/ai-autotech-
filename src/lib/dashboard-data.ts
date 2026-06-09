import {
  agents as mockAgents,
  kpis as mockKpis,
  pipeline as mockPipeline,
  projects as mockProjects,
  reports,
  revenueData as mockRevenueData,
  roleMatrix,
  tickets as mockTickets,
} from "@/lib/platform-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/organization";
import { formatCurrency } from "@/lib/utils";

export type DashboardData = {
  dataSource: "supabase" | "mock";
  kpis: typeof mockKpis;
  pipeline: typeof mockPipeline;
  revenueData: typeof mockRevenueData;
  projects: typeof mockProjects;
  agents: typeof mockAgents;
  tickets: typeof mockTickets;
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

function mockDashboardData(): DashboardData {
  return {
    dataSource: "mock",
    kpis: mockKpis,
    pipeline: mockPipeline,
    revenueData: mockRevenueData,
    projects: mockProjects,
    agents: mockAgents,
    tickets: mockTickets,
    reports,
    roleMatrix,
  };
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { month: "short" }).format(new Date(value));
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return mockDashboardData();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const organizationId = await getCurrentOrganizationId();
    const orgFilter = <T,>(query: SupabaseListQuery<T>) =>
      organizationId ? query.eq("organization_id", organizationId) : query;

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

    if (leadsResult.error || clientsResult.error || projectsResult.error) {
      return mockDashboardData();
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

    const revenueData = revenueByMonth.size
      ? Array.from(revenueByMonth.entries()).map(([month, revenue]) => ({ month, revenue, leads: leads.length }))
      : mockRevenueData;

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

    return {
      dataSource: "supabase",
      kpis: [
        { label: "Monthly Revenue", value: formatCurrency(monthlyRevenue), delta: "Live payments", tone: "text-emerald-700" },
        { label: "Leads Generated", value: String(leadsResult.count ?? leads.length), delta: "Supabase", tone: "text-blue-700" },
        { label: "Active Clients", value: String(clientsResult.count ?? 0), delta: "Tenant scoped", tone: "text-cyan-700" },
        { label: "Active Projects", value: String(projectsResult.count ?? 0), delta: "Live", tone: "text-amber-700" },
        { label: "Open Invoices", value: formatCurrency(openInvoiceTotal), delta: `${invoiceRows.length} invoices`, tone: "text-rose-700" },
        { label: "AI Agents Running", value: String(liveAgents.length), delta: "Configured", tone: "text-indigo-700" },
        { label: "Conversion Rate", value: `${conversionRate}%`, delta: `${wonLeads} won`, tone: "text-emerald-700" },
        { label: "MRR / ARR", value: formatCurrency(monthlyRevenue), delta: formatCurrency(monthlyRevenue * 12), tone: "text-slate-700" },
      ],
      pipeline,
      revenueData,
      projects: projects.length ? projects : mockProjects,
      agents: liveAgents.length ? liveAgents : mockAgents,
      tickets: tickets.length ? tickets : mockTickets,
      reports,
      roleMatrix,
    };
  } catch {
    return mockDashboardData();
  }
}

import {
  Bot,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Headset,
  LayoutDashboard,
  MessageSquareMore,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

export const publicPages = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "AI Agents", href: "/ai-agents" },
  { label: "Automation", href: "/automation" },
  { label: "CRM Solutions", href: "/crm-solutions" },
  { label: "Software", href: "/software-development" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const services = [
  {
    title: "Automation Systems",
    text: "Workflow automation for sales, operations, support, finance, and delivery teams.",
    icon: Workflow,
  },
  {
    title: "AI Agents",
    text: "Sales, support, marketing, operations, finance, and executive agents with tool-ready dashboards.",
    icon: Bot,
  },
  {
    title: "CRM Solutions",
    text: "Lead capture, pipeline tracking, follow-ups, UTM attribution, and owner assignment.",
    icon: Users,
  },
  {
    title: "Software Development",
    text: "Custom portals, internal tools, proposal systems, invoice workflows, and SaaS foundations.",
    icon: BriefcaseBusiness,
  },
];

export const dashboardNav = [
  { label: "Executive", icon: LayoutDashboard },
  { label: "CRM", icon: Users },
  { label: "Clients", icon: BriefcaseBusiness },
  { label: "Projects", icon: ClipboardCheck },
  { label: "Proposals", icon: FileText },
  { label: "Invoices", icon: CircleDollarSign },
  { label: "AI Agents", icon: Bot },
  { label: "Tickets", icon: Headset },
  { label: "Reports", icon: ChartNoAxesCombined },
  { label: "Messages", icon: MessageSquareMore },
  { label: "Security", icon: ShieldCheck },
];

export const kpis = [
  { label: "Monthly Revenue", value: "R428k", delta: "+18.4%", tone: "text-emerald-700" },
  { label: "Leads Generated", value: "312", delta: "+42 this week", tone: "text-blue-700" },
  { label: "Active Clients", value: "48", delta: "9 onboarding", tone: "text-cyan-700" },
  { label: "Active Projects", value: "27", delta: "6 launching", tone: "text-amber-700" },
  { label: "Open Invoices", value: "R96k", delta: "5 overdue", tone: "text-rose-700" },
  { label: "AI Agents Running", value: "14", delta: "99.2% uptime", tone: "text-indigo-700" },
  { label: "Conversion Rate", value: "31%", delta: "+6.2%", tone: "text-emerald-700" },
  { label: "MRR / ARR", value: "R186k", delta: "R2.23m ARR", tone: "text-slate-700" },
];

export const pipeline = [
  { stage: "New Lead", count: 82, value: 328000 },
  { stage: "Qualified", count: 44, value: 246000 },
  { stage: "Discovery Booked", count: 28, value: 214000 },
  { stage: "Proposal Sent", count: 18, value: 392000 },
  { stage: "Negotiation", count: 11, value: 304000 },
  { stage: "Won", count: 9, value: 286000 },
  { stage: "Lost", count: 7, value: 76000 },
  { stage: "Onboarding", count: 6, value: 178000 },
];

export const revenueData = [
  { month: "Jan", revenue: 186000, leads: 96 },
  { month: "Feb", revenue: 224000, leads: 132 },
  { month: "Mar", revenue: 248000, leads: 156 },
  { month: "Apr", revenue: 311000, leads: 208 },
  { month: "May", revenue: 382000, leads: 274 },
  { month: "Jun", revenue: 428000, leads: 312 },
];

export const projects = [
  {
    client: "Cape Logistics Group",
    project: "AI Dispatch Automation",
    stage: "Build",
    progress: 68,
    owner: "Operations Agent",
    due: "14 Jun",
  },
  {
    client: "Mzansi Dental Network",
    project: "Client Portal + CRM",
    stage: "Testing",
    progress: 84,
    owner: "Staff",
    due: "21 Jun",
  },
  {
    client: "Durban Solar Works",
    project: "Proposal Generator",
    stage: "Design",
    progress: 42,
    owner: "Contractor",
    due: "28 Jun",
  },
  {
    client: "Pretoria Accounting Hub",
    project: "Invoice Tracking",
    stage: "Review",
    progress: 91,
    owner: "Finance Agent",
    due: "09 Jun",
  },
];

export const agents = [
  {
    name: "Nandi Sales",
    type: "Sales Agent",
    status: "Running",
    tasks: 38,
    score: 94,
    tools: "CRM, WhatsApp, Calendly",
  },
  {
    name: "Kabelo Support",
    type: "Support Agent",
    status: "Reviewing",
    tasks: 21,
    score: 88,
    tools: "Tickets, Email, Docs",
  },
  {
    name: "Aisha Finance",
    type: "Finance Agent",
    status: "Running",
    tasks: 17,
    score: 91,
    tools: "Invoices, Payments",
  },
  {
    name: "Thabo Executive",
    type: "Executive Agent",
    status: "Scheduled",
    tasks: 12,
    score: 86,
    tools: "Reports, Forecasts",
  },
];

export const tickets = [
  { title: "Portal invite not received", client: "Mzansi Dental Network", priority: "High", status: "Open" },
  { title: "Change invoice VAT wording", client: "Pretoria Accounting Hub", priority: "Medium", status: "Waiting On Client" },
  { title: "Add two proposal line items", client: "Durban Solar Works", priority: "Low", status: "In Progress" },
];

export const reports = [
  "Sales report",
  "Revenue report",
  "Lead source report",
  "Project delivery report",
  "Client activity report",
  "Agent performance report",
];

export const databaseTables = [
  "users",
  "organizations",
  "organization_members",
  "profiles",
  "companies",
  "contacts",
  "leads",
  "clients",
  "projects",
  "tasks",
  "proposals",
  "proposal_items",
  "invoices",
  "invoice_items",
  "payments",
  "documents",
  "support_tickets",
  "ticket_comments",
  "agents",
  "agent_tasks",
  "activity_logs",
  "notifications",
  "appointments",
  "services",
  "service_packages",
  "settings",
  "subscriptions",
];

export const roleMatrix = [
  ["Super Admin", "Full platform control, settings, billing readiness, audit logs"],
  ["Admin", "Team management, CRM, projects, invoices, reports"],
  ["Staff", "Assigned leads, clients, projects, proposals, tickets"],
  ["Contractor", "Assigned project work, deliverables, client-visible updates"],
  ["Client", "Portal access to projects, documents, invoices, proposals, tickets, messages"],
];

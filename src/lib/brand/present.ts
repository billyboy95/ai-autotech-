import type { OrgType, WorkspaceBranding, WorkspaceSummary } from "@/lib/tenant/types";

export type PublicBrand = {
  slug: string;
  productName: string;
  senderName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  showPlatformName: boolean;
  customDomain: string;
  orgType: OrgType;
};

export function presentBrand(input: {
  slug: string;
  name: string;
  orgType: OrgType;
  senderName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  customDomain?: string;
  branding?: Partial<WorkspaceBranding> | null;
}): PublicBrand {
  const branding = input.branding ?? {};
  const showPlatformName = input.orgType === "client" ? branding.showPlatformName === true : branding.showPlatformName !== false;
  const productName = (branding.productName || input.senderName || input.name).trim() || input.name;
  return {
    slug: input.slug,
    productName,
    senderName: (input.senderName || productName).trim(),
    logoUrl: input.logoUrl || "",
    primaryColor: input.primaryColor || "#0B1F3A",
    accentColor: input.accentColor || "#2563EB",
    showPlatformName,
    customDomain: input.customDomain || "",
    orgType: input.orgType,
  };
}

export function presentWorkspace(workspace: WorkspaceSummary) {
  return presentBrand(workspace);
}

export function mentionsPlatform(text: string) {
  return /ai autotech/i.test(text);
}

export function loginCopy(brand: PublicBrand | null) {
  if (!brand || brand.showPlatformName) {
    return {
      title: "Sign in",
      body: "Agency owners and client teams sign in with Supabase Auth. Use your email and password, or email yourself a magic link. AI AutoTech staff land on the agency view. EASTC and other client users land in their own workspace.",
      showPlatform: true,
      placeholder: "billyfarber06@gmail.com",
    };
  }
  return {
    title: `Sign in to ${brand.productName}`,
    body: `${brand.productName} team members sign in here. This page shows ${brand.productName} only.`,
    showPlatform: false,
    placeholder: "you@example.com",
  };
}

export type ClassicSlice = {
  leads: Array<{ id: string; name?: string; company?: string }>;
  clients: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; client: string }>;
  invoices: Array<{ id: string; client: string }>;
};

/** On a resolved client host, classic rows from another business stay off the page. */
export function classicForBrand<T extends ClassicSlice>(data: T, brandSlug: string | null): T {
  if (!brandSlug || brandSlug === "ai-autotech") return data;
  if (brandSlug === "eastc") {
    return {
      ...data,
      leads: data.leads.filter((lead) => /eastc/i.test(`${lead.name ?? ""} ${lead.company ?? ""}`)),
      clients: data.clients.filter((client) => /eastc/i.test(client.name)),
      jobs: data.jobs.filter((job) => /eastc/i.test(job.client)),
      invoices: data.invoices.filter((invoice) => /eastc/i.test(invoice.client)),
    };
  }
  return { ...data, leads: [], clients: [], jobs: [], invoices: [] };
}

export function recordsForWorkspace<T extends { orgId?: string | null }>(rows: T[], orgId: string, locked: boolean) {
  if (!locked) return rows;
  return rows.filter((row) => row.orgId === orgId);
}

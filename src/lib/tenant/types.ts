export const AGENCY_SLUG = "ai-autotech";
export const EASTC_SLUG = "eastc";
export const WORKSPACE_COOKIE = "aat_workspace";

export const MEMBERSHIP_ROLES = ["agency_owner", "agency_staff", "client_admin", "client_user"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export type OrgType = "agency" | "client";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  orgType: OrgType;
  parentId: string | null;
  legalName: string;
  location: string;
  industry: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  domain: string;
  formKey: string;
  settings: WorkspaceSettings;
};

export type ChannelPlaceholders = {
  whatsapp: { phoneNumberId: string; displayPhone: string };
  email: { fromAddress: string; provider: string };
  sms: { senderId: string };
};

export type WorkspaceSettings = {
  channels: ChannelPlaceholders;
};

export type Membership = {
  userId: string;
  orgId: string;
  role: MembershipRole;
};

export type WorkspaceOption = {
  slug: string;
  name: string;
  orgType: OrgType;
};

export type WorkspaceResolution = {
  mode: "owner" | "member" | "preview";
  active: WorkspaceSummary;
  workspaces: WorkspaceOption[];
  role: MembershipRole | null;
  userEmail: string | null;
  canManageAgency: boolean;
  scoped: boolean;
  requiresLogin: boolean;
  requestedSlug: string | null;
};

export type ClientMetric = {
  workspace: WorkspaceSummary;
  leads: number;
  pipelineValue: number;
  conversions: number;
  won: number;
  stages: string[];
};

export type PipelineStage = {
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
};

export type WorkspaceTemplate = {
  name: string;
  channel: string;
  body: string;
};

export type SequenceStep = {
  position: number;
  delayHours: number;
  channel: string;
  templateName: string;
};

export type WorkspaceBlueprint = {
  key: "agency" | "education";
  label: string;
  pipelineName: string;
  stages: PipelineStage[];
  templates: WorkspaceTemplate[];
  sequenceName: string;
  steps: SequenceStep[];
};

export function emptyChannels(): ChannelPlaceholders {
  return {
    whatsapp: { phoneNumberId: "", displayPhone: "" },
    email: { fromAddress: "", provider: "" },
    sms: { senderId: "" },
  };
}

export function isAgencyRole(role: MembershipRole | null) {
  return role === "agency_owner" || role === "agency_staff";
}

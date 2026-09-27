import { classicForBrand } from "@/lib/brand/present";
import { isSendEnabled } from "@/lib/automation/channels";
import { createInitialState } from "@/lib/automation/engine";
import { DEFAULT_SETTINGS } from "@/lib/automation/types";
import { loadViewerWorkspace, type Workspace } from "@/lib/automation/service";
import type { CrmData } from "@/lib/crm-store";
import { readCrm } from "@/lib/crm-store";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import type { WorkspaceResolution } from "@/lib/tenant/types";

const DEMO_CLASSIC: CrmData = {
  leads: [],
  clients: [
    {
      id: "eastc",
      name: "EASTC Holdings",
      person: "CEO",
      phone: "",
      whatsapp: "",
      notes: "Existing work: eastech.co.za, foundation, institute",
    },
  ],
  jobs: [
    {
      id: "job-sites",
      client: "EASTC Holdings",
      title: "Campus websites",
      kind: "Website",
      status: "Done",
    },
    {
      id: "job-inbox",
      client: "Ndlovu Dental",
      title: "WhatsApp lead desk",
      kind: "WhatsApp",
      status: "Doing",
    },
  ],
  invoices: [
    {
      id: "inv-ndl",
      client: "Ndlovu Dental",
      amount: "18500",
      status: "Unpaid",
    },
  ],
};

const EMPTY_CLASSIC: CrmData = { leads: [], clients: [], jobs: [], invoices: [] };

const EMPTY_WORKSPACE: Workspace = {
  state: createInitialState(),
  automationReady: false,
  setupError: null,
  demo: false,
};

export async function loadCommandData(): Promise<{
  workspace: Workspace;
  classic: CrmData;
  sendingEnabled: boolean;
  tenant: WorkspaceResolution;
}> {
  const tenant = await safeResolveWorkspace();
  if (tenant.mode === "preview") {
    return {
      workspace: {
        state: createInitialState({
          templates: [],
          settings: { ...DEFAULT_SETTINGS, defaultOwner: "", team: [], checklist: [], rules: [] },
        }),
        automationReady: false,
        setupError: null,
        demo: true,
      },
      classic: classicForBrand(DEMO_CLASSIC, tenant.brandLocked ? tenant.active.slug : null),
      sendingEnabled: isSendEnabled(),
      tenant,
    };
  }
  if (tenant.requiresLogin || !tenant.role || (tenant.brandLocked && tenant.workspaces.length === 0)) {
    return {
      workspace: EMPTY_WORKSPACE,
      classic: EMPTY_CLASSIC,
      sendingEnabled: isSendEnabled(),
      tenant,
    };
  }

  const lockedOrgId =
    tenant.brandLocked && !tenant.active.id.startsWith("preview-") ? tenant.active.id : null;
  let workspace: Workspace;
  try {
    workspace = await loadViewerWorkspace(lockedOrgId);
  } catch (error) {
    console.error("automation workspace load failed", error);
    workspace = {
      state: createInitialState(),
      automationReady: false,
      setupError: tenant.brandLocked ? null : error instanceof Error ? error.message : "Command centre data is unavailable.",
      demo: false,
    };
  }
  let classic = workspace.demo ? DEMO_CLASSIC : EMPTY_CLASSIC;
  if (!workspace.demo) {
    try {
      const orgId = tenant.scoped && !tenant.active.id.startsWith("preview-") ? tenant.active.id : null;
      classic = await readCrm(orgId);
    } catch (error) {
      console.error("classic crm load failed", error);
      classic = EMPTY_CLASSIC;
    }
  }
  if (tenant.brandLocked) classic = classicForBrand(classic, tenant.active.slug);
  return { workspace, classic, sendingEnabled: isSendEnabled(), tenant };
}

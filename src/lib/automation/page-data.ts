import { isSendEnabled } from "@/lib/automation/channels";
import { createInitialState } from "@/lib/automation/engine";
import { loadWorkspace, type Workspace } from "@/lib/automation/service";
import type { CrmData } from "@/lib/crm-store";
import { readCrm } from "@/lib/crm-store";
import { safeResolveWorkspace } from "@/lib/tenant/context";

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

export async function loadCommandData(): Promise<{ workspace: Workspace; classic: CrmData; sendingEnabled: boolean }> {
  let workspace: Workspace;
  try {
    workspace = await loadWorkspace();
  } catch (error) {
    console.error("automation workspace load failed", error);
    workspace = {
      state: createInitialState(),
      automationReady: false,
      setupError: error instanceof Error ? error.message : "Command centre data is unavailable.",
      demo: false,
    };
  }
  let classic = workspace.demo ? DEMO_CLASSIC : EMPTY_CLASSIC;
  if (!workspace.demo) {
    try {
      const tenant = await safeResolveWorkspace();
      const orgId = tenant.scoped && !tenant.active.id.startsWith("preview-") ? tenant.active.id : null;
      classic = await readCrm(orgId);
    } catch (error) {
      console.error("classic crm load failed", error);
      classic = EMPTY_CLASSIC;
    }
  }
  return { workspace, classic, sendingEnabled: isSendEnabled() };
}

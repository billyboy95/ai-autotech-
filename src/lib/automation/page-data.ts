import { isSendEnabled } from "@/lib/automation/channels";
import { loadWorkspace, type Workspace } from "@/lib/automation/service";
import type { CrmData } from "@/lib/crm-store";
import { readCrm } from "@/lib/crm-store";

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

export async function loadCommandData(): Promise<{ workspace: Workspace; classic: CrmData; sendingEnabled: boolean }> {
  const workspace = await loadWorkspace();
  let classic = DEMO_CLASSIC;
  if (!workspace.demo) {
    try {
      classic = await readCrm();
    } catch (error) {
      console.error("classic crm load failed", error);
      classic = { leads: [], clients: [], jobs: [], invoices: [] };
    }
  }
  return { workspace, classic, sendingEnabled: isSendEnabled() };
}

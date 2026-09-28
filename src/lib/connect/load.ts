import {
  CONNECT_ACCOUNTS,
  missingConnectMigration,
  resolveConnectState,
  type ConnectState,
  type StoredConnection,
} from "@/lib/connect/accounts";
import { isMetaStubAccount, metaConnectDisplayMode, metaStubBadges, missingMetaStubMigration, type MetaStubStatus } from "@/lib/connect/meta-stub";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConnectCard = {
  key: string;
  label: string;
  detail: string;
  state: ConnectState;
  metaStub: MetaStubStatus[] | null;
};

export type ConnectPageData = {
  preview: boolean;
  tableReady: boolean;
  cards: ConnectCard[];
  notice: string | null;
};

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function cardsFrom(input: {
  checklist: Map<string, string>;
  connections: StoredConnection[];
  metaStubs: Set<string>;
}): ConnectCard[] {
  return CONNECT_ACCOUNTS.map((account) => ({
    key: account.key,
    label: account.label,
    detail: account.detail,
    state: resolveConnectState({
      account,
      checklistStatus: input.checklist.get(account.key) ?? null,
      connections: input.connections,
    }),
    metaStub: isMetaStubAccount(account.key)
      ? metaStubBadges({ stubStored: input.metaStubs.has(account.key), providerKeysPresent: false })
      : null,
  }));
}

export async function loadConnectAccounts(input: {
  mode: string;
  orgId: string;
}): Promise<ConnectPageData> {
  const empty = cardsFrom({ checklist: new Map(), connections: [], metaStubs: new Set() });
  if (!configured() || input.mode !== "member" || input.orgId.startsWith("preview-")) {
    return {
      preview: true,
      tableReady: false,
      cards: empty,
      notice: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const [checklist, connections] = await Promise.all([
    supabase.from("connect_checklist").select("account_key, status").eq("org_id", input.orgId),
    supabase.from("channel_connections").select("channel, provider, status, secret_id").eq("org_id", input.orgId),
  ]);

  let notice: string | null = null;
  let tableReady = true;
  const checklistRows = new Map<string, string>();
  if (checklist.error) {
    tableReady = false;
    notice = missingConnectMigration(checklist.error.message)
      ? "Sandbox stub. Apply step 24 before saving connect progress. No key is stored and nothing is sent."
      : checklist.error.message;
  } else {
    for (const row of checklist.data ?? []) {
      checklistRows.set(String(row.account_key), String(row.status));
    }
  }

  const stored: StoredConnection[] = [];
  if (connections.error) {
    if (!notice && missingConnectMigration(connections.error.message)) {
      notice = "Channel connections are not in this database yet. Apply phase 2b before connecting accounts.";
    } else if (!notice) notice = connections.error.message;
  } else {
    for (const row of connections.data ?? []) {
      stored.push({
        channel: String(row.channel),
        provider: String(row.provider),
        status: String(row.status),
        hasSecret: Boolean(row.secret_id),
      });
    }
  }

  const metaStubs = new Set<string>();
  if (metaConnectDisplayMode({ tenantMode: input.mode }) === "sandbox") {
    const stubs = await supabase.from("meta_connect_stubs").select("account_key").eq("org_id", input.orgId);
    if (stubs.error) {
      if (!notice) {
        notice = missingMetaStubMigration(stubs.error.message)
          ? "Sandbox stub. Apply step 26 before saving WhatsApp or Facebook / Instagram status. No key is stored and nothing is sent."
          : stubs.error.message;
      }
    } else {
      for (const row of stubs.data ?? []) metaStubs.add(String(row.account_key));
    }
  }

  return {
    preview: false,
    tableReady,
    cards: cardsFrom({ checklist: checklistRows, connections: stored, metaStubs }),
    notice,
  };
}

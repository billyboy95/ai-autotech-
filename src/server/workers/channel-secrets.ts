import { createClient } from "@supabase/supabase-js";
import type { ChannelConnectionCredentials } from "@/lib/automation/channels";
import type { ConnectionRow } from "@/lib/channels/inbound";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function loadConnectionForWebhook(connectionId: string): Promise<ConnectionRow | null> {
  if (!UUID.test(connectionId)) return null;
  const client = serviceClient();
  if (!client) return null;
  const row = await client
    .from("channel_connections")
    .select("id, org_id, channel, provider, identifier, display_name")
    .eq("id", connectionId)
    .maybeSingle();
  if (row.error || !row.data) return null;
  const data = row.data as {
    id: string;
    org_id: string;
    channel: string;
    provider: string;
    identifier: string;
    display_name: string;
  };
  const org = await client.from("organizations").select("sender_name, name, sending_enabled").eq("id", data.org_id).maybeSingle();
  const orgRow = (org.data ?? {}) as { sender_name?: string; name?: string };
  const secretText = await readChannelSecret(connectionId);
  return {
    id: data.id,
    orgId: data.org_id,
    channel: data.channel,
    provider: data.provider,
    identifier: data.identifier,
    displayName: data.display_name,
    senderName: orgRow.sender_name || orgRow.name || data.display_name || "",
    secret: parseSecret(secretText),
  };
}

export async function readChannelSecret(connectionId: string) {
  const client = serviceClient();
  if (!client || !UUID.test(connectionId)) return null;
  const result = await client.rpc("read_channel_secret", { p_connection_id: connectionId });
  if (result.error || typeof result.data !== "string") return null;
  return result.data;
}

export function parseSecret(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConnectionRow["secret"];
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return { token: raw };
  }
}

export function credentialsFromConnection(connection: ConnectionRow): ChannelConnectionCredentials | null {
  if (!connection.secret) return null;
  const secret = connection.secret;
  return {
    connectionId: connection.id,
    provider: connection.provider as ChannelConnectionCredentials["provider"],
    identifier: connection.identifier,
    token: secret.token,
    apiKey: secret.apiKey,
    apiSecret: secret.apiSecret,
    clientId: secret.clientId,
    webhookSecret: secret.webhookSecret,
    graphVersion: "v21.0",
  };
}

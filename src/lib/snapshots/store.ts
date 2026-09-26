import { createSupabaseServerClient } from "@/lib/supabase/server";
import { seededSnapshotOptions, type SnapshotOption } from "@/lib/snapshots/catalog";

export type SnapshotTemplateRow = {
  id: string;
  assetKey: string;
  channel: string;
  name: string;
  subject: string;
  body: string;
  active: boolean;
};

function missingSnapshotTable(message: string) {
  return /does not exist|schema cache|could not find|snapshots|message_templates|pipelines/i.test(message);
}

export async function listSnapshotOptions(): Promise<SnapshotOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("snapshots").select("id, name, description").order("name", { ascending: true });
  if (error || !data?.length) {
    if (error && !missingSnapshotTable(error.message)) throw new Error(error.message);
    return seededSnapshotOptions();
  }
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
  }));
}

export async function listSnapshotTemplates(orgId: string): Promise<SnapshotTemplateRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, asset_key, channel, name, subject, body, active")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (error) {
    if (missingSnapshotTable(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    assetKey: String(row.asset_key),
    channel: String(row.channel),
    name: String(row.name),
    subject: String(row.subject ?? ""),
    body: String(row.body ?? ""),
    active: Boolean(row.active),
  }));
}

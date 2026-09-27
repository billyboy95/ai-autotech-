import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { missingOrgColumn } from "@/lib/tenant/rows";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LOOKUPS: Record<string, readonly string[]> = {
  organizations: ["id", "slug", "form_key"],
  workspace_shopify_stores: ["myshopify_domain"],
};

type OrgColumn = "org_id" | "organization_id" | "id";

function serviceClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function serviceConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function stamp<T extends Record<string, unknown>>(row: T, column: OrgColumn, orgId: string): T {
  if (column === "id") return row;
  return { ...row, [column]: orgId };
}

function stampMany(value: Record<string, unknown> | Record<string, unknown>[], column: OrgColumn, orgId: string) {
  if (Array.isArray(value)) return value.map((row) => stamp(row, column, orgId));
  return stamp(value, column, orgId);
}

/**
 * Service-role access for workers and webhooks. Every query is filtered by the
 * organisation id. There is no unscoped client export.
 */
export function withOrg(orgId: string, column: OrgColumn = "org_id") {
  if (!UUID.test(orgId)) throw new Error("withOrg requires an organisation id.");
  const client = serviceClient();
  if (!client) throw new Error("Supabase service role is not configured.");
  return {
    orgId,
    from(table: string) {
      const base = client.from(table);
      return {
        select(columns: string) {
          return base.select(columns).eq(column, orgId);
        },
        insert(values: Record<string, unknown> | Record<string, unknown>[]) {
          return base.insert(stampMany(values, column, orgId));
        },
        upsert(
          values: Record<string, unknown> | Record<string, unknown>[],
          options?: { onConflict?: string },
        ) {
          return base.upsert(stampMany(values, column, orgId), options);
        },
        update(values: Record<string, unknown>) {
          const patch = { ...values };
          delete patch.org_id;
          delete patch.organization_id;
          return base.update(patch).eq(column, orgId);
        },
        delete() {
          return base.delete().eq(column, orgId);
        },
      };
    },
  };
}

export async function lookupRow(table: string, column: string, value: string, columns: string) {
  const allowed = LOOKUPS[table];
  if (!allowed?.includes(column)) throw new Error("That lookup is not allowed.");
  const client = serviceClient();
  if (!client) return { data: null, error: null, configured: false as const };
  const result = await client.from(table).select(columns).eq(column, value).maybeSingle();
  return { ...result, configured: true as const };
}

export async function callServiceRpc(fn: string, args: Record<string, unknown>) {
  const allowed = new Set([
    "apply_billing_event",
    "apply_billing_dunning",
    "run_billing_cycle",
    "bill_usage_period",
  ]);
  if (!allowed.has(fn)) throw new Error("That billing call is not allowed.");
  const client = serviceClient();
  if (!client) return { data: null, error: null, configured: false as const };
  const result = await client.rpc(fn, args);
  return { data: result.data, error: result.error, configured: true as const };
}

const SHARE_TOKEN = /^[a-f0-9]{64}$/;

/** Audit fields the public team page is allowed to read. No name, email, phone, or company. */
export async function readAuditTeamSource(token: string) {
  if (!SHARE_TOKEN.test(token)) return null;
  const client = serviceClient();
  if (!client) return null;
  const result = await client.from("crm_audit_leads").select("industry, answers").eq("share_token", token).maybeSingle();
  if (result.error || !result.data) return null;
  const row = result.data as { industry?: string; answers?: Record<string, unknown> };
  return {
    industry: typeof row.industry === "string" ? row.industry : "",
    answers: row.answers && typeof row.answers === "object" ? row.answers : {},
  };
}

/** Creates a share token when the audit row has none. Returns null when storage is unavailable. */
export async function ensureAuditShareToken(auditLeadId: string, token: string) {
  if (!UUID.test(auditLeadId) || !SHARE_TOKEN.test(token)) return null;
  const client = serviceClient();
  if (!client) return null;
  const existing = await client.from("crm_audit_leads").select("share_token").eq("id", auditLeadId).maybeSingle();
  if (existing.error || !existing.data) return null;
  const current = (existing.data as { share_token?: string | null }).share_token;
  if (typeof current === "string" && SHARE_TOKEN.test(current)) return current;
  const saved = await client.from("crm_audit_leads").update({ share_token: token }).eq("id", auditLeadId).is("share_token", null);
  if (saved.error) return null;
  return token;
}

export async function agencyOrgId() {
  const found = await lookupRow("organizations", "slug", "ai-autotech", "id");
  if (!found.configured || found.error || !found.data) return null;
  const id = (found.data as { id?: string }).id;
  return id ? String(id) : null;
}

export async function listAuthEmails() {
  const client = serviceClient();
  const emails = new Map<string, string>();
  if (!client) return emails;
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) return emails;
  for (const user of listed.data.users) {
    if (user.email) emails.set(user.id, user.email);
  }
  return emails;
}

export async function findAuthUserIdByEmail(email: string) {
  const client = serviceClient();
  if (!client) throw new Error("Supabase service role is not configured.");
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw new Error(listed.error.message);
  const user = listed.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

/** Insert one row for an org. Retries without org_id only when that column is not migrated yet. */
export async function insertForOrg(orgId: string | null, table: string, row: Record<string, unknown>) {
  const client = serviceClient();
  if (!client) return { data: null, error: { message: "Supabase service role is not configured." } };
  if (!orgId) return client.from(table).insert(row).select("id").single();
  const scoped = await withOrg(orgId).from(table).insert(row).select("id").single();
  if (scoped.error && missingOrgColumn(scoped.error)) {
    return client.from(table).insert(row).select("id").single();
  }
  return scoped;
}

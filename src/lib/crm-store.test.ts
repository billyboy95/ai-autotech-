import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicLead, insertClient, updateJobStatus, writeCrm } from "@/lib/crm-store";

function recordingClient() {
  const ops: string[] = [];
  const client = {
    from(table: string) {
      return {
        insert() {
          ops.push(`insert ${table}`);
          return Promise.resolve({ error: null });
        },
        upsert() {
          ops.push(`upsert ${table}`);
          return Promise.resolve({ error: null });
        },
        update() {
          ops.push(`update ${table}`);
          return {
            eq(column: string, value: string) {
              ops.push(`eq ${table}.${column}=${value}`);
              return Promise.resolve({ error: null });
            },
          };
        },
        delete() {
          ops.push(`delete ${table}`);
          return {
            in() {
              ops.push(`delete in ${table}`);
              return Promise.resolve({ error: null });
            },
          };
        },
        select() {
          ops.push(`select ${table}`);
          return Promise.resolve({ data: [{ id: "row-from-another-request" }], error: null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, ops };
}

test("createPublicLead inserts one lead and does not rewrite the table", async () => {
  const { client, ops } = recordingClient();
  const id = await createPublicLead(
    { name: "Amina", email: "amina@example.co.za", phone: "0820000001", company: "Cafe", message: "Hello" },
    client,
  );
  assert.match(id, /./);
  assert.deepEqual(ops, ["insert crm_leads"]);
});

test("classic job and client saves touch one row and never delete", async () => {
  const jobs = recordingClient();
  await updateJobStatus("job-1", "Doing", jobs.client);
  assert.deepEqual(jobs.ops, ["update crm_jobs", "eq crm_jobs.id=job-1"]);

  const clients = recordingClient();
  await insertClient({ id: "c1", name: "EASTC", person: "", phone: "", whatsapp: "", notes: "" }, clients.client);
  assert.deepEqual(clients.ops, ["insert crm_clients"]);
});

test("writeCrm upserts the payload and leaves rows it did not load", async () => {
  const { client, ops } = recordingClient();
  await writeCrm(
    {
      leads: [{ id: "lead-1", name: "Amina", company: "", phone: "", stage: "New", notes: "" }],
      clients: [],
      jobs: [],
      invoices: [],
    },
    client,
  );
  assert.equal(ops.some((op) => op.startsWith("delete")), false);
  assert.equal(ops.some((op) => op.startsWith("select")), false);
  assert.deepEqual(ops, ["upsert crm_leads"]);
});

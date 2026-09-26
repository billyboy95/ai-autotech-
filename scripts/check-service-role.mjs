import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "src");
const allowed = [
  "src/server/workers/",
  "src/server/webhooks/",
];

function files(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...files(path));
    else if (/\.(ts|tsx|js|mjs|jsx)$/.test(name)) found.push(path);
  }
  return found;
}

const hits = [];
for (const path of files(src)) {
  const rel = relative(root, path).split("\\").join("/");
  if (allowed.some((prefix) => rel.startsWith(prefix))) continue;
  const text = readFileSync(path, "utf8");
  if (text.includes("SUPABASE_SERVICE_ROLE_KEY") || text.includes("createSupabaseAdminClient")) {
    hits.push(rel);
  }
}

if (hits.length) {
  console.error("Service role is only allowed in src/server/workers and src/server/webhooks.");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

const crm = readFileSync(join(root, "src/lib/crm-store.ts"), "utf8");
if (crm.includes("replaceTable") || crm.includes(".delete()")) {
  console.error("crm-store.ts must save row by row and must not delete unrecognised rows.");
  process.exit(1);
}

console.log("Service-role guard passed.");

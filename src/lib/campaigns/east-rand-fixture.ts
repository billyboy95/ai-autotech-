import { readFileSync } from "node:fs";
import path from "node:path";
import { EAST_RAND_SANDBOX_FILE } from "@/lib/campaigns/east-rand-seed";

/** Server-only read of the in-repo sandbox fixture. Client components must not import this file. */
export function readEastRandSandboxCsv() {
  return readFileSync(path.join(process.cwd(), EAST_RAND_SANDBOX_FILE), "utf8");
}

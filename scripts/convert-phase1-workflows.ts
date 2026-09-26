import { phase1SnapshotWorkflows } from "@/lib/workflows/phase1";

const workflows = phase1SnapshotWorkflows();
process.stdout.write(`${JSON.stringify(workflows, null, 2)}\n`);
process.stderr.write(`Converted ${workflows.length} phase 1 workflows. Nothing was sent.\n`);

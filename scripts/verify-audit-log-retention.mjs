import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const runtimeDir = process.env.FROST_MONERO_RUNTIME_DIR ?? join(process.env.HOME ?? ".", ".local/share/frost-monero-regtest");
const sessionDir = join(runtimeDir, "escrow-demo", "session-local-demo");
const port = process.env.FROST_BUN_PORT ?? "3901";

async function rawLines(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await rawLines(path));
    else if (entry.name.endsWith(".log")) {
      const lines = (await readFile(path, "utf8")).trim().split("\n").filter(Boolean);
      output.push(...lines.map(line => `[seller] library/${entry.name}: ${line}`));
    }
  }
  return output;
}

const auditResponse = await fetch(`http://127.0.0.1:${port}/audit.json`);
if (!auditResponse.ok) throw new Error(`Audit endpoint returned ${auditResponse.status}`);
const audit = await auditResponse.json();
const expected = await rawLines(sessionDir);
const retained = audit.full_library_log;
const expectedSet = new Set(expected);
const retainedSet = new Set(retained);
const missing = expected.filter(line => !retainedSet.has(line));
const unexpected = retained.filter(line => !expectedSet.has(line));

console.log(JSON.stringify({
  raw_line_count: expected.length,
  audit_line_count: retained.length,
  missing_line_count: missing.length,
  unexpected_line_count: unexpected.length,
  sample_missing: missing.slice(0, 2),
  sample_unexpected: unexpected.slice(0, 2),
}, null, 2));

if (missing.length || unexpected.length) process.exitCode = 1;

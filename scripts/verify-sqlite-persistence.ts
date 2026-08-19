import { Database } from "bun:sqlite";
import { rmSync } from "node:fs";
import { join } from "node:path";

const dbPath = process.argv[2] ?? join("/tmp", `frost-sqlite-${crypto.randomUUID()}.sqlite`);
rmSync(dbPath, { force: true });
let db = new Database(dbPath, { create: true });
db.exec("CREATE TABLE escrow_sessions (id TEXT PRIMARY KEY, status TEXT NOT NULL); CREATE TABLE protocol_records (session_id TEXT NOT NULL, record_key TEXT NOT NULL, record_value TEXT NOT NULL, PRIMARY KEY (session_id, record_key));");
db.query("INSERT INTO escrow_sessions VALUES (?, ?)").run("persistence-check", "funded");
for (const record of ["participation", "group_key", "threshold_key", "preprocess", "share", "signed_tx"]) {
  db.query("INSERT INTO protocol_records VALUES (?, ?, ?)").run("persistence-check", record, JSON.stringify({ record }));
}
db.close();
db = new Database(dbPath, { readonly: true });
const session = db.query("SELECT status FROM escrow_sessions WHERE id = ?").get("persistence-check") as { status: string };
const records = db.query("SELECT record_key FROM protocol_records WHERE session_id = ? ORDER BY record_key").all("persistence-check") as { record_key: string }[];
if (session.status !== "funded" || records.length !== 6) throw new Error("SQLite reopen did not restore the expected escrow state.");
db.close();
rmSync(dbPath, { force: true });
console.log(JSON.stringify({ restored: session.status, records: records.map(row => row.record_key) }));

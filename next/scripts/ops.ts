import { openSync, readSync, closeSync, fstatSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { loadProductionConfig } from "../src/lib/server/config";
import { addUser, updateUser } from "../src/lib/server/auth";
import { openExisting, verifyDatabase } from "../src/lib/server/database";
import { createBackup, restoreBackup, pruneBackups } from "../src/lib/server/backup";
import { assertServiceReady, installationLock } from "../src/lib/server/lifecycle";
import { initialize, migrateInstallation, deleteWorkspace, status, prepareStorage } from "../src/lib/server/operations";
import { log } from "../src/lib/server/log";

const args = process.argv.slice(2);
const command = args.shift();
function flag(name: string): boolean { const index = args.indexOf(name); if (index < 0) return false; args.splice(index, 1); return true; }
function option(name: string): string | undefined { const index = args.indexOf(name); if (index < 0) return undefined; const value = args[index + 1]; if (!value || value.startsWith("--")) throw new Error("Option value required"); args.splice(index, 2); return value; }
function noExtra(): void { if (args.length) throw new Error("Unexpected arguments; passwords must never be supplied as arguments"); }

/** Bounded password input; terminal echo restored even when input fails. */
function password(stdin: boolean): string {
  let fd = 0;
  if (!stdin) fd = openSync("/dev/tty", "r+");
  else {
    const info = fstatSync(0);
    if (info.isFile() && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())) throw new Error("Password stdin file must be owned by this user with mode 0600");
    if (!info.isFile() && !info.isFIFO() && !info.isSocket()) throw new Error("Use a protected file or pipe for --password-stdin");
  }
  const terminal = !stdin;
  if (terminal) {
    process.stderr.write("Password (15–128 characters, spaces preserved): ");
    if (spawnSync("stty", ["-echo"], { stdio: [fd, "ignore", "ignore"] }).status !== 0) { closeSync(fd); throw new Error("Could not disable terminal echo"); }
  }
  try {
    const bytes: number[] = [];
    const one = Buffer.alloc(1);
    while (readSync(fd, one, 0, 1, null) === 1) {
      if (one[0] === 10) break;
      bytes.push(one[0]);
      if (bytes.length > 512) throw new Error("Password input too long");
    }
    const input = Buffer.from(bytes).toString("utf8");
    return input;
  } finally {
    if (terminal) { spawnSync("stty", ["echo"], { stdio: [fd, "ignore", "ignore"] }); closeSync(fd); process.stderr.write("\n"); }
  }
}
async function main(): Promise<void> {
  const config = loadProductionConfig();
  const maintenance = flag("--maintenance");
  const resume = flag("--resume");
  const json = flag("--json");
  const commit = process.env.LIVELIFT_APP_COMMIT ?? "unknown";
  if (command === "status" || command === "diagnostics") {
    noExtra();
    if (!existsSync(dirname(config.dbPath))) { process.stdout.write(JSON.stringify(status(config)) + "\n"); return; }
    const release = await installationLock(config, true, ".livelift-maintenance.lock");
    try { process.stdout.write(JSON.stringify(status(config), null, json ? 0 : 2) + "\n"); } finally { await release(); }
    return;
  }
  if (command === "init") prepareStorage(config);
  const lifecycle = ["init", "migrate", "restore", "delete-workspace"].includes(command ?? "");
  if (lifecycle && !maintenance) throw new Error("This operation requires stopped service and --maintenance");
  const release = await installationLock(config, !lifecycle, ".livelift-maintenance.lock");
  try {
    if (command === "init") { noExtra(); initialize(config); }
    else if (command === "migrate") { noExtra(); await migrateInstallation(config, commit, resume); }
    else if (command === "restore") { const artifact = args.shift(); noExtra(); if (!artifact) throw new Error("Managed backup artifact required"); await restoreBackup(artifact, config, resume); }
    else if (command === "delete-workspace") {
      process.stderr.write("Export through GET /api/v3/workspace/export before deletion. Retained off-host backups require separate cleanup.\n");
      const confirmation = option("--confirm-workspace"); const prune = flag("--prune-backups") || process.env.LIVELIFT_DELETE_BACKUPS === "1"; noExtra();
      if (!confirmation) throw new Error("--confirm-workspace requires the typed workspace UUID");
      deleteWorkspace(config, confirmation, prune, resume);
    } else if (command === "user") {
      assertServiceReady(config);
      const action = args.shift(); const username = args.shift();
      const name = option("--name"); const role = option("--role"); const stdin = flag("--password-stdin"); noExtra();
      if (!action || !username) throw new Error("User operation and username required");
      const secret = ["add", "reset-password"].includes(action) ? password(stdin) : undefined;
      const db = openExisting(config.dbPath);
      try {
        verifyDatabase(db, config);
        if (action === "add") { if (!role || !name) throw new Error("--name and --role required"); await addUser(db, username, name, role, secret!); }
        else await updateUser(db, username, action, action === "reset-password" ? secret : role);
      } finally { db.close(); }
    } else if (command === "backup") {
      const prune = flag("--prune"); const pruneOnly = flag("--prune-only"); noExtra(); assertServiceReady(config);
      const db = openExisting(config.dbPath);
      try { if (!pruneOnly) { const artifact = await createBackup(db, config, commit); process.stdout.write(artifact + "\n"); } if (prune || pruneOnly) await pruneBackups(config); } finally { db.close(); }
    } else throw new Error("Use ops init|migrate|status|user|backup|restore|delete-workspace|diagnostics");
  } finally { await release(); }
}
// Read only trusted version metadata, never credentials or workspace contents.
if (!process.env.LIVELIFT_APP_COMMIT) {
  try { process.env.LIVELIFT_APP_COMMIT = readFileSync(new URL("../../APP_COMMIT", import.meta.url), "utf8").trim(); } catch { /* Development checkout. */ }
}
main().catch(() => { log(["init", "migrate", "backup", "restore", "delete-workspace", "user"].includes(command ?? "") ? `${command}_failed` : "ops_failed", { resultCode: "operation_failed" }, "error"); process.stderr.write("Operation failed; inspect redacted diagnostics and runbook. No workspace replacement is automatically attempted.\n"); process.exitCode = 1; });

import { spawnSync } from "node:child_process";
import { z } from "zod";
import type { ProductionConfig } from "./config";

/** Administrator-only Restic operations; credentials remain in the protected environment/file. */
export function pruneOffHostWorkspace(config: ProductionConfig): void {
  if (!process.env.RESTIC_REPOSITORY) return;
  if (!process.env.RESTIC_PASSWORD_FILE) throw new Error("Protected Restic password file required");
  const run = (args: string[]) => {
    const result = spawnSync("restic", args, { encoding: "utf8", timeout: 300000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    if (result.status !== 0) throw new Error("Off-host backup cleanup failed");
    return result.stdout;
  };
  const list = () => z.array(z.object({ id: z.string().regex(/^[a-f0-9]{64}$/) })).parse(JSON.parse(run(["snapshots", "--json", "--tag", `livelift-v3,${config.workspaceId}`]) || "[]"));
  const snapshots = list();
  for (const snapshot of snapshots) run(["forget", snapshot.id]);
  if (snapshots.length) run(["prune"]);
  if (list().length) throw new Error("Off-host backup cleanup incomplete");
}

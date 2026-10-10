import { z } from "zod";
import { InstantSchema } from "@/contracts/liveIntelligence";
import { authorized, json } from "@/lib/server/http";
import { AuthorityError } from "@/lib/server/config";
import { readJson } from "@/lib/server/boundary";
import { getRuntime } from "@/lib/server/runtime";
import { readEvidence } from "@/lib/server/liveIntelligence/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ReadSchema = z.object({
  sessionId: z.string().min(1).max(128), roomId: z.string().min(1).max(128),
  perspective: z.enum(["as_known_then", "later_evidence"]).default("later_evidence"),
  asOfMs: InstantSchema.optional(), snapshotId: z.string().uuid().optional(), session: z.unknown().optional(),
}).strict();
export async function GET(request: Request): Promise<Response> {
  return authorized(request, async (authority, access) => {
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length || params.has("session")) throw new AuthorityError(400, "invalid_request", "Invalid evidence query.");
    const query: Record<string, unknown> = Object.fromEntries(params);
    if (params.has("asOfMs")) query.asOfMs = /^\d{1,16}$/.test(params.get("asOfMs")!) ? Number(params.get("asOfMs")) : NaN;
    const parsed = ReadSchema.safeParse(query);
    if (!parsed.success) throw new AuthorityError(400, "invalid_request", "Invalid evidence query.");
    return json(readEvidence(authority, access, (await getRuntime()).config.dbPath, parsed.data));
  });
}
/** Read a browser-local SIMULATED rehearsal; POST follows the existing operator-only/CSRF convention. */
export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access) => {
    if (access.role !== "operator") throw new AuthorityError(403, "forbidden", "Operator access required.");
    const parsed = ReadSchema.safeParse(await readJson(request, 1_048_576));
    if (!parsed.success || parsed.data.session === undefined) throw new AuthorityError(400, "invalid_request", "A validated SIMULATED rehearsal is required.");
    return json(readEvidence(authority, access, (await getRuntime()).config.dbPath, parsed.data));
  });
}

import { assertRoom } from "@/lib/server/authority";
import { AuthorityError } from "@/lib/server/config";
import { authorized, json } from "@/lib/server/http";
import { readJson } from "@/lib/server/boundary";
import { log } from "@/lib/server/log";
import { envelopeSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access, requestId, currentAccess) => {
    let input: unknown;
    try { input = await readJson(request, 1024 * 1024); }
    catch (error) { if (error instanceof AuthorityError) throw error; throw new AuthorityError(400, "malformed_envelope", "Command body must be JSON."); }
    const parsed = envelopeSchema.safeParse(input);
    if (!parsed.success) throw new AuthorityError(400, "malformed_envelope", "Invalid command envelope.");
    if (authority.production) assertRoom(parsed.data.roomId, authority.roomId);
    access = currentAccess();
    const result = authority.command(parsed.data, access, currentAccess);
    log(result.body.duplicate ? "command_duplicate" : result.body.receipt.outcome === "committed" ? "command_commit" : "command_rejection", { requestId, route: "/api/v3/room/commands", workspaceId: process.env.LIVELIFT_WORKSPACE_ID, roomId: authority.roomId, actorId: access.actorId, commandId: parsed.data.commandId, revision: result.body.receipt.roomRevisionAfter, status: result.status, resultCode: result.body.receipt.code ?? "committed" });
    return json(result.body, result.status);
  });
}

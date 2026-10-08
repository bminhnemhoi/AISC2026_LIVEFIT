import { assertRoom } from "@/lib/server/authority";
import { AuthorityError } from "@/lib/server/config";
import { authorized, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ commandId: string }> }): Promise<Response> {
  return authorized(request, async (authority) => {
    assertRoom(new URL(request.url).searchParams.get("roomId"), authority.roomId);
    const { commandId } = await context.params;
    const receipt = authority.receipt(commandId);
    if (!receipt) throw new AuthorityError(404, "not_found", "No receipt is known for this ID. Absence does not establish that an in-flight command failed.");
    return json(receipt);
  });
}

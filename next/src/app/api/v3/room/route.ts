import { assertRoom } from "@/lib/server/authority";
import { AuthorityError } from "@/lib/server/config";
import { authorized, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return authorized(request, (authority, access) => {
    const params = new URL(request.url).searchParams;
    assertRoom(params.get("roomId"), authority.roomId);
    const value = params.get("afterRevision");
    const revision = value === null ? undefined : Number(value);
    if (value !== null && (!/^\d+$/.test(value) || !Number.isSafeInteger(revision))) {
      throw new AuthorityError(400, "malformed_request", "afterRevision must be a nonnegative safe integer.");
    }
    return json(authority.read(access, revision));
  });
}

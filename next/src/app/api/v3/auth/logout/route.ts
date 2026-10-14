import { cookie, logout } from "@/lib/server/auth";
import { csrf, readJson } from "@/lib/server/boundary";
import { boundary, json, productionRuntime } from "@/lib/server/http";
import { AuthorityError } from "@/lib/server/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  return boundary(request, async () => {
    const platform = await productionRuntime();
    csrf(request, platform.production);
    const body = await readJson(request, 4096);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) throw new AuthorityError(400, "invalid_request", "Logout body must be an empty JSON object.");
    logout(platform.authority.db, request);
    const response = json({ loggedOut: true });
    response.headers.set("Set-Cookie", cookie("", 0));
    return response;
  });
}

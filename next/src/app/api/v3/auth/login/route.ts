import { AuthorityError } from "@/lib/server/config";
import { login, loginSchema, cookie } from "@/lib/server/auth";
import { clientIp, csrf, readJson, loginLimits } from "@/lib/server/boundary";
import { boundary, json, productionRuntime } from "@/lib/server/http";
import { log } from "@/lib/server/log";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  return boundary(request, async (requestId) => {
    const platform = await productionRuntime();
    csrf(request, platform.production);
    const ip = `ip:${clientIp(request, platform.production)}`;
    loginLimits.check(ip, 20, 900000, false);
    const parsed = loginSchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new AuthorityError(400, "invalid_request", "Username and password must meet the account format and 15–128 character password policy.");
    const account = `account:${parsed.data.username}`;
    loginLimits.check(account, 5, 900000, false);
    // Reserve attempts before async hashing so concurrent failures cannot bypass thresholds.
    loginLimits.failure(ip, 900000); loginLimits.failure(account, 900000);
    let result;
    try { result = await login(platform.authority.db, parsed.data.username, parsed.data.password); }
    catch (error) {
      if (!(error instanceof AuthorityError) || error.code !== "invalid_credentials") { loginLimits.success(ip); loginLimits.success(account); }
      throw error;
    }
    loginLimits.success(ip); loginLimits.success(account);
    const response = json(result.session);
    response.headers.set("Set-Cookie", cookie(result.token, result.session.expiresAtMs));
    log("auth_login", { requestId, route: "/api/v3/auth/login", workspaceId: result.session.workspaceId, roomId: result.session.roomId, actorId: result.session.access.actorId, status: 200 });
    return response;
  });
}

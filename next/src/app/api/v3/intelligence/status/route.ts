import { authorized, json } from "@/lib/server/http";
import { getRuntime } from "@/lib/server/runtime";
import { statusFor } from "@/lib/server/liveIntelligence/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  return authorized(request, async (authority) => json(statusFor(authority, (await getRuntime()).config.dbPath)));
}

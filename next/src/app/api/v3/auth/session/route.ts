import { currentSession } from "@/lib/server/auth";
import { boundary, json, productionRuntime } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  return boundary(request, async () => json(currentSession((await productionRuntime()).authority.db, request)));
}

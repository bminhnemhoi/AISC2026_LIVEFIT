import { authorized, json } from "@/lib/server/http";
import { aiStatus } from "@/lib/server/ai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the AI Copilot can run on this deployment, and with which model. Names of missing variables, never values. */
export async function GET(request: Request): Promise<Response> {
  return authorized(request, () => json(aiStatus()));
}

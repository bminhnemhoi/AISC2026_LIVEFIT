import { exportWorkspace } from "@/lib/server/database";
import { AuthorityError } from "@/lib/server/config";
import { authorized, json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  return authorized(request, (authority, access) => {
    if (access.role !== "operator") throw new AuthorityError(403, "forbidden", "Workspace export requires an operator.");
    const response = json(exportWorkspace(authority.db));
    response.headers.set("Content-Disposition", 'attachment; filename="livelift-workspace.json"');
    return response;
  });
}

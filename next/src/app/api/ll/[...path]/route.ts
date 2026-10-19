import { NextResponse, type NextRequest } from "next/server";
import { filterQuery, isAllowed, isJsonContentType, isSameOrigin, isWriteMethod } from "@/lib/livelift-api/allowlist";

/**
 * Server-side proxy from the desk to the LiveLift FastAPI core.
 *
 * - Only allowlisted (method, path) pairs are forwarded (`allowlist.ts`).
 * - Writes must come from the desk's own pages: same-origin `Origin` (else 403) and, when there is a body, a JSON
 *   `Content-Type` (else 415). Together they close the CSRF door a token-carrying proxy would otherwise open.
 *   GET is unchanged.
 * - The operator token lives ONLY here, in `LIVELIFT_API_TOKEN`; it is never sent to the browser.
 * - Status codes and JSON bodies pass through unchanged so the desk can show the API's own Vietnamese messages.
 */

const BASE = (process.env.LIVELIFT_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");
const TIMEOUT_MS = 15_000;

async function forward(req: NextRequest, params: Promise<{ path: string[] }>, method: "GET" | "POST"): Promise<NextResponse> {
  const { path } = await params;
  const joined = path.join("/");
  if (!isAllowed(method, joined)) {
    return NextResponse.json({ detail: "Đường này không mở qua bàn thí nghiệm." }, { status: 404 });
  }
  if (isWriteMethod(method) && !isSameOrigin(req.headers)) {
    return NextResponse.json({ detail: "Thao tác ghi chỉ nhận từ chính trang LiveLift (cùng nguồn)." }, { status: 403 });
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.LIVELIFT_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (isWriteMethod(method)) {
    const text = await req.text();
    // A body-less write (end, seed-vang) sends no Content-Type; any body must be declared JSON.
    if (text.length > 0 && !isJsonContentType(req.headers.get("content-type"))) {
      return NextResponse.json({ detail: "Thân yêu cầu phải là JSON (Content-Type: application/json)." }, { status: 415 });
    }
    headers["Content-Type"] = "application/json";
    body = text.length > 0 ? text : undefined;
  }
  const url = `${BASE}/${joined}${filterQuery(req.nextUrl.searchParams)}`;
  try {
    const res = await fetch(url, { method, headers, body, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { detail: "Không kết nối được máy chủ LiveLift (API). Kiểm tra API đã chạy và LIVELIFT_API_BASE." },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(req, ctx.params, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(req, ctx.params, "POST");
}

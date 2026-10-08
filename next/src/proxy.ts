import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
export function proxy(request: NextRequest): NextResponse {
  const nonce = randomBytes(16).toString("base64");
  // React needs eval only in development (debug callstacks); the production policy never allows it.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const policy = ["default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`, `style-src 'self' 'nonce-${nonce}'`, "style-src-attr 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("X-Request-Id", randomUUID());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"] };

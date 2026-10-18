import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
export function proxy(request: NextRequest): NextResponse {
  const nonce = randomBytes(16).toString("base64");
  // React needs eval only in development (debug callstacks); the production policy never allows it.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  // The viewer room (/xem, XemRoom.tsx) plays the host video either as an mp4 over https (media-src) or as a
  // YouTube embed that XemRoom always rewrites to the nocookie host (frame-src). Nothing else may be framed.
  const policy = ["default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`, `style-src 'self' 'nonce-${nonce}'`, "style-src-attr 'unsafe-inline'", "img-src 'self' data:", "media-src 'self' https:", "frame-src https://www.youtube-nocookie.com", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join("; ");
  // YouTube refuses an embed whose request carries no Referer (player error 153), so the viewer room sends its
  // origin only (never the path, which holds the room code) cross-site, as docker/Caddyfile.tunnel already does
  // behind the tunnel. Every other page keeps no-referrer.
  const { pathname } = request.nextUrl;
  const viewerRoom = pathname === "/xem" || pathname.startsWith("/xem/");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", viewerRoom ? "strict-origin-when-cross-origin" : "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("X-Request-Id", randomUUID());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"] };

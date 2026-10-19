/**
 * Which FastAPI paths the Next.js desk may reach through its server-side proxy
 * (`/api/ll/...`). Explicit (method, pattern) pairs — never "forward anything":
 * the proxy attaches the operator token, so an open proxy would be an open door.
 *
 * The staged viewer room (`/xem-api/*`) does NOT go through here: it is public,
 * needs no token, and is served by a same-origin rewrite (next.config.mjs) or,
 * behind the tunnel, by Caddy (docker/Caddyfile.tunnel).
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

type Method = "GET" | "POST";

const RULES: ReadonlyArray<readonly [Method, RegExp]> = [
  ["GET", /^health$/],
  ["GET", /^products$/],
  ["GET", /^sessions$/],
  ["GET", new RegExp(`^sessions/${UUID}$`)],
  // No `report`: it returns the raw ON/OFF difference in means at any moment, mid-session included, with no §7
  // lock. The desk reads `bao-cao`, which goes through the pre-registered analysis and honours the lock.
  ["GET", new RegExp(`^sessions/${UUID}/(state|schedule|ticks|comments|orders|bao-cao|signals)$`)],
  ["POST", /^products$/],
  ["POST", /^sessions$/],
  ["POST", new RegExp(`^sessions/${UUID}/(schedule|start|end|actions/execute|phong-xem)$`)],
  ["POST", /^demo\/seed$/],
  ["POST", /^demo\/seed-vang$/],
];

/** True when `method path` may be forwarded. `path` has no leading slash. */
export function isAllowed(method: string, path: string): boolean {
  if (path.includes("..") || path.includes("//") || /%2f|%5c|\\/i.test(path)) return false;
  return RULES.some(([m, re]) => m === method && re.test(path));
}

/** Methods that change state. The proxy forwards them only from the desk's own pages (`isSameOrigin`). */
export function isWriteMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

/**
 * CSRF guard for write methods. The proxy attaches the operator token, so a write sent from any other site (an HTML
 * form, or a `text/plain` fetch, needs no CORS preflight) would act with operator rights. Browsers always send
 * `Origin` on POST/PUT/PATCH/DELETE; it must name the host the browser called: `X-Forwarded-Host` when a proxy sits
 * in front, else `Host` (the rule Next.js applies to Server Actions). `request.nextUrl.host` is NOT used: behind
 * `next start -H 127.0.0.1` or a tunnel it is the bind address, not what the browser saw. A missing or "null"
 * Origin is refused.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin || origin === "null") return false;
  let originHost: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    originHost = url.host;
  } catch {
    return false;
  }
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwarded || headers.get("host") || "").trim().toLowerCase();
  return host.length > 0 && originHost === host;
}

/** A write body must be JSON: `application/json`, parameters such as `charset=utf-8` allowed. */
export function isJsonContentType(value: string | null): boolean {
  return (value ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}

/** Query keys the desk is allowed to pass through (everything else is dropped). */
export const ALLOWED_QUERY = new Set(["role", "env", "gieo_lai"]);

export function filterQuery(search: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [k, v] of search) if (ALLOWED_QUERY.has(k) && v.length <= 64) out.append(k, v);
  const s = out.toString();
  return s ? `?${s}` : "";
}

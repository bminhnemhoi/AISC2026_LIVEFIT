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
  ["GET", new RegExp(`^sessions/${UUID}/(state|schedule|ticks|comments|orders|report|bao-cao|signals)$`)],
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

/** Query keys the desk is allowed to pass through (everything else is dropped). */
export const ALLOWED_QUERY = new Set(["role", "env", "gieo_lai"]);

export function filterQuery(search: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [k, v] of search) if (ALLOWED_QUERY.has(k) && v.length <= 64) out.append(k, v);
  const s = out.toString();
  return s ? `?${s}` : "";
}

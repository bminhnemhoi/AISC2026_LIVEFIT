// VERIFICATION ONLY. Never part of a deployment image, never imported by the app.
//
// Replaces the server process's fetch for TikTok's API hosts with deterministic FIXTURES so the real LiveLift
// OAuth flow (state, binding cookie, callback, encryption, refresh, revoke) can be driven in a browser without
// TikTok credentials:
//
//   NODE_OPTIONS="--import $PWD/scripts/tiktok-fixture-preload.mjs" \
//   LIVELIFT_TIKTOK_FIXTURE_CONTROL=/tmp/fixture.json  npm run dev
//
// Everything it returns is synthetic and labelled "not TikTok". It is NOT provider evidence of anything: a
// connection made against it proves LiveLift's behaviour, not TikTok's. Other hosts use the real fetch untouched.
//
// Control file (re-read on every request), all optional:
//   { "token": "ok|invalid_grant|invalid_client|503", "user": "ok|partial|503|401|429",
//     "revoke": "ok|500", "scope": "user.info.basic", "expiresIn": 86400, "refreshExpiresIn": 31536000 }
import { readFileSync } from "node:fs";

const realFetch = globalThis.fetch;
const AVATAR_HOST = "p16-sign.tiktokcdn.com";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
let issued = 0;
let validRefresh = "";

const control = () => {
  try { return JSON.parse(readFileSync(process.env.LIVELIFT_TIKTOK_FIXTURE_CONTROL ?? "", "utf8")); } catch { return {}; }
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function token(form, c) {
  const mode = c.token ?? "ok";
  if (mode === "invalid_grant") return json(400, { error: "invalid_grant", error_description: "fixture: grant refused", log_id: "fixture" });
  if (mode === "invalid_client") return json(401, { error: "invalid_client", error_description: "fixture: client refused", log_id: "fixture" });
  if (mode === "503") return json(503, { error: "temporarily_unavailable", error_description: "fixture outage", log_id: "fixture" });
  const grant = form.get("grant_type");
  if (grant === "authorization_code" && form.get("code") !== "fixture-code") return json(400, { error: "invalid_grant", error_description: "fixture: unknown code", log_id: "fixture" });
  if (grant === "refresh_token" && form.get("refresh_token") !== validRefresh) return json(400, { error: "invalid_grant", error_description: "fixture: stale refresh token", log_id: "fixture" });
  issued += 1;
  validRefresh = `fixture-refresh-${issued}`;
  return json(200, { access_token: `fixture-access-${issued}`, refresh_token: validRefresh, open_id: "fixture-open-id-0001", expires_in: c.expiresIn ?? 86400, refresh_expires_in: c.refreshExpiresIn ?? 31536000, scope: c.scope ?? "user.info.basic", token_type: "Bearer" });
}

function user(auth, fields, c) {
  const mode = c.user ?? "ok";
  if (mode === "503") return json(503, { error: { code: "internal_error", message: "fixture outage", log_id: "fixture" } });
  if (mode === "429") return json(429, { data: {}, error: { code: "rate_limit_exceeded", message: "fixture", log_id: "fixture" } });
  if (mode === "401" || !/^Bearer fixture-access-\d+$/.test(auth ?? "")) return json(401, { data: {}, error: { code: "access_token_invalid", message: "fixture", log_id: "fixture" } });
  const all = { open_id: "fixture-open-id-0001", avatar_url: `https://${AVATAR_HOST}/fixture-avatar.png`, display_name: "Fixture Creator (not TikTok)", username: "fixture.creator", is_verified: false };
  const wanted = mode === "partial" ? fields.filter((f) => f === "open_id") : fields;
  return json(200, { data: { user: Object.fromEntries(wanted.map((f) => [f, all[f]])) }, error: { code: "ok", message: "", log_id: "fixture" } });
}

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input?.url ?? input));
  const c = control();
  if (url.hostname === "open.tiktokapis.com") {
    if (url.pathname === "/v2/oauth/token/") return token(new URLSearchParams(String(init?.body ?? "")), c);
    if (url.pathname === "/v2/oauth/revoke/") return c.revoke === "500" ? json(500, { error: "server_error" }) : json(200, {});
    if (url.pathname === "/v2/user/info/") return user(new Headers(init?.headers).get("authorization"), (url.searchParams.get("fields") ?? "").split(","), c);
  }
  if (url.hostname === AVATAR_HOST) return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
  return realFetch(input, init);
};
console.error("\n[tiktok-fixture] ACTIVE: open.tiktokapis.com and the avatar CDN are FIXTURES in this process. Nothing here is TikTok.\n");

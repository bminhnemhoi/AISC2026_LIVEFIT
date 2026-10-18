# TikTok provider integration (V1)

> Scope note: this page documents the V1 Login Kit integration. The later TikTok Shop analytics provider (V7) is
> documented in [LIVE-INTELLIGENCE-IMPLEMENTATION.md](LIVE-INTELLIGENCE-IMPLEMENTATION.md); real Shop analytics access
> is not currently granted to the project's seller account. Current status: [root README](../../README.md#tiktok-integration).

Status: **Login Kit connection + profile read.** Nothing else. See `FEASIBILITY.md` for why, and `SANDBOX-SETUP.md` to run it.

## What a connection means

A connected workspace holds a TikTok authorization for one TikTok account: its open ID, granted scopes, and a profile read through TikTok's User Info API. That is **provider-observed identity**. It does not mean LIVE eligible, Shop connected, analytics available or any native action verified, and the UI says "not established" for each. Simulator output is never provider-observed; no TikTok module imports the domain, stores or session contracts (structural test).

## States

| UI label | Server state | Meaning |
|---|---|---|
| Not configured | `not_configured` | Environment missing or invalid. Names of variables only. |
| Ready to connect | `ready` | Configured, never connected. |
| Connecting | client-only | Connect pressed; being sent to TikTok. |
| Connected | `connected` | Stored authorization, no known problem. |
| Provider unavailable | `unavailable` | Stored authorization; last TikTok call gave no usable answer (network, timeout, rate limit, 5xx, rejected app credentials, unreadable credential). **Unknown, not failed**; tokens kept. |
| Authorization expired | `expired` | TikTok refused the refresh token, or its lifetime passed, or a fresh access token was still refused. **Fails closed**: tokens erased, last profile kept and labelled not current. |
| Disconnected | `disconnected` | Operator removed it. Tokens, open ID and profile erased. |

## Flow

```text
Operator ─POST /api/v3/integrations/tiktok/connect─▶ LiveLift
  creates state S + binding B (random 256-bit); stores sha256(S), sha256(B), actor, workspace (10 min, single use)
  ◀─ { authorizeUrl } + Set-Cookie __Host-livelift_tiktok_bind=B (HttpOnly; Secure; SameSite=Lax; 600 s)
Browser ─▶ https://www.tiktok.com/v2/auth/authorize/?client_key&scope&response_type=code&redirect_uri&state=S
TikTok ─303▶ /api/v3/integrations/tiktok/callback?code&state=S     (cross-site: Strict session cookie NOT sent)
  LiveLift: consume sha256(S) (burns it), require B matches, redirect path exact, operator still enabled
  server-side POST token endpoint (client secret never leaves the server) → encrypt → store → read profile
  303 ─▶ /integrations?tiktok=<fixed outcome code>     (code, state, provider text never echoed)
```

Because the callback arrives without the session cookie, identity comes from the server-side pending record plus the Lax binding cookie. Both must match, and a failed attempt still burns the state. Another browser (a forged callback link) cannot complete someone else's flow.

## Routes (`/api/v3/integrations/tiktok…`)

| Route | Auth | Purpose |
|---|---|---|
| `GET /` | session + workspace context, any role | Local status view. No TikTok call. Ends an authorization whose refresh token has expired by the clock. |
| `POST /connect` | operator, CSRF | Start OAuth. |
| `GET /callback` | state + binding cookie | Finish OAuth; always redirects. |
| `POST /refresh` | operator, CSRF | Renew access token if needed, re-read profile. One at a time per workspace. |
| `POST /disconnect` | operator, CSRF | Revoke at TikTok (best effort), erase locally (always). |
| `GET /avatar` | session | Relay TikTok avatar (https, `*.tiktokcdn*.com`, image/jpeg\|png\|webp\|gif, ≤512 KB, no redirects) so CSP stays `img-src 'self'`. |

## Token design

- **Storage:** a separate SQLite file `provider-credentials.sqlite` beside the authority database (`LIVELIFT_PROVIDER_DB_PATH` to move it), mode 0600, `secure_delete` on, own explicit `user_version` 1 migration, bound to the workspace ID (a foreign file is refused). Reason: the authority database has a strict, verified v2 schema shared by startup, backup, restore and migration. Provider secrets should not be inside authority backups, and restoring the room must not roll refresh tokens back. **The authority schema, backup, restore, migration and export are unchanged.** `ops delete-workspace` also erases this file.
- **Encryption:** access and refresh tokens are AES-256-GCM with a random 96-bit IV, key from `LIVELIFT_PROVIDER_ENCRYPTION_KEY` (32 bytes, base64), additional authenticated data `livelift:tiktok:<workspaceId>:<column>` so a ciphertext cannot be moved to another workspace or column. A wrong or changed key fails closed to "Provider unavailable — credential unreadable"; reconnecting recovers.
- **Not backed up:** provider credentials are not in authority backups or workspace exports. After restoring a backup, reconnect TikTok if the status is not Connected.
- **Lifecycle:** access token 24 h, refreshed when within 5 minutes of expiry (rotated pair replaced atomically with compare-and-swap on a token version); refresh token 365 days. Refresh runs on **Check connection** and once on page open when the profile is >15 minutes stale. No background job.
- **Never exposed:** the browser receives only the status view (zod-stripped client side too). Tokens, secret, code, state and binding value are absent from responses, logs (allowlisted fields only), exports and client bundles. Client modules contain no web storage and no token or secret identifiers (tested).

## Verification without TikTok credentials

- **Unit/route tests** (`next/src/lib/server/tiktok/tiktok.test.ts`, `next/src/lib/client/tiktokClient.test.ts`, `next/src/components/integrations/__tests__/`): TikTok's HTTP API is replaced by deterministic fixtures; the real routes, session/CSRF checks, SQLite store and encryption run.
- **Browser harness** (`next/scripts/tiktok-fixture-preload.mjs`): a Node `--import` preload that fakes `open.tiktokapis.com` and TikTok's avatar CDN inside the *server process only*, so the whole OAuth flow can be driven in a real browser against `next start` behind HTTPS (production CSP forbids `next dev`'s `eval`). Verification only: it is not in any image, prints a banner, and labels the profile "Fixture Creator (not TikTok)". The authorize page itself is stubbed in the browser (Playwright). What this proves is **LiveLift's behaviour**; it proves nothing about TikTok. The first live proof is the sandbox run in `SANDBOX-SETUP.md`.

```text
NODE_OPTIONS="--import $PWD/scripts/tiktok-fixture-preload.mjs" LIVELIFT_TIKTOK_FIXTURE_CONTROL=/tmp/fixture.json npm run start
# control file keys: token, user, revoke, scope, expiresIn, refreshExpiresIn
```

## Not implemented, on purpose

PKCE (not documented for web), `user.info.stats`, video scopes, Content Posting, any Shop call, any LIVE capability, a background refresher, multiple TikTok accounts per workspace.

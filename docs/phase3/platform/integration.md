# Platform integration boundaries

The three shared Phase 3 seed files, Phase 1 domain/contracts/tests, UI-owned source and
SIMULATED semantics are unchanged. Production has no bearer capability fallback. The old
Phase 2 capability harness is available only outside production without a workspace binding.

## UI lane requirements

1. Make `next/src/app/layout.tsx` render dynamically (for example `await connection()` from
   `next/server` in the root server layout). Nonce CSP requires every HTML response to render
   with the request's nonce; the current seed still prerenders static pages. This file belongs
   to UI and was intentionally not edited. Next automatically reads the nonce from the
   request CSP header; custom scripts/styles should use `x-nonce`. Inline CSS attributes are
   allowed to preserve existing styling; inline JavaScript/unsafe-eval are not allowed.
   See [Next CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).
2. Use login cookies with same-origin credentials. Login body is exactly `{username,password}`;
   logout body is `{}`. Both POSTs require exact configured HTTPS `Origin`, JSON content type,
   `X-LiveLift-Request: 1`; the browser supplies Origin. Session bootstrap/recovery is
   `GET /api/v3/auth/session` without deployment headers and returns frozen `AuthSession`.
   Authentication POST/session endpoints do not require deployment headers, allowing recovery
   of an unknown or restored generation. All room/receipt/export endpoints do require them.
3. Send `X-LiveLift-Workspace` and `X-LiveLift-Generation` from the returned session for every
   room/receipt/export request. Context selects no database. On 409 `recovery_required`, obtain
   a current session context and full snapshot, quarantine old pending commands, and never
   change their generation or automatically replay them. Restore clears login sessions, so
   old cookies ordinarily receive 401 before any generation check.
4. Use immutable `access.actorId` for pending isolation. Logout/account switch must discard
   another actor's installed REAL state. Viewer write denial is a boundary `ProductionError`
   (403) before command receipt lookup; revoked accounts cannot expose duplicate receipts.
5. Expose operator-only export. Auth expiry is absolute 12 hours. Network loss/503 after
   submission remains UNKNOWN; authority receipt reconciliation semantics are unchanged.

## Audit lane requirements

Adapt the existing Phase 2 HTTP harness to cookies/context/CSRF and boundary errors without
weakening its authority assertions. Default `npm test` skips its 20 live checks when no URL is
supplied. `node scripts/phase2-live.mjs` exercises the unchanged legacy assertions through the
explicit non-production harness. `node scripts/platform-smoke.mjs` separately exercises real
production CLI/HTTP authentication, storage, restart, backup and restore. Neither script is
an independent Phase 3 audit or a sustained production soak. A11y/browser verification and
longer soak belong to the UI/audit lanes.

## Deployment prerequisites

Set DNS/TLS/environment, real source commit, persistent storage permissions and protected
account credentials. Configure the daily verified encrypted off-host backup job and alerting;
measure recovery with real installation-sized data. No live off-host repository is provisioned
by this code change. Do not expose Next directly while trusting the Caddy client-IP header.

Production dependency scan: no reported high/critical runtime findings in the locked production
dependency tree. The full development scan reports two critical findings in Vitest/tinypool
and one moderate mocker finding. These packages are absent from the pruned runtime image;
there is no deployed Vitest endpoint. See GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr and
GHSA-82fw-gwwq-j7x9. Run CI/tests only for source whose code you already permit to execute;
a future test-tool upgrade should be validated independently of production semantics.

Production builds use the supported webpack backend. A fresh Node 22 Docker build exposed
a Turbopack Google-font URL parsing failure in the existing UI; webpack builds the same
UI source without changing its font or layout. The Docker context excludes local build caches.

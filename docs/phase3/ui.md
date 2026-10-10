# Phase 3 UI: production authentication, context and accessibility

This describes how the Next.js frontend consumes `docs/phase3/contract.md` and `next/src/contracts/production.ts`.
It changes how a person gets to the REAL room and how the browser proves who it is, not what REAL data means.
Every Phase 1/2 distinction is unchanged: missing ≠ zero, planned ≠ actual, recommendation ≠ acceptance,
acceptance ≠ attempt, attempt ≠ performed, unknown ≠ failed, REAL ≠ SIMULATED. SIMULATED is untouched and needs
no account. The Phase 2 description of the room store, polling, commands and outcome-unknown handling
(`docs/phase2/ui.md` §2–§8) still holds; this document lists what Phase 3 changes.

## 1. Authentication

The session is an opaque `__Host-livelift_session` cookie that the **server** sets and clears
(`Secure`, `HttpOnly`, `SameSite=Strict`). The frontend cannot read it and never tries to. It stores **no token**:
`lib/client/capability.ts` and the bearer capability UX are deleted, and nothing in `localStorage`, `sessionStorage`,
state, URLs, envelopes or logs is a credential. The only auth-related keys are two non-secrets:
`livelift.v3.lastGeneration` (the last restore generation seen, to notice a restore) and
`livelift.v3.recovery.ack` (which restore notice was read).

| File | Role |
| --- | --- |
| `lib/client/productionTransport.ts` | Header names, `buildHeaders`, error-body parsing, one bounded same-origin request |
| `lib/client/authClient.ts` | `POST /api/v3/auth/login`, `GET …/session`, `POST …/logout`, `GET /api/v3/workspace/export`; `parseAuthSession` accepts exactly the frozen `AuthSession` |
| `lib/client/authStore.ts` | The browser's account of who is signed in (below) |
| `lib/client/authorityClient.ts` | Room / command / receipt requests under the current session context |
| `lib/client/announcer.ts`, `components/ui/LiveAnnouncer.tsx` | The one channel for screen-reader announcements |
| `app/login/page.tsx`, `components/auth/*` | Sign-in screen, account control + sign-out, export control |

### States

| Status | Meaning | What the person sees |
| --- | --- | --- |
| `checking` | Asking the server whether this browser has a session | "Checking sign-in…" |
| `signed_out` | No session | Sign in link; REAL screens say "You are signed out" |
| `signing_in` | One login request is in flight | Busy button, read-only fields |
| `authenticated` | A session; `access.role` is operator or viewer | Account name + Sign out; role chip |
| `ended` | There *was* a session and the server now says 401 (expired **or** revoked; the server does not say which) | "Your session ended (it expired or was revoked)"; last confirmed state stays visible, frozen, read-only |
| `unavailable` | The session service or its storage could not be asked | "Sign-in is unavailable"; asked again every 5 s |
| `signing_out` | Logout in flight; protected state is already cleared | "Signing out…" |

- The session is read **only when a REAL view needs it** (Home, Sessions, Create, Prepare, Operate, Review) or on `/login`.
  Rehearsal-only screens still make no network request.
- Invalid credentials are one generic sentence for an unknown user and a wrong password. Throttling (429), storage
  trouble (503) and an unreachable server are named for what they are and are never reported as bad credentials.
- A second submit while a login runs is ignored (a synchronous guard in the form, and the store joins the in-flight
  request), so exactly one login request is sent. The password is cleared from component state the moment the request
  leaves and is never stored.
- `?next=` is accepted only as a path on this site (never another origin, never `/login`).
- **Logout** (a) drops the installed snapshot, role, unresolved list, resolutions and polling at once (before the server
  answers), (b) asks the server, (c) lands on signed-out. If a command is still in flight or unresolved, a dialog first says
  that signing out **does not cancel, undo or fail** it, runs the read-only receipt lookup, and lists what is still unknown.
  The records stay saved under that account's scope. If the server cannot confirm the logout, the browser is still signed out
  locally and says the server session may live on until it expires.
- A session that ends keeps the last confirmed REAL snapshot on screen (frozen, writes refused) until the *same* actor, workspace
  and generation sign in again (reading on from it) or anyone else does (drops it).

## 2. Production context and request transport

Every request is same-origin with `credentials: "same-origin"`, `cache: "no-store"` and `X-LiveLift-Request: 1`. POSTs add
`Content-Type: application/json`. There is no `Authorization` header and no way to add one.

| Request | Marker | JSON content type | `X-LiveLift-Workspace` / `-Generation` |
| --- | --- | --- | --- |
| `POST /auth/login`, `POST /auth/logout` | yes | yes | no (the session does not exist yet / is ending) |
| `GET /auth/session` | yes | – | no (it *establishes* the context) |
| `GET /room`, `POST /room/commands`, `GET /room/commands/{id}` | yes | POST | **yes** |
| `GET /workspace/export` | yes | – | **yes** |

The context comes from the CURRENT `AuthSession` (`authStore.getContext()`), read on every request, so a new generation
is used at once. No control lets a person type or choose a workspace or generation. If there is no authenticated session
nothing is sent: a read is "unauthenticated", a command is refused as *not sent*.

### What each status means

| Status / code | For a read | For a submitted command |
| --- | --- | --- |
| 401 `unauthenticated` | Session ended (expired/revoked) → `ended` | **UNKNOWN**, not rejected: the session may have ended after the server committed it (Phase 3 changes Phase 2's rule). Stored, reconciled after sign-in |
| 400 `context_required` | Blocking problem; session re-read; "Try again" | Refused, nothing recorded; session re-read |
| 404 `not_found` | **Wrong deployment** (this session's workspace/room is not what the server is for); never "show not found" | Refused (`wrong_deployment`) |
| 409 `recovery_required` | Session re-read; a new generation → full resnapshot (§4) | Refused, nothing recorded; session re-read |
| 403 `forbidden` | Access re-read (a role change) | Refused with a role-aware message; session re-read |
| 403 `csrf_failed` | "The server refused this browser's request as unsafe" | Refused |
| 429 `rate_limited` | Retried automatically | Refused, nothing recorded |
| 503 `storage_unavailable` | Storage unavailable, retried automatically | **UNKNOWN** |
| 503 `authority_unavailable` | Backend unavailable, retried automatically | **UNKNOWN** |
| timeout / dropped connection | Not current, reconnecting | **UNKNOWN** |

A receipt 404 still means "no record", which is **not** evidence of failure; wrong-deployment is detected by the room read.

## 3. Pending commands are scoped

The exact envelope is still written to `localStorage` (`livelift.v3.remote.pending`, now version 2) **before** it is sent, and is
never re-POSTed automatically. Each record now carries `scope = { actorId, workspaceId, generation }` from the authenticated
session at the moment it was made; the scope is written once and **never rewritten**.

| Stored record | For the signed-in actor `A` in workspace `W`, generation `G` |
| --- | --- |
| scope `(A, W, G)` | **Current**: shown as OUTCOME UNKNOWN, looked up by receipt, re-sent only by an explicit "Retry same action". Blocks new commands until resolved |
| scope `(A, W, other)` | **Quarantined** (older generation): listed, with only "Set aside". Never looked up, never re-sent, never moved to `G`. Does not block new commands |
| no scope (Phase 2 record) | **Quarantined** (legacy): listed as unattributed, only "Set aside". Never silently attached to any account |
| scope of another actor, or another workspace | Invisible. Not shown, not looked up, not counted, not deleted |

Writes re-read storage so other scopes' records are never lost. An answer that arrives after sign-out or a scope change is
recognised (an `epoch` moves with the scope): a receipt settles and removes its record; anything else is reported as UNKNOWN
("You signed out… may or may not have been recorded") and its record stays saved.

## 4. Restore and generation recovery

Recovery is triggered by `AuthSession.recoveryNotice` (the frozen field name; the brief calls it `recovery`) **or** a generation
different from the one this browser last saw (remembered per workspace) or from the one the page already held.

1. A changed scope drops the installed snapshot, clock and `awaitingSessionIds` and forces a **full** resnapshot (the next read
   has no `afterRevision`), under the new generation's headers.
2. Old pending envelopes are quarantined (§3), never replayed.
3. A restrained notice (not a modal) says: it was restored at *time*, from a backup taken at *time*, at room revision *n*; that
   anything recorded after the backup may be missing and what happened to it is **unknown, not failed**; that LiveLift discarded
   what it had on screen and reloaded from the restored data. When the server sent no facts the notice says only that it was
   restored since last use. It invents no failure, performed, ended or platform confirmation.
4. "I have read this" is remembered per workspace+generation for the tab; the notice is announced once (polite).

## 5. Connection and problem states

`RemoteState.problem` is why the room cannot be shown as current. **A problem is never an empty room:** Home/Sessions show a status
panel instead of the first-run card or "no sessions", and the Sessions empty text says "does not mean there are none".

| `problem` | Chip | Retried? |
| --- | --- | --- |
| `signed_out` | Signed out | Waits for sign-in |
| `session_ended` | Session ended | Waits for sign-in |
| `auth_unavailable` | Sign-in unavailable | Every 5 s |
| `unreachable` | Not current · reconnecting (· last contact Ns ago) | Every second |
| `backend_unavailable` | Room unavailable | Every second |
| `storage_unavailable` | Room storage unavailable | Every second |
| `rate_limited` | – | Every second |
| `wrong_deployment` | Wrong workspace | No; "Try again" / "Sign out" |
| `context_required`, `request_refused`, `forbidden` | Session context problem | No; session re-read; "Try again" / "Sign out" |
| `recovery_required` | Room restored · reloading | After the session is re-read |

Stale/offline/reconnect semantics are otherwise Phase 2's (last committed snapshot kept and labelled, every mutation disabled,
authority time frozen, no optimistic REAL transition).

## 6. Viewer and operator

The role is **not trusted from the browser's cache**. Each room read reports `access`; it replaces the session's role
(`authStore.observeAccess`), announces a change once, and the store refuses to send for a viewer. A 403 re-reads the session. A
revocation or role change (which the contract says revokes sessions) arrives as a 401 and ends the session without a reload.
Viewers: read-only chip, disabled mutations, no workspace export (disabled with the reason). Operators: the unchanged command
flow and the export action.

## 7. Export

`Sessions → Export workspace data` (operators only; disabled with a note for viewers): `GET /api/v3/workspace/export` with the
cookie, marker and context headers. The body is saved only if it is `formatVersion: 1` **and** names this session's workspace
and generation. Results: saved (file name + as-of time), session ended, forbidden, wrong context (including 409 after a restore),
rate limited, storage / backend unavailable, unreachable, or "this browser could not start the download". The status line is the
control's own polite region. There is **no import**; the page says the file is a copy for records, excludes passwords and
sign-in details, and cannot be imported back.

## 8. First REAL setup

Unchanged flow: sign in → Home → **Create** → **Prepare** → **Start LIVE** → **Operate** → **End** → **Review** → **Next LIVE**.
The default `next` is Home, whose first-run card appears only for a *connected, genuinely empty* room. Driven end to end with the
keyboard alone in a real browser (see §11).

## 9. Accessibility

| Requirement | How |
| --- | --- |
| Keyboard reachable, logical order | Native `button`/`a`/`input`; no positive `tabindex`; skip link first, to `#main-content` (a focusable `<main>` in both shells) |
| Visible focus | Global `:focus-visible` 2 px ring (verified computed in Chromium) |
| Labelled inputs | Login fields; Add note textareas and the correction field (found unlabelled by the audit and fixed) |
| Dialog title / description / trap / restore | `Dialog` is `role=dialog aria-modal`, named by its title, described by `description` or else its first paragraph, traps Tab/Shift+Tab, restores focus to the opener |
| Background inaccessible | `Dialog` renders in a portal and sets `inert` + `aria-hidden` on every other `<body>` child (restored exactly, nested dialogs stack); the live-region host (`data-keep-live`) stays live |
| Busy dialogs | "The action has already been sent to the room. This window cannot cancel it." Cancel disabled, Escape ignored while waiting; `aria-busy` |
| 200 % zoom | Standard-shell header wraps below 1024 px (it ran off-screen and clipped Sign out); verified zero horizontal overflow and all actions reachable at 820, 1024, 960×540@2× and 640×360@2× |
| Reduced motion | Existing global rule (animation/transition ≈ 0) verified under `prefers-reduced-motion: reduce` |
| Live regions | Two always-present regions (polite status, assertive alert) in the root layout. Announced: session ended, signed out, role changed, contact lost, contact restored, a command's final answer (recorded / not accepted / unknown / refused), earlier actions still waiting, restore notice |
| No timer announcements | Nothing ticking is in a live region. The WHY box (its detail counts down) is no longer `aria-live`; a hidden status speaks only tone + headline changes. Tests observe live regions for 2.3 s of ticking and assert no mutation |

Automated evidence is `__tests__/phase3-ui/a11y.ui.test.tsx`: a structural audit (names, labels, unique ids, tabindex, dialog
name/modality, dangling references) of Login, Home, Sessions + Export, Create, Prepare, Operate, Review, Next LIVE, every critical
dialog, and the stale / signed-out / ended states, plus a negative control proving the audit can fail. **axe is not available:**
`package.json`/lock are frozen in this lane and `axe-core` is not installed, so P3-A11Y's "automated axe" still needs running at
integration. No screen-reader session was run: the "manual keyboard and scoped screen-reader evidence" remains for the audit lane.

## 10. CSP and layout

`app/layout.tsx` is now an async server component that `await connection()`s, opting **every** route into per-request rendering,
which Next.js requires to apply a CSP nonce. It adds no inline script or style, does not read or set a header, and does not weaken
anything. Verified on a production build: all 16 emitted `<script>` tags on every page receive `nonce="…"` when the request carries
`Content-Security-Policy: script-src 'nonce-…'`, and the server HTML contains zero inline `style="…"` attributes (React's
`style` props are applied by the client through the CSSOM, which a nonce CSP allows).

**Dependency on the platform lane:** `src/proxy.ts` must generate the nonce and set it on the *request's* `Content-Security-Policy`
header (Next reads it there) and on the response; the Caddyfile must not cache HTML. This lane cannot test real CSP enforcement or
`__Host-` cookie behaviour until that exists.

## 11. Verification

- Unit/UI: `__tests__/phase3-ui/*` (transport, auth store, pending scoping, login UI, connection/restore UI, export UI,
  accessibility) and the updated Phase 2 `remote.*` / `ui.flow` suites. `helpers/fakeRoom.ts` now speaks the production wire
  contract (cookie session, marker, context, generation, restore, storage/backend faults) and is test-only.
- Browser (Chromium, built app, backend simulated by the same `FakeRoom` through request interception): login, error, skip link,
  focus rings, dialog trap/restore/inert, storage/backend/session/restore states, viewer, export download, tablet, 200 % zoom,
  reduced motion, and the whole keyboard-only Create → Prepare → Operate → Review → Next LIVE flow.
- SIMULATED regression: screenshots of the Simulator, a rehearsal's Operate / Prepare / Review, Products and Integrations are
  **pixel-identical to the pre-change build** at 1440×900, 1280×720 and 1024×768. At 390×844 the shell header now wraps (it previously
  hid Products, Simulator and Integrations off-screen); that is the intended reflow repair.

## 12. Cross-lane assumptions

1. `POST /auth/login` answers 200 with an `AuthSession` body (if it answers 2xx without one, the client asks `GET /auth/session`).
2. `POST /auth/logout` answers 2xx (or 401 = already ended); the server clears the cookie.
3. `GET /auth/session` answers 401 `unauthenticated` without a session and 503 `storage_unavailable` / `authority_unavailable` when it cannot ask.
4. Room, command and receipt endpoints keep their Phase 2 paths and bodies; receipt-not-found is 404.
5. 401 does not distinguish expiry from revocation; the UI says "expired or revoked".
6. `recoveryNotice` may be returned for as long as the server likes; the client shows it once per generation until acknowledged.
7. The browser's `Origin` on unsafe requests equals the configured origin (the app is served at it).
8. The platform proxy provides the nonce CSP as in §10.

## 13. Contract notes and deviations

- No frozen file was edited. The brief says `AuthSession.recovery`; the frozen type is `recoveryNotice`, and that is what is used.
- A 401 to a submitted command is UNKNOWN (Phase 3 contract), where Phase 2 treated it as a definite rejection.
- `X-LiveLift-Request` is also sent on GETs (harmless; the contract requires it only on unsafe requests).
- Legacy (unscoped) pending records are shown to whoever signs in, as unattributed recovery items with the label only. That is the
  only way to avoid either dropping them silently or attaching them to an account; they are never looked up or sent.

## 14. Could not be independently tested before platform integration

- Real cookie behaviour (`__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Strict`, absolute 12-hour expiry, revocation on role
  change) and the exact-`Origin` CSRF check: they need the HTTPS reverse proxy and the real server.
- CSP enforcement in a browser (only nonce *plumbing* was verified), HSTS and the other security headers.
- A real database restore, real login throttling and real storage faults (all simulated by the test double).
- Automated axe and a manual screen-reader pass.
- The export of a large real workspace and the 60 s export timeout.

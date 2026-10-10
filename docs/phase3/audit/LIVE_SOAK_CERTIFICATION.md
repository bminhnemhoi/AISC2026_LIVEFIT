# Live soak CLI certification — 2026-10-07

Starting commit: `636eeea60d32a72e0d7028387de5d1b0de06c386`.
Worktree: `/home/towfienes/Projects/v3-release-soak-fix`.
Branch: `orca/v3-release-soak-cli`; verified clean before work.
Target: the existing Node 22.23.3 RC.1 staging deployment, whose product runtime was unchanged.

The prior command required an absent `tsx` package and addressed a module with no argument
parsing or invocation. Its legacy runner also allowed simulated fallback and ignored login
failures; it could not certify a live production soak. That simulated CI test is preserved.

The canonical `acceptance/soak.mjs` uses the already locked TypeScript compiler to compile
only `ProductionClient` and `liveSoak.ts` into temporary ordinary JavaScript. The CLI runs
real HTTP calls exclusively, with frozen cookie/context semantics and explicit reauthentication.
No `tsx` or other dependency was added; the lockfile and product runtime files are unchanged.

## Exact staging configuration and commands

Run from the worktree's `next/` directory with Node 22.23.3 on PATH. For this local
certification, the Node binary was copied from the running production container to
`/tmp/livelift-v3-rc1/node22`, and `bin/node` links to it. The public staging CA was copied
from Caddy; TLS certificate verification remained enabled.

```sh
export PATH=/tmp/livelift-v3-rc1/bin:$PATH
export NODE_EXTRA_CA_CERTS=/tmp/livelift-v3-rc1/caddy-root.crt
export LIVELIFT_TEST_SERVER_URL=https://livelift.localhost
export LIVELIFT_APP_ORIGIN=https://livelift.localhost
export LIVELIFT_WORKSPACE_ID=8eb10630-0d31-4cad-9a47-9e6778608f76
export LIVELIFT_ROOM_ID=studio
export LIVELIFT_OPERATOR_USERNAME=staging-operator
export LIVELIFT_VIEWER_USERNAME=staging-viewer
export LIVELIFT_OPERATOR_PASSWORD_FILE=/tmp/livelift-v3-rc1/secrets/operator.pass
export LIVELIFT_VIEWER_PASSWORD_FILE=/tmp/livelift-v3-rc1/secrets/viewer.pass
export LIVELIFT_SOAK_OPS_EXECUTABLE=/tmp/livelift-v3-rc1/soak-ops

npm run soak:smoke -- --duration 60s
npm run soak:48h -- --duration 30s
```

The existing files were owned by the invoking user with mode 0600. Neither password was
passed in argv, placed in an environment variable, copied into the repository, or printed.
Generation was discovered from the real login responses and pinned for each run.

The outside-repository ops wrapper was mode 0700 and contained:

```sh
#!/bin/sh
exec docker exec livelift-v3-rc1-next-1 node .ops/scripts/ops.js "$@"
```

With the same environment, the full endurance command is:

```sh
npm run soak:48h -- --duration 48h
```

Its entry point was exercised live using the 30-second override, and the actual 48-hour
duration/defaults were checked by regression tests. **The complete 48-hour run was not
performed in this tooling fix and remains a final release gate.**

## Real activity and invariant evidence

Both processes exited **0** and printed final `PASS`.

| Measurement | Smoke | Rehearsal entry point |
|---|---:|---:|
| Configured duration | 60 seconds | 30 seconds |
| Measured elapsed time | 60,040 ms | 30,019 ms |
| Operator / viewer logins | 1 / 1 | 1 / 1 |
| Operator / viewer successful polls | 82 / 70 | 22 / 19 |
| Auth session checks | 24 | 2 |
| Committed commands / durable receipts | 12 / 12 | 3 / 3 |
| Rejected commands | 0 | 0 |
| Discarded acknowledgements reconciled | 3 | 1 |
| Exact duplicate replays verified | 3 | 1 |
| Injected read interruptions recovered | 6 | 2 |
| Health / readiness probes | 12 / 13 | 1 / 2 |
| Ops status / verified online backups | 12 / 1 | 1 / 1 |
| Invariant checks / violations | 3,602 / 0 | 1,145 / 0 |
| Errors | 0 | 0 |
| Room revision | 13 → 25 | 25 → 28 |

The first command in each run created one planned REAL draft. Later commands used
`save_prepare` against only that run's draft. Operator and viewer reads observed the
committed title and session revision. No show was started, restored, deleted or reset.

Generation stayed `79801321-10cb-479e-9e2f-7ea569d156e9`. Checks covered deployment/actor
binding, role truth, monotonic room/session revisions, identical snapshots at equal revision,
REAL-only sessions, single-active-show enforcement, append-only ordered operator history,
session retention, receipt identity/revision/atomicity, duplicate replay and mutation visibility.

Post-run ops status reported `ready: true`, `integrity: "ok"`, schema 2, maintenance false,
revision 28, four retained sessions, 31 receipts and two accounts. The two pre-existing
sessions remained retained; the two new planned drafts are audit evidence.

Captured stdout/stderr were scanned against both actual password file contents and cookie/
token markers, without printing the search values: **PASS**. Subprocess regression tests
also injected canary passwords, tokens, cookies and server error text: **none appeared in
output**. Reports contain counters and nonsecret identity only.

## Validation and release status

All local validation used Node **22.23.3**:

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero errors/warnings |
| `npm test` | PASS, 36 files; 502 passed, 57 existing opt-in live tests skipped |
| Focused soak file | PASS, 16 tests including the two preserved tests |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS, zero vulnerabilities |
| Production Docker build (`docker/next.Dockerfile`) | PASS, Node 22.23.3; final image `c77069e17684` |
| Docker `npm prune --omit=dev` | PASS, 27 packages audited, zero vulnerabilities |
| Final image dependency probe | PASS; `tsx`, TypeScript, Vitest, ESLint and soak CLI absent; ops CLI retained |

The focused tests exercise CLI parsing, invalid durations, both modes, protected password
files, redaction, nonzero invariant/auth failure, dropped connection/ack recovery, explicit
session reauthentication and SIGINT/SIGTERM final summaries. A healthy stop prints
`STOPPED` and exits 130/143; it never certifies a completed endurance run.

Dependency lists and `package-lock.json` remain byte-for-byte unchanged. Full development
installation still reports the pre-existing three development vulnerabilities; the production
audit is clean. No dependency upgrade is part of this release-tooling fix.

LIVE SOAK CLI: **PASS**. SHORT LIVE SOAK: **PASS**. READY FOR RC.2: **YES**, as a release
candidate with executable soak tooling. The full 48-hour endurance evidence remains pending
before final V3 release certification. No product modification or push was performed.

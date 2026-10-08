# Platform lane validation

Starting commit: `77f4ae4ae0307739bcd1f79391b53a26f429520a` on
`orca/v3-phase3-platform`. Frozen seed files, domain/authority contracts, Phase 1 tests,
SIMULATED semantics and UI-owned source were not changed.

Local validation completed:

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:ops`, `npm run build`:
  passed. Default suite: 16 files, 302 passing tests, 20 live-only tests skipped.
- `npm run test:phase2-live`: all 21 tests passed, including CHK-01 through CHK-20,
  using the unchanged authority assertions through the explicit non-production HTTP harness.
- `npm run test:platform`: five focused scenario groups passed, including HTTP auth,
  expiry/revocation, delayed-body revocation, viewer denial, wrong room/context/generation,
  migration rollback, missing/newer database, verified backup/restore, disabled restored
  accounts, active LIVE deletion refusal, incomplete deletion, retirement, readiness,
  request bounds, limiter bounds and secret-safe logging.
- Production CLI/HTTP smoke: 66 assertions passed on the host. Final standalone Docker
  image: the same 66 assertions passed on Node 22.23.3, UID 1000, read-only root filesystem,
  writable temporary storage. Restore to authenticated read: **2,067 ms** for the small
  test database, including account revalidation. This is not an installation-sized RTO.
- Clean Docker build passed with the supported webpack backend and no local build cache
  in the context. Compose configuration and Caddy configuration validation passed.
- Restic encrypted test repository: backup, full data check and workspace-specific snapshot
  deletion passed; another workspace's tagged snapshot remained. Real off-host credentials,
  scheduling and alerting are deployment prerequisites.
- `npm audit --omit=dev --audit-level=high`: **zero vulnerabilities**. Development-only
  advisories and their deployment reachability are recorded in `integration.md`.
- `git diff --check`: passed. No push performed.

The integration prerequisites in `integration.md` remain explicit: UI dynamic rendering for
nonce CSP and production cookie/context flows, independent production authority/a11y/soak
acceptance, and real off-host recovery measurement. Platform lane completion is not evidence
that those other lanes or a production rollout are complete.

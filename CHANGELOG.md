# Changelog

High-level history of the current LiveLift product. Individual changes are in the git history; certification reports are linked where they exist.

## Unreleased: certified build `419c07d` (2026-10-08)

This is the build described in the [README](README.md). It is not tagged yet: the `v3.0.0-competition` tag marks the earlier V3 freeze below.

**V7: LIVE Intelligence**
- Provider-evidence layer: immutable snapshots in a separate evidence store, minute-level provider evidence, segment attribution with ambiguous boundary minutes assigned to neither segment, product performance through explicit mappings, exact decimal money.
- TikTok Shop provider adapter with request signing and strict parsing. Real Shop analytics remain blocked by seller-account entitlement; demos use labelled fixture evidence.
- Review perspectives *As known then* and *With later evidence*; Quick Cues; provider capability ledger; AI Review that cites provider facts with provenance.
- [Integration acceptance](docs/tiktok/V7-INTEGRATION-ACCEPTANCE.md): 72/72 browser checks; final competition harness 234/234.
- Final UI polish from a full-product audit: Review reading order, keyboard-focusable regions, heading outline, Integrations layout.

**V6: competition experience and certification**
- Final competition certification harness covering the full journey at three viewports, in not-configured and fixture configurations ([FINAL-CERTIFICATION.md](docs/competition/FINAL-CERTIFICATION.md)).
- Responsive polish of the complete competition experience.

**V5: operational intelligence and AI Copilot**
- Insights: operational analytics from LiveLift's own records (overruns, start drift, cue coverage, repeated deviations, Next LIVE history) with missing data kept distinct from zero.
- AI Copilot for Operate, Review and Next LIVE: optional, server-side, validated answers, recommendations never applied automatically ([COPILOT.md](docs/ai/COPILOT.md)).

**V4: TikTok Login Kit**
- TikTok Login Kit OAuth with server-side encrypted tokens and a provider-observed profile; Terms and Privacy pages for the TikTok app review ([docs/tiktok](docs/tiktok/README.md)).

**Competition launcher**
- `start-`, `check-`, `stop-` and `reset-livelift-demo` scripts for isolated SIMULATED rehearsals, plus an emergency demo kit.

## v3.0.0-competition (2026-10-07, `af55b09`)

V3 competition-ready frozen build: the product reset from the original research platform to an operations desk.

- **Product reset**: Create → Prepare → Operate → Review → Next LIVE, NOW / NEXT / WHY / ACTION, hard anchors and transparent recovery options, REAL / SIMULATED separation.
- **Phase 2: authoritative LIVE room.** A single-room backend with a recorded command history; REAL sessions migrated to server authority.
- **Phase 3: production hardening.** Accounts and operator / viewer roles, production authentication UX, CSRF and CSP, persistence, backup and restore, operations CLI, Caddy HTTPS deployment ([runbook](docs/phase3/platform/runbook.md)).
- Competition onboarding, capability centre and demo experience.

Release candidates: `v3.0.0-rc.1` (Phase 3 production hardening passed) and `v3.0.0-rc.2` (executable 48-hour live soak tooling).

## Original research project (before 2026-10-02)

The original LiveLift ([bminhnemhoi/AISC2026_LIVEFIT](https://github.com/bminhnemhoi/AISC2026_LIVEFIT)): a switchback experimentation platform with a Python statistical core, FastAPI API, Next.js 14 control desk and Vietnamese comment-privacy filtering. See the [original README](docs/legacy/ORIGIN-README.vi.md).

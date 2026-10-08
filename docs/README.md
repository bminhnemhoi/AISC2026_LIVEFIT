# LiveLift documentation

This repository holds two bodies of work. The **current product** is the Next.js application in [`next/`](../next). The **original research project** is the Python switchback-experiment platform it grew from. Its documents are kept for provenance, and most are in Vietnamese. When the two disagree, the current-product documents describe the system as it is now.

Start with the [root README](../README.md).

## Current product

**Product definition**

- [Product vision](product/01_PRODUCT_VISION.md) · [Golden path](product/02_GOLDEN_PATH.md) · [Prepare](product/03_PREPARE.md) · [Operate](product/04_OPERATE.md) · [Review](product/05_REVIEW.md)
- [Frontend architecture](architecture/FRONTEND_REBUILD.md)

**Capabilities**

- [AI Copilot](ai/COPILOT.md): configuration, states, what the model receives and what it may not claim
- [Operational analytics (Insights)](analytics/INTELLIGENCE.md) · [V5 intelligence acceptance](integration/V5-INTELLIGENCE.md)
- [TikTok Login Kit integration](tiktok/README.md) · [Sandbox setup](tiktok/SANDBOX-SETUP.md) · [Feasibility](tiktok/FEASIBILITY.md)
- LIVE Intelligence: [implementation](tiktok/LIVE-INTELLIGENCE-IMPLEMENTATION.md) · [experience](tiktok/LIVE-INTELLIGENCE-UX.md) · [V7 integration acceptance](tiktok/V7-INTEGRATION-ACCEPTANCE.md)
- LIVE Intelligence research inputs (hypotheses, corrected by the implementation): [R&D](tiktok/LIVE-INTELLIGENCE-RD.md) · [roadmap](tiktok/LIVE-INTELLIGENCE-ROADMAP.md)

**Platform and operations**

- [Phase 2 authority contract](phase2/contract.md) · [Phase 2 backend](phase2/backend.md) · [Phase 2 UI](phase2/ui.md)
- [Phase 3 production contract](phase3/contract.md) · [Phase 3 UI](phase3/ui.md)
- [Platform runbook](phase3/platform/runbook.md) · [Integration boundaries](phase3/platform/integration.md) · [Platform validation](phase3/platform/validation.md)
- Audits: [Phase 2](phase2/audit/ACCEPTANCE_MATRIX.md) · [Phase 3](phase3/audit/ACCEPTANCE_MATRIX.md) · [Live soak certification](phase3/audit/LIVE_SOAK_CERTIFICATION.md)

**Demo and certification**

- [Competition demo (presenter guide)](competition/v3-demo/README.md) · [Judge guide](competition/v3-demo/JUDGE-GUIDE.md) · [Presenter cheat sheet](competition/PRESENTER-CHEATSHEET.md) · [Emergency kit](competition/EMERGENCY-DEMO.md)
- [Final competition certification](competition/FINAL-CERTIFICATION.md) · [Launcher verification](competition/LAUNCHER-VERIFICATION.md) · [Integration acceptance](competition/integration-acceptance.md) · [Browser audit](competition/browser-audit.md) · [Capability positioning](competition/capability-positioning.md)

**Roadmap and validation**

- [V3 master roadmap](roadmap/LIVELIFT_V3_MASTER_ROADMAP.md)
- [Field validation protocol](validation/v3/00_VALIDATION_PROTOCOL.md) (protocol and templates; no results published) · [Validation audit](validation/v3-audit/FINAL_AUDIT.md)

Several of these documents were written at the end of a phase and describe the product as it was then. In particular, the V3 demo and capability documents predate the TikTok Login Kit (V4) and LIVE Intelligence (V7) work. The [CHANGELOG](../CHANGELOG.md) gives the order.

## Original research project (legacy)

The original LiveLift ([bminhnemhoi/AISC2026_LIVEFIT](https://github.com/bminhnemhoi/AISC2026_LIVEFIT)) measured whether in-stream actions cause more clicks, using switchback experiments and randomization inference. Its code remains in `src/`, `tests/`, `web/`, `collectors/`, `analysis/` and the Python scripts in `scripts/`, and it is not part of the current product.

- [Original README](legacy/ORIGIN-README.vi.md) and [original contribution guide](legacy/ORIGIN-CONTRIBUTING.vi.md) (Vietnamese)
- Method: [PREREGISTRATION.md](../PREREGISTRATION.md) · [HARNESS.md](../HARNESS.md) · [research reports](research/) · [benchmarks](benchmarks/)
- Guides: [user guide](HUONG-DAN-SU-DUNG.md) · [testing guide](HUONG-DAN-TEST.md) · [platform API keys](HUONG-DAN-LAY-KHOA-API.md) · [startup and troubleshooting](khoi-dong-va-su-co.md) · [data storage](luu-tru-du-lieu.md) · [supported platforms](nen-tang-ho-tro.md) · [golden demo](demo-vang.md)
- Project record: [project summary](TONG-KET-DU-AN.md) · [incident log](incident-log.md) · [research log](research-log.md) · [fact sheet](competition/FACT-SHEET.md)
- Competition dossier (Sáng tạo trẻ 2026): [competition/sang-tao-tre-2026/](competition/sang-tao-tre-2026/noi-dung.md)
- Screenshots of the original interface: [img/](img/) (everything except `img/readme/`)

CI checks the two tracks independently: Python fast tests and nightly statistical validation for the original research, and typecheck, lint, Vitest, build and production dependency audit in `next/` on Node.js 22.23.3 for the current product. The `web/` build remains a legacy check. These jobs do not run full browser certification; Vitest's live-server cases require a configured test server.

`legacy/ORIGIN-README.vi.md` is a historical snapshot. Research evidence checks use that archive and `competition/FACT-SHEET.md`, with the incident log and benchmark reports as sources. `scripts/dong_bo_so_test.py` synchronizes Python **collected** test counts in the legacy web page, fact sheet and competition dossier. It writes neither README and never invents passed-test results; recorded run results stay tied to their original date and commit.

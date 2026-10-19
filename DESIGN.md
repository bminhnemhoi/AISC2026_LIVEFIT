# LiveLift landing

## Direction

Vietnamese product introduction for sellers and livestream operators. Reuse the existing Calm Studio identity: paper, brown ink, brick actions, square edges, self-hosted Be Vietnam Pro, and the team's SVG illustrations. Large type and an illustrated working tabletop lead into an interactive product preview and a scroll story. The visitor should understand the product and enter its working demo.

## Evidence and accepted tokens

- Dembrandt source: `http://localhost:3130/`, original LiveDesk home, extracted 2026-10-19 before replacement.
- Extraction: `job_1792394632333_0hlfkd`; viewport 1920×1080, light theme, fonts ready, one page.
- Reuse `next/src/components/livedesk/calm.css` directly: `--bg: #f6f3ee`, `--ink: #2a2522`, `--ink-2: #5a5047`, `--ink-3: #6e6359`, `--signal: #9e3b2b`, `--paper: #fbf7ef`, `--line: #d8d0c4`.
- Wordmark follows the supplied reference: brown `Live`, brick `Lift`, dotless i with an upward triangle. Shared `WordmarkText` in livedesk/LogoMark.tsx renders the header, footer, large footer and app shell consistently.
- Font: existing self-hosted Be Vietnam Pro with Vietnamese subsets. Display 400, labels 400/500; body follows the existing family.
- Layout extends the existing 8px spacing grid with a 1280px content width and responsive 20/32/56px gutters. The CSS, not this document, applies all tokens.
- Observed extraction gap: document metadata/global dark tokens were elected as background/text despite the light `.ld` surface. Accept the rendered `.ld` tokens; do not copy the automatically inferred dark semantic roles.
- Reference found through Awwwards MCP: [Easyseller](https://www.awwwards.com/sites/easyseller-elevate-your-sales), live URL https://www.easyseller.it/; desktop capture 1440×900. Informs the large typographic opening and one dominant subject illustration. Its palette, serif font, assets and heavy effects are not copied.

## Page and motion

- `/` is the landing; the original application home is `/home`. Existing `/start`, `/desk/*`, `/phien` flows remain reachable.
- Narrative: opening → operating problem → three-stage scroll story → interactive LiveDesk preview → switchback explanation → product principle → before/during/after workflow → project status → FAQ → demo invitation → footer.
- One sticky scene transforms the same product object and morphs one SVG signal path from noisy to stepped to measured. IntersectionObserver follows native scrolling; no scroll interception.
- Native CSS scroll timeline drives reading progress and a small hero parallax where supported. Entrance motion uses individual `translate` so responsive transforms remain intact.
- `prefers-reduced-motion` removes animation, transitions and smooth scrolling; scene content still updates.
- All preview figures and charts are labeled illustrations. No fabricated endorsements, customer counts or revenue claims.

## Validation

- Playwright: 390, 768, 1440px; horizontal geometry, three morph states, preview controls, FAQ, reduced motion; inspect mobile menu, keyboard, CTA destinations and retained application routes.
- Dembrandt contrast: body/secondary/muted text, primary CTA and dark-section accent pass AA (5.28–13.69:1).
- Maximum two visual repair rounds. Scope is `next/`; root Docker Compose still serves the independent legacy `web/` application.
- Final run, 2026-10-19: isolated production Chromium passed all three widths, three morph states, three preview views, FAQ, mobile menu and reduced motion; zero page/console errors. Heights: 8941/7852/9739px at 1440/768/390px.
- 58 retained LiveDesk tests and 3 landing tests passed; final production build and TypeScript passed. Safari/Firefox and real platform integrations were not exercised.

## Swiss technical insert (2026-10-19)

- User supplied a Jev-like scientific editorial reference and requested a few matching sections, with colours adapted to LiveLift and an exact pre-experiment rollback point.
- Primary reference: https://typesafe.ai/ — inspected at 1440×900 and 390×844 with Playwright. Borrow dense diagram panels, tight bold headings, measurement marks and restrained holographic illustrations.
- Secondary reference: https://teenage.engineering/products/ep-133 — inspected at 1440×900 and 390×844. Borrow product-specification grids, thin technical rules and a single warm accent.
- Dembrandt: TypeSafe one-page light-theme extraction `job_1792402904545_f56k4k`, 1920×1080. Observed dark #1e1e1e, off-white #fefefe, pink #f386a1 and green #03aa5c; display 150px/0.80 and 64px/0.90, plus terminal/mono labels and frequent 1px rules.
- Gaps: the reference's body font is a fallback; its actual display/terminal fonts are custom. Do not copy proprietary fonts or the tight line height onto Vietnamese. Retain the existing local Be Vietnam Pro and readable leading.
- Applied to `.lp-atlas`: warm paper #eee9e1, existing brown ink/brick, thin rules and flat fills from existing `--signal-soft`, `--surface-3`, `--surface-2` and `--signal` tokens on authored SVG diagrams. Only the small measurement labels use system monospace.
- Applied to the switchback sheet: diagram grid, hatched TẮT cells and registration marks. The middle statement adds a brick-coloured orbital glyph and stronger typography.
- The hero, navigation, approved wordmark, interactive preview, product flow and reduced-motion behaviour retain their established design.
- Mobile: the atlas stacks vertically. Tablet gives each illustration its own row inside the three-column grid; copy never sits underneath a diagram.
- Rollback source: ignored `.handover/swiss-before/` contains the three exact pre-experiment files. Restore them and remove only `next/src/components/landing/SignalAtlas.tsx` to return to the state after the wordmark adjustment.
- Final Swiss insert validation: 61 related tests, type checking and production build passed. Isolated production Chromium at 1440/768/390 passed geometry, morph states, preview controls, FAQ, mobile menu and reduced motion with zero console/page errors. Atlas contrast pairs pass AA at 4.84–12.54:1. Evidence and references live in ignored `.handover/swiss-evidence/`.
- Colour correction requested by user: remove all rainbow/foil gradients, including the orbital glyph. Technical illustration fills now use only the existing warm brick, brown and beige palette. The pre-Swiss rollback baseline remains intact.

## Navigation layout regression (2026-10-19)

- Reproduced the reported giant pin: fresh landing gives 110px, client navigation to `/home` or `/start` followed by Back gives 929px at the tested desktop viewport. Hero light/phone/arrow also expand.
- Cause: shared `.ld .brand { width: 100% }` and landing component sizing both had specificity 0,2,0. Navigation could load the shared stylesheet last. Shared defaults now use `.ld :where(.brand)` so component dimensions win regardless of load order.
- Related reproduced issue: the same navigation changed seven h2 headings from weight 400/line-height 1.25 to 500/1.3. `.ld.lp h2` now outranks the shared heading reset, including its mobile size rule.
- Final decorative pin has an explicit maximum width, ignores pointer input, and is clipped to its isolated CTA section. It cannot cover the footer or intercept the CTA.
- Regression script: `next/acceptance/landing-layout.playwright.js`, run with the installed Playwright CLI after opening the dev/fixture URL. It checks SVG dimensions, heading/control typography, horizontal overflow, maximum pin size and CTA hit target across 320/390/640/768/959/1024/1440/1920px, fresh and after Back from both app entry routes.
- The script failed before each corresponding fix and passed all 24 dev states after the fixes. Existing 61 related tests and production build/type checking also passed.
- Keep the shared CSS regression fix if restoring the pre-Swiss design baseline; it is independent of that visual experiment.
- Final validation: all 24 navigation/layout states pass in both dev and isolated production, zero production page/console errors. Before/after captures and report: ignored `.handover/layout-regression/`. Preserve the h2 specificity and final-CTA guards as well when restoring an older visual baseline.

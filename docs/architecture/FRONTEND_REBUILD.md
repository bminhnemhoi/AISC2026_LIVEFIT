# LiveLift Frontend Rebuild Architecture & Specification

## 1. Executive Summary & Stack

This document details the architectural foundation, design tokens, domain contracts, deterministic simulator, and semantic invariants for the rebuild of LiveLift's frontend under `/next`.

LiveLift is an operational decision, evidence, replay, and learning workspace for livestream commerce. It guides operators through the complete operational lifecycle:
$$\text{PREPARE} \longrightarrow \text{OPERATE} \longrightarrow \text{RECORD} \longrightarrow \text{REVIEW} \longrightarrow \text{LEARN} \longrightarrow \text{NEXT LIVE}$$

### Technical Stack
- **Framework**: Next.js 16.3.8 (App Router, Turbopack, `output: "standalone"`)
- **Runtime**: Node.js 22 LTS / React 19.3.0 / React DOM 19.3.0
- **Language**: TypeScript 5.8 (Strict mode, zero `any` casting enforced via ESLint)
- **Styling**: Tailwind CSS 4.x (`@tailwindcss/postcss`, native CSS variables, no legacy `tailwind.config.js`)
- **Icons**: Remix Icon 4.6.0
- **Validation**: Zod 3.24.2
- **Testing**: Vitest 3.2.7 with React Testing Library and `@testing-library/jest-dom`
- **Port Assignment**: Local development and host testing runs on `http://127.0.0.1:3130`

---

## 2. Repository Boundaries & Complete Isolation

The new frontend lives strictly in `/next`. The legacy frontend `/web` is retained as read-only reference for backend endpoint schemas and deployment history.
- **Zero Imports**: No file in `/next` imports from `/web`.
- **Zero Shared Dependencies**: All dependencies are managed independently inside `next/package.json` with its own `next/package-lock.json`.
- **Standalone Artifact**: Built with `output: "standalone"` producing an optimized Node server in `next/.next/standalone/server.js`.

```
LiveLift-next/
├── next/                             # New Frontend Application
│   ├── src/
│   │   ├── app/                      # Next.js App Router (All P0 routes)
│   │   │   ├── globals.css           # Tailwind 4 + LiveLift Control tokens
│   │   │   ├── layout.tsx            # Root layout with Google Rubik font
│   │   │   ├── page.tsx              # Home / Desk Launcher
│   │   │   ├── live/
│   │   │   │   ├── new/              # Create Live (Blank / Pack / Session clone)
│   │   │   │   └── [sessionId]/
│   │   │   │       ├── prepare/      # Prepare Workspace (3 columns)
│   │   │   │       ├── operate/      # Operate Desk (NOW / NEXT Command Band)
│   │   │   │       ├── wrap/         # Session Wrap & Unsynced Draft Review
│   │   │   │       └── review/       # Replay, Dual Lens & Learn / Next Live
│   │   │   ├── sessions/             # Session list & history
│   │   │   ├── products/             # Product & Pack library
│   │   │   └── integrations/         # Capability matrix & Manual guarantee
│   │   ├── components/
│   │   │   ├── ui/                   # Shared UI primitives (WCAG 2.1 AA)
│   │   │   └── shell/                # Canonical shell & focused operational bars
│   │   ├── contracts/                # Runtime schemas (Zod) & semantic contracts
│   │   ├── fixtures/                 # Deterministic fixtures
│   │   ├── lib/
│   │   │   ├── simulator/            # Deterministic simulator engine
│   │   │   ├── storage/              # Device-local draft storage
│   │   │   ├── api/                  # API boundary client (no silent fallback)
│   │   │   └── realtime/             # Realtime adapter interface
│   │   └── __tests__/                # Vitest semantic, route & simulator suites
├── docker/
│   ├── next.Dockerfile              # Multi-stage standalone production Dockerfile
│   └── web.Dockerfile               # Legacy web container (reference)
├── docker-compose.next.yml           # Compose file exposing host port 3130
└── docs/architecture/                # Architecture documentation
```

---

## 3. Non-Negotiable Semantic Invariants

The LiveLift frontend implements strict semantic boundaries directly in data types, UI states, and test suites:

1. **`missing != zero`**:
   - A missing unit price or unmeasured telemetry metric is rendered as `"Not entered"` or `"Not available"`, never as `$0` or `0%`.
   - Numeric zero (`0`) is only rendered when an authoritative measurement was performed and yielded exactly zero.
2. **`planned != actual`**:
   - Planned segment duration (e.g. 5 minutes) remains an immutable baseline for post-session replay comparison.
   - Live adjustments (`+1m extension`) adjust the active target duration without overwriting the original planned baseline.
3. **`recommendation != acceptance != execution`**:
   - A recommendation (e.g. "Present M03 Cargo Pants") is a suggestion from the plan or engine.
   - Clicking **Accept** formally records operator acceptance but does **not** change the presenting product or start the segment.
   - Clicking **Start M03 now** executes the operational segment transition.
4. **`attempt != performed != platform confirmed`**:
   - An HTTP 200 from an API adapter is a transport success, not platform confirmation.
   - An operator's manual assertion that a product is pinned is an `operator_report`.
   - Platform verification remains `unknown` until authoritative confirmation is delivered.
5. **`unknown != failed`**:
   - An unverified state is rendered with an informational neutral status badge and a question mark icon (`ri-question-line`), never with a red `Failed` badge.
6. **`REAL != SIMULATED`**:
   - REAL and SIMULATED environments are rendered with visually distinct badges and borders.
   - No silent fallback: A network error in REAL mode displays an explicit degraded state rather than silently redirecting to mock/simulated data.
7. **`UNSYNCED DRAFT` Device-Local Isolation**:
   - Offline or disconnected operator notes and actions are stored in device-local storage with `deviceLocal: true` and `confirmedForSubmission: false`.
   - Drafts are explicitly reviewed and confirmed by the operator during Wrap before submission to the central server.
8. **Dual Knowledge Lens (Replay & Review)**:
   - **"As Known Then"**: Reflects strictly what information was available to the operator in the live moment (excludes late receipts and retrospective metrics).
   - **"With Later Evidence"**: Exposes late receipts, post-stream provider observations, and retroactive gap evaluations.

---

## 4. Visual Foundation & Design Tokens

The visual design system implements the canonical dark-first control desk palette specified in `.kombai/canvas/`:

### Surfaces & Backgrounds
| Token | Hex | Role |
| :--- | :--- | :--- |
| `surface-canvas` (L0) | `#090B0F` | Deep workspace background |
| `surface-panel` (L1) | `#13161C` | Cards, primary containers, panels |
| `surface-card` (L2) | `#1B1F27` | Inner cards, table rows, sub-panels |
| `surface-raised` (L3) | `#252A34` | Hover states, modals, popovers |
| `surface-overlay` (L4) | `#303643` | Active selections, dialog overlays |

### Semantics & Accents
| Token | Hex | Role |
| :--- | :--- | :--- |
| `accent-lime` | `#DFFF00` | Primary action CTA, current segment indicator (Text: `#111407`) |
| `accent-violet` | `#C8B2FF` | Evidence, replay intelligence, late receipt badges (Bg: `#211F2B`) |
| `status-success` | `#22C55E` | Platform verified confirmation |
| `status-warning` | `#FFB800` | Provider gaps, unsaved drafts |
| `status-error` | `#FF5C5C` | Authoritative failures, quota exhaustion |
| `status-neutral` | `#8A95A5` | Unknown, deferred, unverified |

### Accessibility & Ergonomics
- **Touch Target**: Minimum `44px` (`min-h-[44px]`, `min-w-[44px]`) on all interactive buttons, links, and form fields.
- **Focus Rings**: High-contrast WCAG 2.1 AA focus indicator (`2px solid #DFFF00` with `3px` offset).
- **Reduced Motion**: Motion transitions disable automatically under `prefers-reduced-motion: reduce`.
- **Typography**: Google Rubik font with Latin and Latin-ext subsets (full Vietnamese diacritics support without glyph clipping).

---

## 5. Route Architecture & Screen Breakdown

### 1. Home (`/`)
- Active live session card with pulsating indicator and direct **Return to LIVE** button.
- Prepared sessions ready for launch.
- Finish review queue for ended sessions awaiting post-mortem reflection.
- Empty state guidance with direct links to Create LIVE or Browse Sessions.

### 2. Create Live (`/live/new`)
- Starting point selector:
  - **Blank Session**: Start from scratch.
  - **Saved Pack**: Import an existing product pack.
  - **Previous Session**: Clone products, segments, and timing from past broadcasts.
- Clone preview displaying segments and products to be duplicated.
- Environment toggle: REAL vs SIMULATED rehearsal mode.

### 3. Prepare Workspace (`/live/[sessionId]/prepare`)
- **Left Column**: Product Pack inventory with product codes, Vietnamese titles, prices (`missing != zero`), and initial priority tags.
- **Center Column**: Dominant Run of Show timeline with drag/move reordering, target durations, segment types (Intro, Product, Flash Sale, Q&A, Wrap), and planned duration calculations.
- **Right Column**: Readiness checklist (Product pack ready, Run of show ready, Capability status: Manual Operation available) and prominent **Start LIVE** CTA.

### 4. Operate Desk (`/live/[sessionId]/operate`)
- High-contrast focused command shell with live elapsed clock and operator presence bar.
- **Dominant NOW / NEXT Command Band**:
  - **NOW Panel**: Presenting product initials, product code, title, duration progress bar, and platform pin verification state (`unknown != failed`).
  - **NEXT Panel**: Intelligent recommendation card, explicit rationale, and independent **Accept** vs **Start Now** execution buttons.
- **Operational Controls**:
  - **Extend +1m**: Extends target operational time without modifying planned baseline.
  - **Hold**: Pauses automated recommendation proposals.
  - **Skip**: Advances segment manually.
  - **Report Presentation**: Operator asserts presenting product directly.
  - **End LIVE**: Confirmation modal that freezes timestamps and navigates to Wrap.
- **Operational Tabs**: Queue (upcoming segments), Coverage (product airtime), Pulse (telemetry / engagement), History (command log).

### 5. Wrap Workspace (`/live/[sessionId]/wrap`)
- Duration summary showing scheduled vs actual duration.
- Unsynced device-local draft manager: Lists drafts captured during disconnected operation, allowing individual confirmation before server submission.
- Wrap notes entry.
- Direct CTA to **Open Review**.

### 6. Review & Learning Workspace (`/live/[sessionId]/review`)
- **Dual Knowledge Lens**: Toggle between **"As Known Then"** and **"With Later Evidence"**.
- Visual timeline rail comparing planned segments against actual execution.
- Operational event ledger with filters for Recommendations, Actions, and Gaps.
- Evidence inspector showing assertion source (operator vs provider vs platform) and late receipt timestamps.
- **Learn / Next Live Reasoning Chain**:
  - Observation $\longrightarrow$ Insight $\longrightarrow$ Hypothesis.
  - Operator can accept AI-suggested learnings or author manual observations.
  - Next Live Changes ledger with toggle to apply directly into future sessions.

### 7. Sessions (`/sessions`)
- Comprehensive session table filterable by text search, lifecycle (`planned`, `active`, `ended`, `abandoned`), and environment (`REAL`, `SIMULATED`).

### 8. Products & Packs (`/products`)
- Support surface for managing products and packs, noting snapshot immutability during live broadcasts.

### 9. Integrations & Capabilities (`/integrations`)
- Honest capability matrix displaying real statuses (`Available`, `Not configured`, `Degraded`, `Rate limited`).
- Prominent **Manual Operation Guarantee** panel ensuring operator autonomy without third-party dependencies.

---

## 6. Deterministic Simulator Engine

To guarantee reliable development, end-to-end demonstrations, and offline testing without live backend or third-party API dependencies, LiveLift includes an in-memory deterministic simulator (`SimulatorEngine` in `src/lib/simulator/simulatorEngine.ts`):
- Pre-seeded with realistic scenarios:
  - `session_oct_evening`: Active live broadcast with presenting product M02 and active recommendation M03.
  - `session_weekend_essentials`: Prepared session ready for readiness check and launch.
  - `session_fall_rehearsal`: Simulated rehearsal session.
  - `session_collection_launch`: Ended session with complete replay ledger, provider gap, and learning objects.
- Full mutation support:
  - `startLive(sessionId)`: Transitions lifecycle to `active`, sets started timestamps, starts first segment.
  - `acceptRecommendation(sessionId, recId)`: Marks recommendation accepted while strictly preserving current segment.
  - `rejectRecommendation(sessionId, recId)`: Marks recommendation rejected without altering planned sequence.
  - `startSegment(sessionId, segmentId)`: Explicitly transitions active segment and changes presenting product.
  - `extendDuration(sessionId, minutes)`: Adds operational target minutes without modifying planned baseline.
  - `holdProposal(sessionId)` / `resumeProposal(sessionId)`: Toggles recommendation engine hold state.
  - `reportPresentation(sessionId, productId)`: Sets presenting product as operator-reported.
  - `endLive(sessionId)`: Marks lifecycle as `ended`, freezes duration, marks final segment completed.
  - `addLearningObject(sessionId, obj)` / `toggleNextLiveChange(sessionId, changeId)`: Mutates post-session insights.

---

## 7. Containerization & Deployment

### Docker Multi-Stage Build (`docker/next.Dockerfile`)
- Builds with Node 22 Alpine in 3 stages:
  1. `deps`: Runs `npm ci` with exact lockfile.
  2. `build`: Compiles Next.js with standalone output.
  3. `runner`: Copies `.next/standalone`, `.next/static`, and `public`, running as non-root `node` user on port 3000.

### Docker Compose (`docker-compose.next.yml`)
- Maps host port `3130` to container port `3000`.
- Built-in HTTP health check verifies service readiness.

---

## 8. Cutover & Verification Checklist

- [x] Independent `/next` scaffold created with Next.js 16.3.8, React 19.3.0, Tailwind CSS 4.x.
- [x] Complete domain contracts defined in `src/contracts/`.
- [x] Zero imports or dependencies on legacy `/web`.
- [x] Deterministic simulator engine fully functional.
- [x] All P0 routes implemented and tested.
- [x] Non-negotiable semantic invariants verified in code and tests.
- [x] WCAG 2.1 AA accessibility standards verified (contrast, focus rings, minimum touch targets).
- [x] TypeScript strict type check passes with 0 errors (`npm run typecheck`).
- [x] ESLint CLI passes with 0 errors and 0 warnings (`npm run lint`).
- [x] Vitest test suite passes 100% of tests (`npm test`).
- [x] Standalone production build succeeds (`npm run build`).
- [x] Dockerfile and Docker Compose configured for host port 3130.

# LiveLift Strategy Review & Independent Product Evaluation
## 12 — Explicit Unresolved Questions & Decision Log

**Evaluator:** Independent Principal Product Strategist & Technical Architect  
**Date:** October 4, 2026  
**Guiding Principle:** "Explicitly document all remaining uncertainties before writing production code."  

---

### 1. Strategic & Market Open Questions

#### Q-01: Will SME live commerce sellers pay for a dedicated Run-of-Show tool, or will they cling to free Google Sheets?
- **Current Assumption:** Sellers will pay $30–$70/month per studio if LiveLift eliminates costly timing mistakes (missed flash sale drops, chaotic host handoffs) and cuts pre-live setup time by 50%.
- **How to Resolve:** Conduct 5 user interviews with active TikTok Shop agency operations leads in Vietnam, showing the interactive prototype and measuring willingness to pay.
- **Risk if Assumption is Wrong:** If spreadsheet inertia is unbreakable for independent SME sellers, LiveLift must pivot strictly to a B2B agency tier (targeting agencies managing 5–20 live studios simultaneously).

#### Q-02: Should LiveLift support Shopee Live and Facebook Live in the commercial pitch, or remain 100% branded as a TikTok Shop tool?
- **Current Assumption:** Maintain provider-neutral architecture in backend code, but brand the product 100% for TikTok Shop during launch.
- **How to Resolve:** Review market share metrics in Vietnam and Southeast Asia. (TikTok Shop currently represents over 70% of live commerce GMV in the region).
- **Risk if Assumption is Wrong:** If Shopee Live sellers experience equal operational pain and feel excluded by TikTok-specific marketing, LiveLift could miss a substantial secondary market.

---

### 2. Operational Ergonomics Open Questions

#### Q-03: Does the livestream host need a dedicated tablet view (`/live/:id/host`) in P0, or is the assistant desk sufficient?
- **Current Assumption:** In P0, the primary user is the assistant at the desk. The host looks at product samples and the broadcast phone. A dedicated host view is P1.
- **How to Resolve:** Observe 3 live broadcasts in real studio environments. Note how the assistant communicates cues to the host (verbal whispers, hand gestures, whiteboards, or secondary screens).
- **Risk if Assumption is Wrong:** If hosts demand a clean teleprompter-style timer on an iPad on the studio floor to stay on schedule, the Host View must be accelerated into P0.

#### Q-04: What is the optimal visual alert for a segment overrun?
- **Current Assumption:** An amber visual clock border and a subtle "+02:15 overrun" counter is sufficient without being distracting.
- **How to Resolve:** Rehearsal testing with experienced operators under simulated studio lighting.
- **Risk if Assumption is Wrong:** If the operator fails to notice the amber border while looking at the TikTok screen, an optional audible chime or flashing title bar may be required.

---

### 3. Technical & Platform Open Questions

#### Q-05: What is the exact delay of TikTok Shop post-live minute performance analytics in production?
- **Current Assumption:** Data is populated within 30 to 90 minutes of broadcast termination.
- **How to Resolve:** Execute Spike 2 (SPK-02) on an active test shop.
- **Risk if Assumption is Wrong:** If ByteDance delays minute-level analytics by 24 hours, the 3-minute post-live review card cannot incorporate sales data on the same night. The review card must display operational rundown variance immediately and mark financial analytics as "Audit Pending."

#### Q-06: Will modern desktop browsers throttle the Server-Sent Events (SSE) stream if the operator leaves LiveLift in a background tab for 20 minutes?
- **Current Assumption:** Modern Chromium maintains HTTP/2 SSE connections, but throttles `requestAnimationFrame`. When the tab is refocused, LiveLift's monotonic sequence check detects any missed state changes and resyncs immediately.
- **How to Resolve:** Run a 30-minute background tab test on Chrome, Firefox, and Edge with active event streaming; measure resync latency on focus.
- **Risk if Assumption is Wrong:** If the browser closes the TCP connection silently, an aggressive WebSocket heartbeat or service worker keep-alive will be necessary.

# LiveLift Strategic Research & Architecture Synthesis
## 14 — Explicit Unresolved Questions & Decision Log

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Guiding Principle:** "Prefer honest uncertainty over invented certainty."  

---

### 1. Overview of Open Questions

An architecture that claims every unknown has been solved is dishonest and brittle. This document catalogues the critical technical, product, and platform uncertainties that still require real-world empirical validation, live provider access, or user feedback.

```
+--------------------------------------------------------------------------------------------------+
|                                    OPEN QUESTIONS INVENTORY                                      |
+------+------------------------------------------+-----------------------+------------------------+
| CAT  | DOMAIN / UNKNOWN                         | RESOLUTION METHOD     | RISK SEVERITY IF WRONG |
+------+------------------------------------------+-----------------------+------------------------+
| **A**| TikTok Shop Seller AM Requirement        | Partner Center Ticket | High (Access Barrier)  |
| **A**| Post-Live Minute Analytics Latency       | Real Shop LIVE Test   | Medium (Reconciliation)|
| **B**| Single-Operator Field Compliance         | User Observation Test | High (Data Completeness|
| **B**| Optimal Segment Extension Increment      | Operator Field Trials | Low (Ergonomic Tuning) |
| **C**| PostgreSQL Event Table Write Ceiling     | Local Load Benchmark  | Low (Capacity Margin)  |
| **C**| WebSocket vs SSE Battery/Network Draw    | Mobile Profile Test   | Low (Client Efficiency)|
| **D**| AISC'26 Live Demo Network Contingency    | Dry-Run Rehearsal     | Critical (Demo Failure)|
+------+------------------------------------------+-----------------------+------------------------+
```

---

### 2. Category A: Platform & External Integration Realities

#### Q-01: Can a standard Vietnamese SME seller account obtain live analytics scopes without an assigned ByteDance Account Manager?
- **Current Assumption:** We assume that individual sellers cannot self-serve live analytics scopes (`data.shop_analytics.public.read`) without an assigned Account Manager (AM) or an approved ISV partner app.
- **How to Resolve:** Submit an onboarding ticket through the TikTok Shop Partner Center using a verified Vietnamese seller account and test app registration.
- **Risk if Assumption is Wrong:** If self-service approval is actually available, LiveLift could integrate official post-live analytics much sooner than anticipated. If approval is strictly blocked, LiveLift must rely entirely on manual desk reports and CSV export imports for SME sellers.

#### Q-02: What is the exact physical latency of post-live minute-level performance data from TikTok Shop Open API?
- **Current Assumption:** Documentation says data is available *"after the session is finished."* We assume a 30 to 120-minute latency before the endpoint populates complete minute arrays.
- **How to Resolve:** Execute a 15-minute live stream on a test shop and poll `GET /analytics/202510/shop_lives/{id}/performance_per_minutes` every 5 minutes until data returns.
- **Risk if Assumption is Wrong:** If latency exceeds 24 hours, the WRAP workspace cannot provide immediate end-of-night platform reconciliation, requiring Review to remain in a `pending_audit` state overnight.

#### Q-03: Does Shopee Open Platform allow automated live pinning without regional enterprise partner verification?
- **Current Assumption:** The endpoint `POST /api/v2/livestream/update_show_item` is documented, but requires an active Shopee Live broadcaster session.
- **How to Resolve:** Test authentication against the Shopee Open Platform sandbox and test shop.
- **Risk if Assumption is Wrong:** If Shopee also restricts live pinning to first-party apps, programmatic pinning must be removed from the roadmap entirely, cementing 100% manual desk operation across all platforms.

---

### 3. Category B: Product & Operational Ergonomics

#### Q-04: Will a single live desk assistant consistently log product presentation reports during a chaotic live broadcast?
- **Current Assumption:** We assume an operator can easily click "Presenting this product" within 5 seconds of the host showing an item.
- **How to Resolve:** Run a simulated 30-minute high-tempo broadcast with a real seller and host, observing whether the operator logs presentations or forgets under pressure.
- **Risk if Assumption is Wrong:** If manual reporting compliance is low ($<60\%$), the operational timeline will have massive evidence gaps, degrading the value of semantic replay. LiveLift would need to introduce automated audio cues, simpler hotkeys, or host-side confirmation pedals.

#### Q-05: What is the optimal default extension increment for overrunning segments?
- **Current Assumption:** `plan.md` defaults to **+1 minute** increments ("Extend current +1 min").
- **How to Resolve:** Solicit direct feedback from livestream hosts and agency operators during Phase A user testing.
- **Risk if Assumption is Wrong:** If 1 minute is too short, operators will be forced to spam the extend button 3–5 times. If 5 minutes is too long, planned schedules will be blown prematurely.

#### Q-06: Should assistant operators be allowed to submit notes without approval from the lead operator?
- **Current Assumption:** Yes. Notes and quick capture entries are append-only human observations and do not alter the authoritative broadcast state.
- **How to Resolve:** Operator desk usability testing with two simultaneous users.
- **Risk if Assumption is Wrong:** If assistant notes clutter the primary desk view, an editorial approval or filtering toggle may be required.

---

### 4. Category C: Technical Performance & System Benchmarks

#### Q-07: What is the maximum throughput of PostgreSQL append-only event insertion on standard $20/month VPS hardware?
- **Current Assumption:** PostgreSQL 16 on 2 vCPUs / 4GB RAM can easily handle 500 writes/second with sub-10ms commit latency using standard connection pooling.
- **How to Resolve:** Run Spike 4 benchmark using `locust` or `pgbench` against the `evidence_record` table.
- **Risk if Assumption is Wrong:** If disk I/O bottlenecks during comment bursts, an asynchronous in-memory commit buffer (`asyncio.Queue` flushing every 500ms) will be required.

#### Q-08: Does background tab throttling in Chromium degrade the SSE state stream after 15 minutes?
- **Current Assumption:** Modern browsers throttle background timers (`setInterval`), but keep HTTP/2 SSE connections alive unless system memory is exhausted.
- **How to Resolve:** Run a 30-minute background tab test on Chrome/Firefox and measure event delivery delay upon tab refocus.
- **Risk if Assumption is Wrong:** If browsers drop background SSE streams, the client must implement an explicit `visibilitychange` listener that triggers a full snapshot resync every time the tab becomes visible.

---

### 5. Category D: Competition & Demonstration Constraints

#### Q-09: How will LiveLift guarantee zero demonstration failures on hostile conference Wi-Fi at AISC'26?
- **Current Assumption:** The live demo must NOT rely on the venue's public internet.
- **How to Resolve:** Package the entire system (Caddy, Next.js `/next`, FastAPI, PostgreSQL, and the deterministic simulator scenario engine) to run 100% locally via `docker compose up -d` on `localhost` with zero external WAN calls.
- **Risk if Assumption is Wrong:** If any component requires external DNS or WAN connectivity, the live demo could freeze on stage during the jury presentation.

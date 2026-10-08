# LiveLift Strategic Research & Architecture Synthesis
## 08 — Security, System Observability & Safe Deployment

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Focus:** Operational Security Boundaries, System Health Telemetry, and Zero-Downtime Deployment Cutover  
**Reference Files:** `docker/Caddyfile`, `docker-compose.yml`, `src/livelift/config.py`, `src/livelift/ingest/pii/filter.py`  

---

### 1. Security Architecture & Threat Boundaries

LiveLift operates in commercial livestream environments where business integrity, personal privacy, and platform compliance are non-negotiable.

```
                                      +------------------------------------+
                                      |         PUBLIC INTERNET            |
                                      +------------------------------------+
                                                        |
                                                        | HTTPS (443) / Strict TLS 1.3
                                                        v
                                      +------------------------------------+
                                      |          CADDY REVERSE PROXY       |
                                      |  * Automatic Let's Encrypt TLS     |
                                      |  * Strips /api prefix to backend   |
                                      |  * Security Headers & Host Filter  |
                                      +------------------------------------+
                                           |                         |
               Static Assets & HTML Routes |                         | Dynamic API & SSE
                                           v                         v
                          +------------------------+   +------------------------+
                          |   NEXT.JS 14 CONTAINER |   |   FASTAPI CORE CONTAINER|
                          |   (Port 3000 / Internal|   |   (Port 8000 / Internal|
                          |   Zero Secrets Exposed |   |   Holds HMAC & Secrets |
                          +------------------------+   +------------------------+
                                                                     |
                                                       Internal Unix | or 127.0.0.1
                                                       Network Only  |
                                                                     v
                                                       +------------------------+
                                                       |     POSTGRESQL 16      |
                                                       |  (No Public Port 5432) |
                                                       +------------------------+
```

#### 1.1 Credential & Secret Isolation
- **Server-Side Exclusivity:** Third-party OAuth tokens, client secrets, and HMAC keys (`TIKTOK_SHOP_APP_SECRET`, `TIKTOK_SHOP_ACCESS_TOKEN`, `POSTGRES_PASSWORD`) reside strictly within the backend container environment.
- **Next.js Public Leak Prevention:** The `next/**` codebase is prohibited from accessing any variable without the `NEXT_PUBLIC_` prefix. Under no circumstances should backend secrets be passed to frontend build targets.
- **Log Sanitization:** LiveLift inherits the strict logging interceptor in `src/livelift/ingest/base.py`, which scrubs sensitive parameters (`sign=`, `access_token=`, `app_secret=`) from all outgoing HTTP client logs (`httpx`).

#### 1.2 Session Scoping and Cross-Session Injection Defenses
- **Session Identity Invariant:** Every incoming request to mutate or query session state must include `session_id: UUID`.
- **Fail-Closed Scoping:** The backend validates that all referenced products, segments, and decisions belong strictly to the target `session_id`. Stale tokens or mismatched IDs immediately reject the request with HTTP 403/409.
- **Dual-Operator CSRF & Auth:** SSE and WebSocket connections require an authenticated session token. Routine commands use standard CSRF protection and origin headers locked down by Caddy.

#### 1.3 Vietnamese Personal Data Protection (Law 91/2025/QH15 Compliance)
- **Mandatory Scrubbing Before Persistence:** In compliance with Vietnamese privacy law, live comments must never be persisted in raw form.
- **Two-Tier Scrubbing Pipeline:** Ingested comments pass through `src/livelift/ingest/pii/filter.py` before hitting database storage or memory buffers.
  - Detects standard and spelled-out phone numbers (e.g., *"không chín một hai..."*).
  - Masks Vietnamese residential addresses, bank account numbers, email addresses, and citizen identity card numbers (CCCD).
  - Strips identifiable user account handles.

---

### 2. Operational System Observability (Not User Analytics)

System observability measures the health and reliability of LiveLift itself. It must never be conflated with commercial sales analytics.

```
+--------------------------------------------------------------------------------------------------+
|                                OPERATIONAL TELEMETRY COCKPIT                                     |
+------------------------------------+-------------------------------------------------------------+
| TELEMETRY METRIC                   | HEALTHY THRESHOLD & OPERATIONAL SIGNIFICANCE                |
+------------------------------------+-------------------------------------------------------------+
| **Command Latency (p95)**          | $< 120$ ms (Time from operator click to server ACK)          |
| **Snapshot Resync Rate**           | $< 0.1$ / min (High rate indicates client packet drops)     |
| **Revision Conflict Count (409)**  | $= 0$ (Spikes indicate double clicks or stale tabs)         |
| **Realtime Stream Disconnects**    | $< 1$ per hour (Measures studio Wi-Fi stability)            |
| **Provider Telemetry Lag**         | $< 5.0$ s (Delay between external event and LiveLift ingest)|
| **Storage Commit Latency**         | $< 15$ ms (Postgres commit time for append-only events)     |
| **Unsynced Draft Queue Depth**     | $= 0$ (Elevated count warns operator of offline risk)       |
+------------------------------------+-------------------------------------------------------------+
```

#### 2.1 Standard Health Endpoints
The FastAPI core exposes three lightweight, unauthenticated health probes for container orchestration and Caddy:
- `GET /health/live`: Returns HTTP 200 if the Python process event loop is active.
- `GET /health/ready`: Returns HTTP 200 if database connection pool is healthy and migrations are current.
- `GET /health/storage`: Returns detailed storage diagnostics (Postgres reachable, disk space $>10\%$, write latency $<50$ms). If the database enters read-only mode or fails, this returns HTTP 503, signaling immediate degraded status to the operator desk.

---

### 3. Safe Migration & Zero-Downtime Deployment Strategy

The project must transition from the legacy Next.js `/web` interface to the new `/next` (LiveLift Control) interface without disrupting existing testing or demonstration environments.

```
PHASE 1: PARALLEL RUNNING            PHASE 2: STAGING ROUTE               PHASE 3: COMPLETE CUTOVER
+-----------------------+           +-----------------------+            +-----------------------+
| Caddy                 |           | Caddy                 |            | Caddy                 |
| /*       -> web:3000  |           | /*       -> web:3000  |            | /*       -> next:3001 |
| /api/*   -> api:8000  |           | /next/*  -> next:3001 |            | /legacy/*-> web:3000  |
|                       |           | /api/*   -> api:8000  |            | /api/*   -> api:8000  |
+-----------------------+           +-----------------------+            +-----------------------+
```

#### 3.1 Step-by-Step Cutover Runbook
1. **Container Definition:** Add `next` service to `docker-compose.yml`:
   ```yaml
   next:
     build:
       context: .
       dockerfile: docker/Dockerfile.next
     environment:
       - NEXT_PUBLIC_API_URL=/api
     expose:
       - "3000"
   ```
2. **Staged Caddy Routing:** Update `docker/Caddyfile` to expose `/next` while preserving root routing to `/web`:
   ```caddyfile
   {$DOMAIN:localhost} {
       handle /api/* {
           uri strip_prefix /api
           reverse_proxy api:8000
       }
       handle /next/* {
           uri strip_prefix /next
           reverse_proxy next:3000
       }
       handle {
           reverse_proxy web:3000
       }
   }
   ```
3. **Verification & Smoke Testing:** Execute the complete end-to-end golden path on `/next` via browser E2E tests.
4. **Primary Cutover:** Swap Caddy handlers so that `/*` routes to `next:3000`, and preserve `web:3000` under `/legacy/*` for temporary contingency.
5. **Decommissioning:** Once `/next` passes all operational acceptance gates across three consecutive live rehearsals, archive the `/web` directory and remove the legacy container service.

#### 3.2 Database Migration Compatibility
- All database schema updates in LiveLift-next are **strictly additive**.
- Tables and columns are added (`ADD COLUMN IF NOT EXISTS`). No columns are renamed or dropped in production migrations until code dependencies are completely eradicated.
- This ensures that if a rollback to legacy code is required during initial staging, the database remains 100% backward compatible.

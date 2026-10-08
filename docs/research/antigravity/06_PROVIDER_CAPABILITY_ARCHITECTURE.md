# LiveLift Strategic Research & Architecture Synthesis
## 06 — Provider Capability Architecture & Integration Abstraction

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Focus:** Capability Negotiation, Adapter Topology, and Decoupled Platform Integrations  
**Design Reference:** `.kombai/canvas/livelift_canonical_20261003_00_foundations.canvas`  

---

### 1. The Anti-Pattern: Monolithic Platform Branching

Legacy systems typically implement integrations via global conditionals scattered throughout the application:

```python
# ANTI-PATTERN: Dangerous, brittle coupling
if session.platform == 'tiktok':
    await call_tiktok_pin(product_id)
elif session.platform == 'shopee':
    await call_shopee_update(product_id)
elif session.platform == 'manual':
    pass  # do nothing
```

This monolithic switch pattern causes four severe architectural failures:
1. **False Equivalency:** It assumes all platforms support identical primitives (e.g., assuming TikTok supports `pin_product` because Shopee does).
2. **Binary Health Illusion:** It treats a provider as either "connected" or "disconnected," concealing situations where catalog sync works but real-time telemetry is down.
3. **Core Domain Contamination:** Platform-specific error codes, rate limits, and tokens bleed into core business logic and UI state machines.
4. **Fragility Under Degradation:** An outage in an optional external provider can crash the entire live desk runtime.

---

### 2. The Solution: Dynamic Capability Negotiation

LiveLift abstracts external systems through a **Capability-Oriented Architecture**. The core domain never asks *"What platform is this?"* Instead, it queries: *"Is capability $C$ available and healthy right now?"*

```
+--------------------------------------------------------------------------------------------------+
|                                    CORE APPLICATION DOMAIN                                       |
|  * Evaluates: Does the session have CAPABILITY_LIVE_PINNING?                                     |
|  * If YES: Render automated "Pin Native" button.                                                 |
|  * If NO:  Render manual "I Performed This Pin" report button.                                  |
+--------------------------------------------------------------------------------------------------+
                                                ^
                                                | Capability Query
                                                v
+--------------------------------------------------------------------------------------------------+
|                                  CAPABILITY NEGOTIATOR ENGINE                                    |
|  Aggregates capabilities across registered, authenticated, and healthy adapters:                 |
|  Union(ManualBaseline, TikTokAdapter, ShopeeAdapter, SimulatorAdapter)                          |
+--------------------------------------------------------------------------------------------------+
            |                               |                              |
            v                               v                              v
+-----------------------+       +-----------------------+      +-----------------------+
|  ManualDeskAdapter    |       |  TikTokShopAdapter    |      |  ShopeeLiveAdapter    |
|  [Always Active]      |       |  [Seller OAuth]       |      |  [Partner OAuth]      |
|  * MANUAL_DESK: Active|       |  * CATALOG_SYNC: Avail|      |  * CATALOG_SYNC: Avail|
|  * OPERATOR_REP: Avail|       |  * POST_AUDIT: Avail  |      |  * PIN_CONTROL: Avail |
|  * REPLAY_CORE: Avail |       |  * PIN_CONTROL: Unsupp|      |  * CHAT_POLL: Avail   |
|                       |       |  * LIVE_CHAT: Unsupp  |      |                       |
+-----------------------+       +-----------------------+      +-----------------------+
```

---

### 3. Domain Model for Provider Abstraction

```python
from enum import StrEnum
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

class Capability(StrEnum):
    MANUAL_OPERATING_DESK = "manual_operating_desk"     # Operator transitions, notes, reports
    CATALOG_READ = "catalog_read"                       # Import/sync products & pricing
    CATALOG_WRITE = "catalog_write"                     # Update inventory/pricing on platform
    LIVE_ROOM_METRICS = "live_room_metrics"             # Real-time viewer count, like count
    LIVE_CHAT_STREAM = "live_chat_stream"               # Real-time incoming viewer comments
    PLATFORM_PIN_CONTROL = "platform_pin_control"       # Programmatic pinning of showcase items
    PLATFORM_ACTION_VERIFY = "platform_action_verify"   # Cryptographic verification of platform state
    POST_LIVE_ANALYTICS_AUDIT = "post_live_analytics"   # Minute-level performance audit post-session

class CapabilityState(StrEnum):
    AVAILABLE = "available"         # Fully operational, fresh, and authorized
    DEGRADED = "degraded"           # Functional but experiencing rate limits or elevated latency
    STALE = "stale"                 # Last update exceeded validity TTL; historical only
    UNAVAILABLE = "unavailable"     # Configured/authorized, but temporarily offline or erroring
    UNSUPPORTED = "unsupported"     # Not provided by this platform by design (e.g. TikTok Live Pin)
    REVOKED = "revoked"             # OAuth token invalid or permissions missing

class ProviderIdentity(BaseModel):
    provider_id: str                # e.g., 'tiktok_shop', 'shopee', 'simulator'
    account_id: str                 # e.g., 'seller_vn_98765'
    market: str                     # e.g., 'VN', 'TH', 'ID'
    authorized_at: datetime
    token_expires_at: datetime | None

class CapabilityStatus(BaseModel):
    capability: Capability
    state: CapabilityState
    last_fresh_at: datetime | None
    validity_ttl_seconds: int | None
    error_message: str | None = None
    actionable_recovery_hint: str | None = None
```

---

### 4. Adapter Interface Specification

Every external integration implements the abstract `ProviderAdapter` interface:

```python
from abc import ABC, abstractmethod

class ProviderAdapter(ABC):
    @property
    @abstractmethod
    def provider_identity(self) -> ProviderIdentity:
        """Returns the unique identity, market, and account binding."""
        ...

    @abstractmethod
    async def get_capabilities(self) -> dict[Capability, CapabilityStatus]:
        """Evaluates health and returns current state of all supported capabilities."""
        ...

    @abstractmethod
    async def check_health(self) -> bool:
        """Lightweight connectivity ping (e.g. checking token validity)."""
        ...

    # Optional capability implementations (raise UnsupportedCapabilityException if unprovided):
    async def sync_catalog(self) -> list[ProductData]:
        raise UnsupportedCapabilityException(Capability.CATALOG_READ)

    async def execute_pin(self, product_id: str) -> CommandResult:
        raise UnsupportedCapabilityException(Capability.PLATFORM_PIN_CONTROL)

    async def fetch_post_live_metrics(self, session_id: UUID) -> list[MinuteMetricInterval]:
        raise UnsupportedCapabilityException(Capability.POST_LIVE_ANALYTICS_AUDIT)
```

---

### 5. Concrete Adapter Topologies

#### 5.1 ManualDeskAdapter (Baseline — Always Present)
- **Role:** Guarantees that LiveLift is 100% usable without external accounts or networks.
- **Capabilities Provided:**
  - `MANUAL_OPERATING_DESK`: `AVAILABLE`
  - All automated capabilities: `UNSUPPORTED`
- **Invariants:** This adapter has no network dependencies and cannot fail due to third-party outages.

#### 5.2 TikTokShopAdapter (Seller Center Partner API)
- **File Location:** `src/livelift/adapters/tiktok_shop/`
- **Capabilities Provided:**
  - `CATALOG_READ`: `AVAILABLE` (fetches product listings pre-session).
  - `POST_LIVE_ANALYTICS_AUDIT`: `AVAILABLE` (calls `/analytics/202510/shop_lives/{id}/performance_per_minutes` after session ends).
  - `PLATFORM_PIN_CONTROL`: `UNSUPPORTED` (explicitly documents TikTok platform limitations).
  - `LIVE_CHAT_STREAM`: `UNSUPPORTED` (no public WebSocket available).
- **Error Quarantine:** If TikTok returns HTTP 401 (`105002` token expired), only `CATALOG_READ` and `POST_LIVE_ANALYTICS_AUDIT` flip to `REVOKED`. The live desk runtime continues operating smoothly via `ManualDeskAdapter`.

#### 5.3 ShopeeLiveAdapter (Shopee Open Platform)
- **File Location:** `src/livelift/adapters/shopee/`
- **Capabilities Provided:**
  - `CATALOG_READ`: `AVAILABLE`
  - `PLATFORM_PIN_CONTROL`: `AVAILABLE` (maps to `update_show_item`)
  - `LIVE_CHAT_STREAM`: `DEGRADED` (short-polling every 3–5 seconds)
  - `PLATFORM_ACTION_VERIFY`: `AVAILABLE` (verifies returned HTTP response payload)

#### 5.4 DeterministicSimulatorAdapter (Rehearsal & Development)
- **File Location:** `src/livelift/adapters/simulator/`
- **Role:** Generates synthetic, deterministic operational conditions for demo, testing, and training.
- **Capabilities Provided:**
  - All capabilities marked `AVAILABLE`, but every emitted event carries `evidence_class = 'simulated'` and `provenance = 'simulator'`.

---

### 6. Isolation and Fail-Closed Safeguards

To prevent external platform failures from corrupting LiveLift sessions:
1. **Process Isolation:** Network calls to external APIs execute inside bounded `asyncio.wait_for(timeout=3.0)` blocks with strict circuit breakers.
2. **Context Quarantine:** If an adapter reports an `account_id` or `room_id` that does not match the active session binding, all incoming data from that adapter is immediately routed to a **Quarantine Log**. It is never merged into the active live session.
3. **No Credential Exposure:** All API secrets (`app_secret`, bearer tokens, `shop_cipher`) remain on the server and are masked in logging via the existing `livelift.ingest.base` redaction filter.

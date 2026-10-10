import type { LiveIntelligenceSnapshot, ProviderMetric, SegmentAttribution } from "@/contracts/liveIntelligence";
export { METRIC_KEYS } from "@/contracts/liveIntelligence";
export type { ProviderMetric, MinuteEvidenceBucket, SegmentAttribution, ProductPerformance, LiveIntelligenceSnapshot, MetricKey, ProviderCapability } from "@/contracts/liveIntelligence";
export type Availability = ProviderMetric["availability"];
export type AttributionCoverage = SegmentAttribution["coverage"];
export type TimeWindow = { startMs: number; endMs: number };
export type EvidenceOrigin = "provider" | "fixture";

// ---- Results ---------------------------------------------------------------------------------------------------------

/** Why a request produced no snapshot. Each is a different thing to tell the operator; none is "zero". */
export type MalformedReason = "malformed" | "wrong_perspective" | "session_mismatch" | "rejected_fixture" | "settling" | "network" | "timeout" | "server" | "not_found";

export type LiveIntelligenceResult =
  | { kind: "fetching" }
  | { kind: "available"; snapshot: LiveIntelligenceSnapshot; origin: EvidenceOrigin }
  /** The server does not offer provider evidence at all (route absent, or no provider configured). */
  | { kind: "not_configured" }
  /** A provider is configured, but the seller/creator has not granted this deployment access. */
  | { kind: "access_not_granted" }
  /** The provider authorization expired or was revoked. Fails closed. */
  | { kind: "auth_expired" }
  | { kind: "rate_limited"; retryAfterSec: number | null }
  /** The provider's official API does not offer this evidence. Permanent, not an outage. */
  | { kind: "unsupported" }
  /** Asked, and could not get an answer. Unknown, not zero. */
  | { kind: "unavailable"; reason: MalformedReason; message: string }
  | { kind: "signed_out" }
  | { kind: "forbidden" }
  /** The show is not in the room (a local archive), so there is nothing the server could look up. */
  | { kind: "not_applicable"; message: string };

export type LiveIntelligenceState = { kind: "idle" } | { kind: "fetching" } | LiveIntelligenceResult;

// ---- Capabilities ----------------------------------------------------------------------------------------------------

export type CapabilityState =
  | "available"
  | "post_live"
  | "realtime"
  | "access_required"
  | "connected"
  | "not_connected"
  | "not_configured"
  | "access_not_granted"
  | "partner_access_required"
  | "rate_limited"
  | "auth_expired"
  | "unavailable"
  | "unsupported"
  | "unknown";

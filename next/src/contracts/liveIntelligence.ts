import { z } from "zod";
import { RuntimeSchema, SessionEventSchema } from "./session";
import { PlanVersionSchema } from "./plan";

export const INTELLIGENCE_ROUTES = {
  status: "/api/v3/intelligence/status",
  evidence: "/api/v3/intelligence/evidence",
  refresh: "/api/v3/intelligence/refresh",
} as const;
export const InstantSchema = z.number().int().nonnegative().max(8.64e15).safe();
export const EvidenceTierSchema = z.enum(["operator_reported", "provider_observed"]);
export type EvidenceTier = z.infer<typeof EvidenceTierSchema>;
export const AvailabilitySchema = z.enum(["available", "missing", "unknown", "unsupported"]);
export const ProviderStateSchema = z.enum(["NOT_CONFIGURED", "READY", "FETCHING", "AVAILABLE", "UNAVAILABLE", "AUTH_EXPIRED", "RATE_LIMITED", "ACCESS_NOT_GRANTED", "UNSUPPORTED"]);
export type ProviderState = z.infer<typeof ProviderStateSchema>;
export const EvidenceSourceSchema = z.enum(["tiktok_shop", "tiktok_creator", "fixture"]);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export const CountSchema = z.number().int().nonnegative().safe();
/** Decimal major units, never a JS floating point monetary value. */
export const MoneySchema = z.object({ amount: z.string().regex(/^(0|[1-9]\d{0,29})(\.\d{1,6})?$/), currency: z.string().regex(/^[A-Z]{3}$/) }).strict();
export type Money = z.infer<typeof MoneySchema>;
/** Exact rational for rates, including money/minute. No rounded authoritative GMV. */
export const RatioSchema = z.object({ numerator: z.string().regex(/^\d{1,50}$/), denominator: z.string().regex(/^[1-9]\d{0,49}$/), currency: z.string().regex(/^[A-Z]{3}$/).optional() }).strict();
export type ExactRatio = z.infer<typeof RatioSchema>;
export const ProviderMetricSchema = z.object({
  key: z.string().max(60), value: z.union([CountSchema, MoneySchema, RatioSchema]).nullable(), unit: z.string().max(40),
  availability: AvailabilitySchema, source: EvidenceSourceSchema, evidenceTier: z.literal("provider_observed"),
  observedAt: InstantSchema, providerWindowStart: InstantSchema.optional(), providerWindowEnd: InstantSchema.optional(),
  note: z.string().max(500).optional(), calculation: z.literal("COMPUTED FROM PROVIDER-OBSERVED DATA").optional(),
}).strict().refine((m) => (m.availability === "available") === (m.value !== null), "Availability must match value");
export type ProviderMetric = z.infer<typeof ProviderMetricSchema>;
export const METRIC_KEYS = ["viewers", "impressions", "clicks", "orders", "gmv", "comments", "likes", "shares"] as const;
export type MetricKey = typeof METRIC_KEYS[number];
export const MinuteEvidenceBucketSchema = z.object({
  startMs: InstantSchema, endMs: InstantSchema,
  viewers: CountSchema.nullable().optional(), impressions: CountSchema.nullable().optional(), clicks: CountSchema.nullable().optional(),
  orders: CountSchema.nullable().optional(), gmv: MoneySchema.nullable().optional(), comments: CountSchema.nullable().optional(),
  likes: CountSchema.nullable().optional(), shares: CountSchema.nullable().optional(),
  source: EvidenceSourceSchema, evidenceTier: z.literal("provider_observed"), observedAt: InstantSchema,
  reportedEndMs: InstantSchema.optional(),
  /** Official reference does not establish inclusive/exclusive end semantics. Never guess them. */
  timing: z.enum(["half_open", "unverified_bounds"]),
}).strict().refine((b) => b.endMs > b.startMs && b.endMs - b.startMs <= 60_000, "Invalid minute interval");
export type MinuteEvidenceBucket = z.infer<typeof MinuteEvidenceBucketSchema>;
export const CoverageSchema = z.enum(["complete", "partial", "ambiguous", "none"]);
export const SegmentAttributionSchema = z.object({
  segmentId: z.string(), title: z.string(), plannedDurationMs: InstantSchema.nullable(),
  actualStartMs: InstantSchema.optional(), actualEndMs: InstantSchema.optional(), coverage: CoverageSchema,
  metrics: z.array(ProviderMetricSchema), ambiguousBuckets: z.array(z.object({ startMs: InstantSchema, endMs: InstantSchema, reason: z.enum(["segment_boundary", "unknown_timing", "overlapping_actual_windows"]) }).strict()),
  limitations: z.array(z.string()),
}).strict();
export type SegmentAttribution = z.infer<typeof SegmentAttributionSchema>;
export const ProductPerformanceSchema = z.object({
  productId: z.string().optional(), skuId: z.string().optional(), productLabel: z.string().max(240).optional(),
  impressions: CountSchema.nullable().optional(), clicks: CountSchema.nullable().optional(), orders: CountSchema.nullable().optional(),
  gmv: MoneySchema.nullable().optional(), ctor: RatioSchema.nullable().optional(), availability: AvailabilitySchema,
  source: EvidenceSourceSchema, observedAt: InstantSchema, evidenceTier: z.literal("provider_observed"),
  association: z.enum(["contextual", "ambiguous", "session_only"]), segmentId: z.string().optional(), limitations: z.array(z.string()),
}).strict();
export type ProductPerformance = z.infer<typeof ProductPerformanceSchema>;
export const ProductMappingSchema = z.object({ liveLiftProductId: z.string().min(1).max(128), providerProductId: z.string().regex(/^\d{1,30}$/) }).strict();
export type ProductMapping = z.infer<typeof ProductMappingSchema>;
export const ProviderWindowSchema = z.object({ startMs: InstantSchema, endMs: InstantSchema }).strict().refine((w) => w.endMs >= w.startMs, "Invalid provider window");
export const LiveIntelligenceSnapshotSchema = z.object({
  snapshotId: z.string().uuid(), sessionId: z.string(), sessionRevision: CountSchema,
  mode: z.enum(["REAL", "SIMULATED"]), perspective: z.literal("later_evidence"), provider: EvidenceSourceSchema,
  providerSessionId: z.string(), fetchedAt: InstantSchema, providerWindow: ProviderWindowSchema.optional(),
  minuteBuckets: z.array(MinuteEvidenceBucketSchema).max(3000), segmentAttributions: z.array(SegmentAttributionSchema),
  productPerformance: z.array(ProductPerformanceSchema).max(1000), productMappings: z.array(ProductMappingSchema),
  evidenceLimits: z.array(z.string()), reconciliationVersion: z.literal("livelift.attribution.v1"),
}).strict().refine((s) => (s.mode === "SIMULATED" ? s.provider === "fixture" : s.provider === "tiktok_shop")
  && [...s.minuteBuckets, ...s.productPerformance, ...s.segmentAttributions.flatMap((a) => a.metrics)].every((e) => e.source === s.provider), "Environment/source mismatch");
export type LiveIntelligenceSnapshot = z.infer<typeof LiveIntelligenceSnapshotSchema>;
export const ProviderFailureSchema = z.object({
  state: z.enum(["NOT_CONFIGURED", "UNAVAILABLE", "AUTH_EXPIRED", "RATE_LIMITED", "ACCESS_NOT_GRANTED", "UNSUPPORTED"]), code: z.enum(["not_configured", "access_not_granted", "auth_expired", "rate_limited", "timeout", "network", "malformed_response", "response_too_large", "upstream_unavailable", "unsupported", "outcome_unknown"]),
  retryAfterSec: z.number().int().positive().max(86400).optional(),
}).strict();
export type ProviderFailure = z.infer<typeof ProviderFailureSchema>;
export const FIXTURE_CASES = ["normal", "zero_clicks", "missing_clicks", "zero_gmv", "missing_gmv", "boundary", "not_reached", "repeated_product", "unknown_product", "malformed", "rate_limit", "auth_expired", "empty", "comment_count", "realtime_viewers", "not_configured", "access_not_granted", "unavailable", "unsupported_comments", "unsupported", "shifted_boundary"] as const;
export const RefreshRequestSchema = z.object({
  commandId: z.string().uuid(), roomId: z.string().min(1).max(128), sessionId: z.string().min(1).max(128),
  expectedSessionRevision: CountSchema, providerSessionId: z.string().regex(/^\d{1,30}$/).optional(),
  productMappings: z.array(ProductMappingSchema).max(1000).default([]), fixtureCase: z.enum(FIXTURE_CASES).optional(),
  /** Existing browser-local rehearsal convention. REAL state is always read from the authority. */
  session: z.unknown().optional(),
  action: z.enum(["post_live", "creator_snapshot"]).default("post_live"),
}).strict();
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export const CAPABILITY_KEYS = ["audience_concurrency", "minute_viewers", "product_impressions", "product_clicks", "orders", "gmv", "comment_count", "likes", "shares", "raw_comment_text", "product_pin_state", "pin_unpin_control", "giveaway_control"] as const;
export type CapabilityKey = typeof CAPABILITY_KEYS[number];
export const ProviderCapabilitySchema = z.object({
  key: z.enum(CAPABILITY_KEYS), support: z.enum(["REALTIME", "POST_LIVE", "UNSUPPORTED"]),
  state: z.enum(["REALTIME", "POST_LIVE", "ACCESS_REQUIRED", "UNSUPPORTED", "NOT_CONFIGURED"]),
  scope: z.string().nullable(), note: z.string(),
}).strict();
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;
export const ProviderStatusSchema = z.object({
  provider: z.literal("tiktok_shop"), state: ProviderStateSchema, mode: z.enum(["off", "real", "fixture"]),
  configIssues: z.array(z.string()), capabilities: z.array(ProviderCapabilitySchema), fixtureLabel: z.literal("SIMULATED / FIXTURE").nullable(),
}).strict();
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

export const CreatorEvidenceSchema = z.object({ telemetryId: z.string().uuid(), sessionId: z.string(), mode: z.enum(["REAL", "SIMULATED"]),
  providerSessionId: z.string().regex(/^\d{1,30}$/), observedAt: InstantSchema, recordedAt: InstantSchema, metrics: z.array(ProviderMetricSchema).max(2),
}).strict().refine(e => e.metrics.every(m => m.source === (e.mode === "REAL" ? "tiktok_creator" : "fixture")), "Invalid telemetry source");
export type CreatorEvidence = z.infer<typeof CreatorEvidenceSchema>;
export const AsKnownThenSchema = z.object({
  sessionId: z.string(), mode: z.enum(["REAL", "SIMULATED"]), perspective: z.literal("as_known_then"), asOfMs: InstantSchema,
  plan: PlanVersionSchema, runtime: RuntimeSchema, events: z.array(SessionEventSchema), evidenceLimits: z.array(z.string()),
}).strict();
export type AsKnownThen = z.infer<typeof AsKnownThenSchema>;
export const HistoricalEvidenceSchema = AsKnownThenSchema.extend({ providerEvidence: z.array(CreatorEvidenceSchema).max(1000) }).strict();
export type HistoricalEvidence = z.infer<typeof HistoricalEvidenceSchema>;

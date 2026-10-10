import { z } from "zod";
import { PlanVersionSchema } from "./plan";
import { ProductSnapshotSchema } from "./product";

export const SessionLifecycleSchema = z.enum(["planned", "active", "ended"]);
export type SessionLifecycle = z.infer<typeof SessionLifecycleSchema>;

/** REAL manual execution and SIMULATED rehearsal never mix. */
export const EnvironmentIdentitySchema = z.enum(["REAL", "SIMULATED"]);
export type EnvironmentIdentity = z.infer<typeof EnvironmentIdentitySchema>;

export const OperatorRoleSchema = z.enum(["lead", "assistant"]);
export type OperatorRole = z.infer<typeof OperatorRoleSchema>;

export const OperatorContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: OperatorRoleSchema,
  isLead: z.boolean(),
});
export type OperatorContext = z.infer<typeof OperatorContextSchema>;

export const SegmentRunSchema = z.object({
  state: z.enum(["pending", "active", "completed", "skipped"]),
  startedAtMs: z.number().int().nullable(),
  endedAtMs: z.number().int().nullable(),
  endedBy: z.enum(["advance", "close", "session_end"]).nullable(),
  /**
   * Operator-declared coverage when a segment ends. null = not declared.
   * Duration never implies coverage: reaching a minimum is not proof that every point was covered.
   */
  coverage: z.enum(["complete", "partial"]).nullable(),
  /** Unfinished work the operator declared at the end of the segment. A manual note, never an automatic transfer. */
  followUp: z.string().nullable().default(null),
  /** Explicit host estimate for the active segment: it is expected to end at endsAtMs. 0 remaining is a valid estimate. */
  remainingEstimate: z
    .object({ endsAtMs: z.number().int(), reportedAtMs: z.number().int() })
    .nullable(),
  /**
   * The host explicitly said the remaining time is unknown (recorded at this instant).
   * Distinct from "no estimate entered": it suppresses the target-derived end and propagates possible risk.
   */
  remainingUnknownAtMs: z.number().int().nullable().default(null),
  belowMinimum: z.boolean(),
  skipAcknowledged: z.boolean(),
  /** Set when an operator moved this pending segment later in the order. */
  deferred: z.boolean(),
});
export type SegmentRun = z.infer<typeof SegmentRunSchema>;

/** Cue outcome. Attempt != performed. A report is never platform confirmation. */
export const CueRunSchema = z.object({
  state: z.enum(["pending", "attempted", "performed", "cancelled"]),
  /** When the operator says it happened. */
  occurredAtMs: z.number().int().nullable(),
  /** When LiveLift recorded the report. */
  reportedAtMs: z.number().int().nullable(),
  reason: z.string().nullable(),
});
export type CueRun = z.infer<typeof CueRunSchema>;

/**
 * A native action the operator reports that was NOT planned as a cue (e.g. an unexpected pin).
 * Same semantics as a cue report: attempted stays unresolved, a report is never platform confirmation.
 */
export const ManualActionRunSchema = z.object({
  id: z.string(),
  action: z.enum(["pin_product", "unpin_product", "start_promotion", "other"]),
  /** Product in this show's pack, when the action targets one. */
  productId: z.string().nullable(),
  /** Exact target as the operator named it (product code + name, promotion name, ...). */
  targetLabel: z.string(),
  state: z.enum(["attempted", "performed", "cancelled"]),
  /** When the operator says it happened. null when cancelled. */
  occurredAtMs: z.number().int().nullable(),
  /** When LiveLift recorded the latest report. */
  reportedAtMs: z.number().int(),
  reason: z.string().nullable(),
});
export type ManualActionRun = z.infer<typeof ManualActionRunSchema>;

export const RuntimeSchema = z.object({
  startedAtMs: z.number().int().nullable(),
  endedAtMs: z.number().int().nullable(),
  currentSegmentId: z.string().nullable(),
  segments: z.record(z.string(), SegmentRunSchema),
  cues: z.record(z.string(), CueRunSchema),
  /** Unplanned native actions reported by the operator. */
  actions: z.record(z.string(), ManualActionRunSchema).default({}),
});
export type Runtime = z.infer<typeof RuntimeSchema>;

export const EventTypeSchema = z.enum([
  "session_started",
  "segment_started",
  "segment_ended",
  "segment_skipped",
  "segment_reordered",
  "plan_changed",
  "anchor_changed",
  "remaining_estimated",
  "recovery_selected",
  "cue_reported",
  "action_reported",
  "note_added",
  "clock_advanced",
  "clock_discontinuity",
  "session_ended",
  "correction_added",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const SessionEventSchema = z.object({
  id: z.string(),
  seq: z.number().int().positive(),
  type: EventTypeSchema,
  /** When it happened. */
  occurredAtMs: z.number().int(),
  /** When LiveLift recorded it. Corrections and late reports differ from occurredAtMs. */
  recordedAtMs: z.number().int(),
  actor: z.string(),
  source: z.enum(["operator", "simulator"]),
  commandKey: z.string(),
  planVersionId: z.string(),
  summary: z.string(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const ReceiptSchema = z.object({
  commandKey: z.string(),
  type: z.string(),
  outcome: z.enum(["committed", "rejected"]),
  code: z.string().nullable(),
  message: z.string().nullable(),
  revisionAfter: z.number().int(),
  eventIds: z.array(z.string()),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const DerivedFromSchema = z.object({
  sessionId: z.string(),
  sessionTitle: z.string(),
  planVersionId: z.string(),
  /** The selected adjustments that were applied to this plan, with their plain-language summaries. */
  appliedChanges: z.array(z.object({ id: z.string(), summary: z.string() })),
  changeNote: z.string(),
  createdAtMs: z.number().int(),
});
export type DerivedFrom = z.infer<typeof DerivedFromSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Session title is required"),
  environment: EnvironmentIdentitySchema,
  timezone: z.string(),
  objective: z.string().nullable(),
  accountLabel: z.string().nullable(),
  lifecycle: SessionLifecycleSchema,
  operator: OperatorContextSchema,
  scenarioId: z.string().nullable(),
  derivedFrom: DerivedFromSchema.nullable(),
  products: z.array(ProductSnapshotSchema),
  /** plans[0] is the baseline. It is immutable once baselineLocked. Later entries are explicit revisions. */
  plans: z.array(PlanVersionSchema).min(1),
  baselineLocked: z.boolean(),
  runtime: RuntimeSchema,
  /** Append-only. Earlier entries are never edited. */
  events: z.array(SessionEventSchema),
  receipts: z.record(z.string(), ReceiptSchema),
  revision: z.number().int().nonnegative(),
  /** Deterministic id counters. */
  seq: z.object({
    event: z.number().int(),
    command: z.number().int(),
    segment: z.number().int(),
    cue: z.number().int(),
    action: z.number().int().default(0),
  }),
  /** Simulated sessions run on an explicit virtual clock. REAL sessions use the device clock. */
  virtualNowMs: z.number().int().nullable(),
  /** Index of the next scripted scenario step (simulated sessions only). */
  scriptCursor: z.number().int().nonnegative(),
  createdAtMs: z.number().int(),
  updatedAtMs: z.number().int(),
});
export type Session = z.infer<typeof SessionSchema>;

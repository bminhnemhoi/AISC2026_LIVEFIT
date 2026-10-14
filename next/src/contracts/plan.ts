import { z } from "zod";
import { ProductSnapshotSchema } from "./product";

/**
 * Plan contracts for the timed Run of Show.
 *
 * Durations are whole seconds. Instants are epoch milliseconds.
 * `null` on a duration means "not entered" — missing is never treated as zero.
 */

export const SegmentKindSchema = z.enum([
  "opening",
  "product",
  "promotion",
  "qa",
  "closing",
  "break",
]);
export type SegmentKind = z.infer<typeof SegmentKindSchema>;

export const SegmentSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Segment title is required"),
  kind: SegmentKindSchema,
  productId: z.string().nullable(),
  /** Allocated (target) host time. null = not entered. */
  targetSec: z.number().int().positive().nullable(),
  /**
   * Declared minimum. null = no minimum declared, so the segment cannot be shortened.
   * 0 is a real declared value: the segment may be cut entirely without a minimum exception.
   */
  minSec: z.number().int().nonnegative().nullable(),
  /** Optional segments may be skipped without breaking required coverage. */
  optional: z.boolean(),
  /**
   * Hard anchor: the committed start, as seconds after the plan's planned start.
   * null = floating. Anchors are never moved implicitly.
   */
  anchorOffsetSec: z.number().int().nonnegative().nullable(),
  /** Short presenter cue shown with the segment. */
  cue: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Segment = z.infer<typeof SegmentSchema>;

/** Explicit action enum so that `unpin` can never match `pin` through substring logic. */
export const CueActionSchema = z.enum([
  "none",
  "pin_product",
  "unpin_product",
  "start_promotion",
]);
export type CueAction = z.infer<typeof CueActionSchema>;

export const CueTimingSchema = z.discriminatedUnion("type", [
  /** Wall-clock commitment: planned start + offset. */
  z.object({ type: z.literal("at_offset"), offsetSec: z.number().int().nonnegative() }),
  /** Relative to a segment's (projected or actual) start. */
  z.object({
    type: z.literal("segment_start"),
    segmentId: z.string(),
    offsetSec: z.number().int(),
  }),
  /** Relative to a segment's (projected or actual) end. */
  z.object({
    type: z.literal("segment_end"),
    segmentId: z.string(),
    offsetSec: z.number().int(),
  }),
]);
export type CueTiming = z.infer<typeof CueTimingSchema>;

/**
 * A cue is a zero-duration marker. It never consumes host time.
 * A promotion that takes host time is a Segment, not a Cue.
 */
export const CueSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Cue title is required"),
  audience: z.enum(["operator", "presenter"]),
  action: CueActionSchema,
  productId: z.string().nullable(),
  timing: CueTimingSchema,
  text: z.string().nullable(),
});
export type Cue = z.infer<typeof CueSchema>;

export const PlanVersionSchema = z.object({
  id: z.string(),
  /** 1 = baseline/draft; later numbers are explicit in-show revisions. */
  version: z.number().int().positive(),
  kind: z.enum(["baseline", "revision"]),
  plannedStartMs: z.number().int(),
  segments: z.array(SegmentSchema),
  cues: z.array(CueSchema),
  createdAtMs: z.number().int(),
  reason: z.string().nullable(),
});
export type PlanVersion = z.infer<typeof PlanVersionSchema>;

export { ProductSnapshotSchema };

import { z } from "zod";
import type { AuthorityCommandBody } from "@/contracts/authority";
import { CueSchema, ProductSnapshotSchema, SegmentSchema } from "@/contracts";

// These names must not resolve inherited entries in the domain's runtime records.
export const idSchema = z.string().min(1).refine(
  (id) => id.trim() !== "" && !["__proto__", "constructor", "prototype"].includes(id),
  "Invalid identifier",
);
const instant = z.number().int().safe().refine((n) => Math.abs(n) <= 8.64e15, "Invalid instant");
const number = z.number().finite();
const report = z.enum(["performed", "attempted", "cancelled"]);
const coverage = {
  coverage: z.enum(["complete", "partial"]).nullable().optional(),
  followUp: z.string().optional(),
  acknowledgeBelowMinimum: z.boolean().optional(),
};
const recovery = { recoveryId: z.string().optional(), recoveryLabel: z.string().optional() };
const segment = SegmentSchema.extend({
  id: idSchema, productId: idSchema.nullable(),
  targetSec: z.number().int().safe().positive().nullable(),
  minSec: z.number().int().safe().nonnegative().nullable(),
  anchorOffsetSec: z.number().int().safe().nonnegative().nullable(),
}).strict();
const cue = CueSchema.extend({
  id: idSchema,
  productId: idSchema.nullable(),
  timing: z.discriminatedUnion("type", [
    z.object({ type: z.literal("at_offset"), offsetSec: z.number().int().safe().nonnegative() }).strict(),
    z.object({ type: z.literal("segment_start"), segmentId: idSchema, offsetSec: z.number().int().safe() }).strict(),
    z.object({ type: z.literal("segment_end"), segmentId: idSchema, offsetSec: z.number().int().safe() }).strict(),
  ]),
}).strict();
const editable = {
  title: z.string().refine((s) => s.trim() !== "", "Session title is required"),
  timezone: z.string().refine((zone) => {
    try { new Intl.DateTimeFormat("en", { timeZone: zone }); return zone.trim() !== ""; }
    catch { return false; }
  }, "Invalid timezone"),
  plannedStartMs: instant,
  objective: z.string().nullable(),
  accountLabel: z.string().nullable(),
  products: z.array(ProductSnapshotSchema.extend({ id: idSchema, price: z.number().finite().nullable() }).strict()),
  segments: z.array(segment),
  cues: z.array(cue),
};

/** Shape validation precedes durable intent logging; payload validation happens inside the transaction. */
export const envelopeSchema = z.object({
  commandId: idSchema,
  roomId: idSchema,
  sessionId: idSchema.nullable(),
  expectedRevision: z.number().int().safe().nonnegative(),
  type: z.string().min(1),
  // Keep the exact JSON object: z.record strips a literal __proto__ key before identity hashing.
  payload: z.custom<Record<string, unknown>>((value) => value !== null && typeof value === "object" && !Array.isArray(value)),
}).strict();
export type Envelope = z.infer<typeof envelopeSchema>;

const payloads = {
  create_session: z.object({
    ...editable,
    objective: editable.objective.optional(),
    accountLabel: editable.accountLabel.optional(),
    products: editable.products.optional(),
    segments: editable.segments.optional(),
    cues: editable.cues.optional(),
  }).strict(),
  save_prepare: z.object(editable).strict(),
  create_next: z.object({ title: editable.title, plannedStartMs: instant, changeIds: z.array(idSchema), note: z.string() }).strict(),
  start_live: z.object({ rebaseToNow: z.boolean().optional() }).strict(),
  start_segment: z.object({ segmentId: idSchema }).strict(),
  end_segment: z.object({ segmentId: idSchema, ...coverage, ...recovery }).strict(),
  advance_segment: z.object({ ...coverage, ...recovery }).strict(),
  shorten_segment: z.object({ segmentId: idSchema, newTargetSec: number, acknowledgeBelowMinimum: z.boolean().optional(), ...recovery }).strict(),
  extend_segment: z.object({ segmentId: idSchema, deltaSec: number, ...recovery }).strict(),
  commit_end_by: z.object({ segmentId: idSchema, endByMs: instant, acknowledgeBelowMinimum: z.boolean().optional(), ...recovery }).strict(),
  set_remaining_estimate: z.object({ segmentId: idSchema, remainingSec: number.nullable() }).strict(),
  mark_remaining_unknown: z.object({ segmentId: idSchema }).strict(),
  skip_segment: z.object({ segmentId: idSchema, acknowledgeCoverageLoss: z.boolean().optional(), ...recovery }).strict(),
  reorder_segment: z.object({ segmentId: idSchema, beforeSegmentId: idSchema.nullable(), ...recovery }).strict(),
  reanchor_segment: z.object({ segmentId: idSchema, anchorOffsetSec: number, reason: z.string(), ...recovery }).strict(),
  report_cue: z.object({ cueId: idSchema, report, occurredAtMs: instant.optional(), reason: z.string().optional() }).strict(),
  report_manual_action: z.object({
    actionId: idSchema.optional(), action: z.enum(["pin_product", "unpin_product", "start_promotion", "other"]).optional(),
    productId: idSchema.nullable().optional(), targetLabel: z.string().optional(), report,
    occurredAtMs: instant.optional(), reason: z.string().optional(),
  }).strict(),
  add_note: z.object({ text: z.string() }).strict(),
  end_live: z.object({}).strict(),
  acknowledge_clock_discontinuity: z.object({ deviceNowMs: instant, keptNowMs: instant }).strict(),
  append_correction: z.object({ targetEventId: idSchema, text: z.string(), correctedAtMs: instant.optional() }).strict(),
} satisfies Record<AuthorityCommandBody["type"], z.ZodTypeAny>;

export function parseBody(envelope: Envelope): AuthorityCommandBody | null {
  const schema = Object.hasOwn(payloads, envelope.type) ? payloads[envelope.type as keyof typeof payloads] : null;
  if (!schema) return null;
  const result = schema.safeParse(envelope.payload);
  return result.success ? { ...result.data, type: envelope.type } as AuthorityCommandBody : null;
}

/** Sort object keys only: defaults, absent keys, nulls, zeros and array order retain their identity. */
export function canonicalJson(value: unknown): string {
  // JSON.parse can overflow a valid JSON numeric literal; keep rejected nonfinite intent distinct from null.
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

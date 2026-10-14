import { z } from "zod";
import type { EvidenceSource } from "./liveIntelligence";

/**
 * AI Copilot contracts: what the browser may send, and what it may be told.
 *
 * The Copilot is an ADVISOR. Nothing here can change authoritative show state:
 *   - a recommendation can only point at an option or change that LiveLift's own product logic already computed
 *     (by an opaque alias), never carry a command of its own;
 *   - acceptance is a separate, explicit operator action through the existing command path.
 *
 * No provider credential, provider URL or raw provider text appears in any type here.
 */

export const AI_ROUTES = {
  status: "/api/v3/ai/status",
  operate: "/api/v3/ai/operate",
  review: "/api/v3/ai/review",
} as const;

export type AiTask = "operate" | "review";

/** What the server itself can know. The runtime states (generating, available, ...) belong to one request. */
export type AiConfigState = "not_configured" | "ready";

export interface AiStatusView {
  state: AiConfigState;
  /** The configured model name (not a secret). null when not configured. */
  model: string | null;
  /** Names (never values) of environment variables that are missing or invalid, when not configured. */
  configIssues: string[];
}

/** The truthful states a Copilot surface can be in. */
export type AiRunState = "not_configured" | "ready" | "generating" | "available" | "unavailable" | "rate_limited" | "invalid_response";

// ---- Evidence -------------------------------------------------------------------------------------------------------

/**
 * recorded          a fact in LiveLift's own recorded history (commands, actuals)
 * computed          schedule arithmetic over recorded facts (a forecast, a variance) — product logic, not AI
 * operator_reported what the operator said happened; never platform confirmation
 * gap               something LiveLift does NOT have (missing != zero, unknown != failed)
 * simulated         the data is a SIMULATED rehearsal
 */
export const AiFactKindSchema = z.enum(["recorded", "computed", "operator_reported", "gap", "simulated"]);
export type AiFactKind = z.infer<typeof AiFactKindSchema>;

export const AiFactSchema = z
  .object({
    /** Opaque id used for citations (f1, f2, ...). */
    id: z.string().min(1).max(12),
    /** Stable semantic topic, for tests and grouping. Never shown as evidence. */
    topic: z.string().min(1).max(40),
    kind: AiFactKindSchema,
    text: z.string().min(1).max(420),
    /** The numbers behind the sentence, so a model may quote them exactly. */
    values: z.record(z.string(), z.number()).optional(),
    evidenceTier: z.literal("provider_observed").optional(),
    source: z.enum(["tiktok_shop", "fixture"]).optional(),
    fetchedAt: z.number().int().nonnegative().optional(),
    perspective: z.literal("later_evidence").optional(),
  })
  .strict();
export type AiFact = z.infer<typeof AiFactSchema>;

// ---- Model output (what the model is allowed to say) ------------------------------------------------------------------

const Cites = z.array(z.string().min(1).max(12)).max(8);
const Alias = z.string().min(1).max(12);

export const OperateModelOutputSchema = z
  .object({
    interpretation: z.object({ text: z.string().min(1).max(400), cites: Cites }).strict(),
    /** Each points at a candidate option by alias. Never a command. */
    recommendations: z.array(z.object({ optionId: Alias, why: z.string().min(1).max(300), cites: Cites }).strict()).max(2),
    /** Advisory guidance about what should happen NEXT. Not executable. */
    nextStep: z.object({ text: z.string().min(1).max(240), why: z.string().min(1).max(300), cites: Cites }).strict().nullable(),
    limitations: z.array(z.string().min(1).max(200)).max(3),
  })
  .strict();
export type OperateModelOutput = z.infer<typeof OperateModelOutputSchema>;

export const ReviewModelOutputSchema = z
  .object({
    summary: z.object({ text: z.string().min(1).max(600), cites: Cites }).strict(),
    deviations: z.array(z.object({ text: z.string().min(1).max(240), cites: Cites }).strict()).max(5),
    gaps: z.array(z.object({ text: z.string().min(1).max(240), cites: Cites }).strict()).max(5),
    evidenceLimits: z.array(z.object({ text: z.string().min(1).max(240), cites: Cites }).strict()).max(4),
    /** Each points at a Next LIVE adjustment LiveLift already proposes, by alias. */
    nextLive: z.array(z.object({ changeId: Alias, why: z.string().min(1).max(300), cites: Cites }).strict()).max(5),
    /** Ideas the operator would have to carry out by hand. Not selectable, never applied. */
    manualIdeas: z.array(z.object({ text: z.string().min(1).max(240), why: z.string().min(1).max(300), cites: Cites }).strict()).max(3),
  })
  .strict();
export type ReviewModelOutput = z.infer<typeof ReviewModelOutputSchema>;

// ---- What the browser receives ----------------------------------------------------------------------------------------

export const AiOptionRefSchema = z
  .object({
    /** The product's own recovery option id: the Apply button resolves it against the LIVE options. */
    id: z.string().min(1).max(200),
    label: z.string().max(300),
    detail: z.string().max(600),
    kind: z.string().max(40),
    clean: z.boolean(),
    protects: z.boolean(),
    exception: z.enum(["below_minimum", "required_coverage", "commitment_change"]).nullable(),
  })
  .strict();
export type AiOptionRef = z.infer<typeof AiOptionRefSchema>;

export const AiChangeRefSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().max(300),
    detail: z.string().max(600),
    basis: z.enum(["observed", "tradeoff"]),
  })
  .strict();
export type AiChangeRef = z.infer<typeof AiChangeRefSchema>;

const Basis = z
  .object({
    /** The session revision the evidence came from. A different revision means the analysis is out of date. */
    revision: z.number().int().nonnegative(),
    criticalSegmentId: z.string().nullable(),
    recoveryStatus: z.string().max(40),
  })
  .strict();

const Common = {
  environment: z.enum(["REAL", "SIMULATED"]),
  model: z.string().max(120),
  generatedAtMs: z.number().int(),
  /** The show time the evidence was taken at. */
  asOfMs: z.number().int(),
  facts: z.array(AiFactSchema).max(60),
};

export const OperateAvailableSchema = z
  .object({
    status: z.literal("available"),
    task: z.literal("operate"),
    ...Common,
    basis: Basis,
    output: z
      .object({
        interpretation: z.object({ text: z.string(), cites: Cites }).strict(),
        recommendations: z.array(z.object({ option: AiOptionRefSchema, why: z.string(), cites: Cites }).strict()).max(2),
        nextStep: z.object({ text: z.string(), why: z.string(), cites: Cites }).strict().nullable(),
        limitations: z.array(z.string()).max(3),
      })
      .strict(),
  })
  .strict();
export type OperateAvailable = z.infer<typeof OperateAvailableSchema>;

export const ReviewAvailableSchema = z
  .object({
    status: z.literal("available"),
    task: z.literal("review"),
    ...Common,
    basis: Basis,
    output: z
      .object({
        summary: z.object({ text: z.string(), cites: Cites }).strict(),
        deviations: z.array(z.object({ text: z.string(), cites: Cites }).strict()).max(5),
        gaps: z.array(z.object({ text: z.string(), cites: Cites }).strict()).max(5),
        evidenceLimits: z.array(z.object({ text: z.string(), cites: Cites }).strict()).max(4),
        nextLive: z.array(z.object({ change: AiChangeRefSchema, why: z.string(), cites: Cites }).strict()).max(5),
        manualIdeas: z.array(z.object({ text: z.string(), why: z.string(), cites: Cites }).strict()).max(3),
      })
      .strict(),
  })
  .strict();
export type ReviewAvailable = z.infer<typeof ReviewAvailableSchema>;

export const AiInvalidReasonSchema = z.enum(["empty", "not_json", "schema", "unknown_reference", "unsafe_content", "unsupported_claim", "ungrounded_number"]);
export type AiInvalidReason = z.infer<typeof AiInvalidReasonSchema>;

export const AiUnavailableReasonSchema = z.enum(["timeout", "network", "provider_error", "credentials_rejected"]);
export type AiUnavailableReason = z.infer<typeof AiUnavailableReasonSchema>;

const NotConfigured = z.object({ status: z.literal("not_configured"), configIssues: z.array(z.string().max(80)).max(20) }).strict();
const Unavailable = z.object({ status: z.literal("unavailable"), reason: AiUnavailableReasonSchema }).strict();
const RateLimited = z.object({ status: z.literal("rate_limited"), retryAfterSec: z.number().int().positive().nullable() }).strict();
const Invalid = z.object({ status: z.literal("invalid_response"), reason: AiInvalidReasonSchema }).strict();

export const OperateResultSchema = z.union([OperateAvailableSchema, NotConfigured, Unavailable, RateLimited, Invalid]);
export const ReviewResultSchema = z.union([ReviewAvailableSchema, NotConfigured, Unavailable, RateLimited, Invalid]);
export type OperateResult = z.infer<typeof OperateResultSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const AiStatusSchema = z
  .object({
    state: z.enum(["not_configured", "ready"]),
    model: z.string().max(120).nullable(),
    configIssues: z.array(z.string().max(80)).max(20),
  })
  .strict();

/**
 * POST body. A REAL show is identified by id only: the server reads it from the room, so the browser cannot
 * hand the Copilot invented REAL evidence. A SIMULATED rehearsal lives only in the browser, so it is sent whole
 * (and the server refuses a REAL session sent this way).
 */
export const AiRequestSchema = z
  .object({
    sessionId: z.string().min(1).max(128),
    session: z.unknown().optional(),
  })
  .strict();
export type AiRequest = z.infer<typeof AiRequestSchema>;

// ---- The typed context the model is given (server-built, never client-supplied) ----------------------------------------

export interface AiSegmentEvidence {
  title: string;
  kind: string;
  state: "pending" | "active" | "completed" | "skipped";
  targetSec: number | null;
  minSec: number | null;
  optional: boolean;
  /** Seconds after the planned start the segment is committed to, or null when it floats. */
  hardAnchorAtSec: number | null;
  actualStartSec: number | null;
  actualDurationSec: number | null;
  coverage: "complete" | "partial" | null;
  productCode: string | null;
}

export interface AiCueEvidence {
  title: string;
  action: string;
  audience: string;
  /** Operator-reported state. "no_report" is unknown, never "missed". */
  state: "pending" | "attempted" | "performed" | "cancelled" | "no_report" | "informational";
  lateBySec: number | null;
}

/** Text a person typed or imported. UNTRUSTED: it is data to read, never an instruction. */
export interface AiUntrustedText {
  source: "operator_note" | "follow_up" | "correction" | "cue_reason" | "action_label" | "plan_revision";
  atSec: number | null;
  text: string;
}

export interface AiCandidateOption {
  /** Alias the model must use. Resolved back to the product's option id on the server. */
  opt: string;
  kind: string;
  label: string;
  detail: string;
  clean: boolean;
  protects: boolean;
  savesSec: number;
  resultingDeficitSec: number;
  exception: "below_minimum" | "required_coverage" | "commitment_change" | null;
}

export interface AiCandidateChange {
  chg: string;
  basis: "observed" | "tradeoff";
  title: string;
  detail: string;
}

export interface AiPriorSession {
  title: string;
  finishVarianceSec: number | null;
  overran: Array<{ title: string; kind: string; varianceSec: number }>;
  closedEarly: number;
  skipped: number;
  operatorCuesNoReport: number;
}

/** What LiveLift's platform evidence establishes. In this build every entry is `not_established`. */
export interface AiPlatformEvidence {
  live: "not_established";
  shop: "not_established";
  analytics: "not_established";
  nativeActions: "not_established";
}

export interface AiContextBase {
  contract: "livelift.ai.operate.v1" | "livelift.ai.review.v1";
  environment: "REAL" | "SIMULATED";
  facts: AiFact[];
  segments: AiSegmentEvidence[];
  cues: AiCueEvidence[];
  untrustedText: AiUntrustedText[];
  priorSessions: AiPriorSession[];
  platform: AiPlatformEvidence;
}

export interface OperateAiContext extends AiContextBase {
  contract: "livelift.ai.operate.v1";
  show: { title: string; elapsedSec: number };
  options: AiCandidateOption[];
}

export interface ReviewAiContext extends AiContextBase {
  contract: "livelift.ai.review.v1";
  show: { title: string; trackedSec: number };
  changes: AiCandidateChange[];
  laterEvidence?: { snapshotId: string; fetchedAt: number; perspective: "later_evidence"; source: EvidenceSource; evidenceTier: "provider_observed" };
}

export type AiContext = OperateAiContext | ReviewAiContext;

import crypto from "node:crypto";
import type {
  AuthorityCommandBody,
  AuthorityReceipt,
  CommandEnvelope,
  CommandResponse,
  CreateNextPayload,
  CreateSessionPayload,
  RoomRead,
  SavePreparePayload,
} from "@/contracts/authority";
import type { Session } from "@/contracts/session";
import { newSegment } from "@/lib/domain";

/** Type-safe constructor for CommandEnvelope */
export function createCommandEnvelope<T extends AuthorityCommandBody["type"]>(
  type: T,
  params: {
    commandId: string;
    roomId?: string;
    sessionId: T extends "create_session" ? null : string;
    expectedRevision: number;
    payload: Omit<Extract<AuthorityCommandBody, { type: T }>, "type">;
  }
): CommandEnvelope {
  return {
    type,
    commandId: params.commandId,
    roomId: params.roomId ?? TEST_ROOM_ID,
    sessionId: params.sessionId,
    expectedRevision: params.expectedRevision,
    payload: params.payload,
  } as CommandEnvelope;
}

export const TEST_ROOM_ID = "room-aud-01";
export const TEST_SESSION_ID = "sess-aud-01";
export const TEST_OPERATOR_ACTOR = {
  actorId: "actor-op-1",
  name: "Lead Operator",
  role: "operator" as const,
};
export const TEST_VIEWER_ACTOR = {
  actorId: "actor-vw-1",
  name: "Guest Viewer",
  role: "viewer" as const,
};

export const TEST_OPERATOR_TOKEN = "test-operator-token";
export const TEST_VIEWER_TOKEN = "test-viewer-token";
export const TEST_INVALID_TOKEN = "invalid-token-xyz";

export const TEST_CAPABILITIES = [
  {
    token: TEST_OPERATOR_TOKEN,
    roomId: TEST_ROOM_ID,
    actorId: TEST_OPERATOR_ACTOR.actorId,
    name: TEST_OPERATOR_ACTOR.name,
    role: "operator" as const,
  },
  {
    token: TEST_VIEWER_TOKEN,
    roomId: TEST_ROOM_ID,
    actorId: TEST_VIEWER_ACTOR.actorId,
    name: TEST_VIEWER_ACTOR.name,
    role: "viewer" as const,
  },
];

export const REJECTION_CODES = [
  "stale_revision",
  "idempotency_conflict",
  "another_show_active",
  "invalid_state",
  "invalid_payload",
  "plan_invalid",
  "not_found",
  "forbidden",
  "not_next",
  "current_segment_active",
  "no_active_segment",
  "anchor_not_reached",
  "needs_ack_below_minimum",
  "needs_ack_required_coverage",
  "constraint_violation",
  "wrong_environment",
  "already_reported",
] as const;

export type AuthorityRejectionCode = (typeof REJECTION_CODES)[number];

/** Canonical sort of JSON object keys (array element order is preserved). */
export function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    if (obj[k] !== undefined) {
      result[k] = canonicalizeJson(obj[k]);
    }
  }
  return result;
}

/** Canonical string representation of a command envelope request. */
export function canonicalRequestString(envelope: {
  roomId: string;
  sessionId: string | null;
  expectedRevision: number;
  type: string;
  payload: object;
}): string {
  const canonicalObj = {
    expectedRevision: envelope.expectedRevision,
    payload: canonicalizeJson(envelope.payload),
    roomId: envelope.roomId,
    sessionId: envelope.sessionId,
    type: envelope.type,
  };
  return JSON.stringify(canonicalObj);
}

/** Canonical SHA-256 hash of a command envelope. */
export function canonicalRequestHash(envelope: {
  roomId: string;
  sessionId: string | null;
  expectedRevision: number;
  type: string;
  payload: object;
}): string {
  return crypto.createHash("sha256").update(canonicalRequestString(envelope)).digest("hex");
}

/** Check if two envelopes represent the exact same canonical intent. */
export function areCanonicalRequestsEqual(
  a: { roomId: string; sessionId: string | null; expectedRevision: number; type: string; payload: object },
  b: { roomId: string; sessionId: string | null; expectedRevision: number; type: string; payload: object }
): boolean {
  return canonicalRequestHash(a) === canonicalRequestHash(b);
}

// ---------------------------------------------------------------------------
// Sample canonical envelopes
// ---------------------------------------------------------------------------

export const sampleCreateSessionPayload: CreateSessionPayload = {
  title: "Phase 2 Authority Acceptance Show",
  timezone: "Asia/Ho_Chi_Minh",
  plannedStartMs: 1_700_000_000_000,
  objective: "Validate sole authority and optimistic concurrency",
  accountLabel: "@livelift_hq",
  products: [
    {
      id: "prod-1",
      code: "SKU-01",
      name: "Smart Stand",
      price: 29.99,
      currency: "USD",
      priority: "normal",
      status: "enabled",
      talkingPoints: ["Sturdy", "Rotates"],
      constraints: [],
      initials: "SS",
    },
  ],
  segments: [
    newSegment("seg-intro", {
      title: "Introduction",
      kind: "opening",
      optional: false,
      targetSec: 180,
      minSec: 120,
    }),
    newSegment("seg-demo", {
      title: "Product Showcase",
      kind: "product",
      optional: false,
      targetSec: 420,
      minSec: 300,
      productId: "prod-1",
    }),
  ],
  cues: [
    {
      id: "cue-pin-1",
      title: "Pin Smart Stand",
      audience: "operator",
      action: "pin_product",
      productId: "prod-1",
      timing: { type: "segment_start", segmentId: "seg-demo", offsetSec: 0 },
      text: null,
    },
  ],
};

export const sampleCreateSessionEnvelope: CommandEnvelope = {
  commandId: "cmd-create-001",
  roomId: TEST_ROOM_ID,
  sessionId: null,
  expectedRevision: 0,
  type: "create_session",
  payload: sampleCreateSessionPayload,
};

export const sampleSavePreparePayload: SavePreparePayload = {
  title: "Phase 2 Updated Acceptance Show",
  timezone: "Asia/Ho_Chi_Minh",
  objective: "Updated objective before start",
  accountLabel: "@livelift_hq",
  products: sampleCreateSessionPayload.products ?? [],
  plannedStartMs: 1_700_000_000_000,
  segments: sampleCreateSessionPayload.segments ?? [],
  cues: sampleCreateSessionPayload.cues ?? [],
};

export const sampleSavePrepareEnvelope: CommandEnvelope = {
  commandId: "cmd-saveprep-001",
  roomId: TEST_ROOM_ID,
  sessionId: TEST_SESSION_ID,
  expectedRevision: 1,
  type: "save_prepare",
  payload: sampleSavePreparePayload,
};

export const sampleStartLiveEnvelope: CommandEnvelope = {
  commandId: "cmd-startlive-001",
  roomId: TEST_ROOM_ID,
  sessionId: TEST_SESSION_ID,
  expectedRevision: 2,
  type: "start_live",
  payload: { rebaseToNow: false },
};

export const sampleStartSegmentEnvelope: CommandEnvelope = {
  commandId: "cmd-startseg-001",
  roomId: TEST_ROOM_ID,
  sessionId: TEST_SESSION_ID,
  expectedRevision: 3,
  type: "start_segment",
  payload: { segmentId: "seg-intro" },
};

export const sampleEndSegmentEnvelope: CommandEnvelope = {
  commandId: "cmd-endseg-001",
  roomId: TEST_ROOM_ID,
  sessionId: TEST_SESSION_ID,
  expectedRevision: 4,
  type: "end_segment",
  payload: {
    segmentId: "seg-intro",
    coverage: "complete",
    acknowledgeBelowMinimum: false,
  },
};

export const sampleCreateNextPayload: CreateNextPayload = {
  title: "Follow-up Live Session",
  plannedStartMs: 1_700_086_400_000,
  changeIds: [],
  note: "Derived from successful acceptance session",
};

export const sampleCreateNextEnvelope: CommandEnvelope = {
  commandId: "cmd-createnext-001",
  roomId: TEST_ROOM_ID,
  sessionId: TEST_SESSION_ID,
  expectedRevision: 5,
  type: "create_next",
  payload: sampleCreateNextPayload,
};

export const sampleOrdinaryShortenEnvelope: CommandEnvelope = {
  commandId: "cmd-shorten-ord-001",
  roomId: TEST_ROOM_ID,
  sessionId: TEST_SESSION_ID,
  expectedRevision: 4,
  type: "shorten_segment",
  payload: {
    segmentId: "seg-demo",
    newTargetSec: 360,
    acknowledgeBelowMinimum: false,
  },
};

export const sampleShortenWithRecoveryEnvelope: CommandEnvelope = {
  commandId: "cmd-shorten-rec-001",
  roomId: TEST_ROOM_ID,
  sessionId: TEST_SESSION_ID,
  expectedRevision: 4,
  type: "shorten_segment",
  payload: {
    segmentId: "seg-demo",
    newTargetSec: 360,
    acknowledgeBelowMinimum: false,
    recoveryId: "rec-cut-demo-60s",
    recoveryLabel: "Cut 60s from Product Showcase to recover flash sale anchor",
  },
} as unknown as CommandEnvelope;

/**
 * Authoritative effective time calculation.
 * serverNowMs is ALREADY the effective server time; clockBehindByMs must NEVER be added to it again.
 */
export function getAuthoritativeEffectiveTime(read: { serverNowMs: number; clockBehindByMs: number }): number {
  return read.serverNowMs;
}

/** Allocates a sparse segment ID from a strictly monotonic counter */
export function allocateSparseSegmentId(currentCounter: number): { nextCounter: number; id: string } {
  const next = currentCounter + 1;
  return { nextCounter: next, id: `seg-${next}` };
}

/** Allocates a sparse cue ID from a strictly monotonic counter */
export function allocateSparseCueId(currentCounter: number): { nextCounter: number; id: string } {
  const next = currentCounter + 1;
  return { nextCounter: next, id: `cue-${next}` };
}

// ---------------------------------------------------------------------------
// Sample receipts & responses
// ---------------------------------------------------------------------------

export const sampleCommittedReceipt: AuthorityReceipt = {
  commandId: "cmd-startlive-001",
  type: "start_live",
  outcome: "committed",
  code: null,
  message: null,
  roomRevisionAfter: 3,
  sessionId: TEST_SESSION_ID,
  sessionRevisionAfter: 1,
  eventIds: ["evt-session-started-1"],
};

export const sampleStaleRejectedReceipt: AuthorityReceipt = {
  commandId: "cmd-startlive-stale",
  type: "start_live",
  outcome: "rejected",
  code: "stale_revision",
  message: "Room revision has advanced beyond expected revision 2",
  roomRevisionAfter: 3,
  sessionId: TEST_SESSION_ID,
  sessionRevisionAfter: 1,
  eventIds: [],
};

export const sampleIdempotencyConflictReceipt: AuthorityReceipt = {
  commandId: "cmd-startlive-001",
  type: "start_live",
  outcome: "rejected",
  code: "idempotency_conflict",
  message: "commandId cmd-startlive-001 reused with differing payload or target",
  roomRevisionAfter: 3,
  sessionId: TEST_SESSION_ID,
  sessionRevisionAfter: null,
  eventIds: [],
};

export const sampleForbiddenReceipt: AuthorityReceipt = {
  commandId: "cmd-viewer-write",
  type: "start_segment",
  outcome: "rejected",
  code: "forbidden",
  message: "Actor does not have operator role in this room",
  roomRevisionAfter: 3,
  sessionId: TEST_SESSION_ID,
  sessionRevisionAfter: null,
  eventIds: [],
};

export const sampleCommandResponse: CommandResponse = {
  receipt: sampleCommittedReceipt,
  duplicate: false,
};

export const sampleDuplicateCommandResponse: CommandResponse = {
  receipt: sampleCommittedReceipt,
  duplicate: true,
};

// ---------------------------------------------------------------------------
// Sample RoomReads
// ---------------------------------------------------------------------------

export function createSampleRoomRead(
  revision: number,
  sessions: Session[],
  changed = true,
  role: "operator" | "viewer" = "operator"
): RoomRead {
  const base = {
    roomId: TEST_ROOM_ID,
    revision,
    serverNowMs: 1_700_000_100_000,
    clockBehindByMs: 0,
    access: {
      actorId: role === "operator" ? TEST_OPERATOR_ACTOR.actorId : TEST_VIEWER_ACTOR.actorId,
      name: role === "operator" ? TEST_OPERATOR_ACTOR.name : TEST_VIEWER_ACTOR.name,
      role,
    },
  };
  if (changed) {
    return { ...base, changed: true, sessions };
  }
  return { ...base, changed: false };
}

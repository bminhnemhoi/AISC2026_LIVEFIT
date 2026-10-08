import type { CommandBase, CommandBody, CreateSessionInput } from "@/lib/domain/engine";
import type { NextSessionInput } from "@/lib/domain/nextLive";
import type { PlanVersion } from "./plan";
import type { Session } from "./session";

/** REAL runtime commands retain Phase 1 payloads; simulation clock controls stay local. */
export type RuntimeCommandBody =
  Exclude<CommandBody, { type: "advance_clock" | "set_clock" }> &
  Pick<CommandBase, "recoveryId" | "recoveryLabel">;

/** IDs, time, environment and operator identity are assigned by the authority. */
export type CreateSessionPayload = Pick<
  CreateSessionInput,
  "title" | "timezone" | "plannedStartMs" | "objective" | "accountLabel" | "products" | "segments" | "cues"
>;

/** Complete editable draft contents, never runtime, history or authority metadata. */
export type SavePreparePayload = Pick<Session, "title" | "timezone" | "objective" | "accountLabel" | "products"> &
  Pick<PlanVersion, "plannedStartMs" | "segments" | "cues">;

export type CreateNextPayload = Omit<NextSessionInput, "id" | "nowMs">;

export type AuthorityCommandBody =
  | RuntimeCommandBody
  | ({ type: "create_session" } & CreateSessionPayload)
  | ({ type: "save_prepare" } & SavePreparePayload)
  | ({ type: "create_next" } & CreateNextPayload);

/** POST /api/v3/room/commands. expectedRevision is the room revision. */
export type CommandEnvelope = {
  [T in AuthorityCommandBody["type"]]: {
    commandId: string;
    roomId: string;
    /** null for create_session; target session for runtime/save_prepare; source for create_next. */
    sessionId: T extends "create_session" ? null : string;
    expectedRevision: number;
    type: T;
    payload: Omit<Extract<AuthorityCommandBody, { type: T }>, "type">;
  };
}[AuthorityCommandBody["type"]];

export type AuthorityReceipt = {
  commandId: string;
  type: string;
  outcome: "committed" | "rejected";
  code: string | null;
  message: string | null;
  roomRevisionAfter: number;
  sessionId: string | null;
  sessionRevisionAfter: number | null;
  eventIds: string[];
};

export type CommandResponse = {
  receipt: AuthorityReceipt;
  duplicate: boolean;
};

/** Only server-authoritative REAL sessions belong in a room snapshot. */
export type RoomSnapshot = {
  roomId: string;
  revision: number;
  sessions: Session[];
};

/** GET /api/v3/room?afterRevision=<revision>. Access is resolved server-side. */
export type RoomRead = {
  roomId: string;
  revision: number;
  serverNowMs: number;
  clockBehindByMs: number;
  access: {
    actorId: string;
    name: string;
    role: "operator" | "viewer";
  };
} & ({ changed: true; sessions: Session[] } | { changed: false });

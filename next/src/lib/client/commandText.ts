import type { CommandBase, CommandBody } from "@/lib/domain";
import type { AuthorityCommandBody, RuntimeCommandBody } from "@/contracts/authority";

/** Phase 1 command base fields that only exist for the local authority. REAL commands never carry them. */
const LOCAL_ONLY_FIELDS = ["key", "actor", "expectedRevision", "nowMs"] as const;

export type DeskCommandInput = CommandBody & Partial<CommandBase>;

/**
 * Turn a desk command into a REAL authority command body.
 *
 * Dropped on purpose: the idempotency key (the envelope's commandId replaces it), the expected session revision
 * (the envelope carries the ROOM revision), device time (the server assigns recording time) and the actor.
 * `recoveryId` / `recoveryLabel` are kept, unchanged: they record which operator-selected recovery contextualized
 * the command. They say nothing about acceptance, an attempt, a performed action or platform confirmation, and the
 * client never adds them on its own: they are present only when the operator chose that recovery.
 * Simulation clock controls are local-only and can never reach the REAL API.
 */
export function toRuntimeBody(input: DeskCommandInput): RuntimeCommandBody | null {
  if (input.type === "advance_clock" || input.type === "set_clock") return null;
  const body: Record<string, unknown> = { ...input };
  for (const field of LOCAL_ONLY_FIELDS) delete body[field];
  return body as RuntimeCommandBody;
}

const LABELS: Record<AuthorityCommandBody["type"], string> = {
  create_session: "Create show",
  save_prepare: "Save plan",
  create_next: "Create next LIVE",
  start_live: "Start LIVE",
  start_segment: "Start segment",
  end_segment: "End segment",
  advance_segment: "Next segment",
  shorten_segment: "Shorten segment",
  extend_segment: "Extend segment",
  commit_end_by: "Commit end time",
  set_remaining_estimate: "Set remaining estimate",
  mark_remaining_unknown: "Mark remaining unknown",
  skip_segment: "Skip segment",
  reorder_segment: "Choose next segment",
  reanchor_segment: "Re-anchor segment",
  report_cue: "Report cue",
  report_manual_action: "Report action",
  add_note: "Add note",
  end_live: "End LIVE",
  acknowledge_clock_discontinuity: "Record clock note",
  append_correction: "Append correction",
};

/** A short operator-facing name for a command type. */
export function commandLabel(type: string): string {
  return (LABELS as Record<string, string>)[type] ?? "Command";
}

/** What the operator reads when the authority refused a command. Never implies a failure of the show itself. */
export function describeRejection(code: string | null, message: string | null, role: "operator" | "viewer" | null): string {
  if (code === "forbidden") {
    return role === "viewer"
      ? "You are viewing this room read-only. Only an operator can record changes."
      : "This room did not allow that action for your access. Nothing was recorded.";
  }
  if (code === "unauthenticated" || code === "unauthorized") {
    return "Your session is no longer valid, so the room did not accept the action. Sign in again to continue.";
  }
  if (code === "csrf_failed") {
    return "The server refused this browser request as unsafe, so the action was not recorded. Reload the page and try again.";
  }
  if (code === "context_required" || code === "wrong_deployment") {
    return "The room does not recognise this session's workspace, so the action was not recorded. Sign out and sign in again.";
  }
  if (code === "recovery_required") {
    return "The room was restored from a backup since this session began, so the action was not recorded. LiveLift is reloading the room; check it and try again.";
  }
  if (code === "rate_limited") {
    return "The room is limiting how quickly actions can be sent. Nothing was recorded; wait a moment and try again.";
  }
  if (code === "invalid_request" || code === "payload_too_large") {
    return "The room could not accept that request as sent. Nothing was recorded.";
  }
  if (code === "stale_revision") {
    return "The room changed since you last looked. The latest state is shown now. Nothing was recorded; review it and try again.";
  }
  if (code === "idempotency_conflict") {
    return "That action's ID was already used for a different request, so it was not applied. Nothing new was recorded.";
  }
  return message && message.trim() !== "" ? message : "That was not accepted. Nothing was recorded.";
}

/**
 * Run `done` when an action succeeded. Local actions answer immediately (boolean); REAL actions answer when the
 * authority has (Promise). `false` means "not done": the caller's input stays where it is.
 */
export function afterResult(result: boolean | Promise<boolean> | void, done: () => void): void {
  if (result === undefined || result === true) done();
  else if (result instanceof Promise) void result.then((ok) => ok && done());
}

/**
 * The Platform Lab's run: a copy of a SIMULATED show as planned, plus a fresh SIMULATED Live, held in memory.
 *
 * Everything the Lab does is a `LabCommand` applied by `applyLabCommand`: the desk, the host's phone, the clock and the
 * Demo Director all go through it, and every platform read is an explicit `sync`. Same commands, same call log.
 * Nothing here is saved: the stored show, its Review and Operate's Platform tab never see a lab run.
 */
import type { ManualActionRun, Session } from "@/contracts";
import { MANUAL_ACTION_LABEL, applyCommand, baselinePlan, createSession, currentPlan, effectiveNowMs, type CommandBody } from "@/lib/domain";
import { hostAct, withAssumptions, withFault, type HostAction, type ShopeeFault, type ShopeeLiveSim, type ShopeeRead, type SimAssumptions } from "./shopeeLive";
import {
  acceptedReason, pinFromLiveLift, refusedReason, reportCommand, syncCycle, unpinFromLiveLift,
  type NoticeItem, type RecordSource, type SyncState,
} from "./sync";
import { addNotices, freshWorld, logReads, type PlatformWorld } from "./world";

export type LabCommand =
  /** A desk command on the lab show. It runs on the show's virtual clock. */
  | { kind: "show"; body: CommandBody }
  /** LiveLift pins through the API; the outcome is recorded in the lab show. */
  | { kind: "pin"; productId: string }
  | { kind: "unpin" }
  /** The host's own hands in the app. LiveLift only learns of it by reading. */
  | { kind: "host"; action: HostAction }
  | { kind: "fault"; fault: ShopeeFault | null }
  | { kind: "assume"; patch: Partial<SimAssumptions> }
  | { kind: "auto"; on: boolean }
  /** Read the platform, then bring it in line with the show (`syncCycle`). */
  | { kind: "sync" };

/** A LiveLift record that platform activity produced, tied to the call behind it, so the wire can draw the return. */
export interface LabTrace {
  /** Call-log seq of the pin's `update_show_item`; for a read, the call it came after. */
  seq: number;
  /** Read-log number of the read that noticed what the host did. null when a call caused the record. */
  read: number | null;
  /** The show record (cue or manual action) this entry vouches for. */
  recordId: string;
  atMs: number;
  source: RecordSource;
  summary: string;
}

export interface LabState {
  session: Session;
  world: PlatformWorld;
  trace: LabTrace[];
  /** Commands applied so far. It also makes each show command's idempotency key. */
  applied: number;
}

/** The show as it was planned, whatever it is doing now, with a platform that has seen nothing yet. */
export function initialLabState(show: Session): LabState {
  if (show.environment !== "SIMULATED") throw new Error("The Platform Lab only runs SIMULATED shows.");
  const plan = baselinePlan(show);
  const copy = structuredClone({ products: show.products, segments: plan.segments, cues: plan.cues });
  const session = createSession({
    id: show.id,
    title: show.title,
    environment: "SIMULATED",
    timezone: show.timezone,
    plannedStartMs: plan.plannedStartMs,
    nowMs: plan.plannedStartMs,
    objective: show.objective,
    accountLabel: show.accountLabel,
    scenarioId: show.scenarioId,
    ...copy,
  });
  return { session, world: freshWorld(session), trace: [], applied: 0 };
}

/** The lab show's virtual clock. */
export const labNow = (state: LabState): number => effectiveNowMs(state.session, 0);

export interface PinRecord {
  sim: ShopeeLiveSim;
  sync: SyncState;
  /** What the show records: performed with the request id, or attempted with the platform's words. */
  command: CommandBody | null;
  notice: NoticeItem | null;
  requestId: string | null;
  /** The re-read after the pin, for the read log. */
  reads: ShopeeRead[];
}

/** Pin through the API and say what to record. Shared by the Operate panel and the Lab. */
export function pinAndRecord(sim: ShopeeLiveSim, sync: SyncState, session: Session, productId: string, nowMs: number): PinRecord {
  const r = pinFromLiveLift(sim, sync, productId, nowMs);
  const base = { sim: r.sim, sync: r.sync, reads: r.reads };
  if (r.outcome.ok) {
    return { ...base, command: reportCommand(session, "pin_product", productId, "performed", acceptedReason(r.outcome.requestId)), notice: null, requestId: r.outcome.requestId };
  }
  if (r.outcome.reason === "api_error") {
    return {
      ...base,
      command: reportCommand(session, "pin_product", productId, "attempted", refusedReason(r.outcome.message, r.outcome.requestId)),
      notice: { code: "pin_refused", summary: `The platform refused the pin: ${r.outcome.message}`, data: { message: r.outcome.message } },
      requestId: r.outcome.requestId ?? null,
    };
  }
  return { ...base, command: null, notice: { code: "pin_not_sent", summary: r.outcome.message }, requestId: null };
}

/** Record in the lab show and remember which call caused it. A refusal is shown, never dropped. */
function recordInShow(state: LabState, command: CommandBody, nowMs: number, key: string, cause: Pick<LabTrace, "seq" | "read">, source: RecordSource): LabState {
  const r = applyCommand(state.session, { ...command, nowMs, key });
  if (r.receipt.outcome !== "committed") {
    return { ...state, world: addNotices(state.world, nowMs, [{ code: "record_refused", summary: `LiveLift could not record it: ${r.receipt.message ?? "not accepted"}`, data: { message: r.receipt.message ?? "not accepted" } }]) };
  }
  const event = r.session.events[r.session.events.length - 1];
  // The source is the bridge's own knowledge of which call or read produced this command, never a reading of the reason text.
  const before = state.session.runtime.actions ?? {};
  const recordId = command.type === "report_cue" ? command.cueId : Object.keys(r.session.runtime.actions ?? {}).find((id) => !(id in before)) ?? "";
  return {
    ...state,
    session: r.session,
    trace: [...state.trace, { ...cause, recordId, atMs: nowMs, source, summary: event?.summary ?? "" }],
  };
}

export function applyLabCommand(state: LabState, cmd: LabCommand): LabState {
  const now = labNow(state);
  const key = `lab:${state.applied}`;
  const next: LabState = { ...state, applied: state.applied + 1 };
  const world = state.world;
  switch (cmd.kind) {
    case "show": {
      const r = applyCommand(state.session, { ...cmd.body, nowMs: now, key });
      if (r.receipt.outcome === "committed") return { ...next, session: r.session };
      return { ...next, world: addNotices(world, now, [{ code: "show_refused", summary: r.receipt.message ?? "That was not accepted." }]) };
    }
    case "pin": {
      const p = pinAndRecord(world.sim, world.sync, state.session, cmd.productId, now);
      let s: LabState = { ...next, world: addNotices(logReads({ ...world, sim: p.sim, sync: p.sync }, p.reads), now, p.notice ? [p.notice] : []) };
      if (p.command) {
        const call = p.sim.ledger.find((e) => e.kind === "api" && e.envelope.request_id === p.requestId);
        s = recordInShow(s, p.command, now, key, { seq: call?.seq ?? p.sim.seq, read: null }, "report" in p.command && p.command.report === "performed" ? "request_accepted" : "request_refused");
      }
      return s;
    }
    case "unpin": {
      const r = unpinFromLiveLift();
      return r.ok ? next : { ...next, world: addNotices(world, now, [{ code: "unpin_unsupported", summary: r.message }]) };
    }
    case "host":
      return { ...next, world: { ...world, sim: hostAct(world.sim, now, cmd.action).sim } };
    case "fault":
      return { ...next, world: { ...world, sim: withFault(world.sim, cmd.fault) } };
    case "assume":
      return { ...next, world: { ...world, sim: withAssumptions(world.sim, cmd.patch) } };
    case "auto":
      return { ...next, world: { ...world, auto: cmd.on } };
    case "sync": {
      const r = syncCycle(state.session, world.sim, world.sync, now);
      let s: LabState = { ...next, world: addNotices(logReads({ ...world, sim: r.sim, sync: r.sync }, r.reads), now, r.notices) };
      // Records from a sync come from a change in what is showing, which only the session read reveals.
      const i = r.reads.findIndex((x) => x.endpoint === "get_session_detail");
      const cause = i >= 0 ? { seq: r.reads[i].afterSeq, read: (world.readLog?.next ?? 1) + i } : { seq: r.sim.seq, read: null };
      r.commands.forEach((c, j) => {
        s = recordInShow(s, c, now, `${key}:${j}`, cause, "provider_observed");
      });
      return s;
    }
  }
}

export const applyLabCommands = (state: LabState, cmds: readonly LabCommand[]): LabState => cmds.reduce(applyLabCommand, state);

/** One line per pin/unpin/promotion record in the show, newest first, with where it came from. */
export interface LabRecord {
  id: string;
  title: string;
  state: "performed" | "attempted" | "cancelled";
  atMs: number;
  source: RecordSource;
  reason: string | null;
}

/**
 * Where a record came from is decided by the bridge's trace, not by what its reason says: only a record the bridge itself
 * wrote has a trace entry. A report with no entry is the operator's, whatever text it carries.
 */
export function labRecords(session: Session, trace: readonly LabTrace[] = []): LabRecord[] {
  const sourceOf = (id: string): RecordSource => trace.findLast((t) => t.recordId === id)?.source ?? "operator_reported";
  const cues = currentPlan(session).cues.flatMap((c): LabRecord[] => {
    const run = session.runtime.cues[c.id];
    if (!run || run.state === "pending") return [];
    return [{ id: c.id, title: c.title, state: run.state, atMs: run.reportedAtMs ?? run.occurredAtMs ?? 0, source: sourceOf(c.id), reason: run.reason }];
  });
  const actions = Object.values(session.runtime.actions ?? {}).map((a: ManualActionRun): LabRecord => ({
    id: a.id, title: `${MANUAL_ACTION_LABEL[a.action]} ${a.targetLabel}`, state: a.state, atMs: a.reportedAtMs, source: sourceOf(a.id), reason: a.reason,
  }));
  return [...cues, ...actions].sort((a, b) => b.atMs - a.atMs || a.id.localeCompare(b.id));
}

/**
 * The Demo Director: a 90 second story played on a lab run, the same way every time.
 *
 * Pure data. Each step says when it plays (presentation time) and which lab commands it issues, computed from the run's
 * state, so the story fits any show whose plan carries it (two planned products and an anchored flash sale; all
 * three seeded rehearsals do). The virtual clock jumps between beats; the player's timer only decides when the next
 * step runs, never what it does, so two runs give a byte-identical call log. Captions live in the Lab copy, by step id.
 */
import type { Session } from "@/contracts";
import { currentPlan } from "@/lib/domain";
import { applyLabCommands, labNow, type LabCommand, type LabState } from "./lab";
import { linkProducts, plannedProductIds } from "./sync";

export const DIRECTOR_DURATION_MS = 90_000;

export type DirectorStepId =
  | "show-starts"
  | "live-opens"
  | "products-load"
  | "livelift-pins"
  | "host-pins"
  | "livelift-notices"
  | "auth-expires"
  | "stays-manual"
  | "recovers"
  | "flash-sale"
  | "live-ends"
  | "recap";

/** Who and what the story is about, taken from the show's own plan. */
export interface DirectorCast {
  /** LiveLift pins this one. */
  first: { productId: string; name: string };
  /** The host pins this one in the app. */
  second: { productId: string; name: string; itemId: number };
  /** The hard-anchored promotion segment ("the 20:12 flash sale"). */
  flash: { segmentId: string; title: string; atMs: number; endMs: number };
  /** When the opening's target is up and the first product segment begins. */
  firstUpMs: number;
}

export type DirectorAvailability = { ok: true; cast: DirectorCast } | { ok: false; reason: "products" | "flash" };

const MIN = 60_000;
/** The beats between the first product and the flash sale need this much virtual time. */
const BEATS_MS = 6 * MIN + 30_000;

export function directorAvailability(session: Session): DirectorAvailability {
  const plan = currentPlan(session);
  const planned = plannedProductIds(session);
  const links = linkProducts(session.products);
  const nameOf = (id: string): string => session.products.find((p) => p.id === id)?.name ?? id;
  const secondLink = links.find((l) => l.productId === planned[1]);
  if (planned.length < 2 || !secondLink) return { ok: false, reason: "products" };
  const opening = plan.segments[0];
  const firstUpMs = plan.plannedStartMs + (opening?.targetSec ?? 0) * 1000;
  const flashSeg = plan.segments.find((s) => s.kind === "promotion" && s.anchorOffsetSec !== null);
  if (!flashSeg || flashSeg.anchorOffsetSec === null) return { ok: false, reason: "flash" };
  const atMs = plan.plannedStartMs + flashSeg.anchorOffsetSec * 1000;
  if (atMs < firstUpMs + BEATS_MS) return { ok: false, reason: "flash" };
  return {
    ok: true,
    cast: {
      first: { productId: planned[0], name: nameOf(planned[0]) },
      second: { productId: planned[1], name: nameOf(planned[1]), itemId: secondLink.itemId },
      // The same end schedulePromotions gives the platform's promotion.
      flash: { segmentId: flashSeg.id, title: flashSeg.title, atMs, endMs: atMs + (flashSeg.targetSec ?? 900) * 1000 },
      firstUpMs,
    },
  };
}

export interface DirectorStep {
  id: DirectorStepId;
  /** Presentation time, from 0 to DIRECTOR_DURATION_MS. */
  atMs: number;
  commands: (state: LabState, cast: DirectorCast) => LabCommand[];
}

/** Move the virtual clock forward to `toMs`; a clock already there (or past it) is left alone. */
const clockTo = (state: LabState, toMs: number): LabCommand[] => (toMs > labNow(state) ? [{ kind: "show", body: { type: "set_clock", toMs } }] : []);

export const DIRECTOR_STEPS: readonly DirectorStep[] = [
  { id: "show-starts", atMs: 0, commands: () => [{ kind: "show", body: { type: "start_live" } }] },
  { id: "live-opens", atMs: 7_000, commands: () => [{ kind: "sync" }] },
  { id: "products-load", atMs: 15_000, commands: (s, c) => [...clockTo(s, c.firstUpMs), { kind: "show", body: { type: "advance_segment" } }, { kind: "sync" }] },
  { id: "livelift-pins", atMs: 24_000, commands: (s, c) => [...clockTo(s, c.firstUpMs + 30_000), { kind: "pin", productId: c.first.productId }] },
  { id: "host-pins", atMs: 33_000, commands: (s, c) => [...clockTo(s, c.firstUpMs + 2 * MIN), { kind: "host", action: { type: "pin_item", itemId: c.second.itemId } }] },
  { id: "livelift-notices", atMs: 41_000, commands: (s, c) => [...clockTo(s, c.firstUpMs + 2 * MIN + 10_000), { kind: "sync" }] },
  { id: "auth-expires", atMs: 50_000, commands: (s, c) => [...clockTo(s, c.firstUpMs + 4 * MIN), { kind: "fault", fault: "token_expired" }, { kind: "sync" }] },
  { id: "stays-manual", atMs: 58_000, commands: (s, c) => [...clockTo(s, c.firstUpMs + 5 * MIN), { kind: "sync" }] },
  { id: "recovers", atMs: 66_000, commands: (s, c) => [...clockTo(s, c.firstUpMs + 6 * MIN), { kind: "fault", fault: null }, { kind: "sync" }] },
  { id: "flash-sale", atMs: 74_000, commands: (s, c) => [...clockTo(s, c.flash.atMs), { kind: "show", body: { type: "advance_segment" } }, { kind: "sync" }] },
  { id: "live-ends", atMs: 83_000, commands: (s, c) => [...clockTo(s, c.flash.endMs), { kind: "show", body: { type: "end_live" } }, { kind: "sync" }] },
  { id: "recap", atMs: DIRECTOR_DURATION_MS, commands: () => [] },
];

/** Play one step. A show the story does not fit is left untouched. */
export function applyDirectorStep(state: LabState, index: number): LabState {
  const step = DIRECTOR_STEPS[index];
  const fit = directorAvailability(state.session);
  if (!step || !fit.ok) return state;
  return applyLabCommands(state, step.commands(state, fit.cast));
}

/** Play steps [from, to) in order. */
export function runDirector(state: LabState, to: number = DIRECTOR_STEPS.length, from = 0): LabState {
  let s = state;
  for (let i = from; i < to; i++) s = applyDirectorStep(s, i);
  return s;
}

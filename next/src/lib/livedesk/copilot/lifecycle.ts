import type { CopilotSuggestion } from "../types";
import type { CopilotCandidate } from "./rules";

/**
 * A suggestion's life, kept apart so the states are never conflated:
 *
 *   proposed  -> accepted   the operator pressed Accept (a recommendation is not an acceptance)
 *   proposed  -> dismissed  the operator pressed Dismiss
 *   accepted  -> performed  only when the platform shows it: the pin is read back as showing, or the flash sale's
 *                           promotion is listed and has started. An accepted request is not a performed one.
 *
 * Nothing else moves a suggestion. A proposed suggestion that the latest signals no longer support is withdrawn
 * (removed): it was never acted on, so nothing is lost. Accepted, dismissed and performed ones stay as the record.
 */

export interface SuggestionRecord extends CopilotSuggestion {
  /** The platform's promotion id for an accepted flash sale, once scheduled. */
  promotionId: number | null;
}

export const SUGGESTION_LIMIT = 12;

export type SourcedCandidate = CopilotCandidate & { source: CopilotSuggestion["source"] };

/**
 * Replace the proposed suggestions with the current candidates. A candidate already proposed keeps its id and time,
 * and a model's wording for it is kept until the model words it again (the rules refresh only the signals).
 */
export function mergeCandidates(list: readonly SuggestionRecord[], candidates: readonly SourcedCandidate[], atSec: number, nextId: number): { list: SuggestionRecord[]; nextId: number } {
  let id = nextId;
  const settled = list.filter((s) => s.state !== "proposed");
  const fresh = candidates.map((c): SuggestionRecord => {
    const same = list.find((s) => s.state === "proposed" && s.kind === c.kind && s.productId === c.productId);
    const keepAi = same?.source === "ai" && c.source === "rules";
    return {
      ...c, headline: keepAi ? same.headline : c.headline, source: keepAi ? "ai" : c.source,
      id: same?.id ?? `s${id++}`, atSec: same?.atSec ?? atSec, state: "proposed", promotionId: null,
    };
  });
  return { list: [...settled, ...fresh].slice(-SUGGESTION_LIMIT), nextId: id };
}

function move(list: readonly SuggestionRecord[], id: string, to: "accepted" | "dismissed"): { list: SuggestionRecord[]; moved: SuggestionRecord | null } {
  const found = list.find((s) => s.id === id);
  if (!found || found.state !== "proposed") return { list: [...list], moved: null };
  const moved = { ...found, state: to };
  return { list: list.map((s) => (s.id === id ? moved : s)), moved };
}

export const acceptSuggestion = (list: readonly SuggestionRecord[], id: string) => move(list, id, "accepted");
export const dismissSuggestion = (list: readonly SuggestionRecord[], id: string) => move(list, id, "dismissed");

export const withPromotion = (list: readonly SuggestionRecord[], id: string, promotionId: number): SuggestionRecord[] =>
  list.map((s) => (s.id === id ? { ...s, promotionId } : s));

/** Move accepted suggestions to performed when the platform, as read, shows them done. */
export function markPerformed(
  list: readonly SuggestionRecord[],
  seen: { showingProductId: string | null; promotions: ReadonlyArray<{ id: number; startMs: number }>; nowMs: number },
): SuggestionRecord[] {
  return list.map((s) => {
    if (s.state !== "accepted") return s;
    const done = s.kind === "show_next"
      ? seen.showingProductId === s.productId
      : s.promotionId !== null && seen.promotions.some((p) => p.id === s.promotionId && p.startMs <= seen.nowMs);
    return done ? { ...s, state: "performed" } : s;
  });
}

export const toSuggestionView = (s: SuggestionRecord): CopilotSuggestion => ({
  id: s.id, kind: s.kind, productId: s.productId, headline: s.headline, signals: s.signals.map((x) => ({ ...x })),
  sampleSize: s.sampleSize, confidence: s.confidence, source: s.source, state: s.state, atSec: s.atSec,
});

import type { Session } from "@/contracts";
import { proposeChanges } from "@/lib/domain";

export type LoopStepId = "create" | "prepare" | "operate" | "review" | "next";

export interface LoopStep {
  id: LoopStepId;
  label: string;
  /** One plain sentence: what you do in this step. */
  summary: string;
  /** Where the step can be entered right now, or null when there is nothing to open yet. */
  href: string | null;
  /** True when the link opens a rehearsal rather than a REAL show. */
  rehearsal: boolean;
  /** Link label, or the reason there is no link yet. */
  action: string;
}

export interface LoopGuide {
  steps: LoopStep[];
  /** The step that is the honest next move for this account. */
  current: LoopStepId;
}

/** REAL shows first (they are the operator's own), then the most recently touched. */
const byRecency = (a: Session, b: Session): number =>
  (a.environment === b.environment ? 0 : a.environment === "REAL" ? -1 : 1) || b.updatedAtMs - a.updatedAtMs;

/**
 * Where the Create → Prepare → Operate → Review → Next LIVE loop can be entered, from the shows this
 * desk can see. Rehearsals are linked (so a first-time visitor can try every stage) but never decide
 * which step is "current" unless one is running: a visitor with only rehearsals is still at the start
 * of their own loop.
 */
export function deriveLoopGuide(sessions: Session[]): LoopGuide {
  const active = sessions.filter((s) => s.lifecycle === "active").sort(byRecency);
  const planned = sessions.filter((s) => s.lifecycle === "planned").sort(byRecency);
  const ended = sessions.filter((s) => s.lifecycle === "ended").sort(byRecency);
  const withChanges = ended.filter((s) => proposeChanges(s).length > 0);
  const isReal = (list: Session[]): boolean => list[0]?.environment === "REAL";
  const isRehearsal = (list: Session[]): boolean => list[0] !== undefined && list[0].environment !== "REAL";

  const steps: LoopStep[] = [
    {
      id: "create",
      label: "Create",
      summary: "Name the show, pick when it starts and a starting point.",
      href: "/live/new",
      rehearsal: false,
      action: "Create a LIVE",
    },
    {
      id: "prepare",
      label: "Prepare",
      summary: "Build the timed run of show and the product lineup. Mark the moments that cannot move.",
      href: planned[0] ? `/live/${planned[0].id}/prepare` : null,
      rehearsal: isRehearsal(planned),
      action: planned[0] ? "Open Prepare" : "Opens once you create a LIVE",
    },
    {
      id: "operate",
      label: "Operate",
      summary: "Run it from one desk: what is on now, what is next, and what to do when time slips.",
      href: active[0] ? `/live/${active[0].id}/operate` : null,
      rehearsal: isRehearsal(active),
      action: active[0] ? "Continue LIVE" : "Opens when a show starts",
    },
    {
      id: "review",
      label: "Review",
      summary: "See the plan beside what was recorded, with what is reported and what is unknown kept apart. Later evidence, when there is any, stays separate.",
      href: ended[0] ? `/live/${ended[0].id}/review` : null,
      rehearsal: isRehearsal(ended),
      action: ended[0] ? "Open Review" : "Opens when a show ends",
    },
    {
      id: "next",
      label: "Next LIVE",
      summary: "Choose which lessons to carry over, and start the next plan from them.",
      href: withChanges[0] ? `/live/${withChanges[0].id}/review?view=next` : null,
      rehearsal: isRehearsal(withChanges),
      action: withChanges[0] ? "Review changes" : "Opens after a Review",
    },
  ];

  const current: LoopStepId =
    active.length > 0 ? "operate" : isReal(planned) ? "prepare" : isReal(ended) ? "review" : "create";
  return { steps, current };
}

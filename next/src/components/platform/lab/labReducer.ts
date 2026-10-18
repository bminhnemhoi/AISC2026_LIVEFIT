/**
 * The Lab page's state: the lab run plus how far the Demo Director has played. Pure, so React may call it twice.
 *
 * A hand action is followed by one sync when auto-sync is on, as the Operate panel does after the host acts. The
 * Director's steps carry their own syncs, so its call log does not depend on that switch.
 */
import type { Session } from "@/contracts";
import { DIRECTOR_STEPS, applyDirectorStep, applyLabCommands, initialLabState, type LabCommand, type LabState } from "@/lib/platform";

export interface LabUi {
  show: Session;
  lab: LabState;
  /** Director steps played so far. */
  cursor: number;
}

export type LabAction =
  | { type: "act"; cmds: LabCommand[] }
  /** Play every step due by this presentation time. */
  | { type: "director-to"; atMs: number }
  | { type: "director-step" }
  | { type: "reset" };

export const initLabUi = (show: Session): LabUi => ({ show, lab: initialLabState(show), cursor: 0 });

export function labReducer(ui: LabUi, action: LabAction): LabUi {
  switch (action.type) {
    case "act": {
      const syncAfter = ui.lab.world.auto && action.cmds.at(-1)?.kind !== "sync" && action.cmds.at(-1)?.kind !== "auto";
      return { ...ui, lab: applyLabCommands(ui.lab, syncAfter ? [...action.cmds, { kind: "sync" }] : action.cmds) };
    }
    case "director-to": {
      let { lab, cursor } = ui;
      while (cursor < DIRECTOR_STEPS.length && DIRECTOR_STEPS[cursor].atMs <= action.atMs) lab = applyDirectorStep(lab, cursor++);
      return cursor === ui.cursor ? ui : { ...ui, lab, cursor };
    }
    case "director-step":
      return ui.cursor >= DIRECTOR_STEPS.length ? ui : { ...ui, lab: applyDirectorStep(ui.lab, ui.cursor), cursor: ui.cursor + 1 };
    case "reset":
      return initLabUi(ui.show);
  }
}

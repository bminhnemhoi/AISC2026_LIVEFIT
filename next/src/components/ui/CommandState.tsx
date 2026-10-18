"use client";

import { createContext, useContext } from "react";

/**
 * State of the one REAL command a screen is waiting on, shared with whatever dialog is open.
 *
 * A REAL dialog does not close when the operator confirms. It stays open and shows `busy` until the authority
 * has answered; a refusal comes back as `error` with the operator's input still in place. Rehearsals and
 * other local actions never set this, so their dialogs behave exactly as before.
 */
export interface CommandState {
  busy: boolean;
  error: string | null;
}

export const CommandStateContext = createContext<CommandState>({ busy: false, error: null });

export function useCommandState(): CommandState {
  return useContext(CommandStateContext);
}

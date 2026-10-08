/**
 * The one channel for screen-reader announcements about critical state (docs/phase3/ui.md §9).
 *
 * Restraint is the rule. Only state TRANSITIONS are announced: the session ended, contact lost or restored, a
 * command's final answer, a restored database. Nothing here is ever driven by a timer or a countdown, so a
 * running clock or "last contact Ns ago" can never flood a screen reader. `LiveAnnouncer` renders what is
 * announced here into two always-present live regions.
 */

export type AnnouncePriority = "polite" | "assertive";

export interface Announcement {
  /** Changes with every announcement so an identical message is announced again. */
  id: number;
  text: string;
  priority: AnnouncePriority;
}

type Listener = () => void;

const MAX_KEPT = 20;
const EMPTY: Announcement[] = [];
let seq = 0;
let log: Announcement[] = [];
const listeners = new Set<Listener>();

export function announce(text: string, priority: AnnouncePriority = "polite"): void {
  const trimmed = text.trim();
  if (trimmed === "") return;
  // The same sentence twice in a row is one event told twice, not two events.
  const last = log[log.length - 1];
  if (last && last.text === trimmed && last.priority === priority) return;
  seq += 1;
  log = [...log, { id: seq, text: trimmed, priority }].slice(-MAX_KEPT);
  for (const l of listeners) l();
}

export const announcer = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): Announcement[] => log,
  getServerSnapshot: (): Announcement[] => EMPTY,
  /** For tests: forget everything announced so far. */
  reset(): void {
    log = [];
    for (const l of listeners) l();
  },
};

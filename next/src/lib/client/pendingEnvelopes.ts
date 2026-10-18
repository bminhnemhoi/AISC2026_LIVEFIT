import type { CommandEnvelope } from "@/contracts/authority";

/**
 * The exact command envelope is written to browser storage BEFORE it is transmitted, so a lost
 * acknowledgement (closed tab, dropped connection, expired session, crash) can be reconciled afterwards through
 * the receipt endpoint. This is the only REAL command data kept locally: it is a pending request, never
 * authoritative state, and it is removed as soon as a receipt (committed or rejected) is known.
 *
 * A stored envelope is never re-POSTed automatically. An explicit retry reuses it unchanged — same
 * commandId, same expectedRevision, same payload — so the server can recognise it as the same intent.
 *
 * Phase 3 scoping (docs/phase3/contract.md "Recovery generation"). Every record carries the scope it was made
 * under: the immutable authenticated `actorId`, the `workspaceId` and the restore `generation`. A scope is
 * written once and NEVER rewritten:
 *
 * - the current scope (same actor, workspace and generation) is the only pending work the browser may look up
 *   or re-send;
 * - the same actor under another generation is QUARANTINED: shown, never looked up, never replayed, never
 *   assigned to the new generation;
 * - a record from a pre-Phase-3 build has no scope at all (`scope: null`). It is a LEGACY recovery item: it
 *   cannot be attributed to any account, so it is quarantined for whoever signs in and never attached silently;
 * - anything belonging to another actor or workspace is invisible and untouched.
 *
 * The records hold no credential.
 */

const STORAGE_KEY = "livelift.v3.remote.pending";
const VERSION = 2;

export interface PendingScope {
  actorId: string;
  workspaceId: string;
  generation: string;
}

export interface PersistedPending {
  /** `null` marks a record written before scoping existed. */
  scope: PendingScope | null;
  envelope: CommandEnvelope;
  /** Plain-language name of the operator's intent, e.g. "End LIVE". */
  label: string;
}

export type QuarantineReason = "older_generation" | "legacy";

export interface QuarantinedPending extends PersistedPending {
  reason: QuarantineReason;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function isEnvelope(v: unknown): v is CommandEnvelope {
  return (
    isRecord(v) &&
    typeof v.commandId === "string" &&
    typeof v.roomId === "string" &&
    typeof v.expectedRevision === "number" &&
    typeof v.type === "string" &&
    isRecord(v.payload) &&
    (v.sessionId === null || typeof v.sessionId === "string")
  );
}

function readScope(v: unknown): PendingScope | null {
  return isRecord(v) && typeof v.actorId === "string" && v.actorId !== "" && typeof v.workspaceId === "string" && typeof v.generation === "string"
    ? { actorId: v.actorId, workspaceId: v.workspaceId, generation: v.generation }
    : null;
}

export const sameScope = (a: PendingScope | null, b: PendingScope | null): boolean =>
  a !== null && b !== null && a.actorId === b.actorId && a.workspaceId === b.workspaceId && a.generation === b.generation;

export const scopeKey = (s: PendingScope): string => JSON.stringify([s.actorId, s.workspaceId, s.generation]);

const sameScopeOrBothNone = (a: PendingScope | null, b: PendingScope | null): boolean => (a === null && b === null ? true : sameScope(a, b));

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function canPersistPending(): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const probe = `${STORAGE_KEY}.probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Every stored record, of every scope, exactly as written. Pre-scoping (version 1) records come back with `scope: null`. */
export function loadAllPending(): PersistedPending[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.pending)) return [];
    if (parsed.v === 1) {
      return parsed.pending.flatMap((item): PersistedPending[] =>
        isRecord(item) && isEnvelope(item.envelope) && typeof item.label === "string" ? [{ scope: null, envelope: item.envelope, label: item.label }] : []
      );
    }
    if (parsed.v !== VERSION) return [];
    return parsed.pending.flatMap((item): PersistedPending[] => {
      if (!isRecord(item) || !isEnvelope(item.envelope) || typeof item.label !== "string") return [];
      // A record that claims a scope but is malformed is not attributable: it is treated as legacy, never as current.
      return [{ scope: readScope(item.scope), envelope: item.envelope, label: item.label }];
    });
  } catch {
    return [];
  }
}

/** Returns false when the browser refused the write; the caller must then not transmit. */
function saveAll(list: PersistedPending[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    if (list.length === 0) s.removeItem(STORAGE_KEY);
    else s.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, pending: list }));
    return true;
  } catch {
    return false;
  }
}

/** Other scopes' records are re-read from storage on every write, so they are never lost or rewritten. */
export function addPending(entry: PersistedPending): boolean {
  const others = loadAllPending().filter((p) => p.envelope.commandId !== entry.envelope.commandId || !sameScopeOrBothNone(p.scope, entry.scope));
  return saveAll([...others, entry]);
}

export function removePending(scope: PendingScope | null, commandId: string): boolean {
  return saveAll(loadAllPending().filter((p) => p.envelope.commandId !== commandId || !sameScopeOrBothNone(p.scope, scope)));
}

/** Forget every record. Only for tests: sign-out and account switching never delete another scope's work. */
export function clearAllPending(): void {
  saveAll([]);
}

/**
 * Split stored records for the authenticated `scope`. `current` may be looked up and re-sent; `quarantined` may
 * only be shown and set aside. Other actors' and other workspaces' records appear in neither list.
 */
export function partitionPending(all: PersistedPending[], scope: PendingScope): { current: PersistedPending[]; quarantined: QuarantinedPending[] } {
  const current: PersistedPending[] = [];
  const quarantined: QuarantinedPending[] = [];
  for (const p of all) {
    if (p.scope === null) quarantined.push({ ...p, reason: "legacy" });
    else if (sameScope(p.scope, scope)) current.push(p);
    else if (p.scope.actorId === scope.actorId && p.scope.workspaceId === scope.workspaceId) quarantined.push({ ...p, reason: "older_generation" });
  }
  return { current, quarantined };
}

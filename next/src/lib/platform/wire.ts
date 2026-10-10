/**
 * "The wire": the call log as rows for a swimlane of LiveLift | SIMULATED Shopee | the host's app.
 *
 * A call carries its own reply (outcome and request_id); a host action sits on the host lane; a record LiveLift made
 * because of a call follows that call, so a read that noticed the host draws the return arrow and its record.
 */
import type { LabTrace } from "./lab";
import { fnv1a, type LedgerEntry, type ReadEntry } from "./shopeeLive";

export type ApiEntry = Extract<LedgerEntry, { kind: "api" }>;
export type HostEntry = Extract<LedgerEntry, { kind: "host_app" }>;
/** A call row's entry: a logged call, or a read from the read log. */
export type CallEntry = ApiEntry | ReadEntry;

export type WireRow =
  | { kind: "call"; key: string; entry: CallEntry; ok: boolean }
  | { kind: "host"; key: string; entry: HostEntry }
  | { kind: "record"; key: string; trace: LabTrace };

/**
 * Rows in call order: the call log and the read log interleaved (a read sits after the call it followed). Successful
 * reads are routine and hidden unless asked for, except a read that noticed something (it is the cause of a record) and a
 * failed read (it is the evidence of a problem).
 */
export function wireRows(ledger: readonly LedgerEntry[], reads: readonly ReadEntry[], trace: readonly LabTrace[], opts: { showReads: boolean }): WireRow[] {
  const cause = new Set(trace.flatMap((t) => (t.read === null ? [] : [t.read])));
  // Sort key: the call's seq, then the read's number (0 for a call), then records after their cause.
  const rows: Array<{ key: [number, number, number]; row: WireRow }> = [];
  for (const e of ledger) {
    if (e.kind === "host_app") rows.push({ key: [e.seq, 0, 0], row: { kind: "host", key: `h${e.seq}`, entry: e } });
    else if (!e.readOnly) rows.push({ key: [e.seq, 0, 0], row: { kind: "call", key: `c${e.seq}`, entry: e, ok: e.envelope.error === "" } });
  }
  for (const r of reads) {
    const ok = r.envelope.error === "";
    if (ok && !opts.showReads && !cause.has(r.n)) continue;
    rows.push({ key: [r.afterSeq, r.n, 0], row: { kind: "call", key: `r${r.n}`, entry: r, ok } });
  }
  trace.forEach((t, i) => rows.push({ key: [t.seq, t.read ?? 0, 1 + i], row: { kind: "record", key: `t${i}`, trace: t } }));
  return rows.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]).map((r) => r.row);
}

/** What was sent and what came back, as the wire's detail view shows it. */
export function callJson(entry: CallEntry): string {
  return `POST ${entry.path}\n${JSON.stringify(entry.params, null, 2)}\n→ ${JSON.stringify(entry.envelope, null, 2)}`;
}

/** A stable id for a call row: a call by its seq, a read by its number. */
export const callKey = (entry: CallEntry): string => (entry.kind === "read" ? `read-${entry.n}` : `call-${entry.seq}`);

/** A short fingerprint of both logs: two runs of the same script show the same digest. */
export function callLogDigest(ledger: readonly LedgerEntry[], reads: readonly ReadEntry[]): string {
  return fnv1a(JSON.stringify({ ledger, reads })).toString(16).padStart(8, "0");
}

// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { expect, test, vi } from "vitest";
import { RoomAuthority } from "./authority";
import { authenticate, type Access } from "./config";
import { canonicalJson, envelopeSchema, parseBody, type Envelope } from "./validation";
import { applyCommand } from "@/lib/domain/engine";
import { newSegment } from "@/lib/domain/plan";

test("single-room authority preserves atomic receipts, revisions, draft IDs and time across reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "livelift-authority-"));
  const path = join(directory, "room.sqlite");
  const operator: Access = { actorId: "op", name: "Operator", role: "operator" };
  const viewer: Access = { actorId: "watch", name: "Viewer", role: "viewer" };
  let authority = new RoomAuthority("room", path);
  try {
    const initial = authority.read(operator);
    expect(initial).toMatchObject({ revision: 0, changed: true, sessions: [], access: operator });
    expect(authority.read(viewer, 0)).not.toHaveProperty("sessions");
    expect(envelopeSchema.safeParse({ commandId: "bad" }).success).toBe(false);
    expect(canonicalJson({ b: [null, 0], a: 1 })).toBe(canonicalJson({ a: 1, b: [null, 0] }));
    expect(canonicalJson({})).not.toBe(canonicalJson({ a: null }));
    expect(canonicalJson({ price: Infinity })).not.toBe(canonicalJson({ price: null }));
    const config = { roomId: "room", dbPath: path, capabilities: [{ ...operator, roomId: "room", token: "test-token" }] };
    expect(authenticate(new Request("http://localhost", { headers: { Authorization: "Bearer test-token" } }), config)).toEqual(operator);
    expect(() => authenticate(new Request("http://localhost"), config)).toThrow("valid room capability");

    let commandNumber = 0;
    let revision = 0;
    const send = (type: string, sessionId: string | null, payload = {}, access = operator, expectedRevision = revision) => {
      const envelope: Envelope = { commandId: `cmd-${++commandNumber}`, roomId: "room", sessionId, expectedRevision, type, payload };
      const reply = authority.command(envelope, access);
      if (reply.body.receipt.outcome === "committed") revision = reply.body.receipt.roomRevisionAfter;
      return { envelope, ...reply };
    };
    const draft = { title: "Show", timezone: "UTC", plannedStartMs: initial.serverNowMs };
    const created = send("create_session", null, draft);
    const prototypePayload = JSON.parse('{"__proto__":1}');
    const exactEnvelope = envelopeSchema.parse({ ...created.envelope, payload: prototypePayload });
    expect(canonicalJson(exactEnvelope.payload)).toBe('{"__proto__":1}');
    expect(parseBody({ ...exactEnvelope, type: "end_live" })).toBeNull();
    const first = created.body.receipt.sessionId!;
    expect(created.status).toBe(200);
    const duplicate = authority.command({ ...created.envelope, payload: { plannedStartMs: draft.plannedStartMs, timezone: "UTC", title: "Show" } }, operator);
    expect(duplicate.body).toEqual({ receipt: created.body.receipt, duplicate: true });
    expect(authority.command(created.envelope, viewer).body.receipt.code).toBe("idempotency_conflict");
    expect(authority.command({ ...created.envelope, payload: { ...draft, objective: null } }, operator).status).toBe(409);
    const refused = send("create_session", null, draft, viewer);
    expect(refused.status).toBe(403);
    expect(authority.command(refused.envelope, viewer).body.duplicate).toBe(true);
    const stale = send("create_session", null, draft, operator, 0);
    expect(stale.body.receipt.code).toBe("stale_revision");
    expect(authority.receipt(stale.envelope.commandId)).toEqual(stale.body.receipt);
    expect(authority.receipt("unknown")).toBeNull();
    expect(send("end_live", "unknown").status).toBe(404);
    expect(authority.command({ ...stale.envelope, commandId: "wrong-room", roomId: "other", expectedRevision: revision }, operator).status).toBe(404);
    expect(send("advance_clock", first, { byMs: 1000 }).body.receipt.code).toBe("wrong_environment");
    expect(send("start_live", first, { actor: "forged" }).status).toBe(422);
    expect(send("start_live", first).body.receipt.code).toBe("plan_invalid");
    expect(send("create_session", null, { ...draft, products: [{ id: "p", code: "P", name: "Product", price: Infinity }] }).status).toBe(422);

    const segment = { id: "seg-1", title: "Opening", kind: "opening", productId: null, targetSec: 60, minSec: 0, optional: false, anchorOffsetSec: null, cue: null, notes: null };
    const prepare = { ...draft, objective: null, accountLabel: null, products: [], segments: [segment], cues: [] };
    const saved = send("save_prepare", first, prepare);
    expect(saved.body.receipt.sessionRevisionAfter).toBe(1);
    expect(send("save_prepare", first, { ...prepare, segments: [{ ...segment, targetSec: Number.MAX_SAFE_INTEGER }] }).status).toBe(422);
    expect(send("save_prepare", first, { ...prepare, segments: [segment, segment] }).status).toBe(422);
    expect(send("save_prepare", first, { ...prepare, segments: [] }).status).toBe(200);
    expect(send("save_prepare", first, prepare).status).toBe(422);
    expect(send("save_prepare", first, { ...prepare, segments: [{ ...segment, id: "seg-2" }] }).status).toBe(200);
    const second = send("create_session", null, { ...draft, segments: [{ ...segment, id: "other-seg" }] }).body.receipt.sessionId!;
    expect(send("create_next", first, { title: "Next", plannedStartMs: draft.plannedStartMs, changeIds: [], note: "" }).status).toBe(409);
    expect(send("start_live", first).status).toBe(200);
    expect(send("start_live", second).body.receipt.code).toBe("another_show_active");
    expect(send("save_prepare", first, prepare).status).toBe(409);
    expect(send("set_remaining_estimate", first, { segmentId: "seg-2", remainingSec: 0 }).status).toBe(200);
    expect(send("mark_remaining_unknown", first, { segmentId: "seg-2" }).status).toBe(200);
    vi.spyOn(Date, "now").mockReturnValue(authority.read(operator).serverNowMs + 180000);
    expect(send("end_segment", first, { segmentId: "seg-2" }).status).toBe(200);
    expect(send("end_live", first).status).toBe(200);
    const ended = authority.read(operator);
    if (!ended.changed) throw new Error("Expected full snapshot");
    const source = ended.sessions.find((s) => s.id === first)!;
    const next = send("create_next", first, { title: "Next", plannedStartMs: draft.plannedStartMs + 86400000, changeIds: [], note: "Selected none" });
    expect(next.status).toBe(200);
    const snapshot = authority.read(operator);
    if (!snapshot.changed) throw new Error("Expected full snapshot");
    expect(snapshot.sessions.find((s) => s.id === first)).toEqual(source);
    const clone = snapshot.sessions.find((s) => s.id === next.body.receipt.sessionId)!;
    expect(clone).toMatchObject({ lifecycle: "planned", events: [], receipts: {}, operator: { id: "op" }, runtime: { startedAtMs: null, segments: {}, cues: {}, actions: {} } });
    expect(clone.plans[0].segments[0].id).not.toBe(source.plans[0].segments[0].id);
    expect(clone.plans[0].segments[0].targetSec).toBe(60);
    expect(send("create_next", first, { title: "Bad selection", plannedStartMs: draft.plannedStartMs, changeIds: ["unknown"], note: "" }).status).toBe(422);
    const adjusted = send("create_next", first, { title: "Selected", plannedStartMs: draft.plannedStartMs, changeIds: ["duration:seg-2"], note: "Use this observation" });
    expect(adjusted.status).toBe(200);
    const adjustedSnapshot = authority.read(operator);
    if (!adjustedSnapshot.changed) throw new Error("Expected full snapshot");
    expect(adjustedSnapshot.sessions.find((s) => s.id === adjusted.body.receipt.sessionId)!.plans[0].segments[0].targetSec).toBe(180);
    expect(adjustedSnapshot.sessions.find((s) => s.id === first)).toEqual(source);
    expect(send("start_live", second).status).toBe(200);

    const beforeRestart = authority.read(operator);
    authority.close();
    vi.spyOn(Date, "now").mockReturnValue(beforeRestart.serverNowMs - 10000);
    authority = new RoomAuthority("room", path);
    const restarted = authority.read(operator);
    expect(restarted.revision).toBe(revision);
    expect(restarted.serverNowMs).toBeGreaterThanOrEqual(beforeRestart.serverNowMs);
    expect(restarted.clockBehindByMs).toBeGreaterThanOrEqual(10000);
    expect(authority.command(created.envelope, operator).body.receipt).toEqual(created.body.receipt);
    expect(authority.command(stale.envelope, operator).body.receipt).toEqual(stale.body.receipt);
    expect(send("start_live", clone.id).body.receipt.code).toBe("another_show_active");
    const db = new DatabaseSync(path);
    try {
      expect(JSON.parse(String(db.prepare("SELECT resolved_creation_json FROM command_log WHERE command_id = ?").get(created.envelope.commandId)!.resolved_creation_json)).plans[0].segments).toEqual([]);
      expect(() => db.prepare("DELETE FROM command_log WHERE command_id = ?").run(created.envelope.commandId)).toThrow("immutable");
      expect(() => db.prepare("INSERT OR REPLACE INTO command_log SELECT * FROM command_log WHERE command_id = ?").run(created.envelope.commandId)).toThrow("immutable");
      db.exec("CREATE TRIGGER inject_receipt_failure BEFORE INSERT ON command_log WHEN NEW.command_id = 'rollback-check' BEGIN SELECT RAISE(ABORT, 'receipt unavailable'); END");
      const beforeFailure = authority.read(operator);
      expect(() => authority.command({ commandId: "rollback-check", roomId: "room", sessionId: second, expectedRevision: revision, type: "add_note", payload: { text: "Must roll back" } }, operator)).toThrow("receipt unavailable");
      const afterFailure = authority.read(operator);
      expect(afterFailure.revision).toBe(beforeFailure.revision);
      if (!beforeFailure.changed || !afterFailure.changed) throw new Error("Expected full snapshots");
      expect(afterFailure.sessions).toEqual(beforeFailure.sessions);
      expect(authority.receipt("rollback-check")).toBeNull();
      db.exec("DROP TRIGGER inject_receipt_failure");
    } finally { db.close(); }
    expect(() => new RoomAuthority("other", path)).toThrow("another room");
    authority.close();
    let perf = 0;
    vi.spyOn(performance, "now").mockImplementation(() => perf);
    authority = new RoomAuthority("room", path);
    const peer = new RoomAuthority("room", path);
    try {
      const baseline = authority.read(operator).serverNowMs;
      expect(peer.read(operator).serverNowMs).toBe(baseline);
      perf = 1000;
      expect(authority.read(operator).serverNowMs).toBe(baseline + 1000);
      expect(peer.read(operator).serverNowMs).toBe(baseline + 1000);
    } finally { peer.close(); }
  } finally {
    vi.restoreAllMocks();
    authority.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("recovery attribution survives strict validation, receipts and restart without implying cue execution", () => {
  const directory = mkdtempSync(join(tmpdir(), "livelift-recovery-"));
  const path = join(directory, "room.sqlite");
  const operator: Access = { actorId: "op", name: "Operator", role: "operator" };
  let authority = new RoomAuthority("room", path);
  try {
    const metadata = { recoveryId: "skip:optional", recoveryLabel: "Skip optional segment" };
    const payloads = {
      end_segment: { segmentId: "first" }, advance_segment: {},
      shorten_segment: { segmentId: "first", newTargetSec: 30 },
      extend_segment: { segmentId: "first", deltaSec: 1 },
      commit_end_by: { segmentId: "first", endByMs: Date.now() + 60000 },
      skip_segment: { segmentId: "optional" },
      reorder_segment: { segmentId: "optional", beforeSegmentId: null },
      reanchor_segment: { segmentId: "optional", anchorOffsetSec: 120, reason: "Explicit change" },
    };
    for (const [type, payload] of Object.entries(payloads)) {
      const envelope = { commandId: "validate", roomId: "room", sessionId: "session", expectedRevision: 0, type, payload: { ...payload, ...metadata } };
      expect(parseBody(envelope)).toEqual({ ...payload, ...metadata, type });
      expect(parseBody({ ...envelope, payload: { ...payload, recoveryId: 1 } })).toBeNull();
      expect(parseBody({ ...envelope, payload: { ...payload, recoveryLabel: null } })).toBeNull();
    }
    let number = 0;
    const send = (type: string, sessionId: string | null, payload = {}) => {
      const envelope = { commandId: `recovery-${++number}`, roomId: "room", sessionId, expectedRevision: authority.read(operator).revision, type, payload };
      const result = authority.command(envelope, operator);
      expect(result.status).toBe(200);
      return { envelope, ...result };
    };
    const snapshot = () => {
      const read = authority.read(operator);
      if (!read.changed) throw new Error("Expected full snapshot");
      return read.sessions[0];
    };
    const created = send("create_session", null, {
      title: "Recovery", timezone: "UTC", plannedStartMs: Date.now(),
      products: [{ id: "product", code: "P", name: "Product", price: null }],
      segments: [newSegment("first", { title: "Opening", kind: "opening", targetSec: 60, minSec: 0 }), newSegment("optional", { title: "Optional", targetSec: 60, minSec: 0, optional: true })],
      cues: [{ id: "cue", title: "Pin product", audience: "operator", action: "pin_product", productId: "product", timing: { type: "at_offset", offsetSec: 0 }, text: null }],
    });
    const id = created.body.receipt.sessionId!;
    send("start_live", id);
    const beforeOrdinary = snapshot();
    const ordinary = send("extend_segment", id, { segmentId: "first", deltaSec: 1 });
    const afterOrdinary = snapshot();
    expect(afterOrdinary).toEqual(applyCommand(beforeOrdinary, { type: "extend_segment", segmentId: "first", deltaSec: 1, key: ordinary.envelope.commandId, actor: operator.name, nowMs: afterOrdinary.updatedAtMs }).session);
    expect(afterOrdinary.events.some((event) => event.type === "recovery_selected")).toBe(false);
    const selected = send("skip_segment", id, { segmentId: "optional", ...metadata });
    const afterSelected = snapshot();
    const decision = afterSelected.events.find((event) => event.type === "recovery_selected")!;
    expect(decision).toMatchObject({ actor: operator.name, commandKey: selected.envelope.commandId, data: { recoveryId: metadata.recoveryId, label: metadata.recoveryLabel } });
    expect(selected.body.receipt.eventIds).toContain(decision.id);
    expect(afterSelected.runtime.cues).toEqual(beforeOrdinary.runtime.cues);
    expect(afterSelected.runtime.cues.cue.state).toBe("pending");
    expect(afterSelected.runtime.actions).toEqual({});
    expect(afterSelected.events.some((event) => event.type === "cue_reported" || event.type === "action_reported")).toBe(false);
    expect(authority.command(selected.envelope, operator).body).toEqual({ receipt: selected.body.receipt, duplicate: true });
    for (const changed of [{ ...metadata, recoveryId: "other" }, { ...metadata, recoveryLabel: "Changed intent" }]) {
      expect(authority.command({ ...selected.envelope, payload: { segmentId: "optional", ...changed } }, operator).body.receipt.code).toBe("idempotency_conflict");
    }
    expect(snapshot()).toEqual(afterSelected);
    authority.close();
    authority = new RoomAuthority("room", path);
    expect(snapshot()).toEqual(afterSelected);
    expect(authority.receipt(selected.envelope.commandId)).toEqual(selected.body.receipt);
    expect(authority.command(selected.envelope, operator).body.duplicate).toBe(true);
    expect(snapshot()).toEqual(afterSelected);
  } finally {
    authority.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("sparse segment and cue counter floors survive deletion, normal allocation and restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "livelift-counters-"));
  const path = join(directory, "room.sqlite");
  const operator: Access = { actorId: "op", name: "Operator", role: "operator" };
  let authority = new RoomAuthority("room", path);
  try {
    let number = 0;
    const command = (type: string, sessionId: string | null, payload = {}) => authority.command({ commandId: `counter-${++number}`, roomId: "room", sessionId, expectedRevision: authority.read(operator).revision, type, payload }, operator);
    const draft = { title: "Sparse IDs", timezone: "UTC", plannedStartMs: Date.now(), objective: null, accountLabel: null, products: [] };
    const created = command("create_session", null, draft);
    expect(created.status).toBe(200);
    const id = created.body.receipt.sessionId!;
    const session = () => {
      const read = authority.read(operator);
      if (!read.changed) throw new Error("Expected full snapshot");
      return read.sessions[0];
    };
    const save = (segmentIds: string[], cueIds: string[]) => command("save_prepare", id, {
      ...draft,
      segments: segmentIds.map((id) => newSegment(id, { title: "Segment", targetSec: 60 })),
      cues: cueIds.map((id) => ({ id, title: "Cue", audience: "presenter", action: "none", productId: null, timing: { type: "at_offset", offsetSec: 0 }, text: null })),
    });
    expect(session().seq).toMatchObject({ segment: 0, cue: 0 });
    expect(save([`${id}:s3`], [`${id}:c3`]).status).toBe(200);
    expect(session().seq).toMatchObject({ segment: 3, cue: 3 });
    expect(save([`${id}:s3`, `${id}:s3`], [`${id}:c3`]).status).toBe(422);
    expect(save([`${id}:s3`], [`${id}:c3`, `${id}:c3`]).status).toBe(422);
    expect(save([], []).status).toBe(200);
    expect(save([], []).status).toBe(200);
    expect(session().seq).toMatchObject({ segment: 3, cue: 3 });
    expect(save([`${id}:s3`], []).status).toBe(422);
    expect(save([], [`${id}:c3`]).status).toBe(422);
    const allocated = () => {
      const before = session();
      const segmentId = `${id}:s${before.seq.segment + 1}`;
      const cueId = `${id}:c${before.seq.cue + 1}`;
      expect(save([...before.plans[0].segments.map((s) => s.id), segmentId], [...before.plans[0].cues.map((c) => c.id), cueId]).status).toBe(200);
      return { segmentId, cueId };
    };
    expect(allocated()).toEqual({ segmentId: `${id}:s4`, cueId: `${id}:c4` });
    const beforeRestart = session();
    authority.close();
    authority = new RoomAuthority("room", path);
    expect(session()).toEqual(beforeRestart);
    expect(allocated()).toEqual({ segmentId: `${id}:s5`, cueId: `${id}:c5` });
    expect(session().seq).toMatchObject({ segment: 5, cue: 5 });
    expect(save([`${id}:s3`], []).status).toBe(422);
    expect(save([], [`${id}:c3`]).status).toBe(422);
    const beforeInvalid = session();
    expect(save([`${id}:s9007199254740992`], []).status).toBe(422);
    expect(save([], [`${id}:c9007199254740992`]).status).toBe(422);
    expect(session()).toEqual(beforeInvalid);
  } finally {
    authority.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

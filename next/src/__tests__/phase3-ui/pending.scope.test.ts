import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { snapshotProducts } from "@/fixtures/library";
import { SCENARIO_BY_ID, applyCommand, createSession } from "@/lib/domain";
import { announcer } from "@/lib/client/announcer";
import { authStore } from "@/lib/client/authStore";
import {
  addPending,
  clearAllPending,
  loadAllPending,
  partitionPending,
  removePending,
  type PendingScope,
  type PersistedPending,
} from "@/lib/client/pendingEnvelopes";
import { RemoteRoomStore } from "@/lib/store/remoteRoomStore";
import type { CommandEnvelope } from "@/contracts/authority";
import { FakeRoom } from "../helpers/fakeRoom";

/**
 * Pending commands are scoped by (actorId, workspaceId, generation). Another actor's work is never shown or
 * replayed; an older generation's work is QUARANTINED (shown, never looked up, never re-sent, never moved);
 * a record from before scoping existed is a legacy recovery item that is never attached to an account.
 */

const KEY = "livelift.v3.remote.pending";

const MAI: PendingScope = { actorId: "actor-1", workspaceId: "ws-1", generation: "gen-1" };
const envelope = (id: string): CommandEnvelope => ({ commandId: id, roomId: "room-1", sessionId: "real-1", expectedRevision: 1, type: "add_note", payload: { text: id } }) as CommandEnvelope;
const rec = (id: string, scope: PendingScope | null): PersistedPending => ({ scope, envelope: envelope(id), label: "Add note" });

function runningShow(room: FakeRoom, id = "real-1") {
  const template = SCENARIO_BY_ID.buffered;
  const { segments, cues } = template.buildPlan(id);
  const planned = createSession({
    id,
    title: "Friday launch",
    environment: "REAL",
    timezone: "UTC",
    plannedStartMs: room.nowMs,
    nowMs: room.nowMs,
    products: snapshotProducts(template.productIds),
    segments,
    cues,
    operator: { id: room.actor.id, name: room.actor.name, role: "lead", isLead: true },
  });
  const started = applyCommand(planned, { type: "start_live", nowMs: room.nowMs });
  room.seed(started.session);
}

let perf = 0;
let ids = 0;
let restoreFetch: (() => void) | null = null;
const stores: RemoteRoomStore[] = [];

async function signedInStore(room: FakeRoom, username = "mai"): Promise<RemoteRoomStore> {
  restoreFetch = room.install();
  authStore.reset();
  if (!room.signedIn) await authStore.login({ username, password: room.accounts[username].password });
  else await authStore.bootstrap();
  const store = new RemoteRoomStore({ perfNow: () => perf, newCommandId: () => `cmd-${++ids}` });
  stores.push(store);
  store.acquire();
  await store.refreshNow();
  return store;
}

const note = (text: string) => ({ body: { type: "add_note" as const, text }, sessionId: "real-1" });
const receiptLookups = (room: FakeRoom): string[] => room.requests.filter((r) => r.method === "GET" && r.path.startsWith("/api/v3/room/commands/")).map((r) => r.path);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  announcer.reset();
  perf = 1000;
  ids = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});
afterEach(() => {
  for (const s of stores.splice(0)) s.reset();
  restoreFetch?.();
  restoreFetch = null;
  vi.useRealTimers();
});

describe("the stored record", () => {
  it("keeps every other scope's records when one is added or removed, and never rewrites a scope", () => {
    const gen2: PendingScope = { ...MAI, generation: "gen-2" };
    expect(addPending(rec("a", MAI))).toBe(true);
    expect(addPending(rec("b", gen2))).toBe(true);
    expect(addPending(rec("c", null))).toBe(true);
    expect(loadAllPending().map((p) => [p.envelope.commandId, p.scope?.generation ?? null])).toEqual([["a", "gen-1"], ["b", "gen-2"], ["c", null]]);
    expect(removePending(MAI, "a")).toBe(true);
    expect(loadAllPending().map((p) => p.envelope.commandId)).toEqual(["b", "c"]);
    expect(removePending(MAI, "b")).toBe(true); // wrong scope for "b": nothing is removed
    expect(loadAllPending().map((p) => p.envelope.commandId)).toEqual(["b", "c"]);
    clearAllPending();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("splits records for the current scope: current / quarantined (same actor, another generation, or legacy); other actors vanish", () => {
    const all = [
      rec("mine", MAI),
      rec("old-gen", { ...MAI, generation: "gen-0" }),
      rec("someone-else", { ...MAI, actorId: "actor-2" }),
      rec("other-workspace", { ...MAI, workspaceId: "ws-9" }),
      rec("legacy", null),
    ];
    const { current, quarantined } = partitionPending(all, MAI);
    expect(current.map((p) => p.envelope.commandId)).toEqual(["mine"]);
    expect(quarantined.map((q) => [q.envelope.commandId, q.reason])).toEqual([["old-gen", "older_generation"], ["legacy", "legacy"]]);
  });

  it("a Phase 2 record (version 1, no scope) loads as legacy and a malformed scope is never treated as current", () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, pending: [{ envelope: envelope("old"), label: "End LIVE" }] }));
    expect(loadAllPending()).toEqual([{ scope: null, envelope: envelope("old"), label: "End LIVE" }]);
    localStorage.setItem(KEY, JSON.stringify({ v: 2, pending: [{ scope: { actorId: "", workspaceId: "ws-1", generation: "gen-1" }, envelope: envelope("odd"), label: "x" }] }));
    expect(partitionPending(loadAllPending(), MAI)).toMatchObject({ current: [], quarantined: [{ reason: "legacy" }] });
  });
});

describe("a command is stored under the session's scope before it is sent", () => {
  it("the record carries the immutable actor id, the workspace and the generation", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await signedInStore(room);
    room.loseNextResponses = 1;
    await store.submit(note("scoped"));
    const stored = JSON.parse(localStorage.getItem(KEY) as string) as { v: number; pending: PersistedPending[] };
    expect(stored.v).toBe(2);
    expect(stored.pending[0].scope).toEqual({ actorId: "actor-1", workspaceId: "ws-1", generation: "gen-1" });
    expect(JSON.stringify(stored)).not.toMatch(/password|token|cookie/i);
  });
});

describe("account switching", () => {
  it("another account never sees, looks up or replays the first account's pending work, which survives untouched", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await signedInStore(room);
    room.loseNextResponses = 1;
    await store.submit(note("Mai's unknown action"));
    expect(store.getSnapshot().unresolved).toHaveLength(1);
    const postsBefore = room.posts().length;
    const lookupsBefore = receiptLookups(room).length;
    const stored = localStorage.getItem(KEY);

    await authStore.logout();
    expect(store.getSnapshot().unresolved).toHaveLength(0); // gone from the screen the moment she signs out
    await authStore.login({ username: "linh", password: room.accounts.linh.password });
    await vi.advanceTimersByTimeAsync(0);
    await store.refreshNow();
    await vi.advanceTimersByTimeAsync(5000);
    await store.checkUnresolved();

    const state = store.getSnapshot();
    expect(state.access?.name).toBe("Linh");
    expect(state.unresolved).toHaveLength(0);
    expect(state.quarantined).toHaveLength(0); // not even listed: it is not hers
    expect(room.posts()).toHaveLength(postsBefore);
    expect(receiptLookups(room)).toHaveLength(lookupsBefore); // not looked up under her session either
    expect(localStorage.getItem(KEY)).toBe(stored); // not deleted, not rewritten

    // Back as the first account: her work is found again, and is looked up — not re-sent.
    await authStore.logout();
    await authStore.login({ username: "mai", password: room.accounts.mai.password });
    expect(store.getSnapshot().unresolved).toHaveLength(1); // hers again, as soon as she is
    await vi.advanceTimersByTimeAsync(0); // contact, then the lookup it schedules
    await store.checkUnresolved();
    expect(store.getSnapshot().unresolved).toHaveLength(0);
    expect(store.getSnapshot().resolutions[0].text).toMatch(/did record it/);
    expect(room.posts()).toHaveLength(postsBefore);
    expect(receiptLookups(room).length).toBeGreaterThan(lookupsBefore); // looked up, never re-sent
  });

  it("another account's unresolved work does not block this account's commands", async () => {
    const room = new FakeRoom();
    runningShow(room);
    addPending(rec("cmd-foreign", { ...MAI, actorId: "actor-9" }));
    const store = await signedInStore(room);
    expect(store.getSnapshot().unresolved).toHaveLength(0);
    const outcome = await store.submit(note("mine"));
    expect(outcome.status).toBe("committed");
  });
});

describe("restore: an older generation is quarantined", () => {
  /** Mai has an unknown command under gen-1; the database is then restored and she signs in under gen-2. */
  async function restoredWithPending() {
    const room = new FakeRoom();
    runningShow(room);
    const store = await signedInStore(room);
    room.loseNextResponses = 1;
    await store.submit(note("sent before the restore"));
    await vi.advanceTimersByTimeAsync(0); // let the poll that follows an unknown outcome finish first
    const sentBefore = room.posts().length;
    room.restore({ generation: "gen-2", notice: { restoredAtMs: 5000, backupTakenAtMs: 1000, backupRevision: 1 } });
    await store.refreshNow(); // the old session is gone: 401
    expect(authStore.getSnapshot().status).toBe("ended");
    await authStore.login({ username: "mai", password: room.accounts.mai.password });
    await vi.advanceTimersByTimeAsync(0);
    await store.refreshNow();
    return { room, store, sentBefore };
  }

  it("is listed, never looked up, never re-sent, and never given the new generation", async () => {
    const { room, store, sentBefore } = await restoredWithPending();
    const state = store.getSnapshot();
    expect(state.unresolved).toHaveLength(0);
    expect(state.quarantined).toEqual([{ commandId: "cmd-1", label: "Add note", reason: "older_generation", generation: "gen-1" }]);
    await store.checkUnresolved();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(room.posts()).toHaveLength(sentBefore); // no automatic replay
    expect(receiptLookups(room).every((p) => !p.endsWith("cmd-1"))).toBe(true); // no lookup for a command of another generation
    const stored = loadAllPending();
    expect(stored).toHaveLength(1);
    expect(stored[0].scope).toEqual({ actorId: "actor-1", workspaceId: "ws-1", generation: "gen-1" }); // NOT rewritten to gen-2
  });

  it("does not block new commands under the new generation, which carry the new generation's scope", async () => {
    const { room, store } = await restoredWithPending();
    const outcome = await store.submit(note("after the restore"));
    expect(outcome.status).toBe("committed");
    expect(room.requests.filter((r) => r.method === "POST").every((r) => r.headers["x-livelift-generation"] === "gen-1" || r.headers["x-livelift-generation"] === "gen-2")).toBe(true);
    expect(room.requests.at(-1)?.headers["x-livelift-generation"]).toBe("gen-2");
  });

  it("is set aside only by the person, and that removes the browser's note of it and nothing else", async () => {
    const { store } = await restoredWithPending();
    addPending(rec("keep-me", { actorId: "actor-9", workspaceId: "ws-1", generation: "gen-1" }));
    store.dismissQuarantined("cmd-1");
    expect(store.getSnapshot().quarantined).toHaveLength(0);
    expect(loadAllPending().map((p) => p.envelope.commandId)).toEqual(["keep-me"]);
  });

  it("a generation change while the session stays valid drops the snapshot, resnapshots in full and quarantines the old work", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await signedInStore(room);
    room.loseNextResponses = 1;
    await store.submit(note("sent under gen-1"));
    expect(store.getSnapshot().unresolved).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0);
    const revisionBefore = store.getSnapshot().snapshot!.revision;

    // The server moved to a new generation without ending this session (the contract's 409 `recovery_required`).
    room.generation = "gen-2";
    room.recoveryNotice = { restoredAtMs: 9000, backupTakenAtMs: 4000, backupRevision: revisionBefore - 1 };
    const fromIndex = room.requests.length;
    await store.refreshNow();
    expect(store.getSnapshot().problem).toBe("recovery_required");
    await vi.advanceTimersByTimeAsync(0);
    await store.refreshNow();

    const state = store.getSnapshot();
    expect(state).toMatchObject({ problem: null, connection: "connected" });
    expect(state.unresolved).toHaveLength(0);
    expect(state.quarantined.map((q) => q.commandId)).toEqual(["cmd-1"]);
    const afterwards = room.requests.slice(fromIndex).filter((r) => r.method === "GET" && r.path.startsWith("/api/v3/room"));
    expect(afterwards.some((r) => r.headers["x-livelift-generation"] === "gen-2" && !r.path.includes("afterRevision"))).toBe(true); // a FULL snapshot, not "changes since"
    expect(room.requests.slice(fromIndex).some((r) => r.method === "POST")).toBe(false);
    expect(authStore.getSnapshot().recovery?.notice?.backupRevision).toBe(revisionBefore - 1);
  });
});

describe("legacy Phase 2 records", () => {
  it("are quarantined for whoever signs in, never attached to the account, never looked up or sent", async () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, pending: [{ envelope: envelope("cmd-legacy"), label: "End LIVE" }] }));
    const room = new FakeRoom();
    runningShow(room);
    const store = await signedInStore(room);
    const state = store.getSnapshot();
    expect(state.unresolved).toHaveLength(0);
    expect(state.quarantined).toEqual([{ commandId: "cmd-legacy", label: "End LIVE", reason: "legacy", generation: null }]);
    await store.checkUnresolved();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(room.posts()).toHaveLength(0);
    expect(receiptLookups(room)).toHaveLength(0);
    expect(loadAllPending()[0].scope).toBeNull(); // still unattributed
    expect((await store.submit(note("not blocked"))).status).toBe("committed");
  });
});

describe("sign-out with a command on its way", () => {
  it("a command answered after sign-out is settled by its receipt and does not leave a stale record", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await signedInStore(room);
    room.onPost = () => void authStore.logout(); // she signs out while it is in flight
    const outcome = await store.submit(note("answered after sign-out"));
    expect(outcome.status).toBe("committed");
    expect(loadAllPending()).toHaveLength(0);
    expect(store.getSnapshot().snapshot).toBeNull(); // nothing of hers is displayed
  });

  it("a command whose answer is lost across sign-out is UNKNOWN (never failed) and stays saved under her scope", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await signedInStore(room);
    room.loseNextResponses = 1;
    room.onPost = () => void authStore.logout();
    const outcome = await store.submit(note("lost across sign-out"));
    expect(outcome).toMatchObject({ status: "unknown" });
    if (outcome.status === "unknown") expect(outcome.message).toMatch(/may or may not have been recorded/);
    const stored = loadAllPending();
    expect(stored).toHaveLength(1);
    expect(stored[0].scope).toEqual(MAI);
    expect(room.sessions[0].events.some((e) => e.type === "note_added")).toBe(true); // it really was committed
  });
});

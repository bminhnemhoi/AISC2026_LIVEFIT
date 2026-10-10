import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { snapshotProducts } from "@/fixtures/library";
import { SCENARIO_BY_ID, applyCommand, createSession } from "@/lib/domain";
import { RemoteRoomStore, STALE_AFTER_MS } from "@/lib/store/remoteRoomStore";
import { FakeRoom } from "./helpers/fakeRoom";
import { authStore } from "@/lib/client/authStore";
import { authorityNowMs } from "@/lib/client/authorityTime";
import { toRuntimeBody } from "@/lib/client/commandText";

const PENDING_KEY = "livelift.v3.remote.pending";

/** A running REAL show, as the room would hold it. */
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
  if (started.receipt.outcome !== "committed") throw new Error("could not start fixture show");
  room.seed(started.session);
  return started.session;
}

let perf = 0;
let ids = 0;
let restore: (() => void) | null = null;
const stores: RemoteRoomStore[] = [];

/** A store under a session: the browser asks the server who it is first, exactly as a page does. */
async function makeStore(room: FakeRoom): Promise<RemoteRoomStore> {
  restore = room.install();
  authStore.reset();
  await authStore.bootstrap();
  const store = new RemoteRoomStore({ perfNow: () => perf, newCommandId: () => `cmd-${++ids}` });
  stores.push(store);
  return store;
}

beforeEach(() => {
  sessionStorage.clear();
  authStore.reset();
  perf = 1000;
  ids = 0;
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});

afterEach(() => {
  for (const s of stores.splice(0)) s.reset();
  restore?.();
  restore = null;
  vi.useRealTimers();
});

const note = (text: string) => ({ body: { type: "add_note" as const, text }, sessionId: "real-1" });

describe("polling and installation", () => {
  it("installs the room snapshot and keeps it when the room answers 'unchanged'", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    const first = store.getSnapshot();
    expect(first.connection).toBe("connected");
    expect(first.snapshot?.revision).toBe(room.revision);
    expect(first.snapshot?.sessions.map((s) => s.id)).toEqual(["real-1"]);
    expect(first.access?.role).toBe("operator");

    await store.refreshNow();
    const second = store.getSnapshot();
    // "changed: false" is a valid read that establishes contact; it must not discard or replace what is installed.
    expect(room.requests.at(-1)!.path).toBe(`/api/v3/room?afterRevision=${room.revision}`);
    expect(second.snapshot).toBe(first.snapshot);
    expect(second.connection).toBe("connected");
  });

  it("never installs an older revision over a newer snapshot", async () => {
    const room = new FakeRoom();
    runningShow(room);
    room.revision = 5;
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().snapshot?.revision).toBe(5);
    room.revision = 3; // a replayed / reordered older answer
    await store.refreshNow();
    expect(store.getSnapshot().snapshot?.revision).toBe(5);
  });

  it("polls every second while a view is mounted, with at most one request in flight", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    let inFlight = 0;
    let peak = 0;
    const base = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await base(...args);
      } finally {
        inFlight -= 1;
      }
    });
    store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    const afterStart = room.requests.length;
    perf += 1000;
    await vi.advanceTimersByTimeAsync(1000);
    perf += 1000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(room.requests.length - afterStart).toBe(2);
    expect(peak).toBe(1);
  });

  it("a view that is no longer mounted stops the polling", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    const release = store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await vi.advanceTimersByTimeAsync(5000);
    const seen = room.requests.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(room.requests.length).toBe(seen);
  });
});

describe("foreground and reconnect", () => {
  const setVisibility = (state: "visible" | "hidden"): void => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
  };
  afterEach(() => setVisibility("visible"));

  it("a hidden view does not poll, and coming back polls immediately", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    setVisibility("hidden");
    const whileHidden = room.requests.length;
    perf += 5000;
    await vi.advanceTimersByTimeAsync(5000);
    expect(room.requests.length).toBe(whileHidden);

    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(room.requests.length).toBe(whileHidden + 1); // no waiting for the next tick
  });

  it("the browser coming back online polls immediately", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room); // the session is known; it is the room that cannot be reached
    room.offline = true;
    store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().connection).toBe("disconnected");
    room.offline = false;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().connection).toBe("connected");
  });
});

describe("stale and disconnected state", () => {
  it("failed contact keeps the last snapshot, marks it stale, freezes authority time and refuses writes", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    perf += 500;
    const liveNow = store.authorityNow()!;
    expect(liveNow).toBe(room.nowMs + 500);

    room.offline = true;
    await store.refreshNow();
    const state = store.getSnapshot();
    expect(state.connection).toBe("stale");
    expect(state.snapshot?.sessions[0].id).toBe("real-1"); // retained, not discarded
    const frozen = store.authorityNow();
    perf += 10_000;
    expect(store.authorityNow()).toBe(frozen); // unseen time is not simulated

    const outcome = await store.submit(note("late"));
    expect(outcome.status).toBe("refused");
    expect(room.posts()).toHaveLength(0);
  });

  it("more than 3 seconds without contact marks the room stale even if no request failed", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().connection).toBe("connected");
    perf += STALE_AFTER_MS + 100;
    await vi.advanceTimersByTimeAsync(500); // the staleness check runs on its own timer
    expect(store.getSnapshot().connection).toBe("stale");
    expect(store.isAuthoritative()).toBe(false);
  });

  it("the first contact failing is 'disconnected', and a later success recovers", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    room.offline = true;
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().connection).toBe("disconnected");
    expect(store.getSnapshot().problem).toBe("unreachable");
    expect(store.getSnapshot().snapshot).toBeNull();
    room.offline = false;
    await store.refreshNow();
    expect(store.getSnapshot().connection).toBe("connected");
    expect(store.getSnapshot().snapshot?.sessions).toHaveLength(1);
  });
});

describe("commands", () => {
  it("sends the room revision and no browser time, persists the envelope before sending, and installs fresh state before reporting", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    let storedAtArrival: string | null = null;
    room.onPost = () => {
      storedAtArrival = localStorage.getItem(PENDING_KEY);
    };

    const outcome = await store.submit(note("Sizing questions"));
    expect(outcome.status).toBe("committed");
    const sent = room.posts()[0];
    expect(sent).toMatchObject({ commandId: "cmd-1", roomId: "room-1", sessionId: "real-1", expectedRevision: 1, type: "add_note", payload: { text: "Sizing questions" } });
    expect(JSON.stringify(sent)).not.toMatch(/nowMs|actor|operator/);
    // The exact envelope was on disk before the room ever saw it, and is gone once the receipt arrived.
    expect(JSON.parse(storedAtArrival!).pending[0].envelope.commandId).toBe("cmd-1");
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    // Fresh state is installed before the caller hears "committed".
    if (outcome.status === "committed") expect(outcome.viewCurrent).toBe(true);
    const installed = store.getSnapshot().snapshot!;
    expect(installed.revision).toBe(2);
    expect(installed.sessions[0].events.some((e) => e.type === "note_added")).toBe(true);
  });

  it("does not advance anything while the command is pending", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    const before = store.getSnapshot().snapshot;
    let during: ReturnType<RemoteRoomStore["getSnapshot"]> | null = null;
    room.onPost = () => {
      during = store.getSnapshot();
    };
    await store.submit(note("pending check"));
    expect(during!.inflight?.commandId).toBe("cmd-1");
    expect(during!.snapshot).toBe(before); // nothing installed until the room says so
  });

  it("only one command is in flight; a second is refused, not queued", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    const [a, b] = await Promise.all([store.submit(note("one")), store.submit(note("two"))]);
    expect(a.status).toBe("committed");
    expect(b).toMatchObject({ status: "refused", code: "busy" });
    expect(room.posts()).toHaveLength(1);
  });

  it("a stale revision is surfaced as a rejection and the room is read again", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.revision += 1; // someone else committed; this tab has not polled yet
    const outcome = await store.submit(note("mine"));
    expect(outcome).toMatchObject({ status: "rejected", code: "stale_revision" });
    expect(outcome.status === "rejected" && outcome.message).toMatch(/room changed/i);
    expect(store.getSnapshot().snapshot?.revision).toBe(room.revision);
    expect(store.getSnapshot().unresolved).toHaveLength(0); // a rejection is a known outcome
  });

  it("a viewer is refused before anything is sent", async () => {
    const room = new FakeRoom({ role: "viewer" });
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    const outcome = await store.submit(note("nope"));
    expect(outcome).toMatchObject({ status: "refused", code: "read_only" });
    expect(room.posts()).toHaveLength(0);
  });

  it("the room's own 'forbidden' is a rejection with a role-aware message, not an unknown outcome", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.role = "viewer"; // the capability changed server-side after this tab last looked
    const outcome = await store.submit(note("denied"));
    expect(outcome).toMatchObject({ status: "rejected", code: "forbidden" });
    expect(store.getSnapshot().unresolved).toHaveLength(0);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe("outcome unknown", () => {
  it("a lost response is UNKNOWN, not failed; the envelope is kept and nothing else may be sent", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.loseNextResponses = 1; // the room commits, the answer never arrives

    const outcome = await store.submit(note("Was it recorded?"));
    expect(outcome.status).toBe("unknown");
    expect(store.getSnapshot().unresolved).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(PENDING_KEY)!).pending[0].envelope.commandId).toBe("cmd-1");

    const blocked = await store.submit(note("another"));
    expect(blocked).toMatchObject({ status: "refused", code: "unresolved" });
    expect(room.posts()).toHaveLength(1); // never replayed automatically
  });

  it("reconnect reconciles through the receipt endpoint and never POSTs again", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.loseNextResponses = 1;
    await store.submit(note("Was it recorded?"));

    await store.reconcile();
    const state = store.getSnapshot();
    expect(state.unresolved).toHaveLength(0);
    expect(state.resolutions[0]).toMatchObject({ tone: "ok" });
    expect(state.resolutions[0].text).toMatch(/did record it/);
    expect(state.snapshot?.sessions[0].events.some((e) => e.type === "note_added")).toBe(true);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(room.posts()).toHaveLength(1);
    expect(room.requests.some((r) => r.method === "GET" && r.path === "/api/v3/room/commands/cmd-1")).toBe(true);
  });

  it("an absent receipt is not evidence of failure: it stays unresolved until explicitly retried with the exact same envelope", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.dropNextPosts = 1; // never reached the room: nothing committed, no receipt
    await store.submit(note("Did this arrive?"));
    const original = store.getSnapshot().unresolved[0].envelope;

    await store.reconcile();
    const entry = store.getSnapshot().unresolved[0];
    expect(entry.lookup).toBe("absent");
    expect(entry.detail).toMatch(/does not prove it failed/);
    expect(room.posts()).toHaveLength(1); // the dropped one is the only POST so far

    const retried = await store.retryUnresolved("cmd-1");
    expect(retried.status).toBe("committed");
    const last = room.posts().at(-1)!;
    expect(last).toEqual(original); // same commandId, same expectedRevision, same payload
    expect(store.getSnapshot().unresolved).toHaveLength(0);
  });

  it("retrying a command that was in fact committed returns the original receipt as a duplicate", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.loseNextResponses = 1;
    await store.submit(note("exactly once"));

    const retried = await store.retryUnresolved("cmd-1");
    expect(retried).toMatchObject({ status: "committed", duplicate: true });
    const notes = store.getSnapshot().snapshot!.sessions[0].events.filter((e) => e.type === "note_added");
    expect(notes).toHaveLength(1);
  });

  it("an interrupted command survives a reload and is looked up, not replayed", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const first = await makeStore(room);
    first.acquire();
    await first.refreshNow();
    room.loseNextResponses = 1;
    await first.submit(note("across a reload"));
    // The tab closes here: only localStorage survives.
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();

    const second = new RemoteRoomStore({ perfNow: () => perf, newCommandId: () => `cmd-${++ids}` });
    stores.push(second);
    second.acquire();
    expect(second.getSnapshot().unresolved).toHaveLength(1); // restored, outcome unknown
    await vi.advanceTimersByTimeAsync(10); // first contact, then the reconcile it schedules
    await second.reconcile();
    expect(second.getSnapshot().unresolved).toHaveLength(0);
    expect(second.getSnapshot().resolutions[0].text).toMatch(/did record it/);
    expect(room.posts()).toHaveLength(1);
  });

  it("setting an unresolved command aside is explicit and does not claim it failed", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.dropNextPosts = 1;
    await store.submit(note("set aside"));
    store.dismissUnresolved("cmd-1");
    const state = store.getSnapshot();
    expect(state.unresolved).toHaveLength(0);
    expect(state.resolutions[0].text).toMatch(/outcome still unknown/);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe("cookie session and production context", () => {
  it("every authority request is a same-origin cookie request with the marker and the session's context, and nothing else", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.loseNextResponses = 1;
    await store.submit(note("with context")); // POST
    await store.reconcile(); // GET receipt

    const methods = new Set(room.requests.map((r) => `${r.method} ${r.path.split("?")[0].replace(/cmd-\d+/, "{id}")}`));
    expect(methods).toEqual(new Set(["GET /api/v3/room", "POST /api/v3/room/commands", "GET /api/v3/room/commands/{id}"]));
    for (const r of room.requests) {
      expect(r.headers["x-livelift-request"]).toBe("1");
      expect(r.headers["x-livelift-workspace"]).toBe(room.workspaceId);
      expect(r.headers["x-livelift-generation"]).toBe(room.generation);
      expect(r.headers.authorization).toBeUndefined(); // the cookie is the browser's; there is no token header
    }
    for (const r of room.requests.filter((x) => x.method === "POST")) expect(r.headers["content-type"]).toContain("application/json");
    // Context is the session's, never part of a URL, an envelope or the pending record.
    expect(room.requests.some((r) => r.path.includes(room.generation) || r.path.includes(room.workspaceId))).toBe(false);
    expect(JSON.stringify(room.posts())).not.toContain(room.generation);
    expect(localStorage.getItem(PENDING_KEY) ?? "").not.toContain("Bearer");
  });

  it("signed out: nothing is sent to the room, the state says so — not 'unreachable'", async () => {
    const room = new FakeRoom({ signedIn: false });
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    const state = store.getSnapshot();
    expect(room.requests).toHaveLength(0);
    expect(state.problem).toBe("signed_out");
    expect(state.connection).toBe("disconnected");
    expect(state.snapshot).toBeNull();
    expect(await store.submit(note("no session"))).toMatchObject({ status: "refused", code: "not_connected" });
    expect(room.posts()).toHaveLength(0);

    await authStore.login({ username: "mai", password: room.accounts.mai.password }); // signing in connects without a reload
    await vi.advanceTimersByTimeAsync(0);
    await store.refreshNow();
    expect(store.getSnapshot()).toMatchObject({ problem: null, connection: "connected" });
  });

  it("a session that ends mid-poll is 'session ended', keeps the last confirmed state frozen, and sends nothing more", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().snapshot).not.toBeNull();
    room.revokeSession();
    await store.refreshNow();
    const state = store.getSnapshot();
    expect(state.problem).toBe("session_ended");
    expect(state.snapshot).not.toBeNull(); // last confirmed state, not an empty room
    expect(authStore.getSnapshot().status).toBe("ended");
    const before = room.requests.length;
    await store.refreshNow();
    expect(room.requests).toHaveLength(before);
    expect(await store.submit(note("too late"))).toMatchObject({ status: "refused", code: "not_connected" });
  });

  it("a 401 AFTER a command was submitted is UNKNOWN, not a rejection", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    room.revokeSession(); // the session ends before this tab has noticed; the command goes out and is answered 401
    const outcome = await store.submit(note("sent as the session ended"));
    expect(outcome).toMatchObject({ status: "unknown" });
    expect(store.getSnapshot().unresolved).toHaveLength(1);
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull(); // saved to be checked after signing in again
    expect(store.getSnapshot().problem).toBe("session_ended");
    expect(room.posts()).toHaveLength(1);
  });

  it("when the sign-in service cannot be asked, the state says so and recovers once it can", async () => {
    const room = new FakeRoom();
    runningShow(room);
    room.offline = true;
    const store = await makeStore(room); // the very first question fails
    store.acquire();
    await vi.advanceTimersByTimeAsync(0);
    expect(authStore.getSnapshot().status).toBe("unavailable");
    expect(store.getSnapshot()).toMatchObject({ problem: "auth_unavailable", connection: "disconnected", snapshot: null });
    room.offline = false;
    await vi.advanceTimersByTimeAsync(5000); // it keeps asking by itself
    await vi.advanceTimersByTimeAsync(0);
    expect(authStore.getSnapshot().status).toBe("authenticated");
    expect(store.getSnapshot()).toMatchObject({ problem: null, connection: "connected" });
  });

  it("a viewer session stays read-only: the role comes from the room, and a role change shows up without a reload", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().access?.role).toBe("operator");
    room.role = "viewer"; // changed server-side
    await store.refreshNow();
    expect(store.getSnapshot().access?.role).toBe("viewer");
    expect(authStore.getSnapshot().session?.access.role).toBe("viewer"); // the cached role follows the room, never the reverse
    expect(await store.submit(note("viewer"))).toMatchObject({ status: "refused", code: "read_only" });
    expect(room.posts()).toHaveLength(0);
  });

  it("switching accounts drops what the previous identity saw", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().access?.name).toBe("Mai");

    await authStore.logout();
    expect(store.getSnapshot().snapshot).toBeNull(); // gone at once, before the next account is even known
    await authStore.login({ username: "linh", password: room.accounts.linh.password });
    await vi.advanceTimersByTimeAsync(0);
    await store.refreshNow();
    expect(store.getSnapshot().access).toMatchObject({ name: "Linh", role: "viewer" });
    expect(await store.submit(note("viewer"))).toMatchObject({ status: "refused", code: "read_only" });
  });
});

describe("recovery attribution", () => {
  it("keeps recoveryId / recoveryLabel and still strips the local-only fields", () => {
    const body = toRuntimeBody({ type: "commit_end_by", segmentId: "s:a", endByMs: 5, recoveryId: "end_by:a", recoveryLabel: "End Zip Hoodie by 20:12", key: "k", nowMs: 1, expectedRevision: 3, actor: "x" });
    expect(body).toEqual({ type: "commit_end_by", segmentId: "s:a", endByMs: 5, recoveryId: "end_by:a", recoveryLabel: "End Zip Hoodie by 20:12" });
    expect(toRuntimeBody({ type: "add_note", text: "plain" })).toEqual({ type: "add_note", text: "plain" }); // nothing is invented
    expect(toRuntimeBody({ type: "advance_clock", byMs: 1 })).toBeNull();
  });

  it("reaches the wire unchanged inside the envelope payload", async () => {
    const room = new FakeRoom();
    const show = runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    const segmentId = show.runtime.currentSegmentId!;
    const body = toRuntimeBody({ type: "commit_end_by", segmentId, endByMs: room.nowMs + 9 * 60_000, recoveryId: "end_by", recoveryLabel: "End by 20:12:00" })!;
    const outcome = await store.submit({ body, sessionId: "real-1" });
    expect(outcome.status).toBe("committed");
    expect(room.posts()[0].payload).toMatchObject({ segmentId, recoveryId: "end_by", recoveryLabel: "End by 20:12:00" });
    expect(store.getSnapshot().snapshot!.sessions[0].events.some((e) => e.type === "recovery_selected")).toBe(true);
  });
});

describe("authority time", () => {
  it("serverNowMs is already corrected: a nonzero clockBehindByMs is NOT added again", async () => {
    const room = new FakeRoom();
    runningShow(room);
    room.clockBehindByMs = 10 * 60_000;
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    expect(store.getSnapshot().clockBehindByMs).toBe(10 * 60_000); // still reported, as information
    expect(store.authorityNow()).toBe(room.nowMs);
    perf += 1500;
    expect(store.authorityNow()).toBe(room.nowMs + 1500); // only monotonic elapsed time is added
  });

  it("interpolates between polls and takes the room's word at the next one", async () => {
    const room = new FakeRoom();
    runningShow(room);
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    perf += 700;
    expect(store.authorityNow()).toBe(room.nowMs + 700);
    room.nowMs += 1000;
    perf += 300;
    await store.refreshNow();
    expect(store.authorityNow()).toBe(room.nowMs); // re-anchored on the new server time, no jump from drift
    perf += 250;
    expect(store.authorityNow()).toBe(room.nowMs + 250);
  });

  it("stale freezes the projection at the last interpolated value, with or without a clock gap", async () => {
    const room = new FakeRoom();
    runningShow(room);
    room.clockBehindByMs = 120_000;
    const store = await makeStore(room);
    store.acquire();
    await store.refreshNow();
    perf += 800;
    room.offline = true;
    await store.refreshNow();
    expect(store.getSnapshot().connection).toBe("stale");
    const frozen = store.authorityNow();
    expect(frozen).toBe(room.nowMs + 800);
    perf += 60_000;
    expect(store.authorityNow()).toBe(frozen);
    room.offline = false;
    await store.refreshNow();
    expect(store.authorityNow()).toBe(room.nowMs); // live again from the room's time
  });

  it("the pure function is serverNowMs + monotonic elapsed, frozen when told to", () => {
    const sample = { serverNowMs: 1_000_000, receivedPerfMs: 50 };
    expect(authorityNowMs(sample, 50)).toBe(1_000_000);
    expect(authorityNowMs(sample, 2050)).toBe(1_002_000);
    expect(authorityNowMs(sample, 9050, 1050)).toBe(1_001_000);
  });
});

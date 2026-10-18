import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { announcer } from "@/lib/client/announcer";
import { AuthStore, authStore, safeNextPath } from "@/lib/client/authStore";
import { createAuthClient } from "@/lib/client/authClient";
import { FakeRoom } from "../helpers/fakeRoom";

/** The browser's account of "who is signed in": every state, and nothing credential-shaped kept anywhere. */

let restore: (() => void) | null = null;
const open = (room: FakeRoom): FakeRoom => {
  restore = room.install();
  return room;
};
const texts = (): string[] => announcer.getSnapshot().map((a) => a.text);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  announcer.reset();
});
afterEach(() => {
  restore?.();
  restore = null;
});

describe("session bootstrap", () => {
  it("a rejected session check leaves checking and permits a successful retry", async () => {
    const client = createAuthClient();
    const getSession = vi.spyOn(client, "getSession").mockRejectedValueOnce(new Error("Unexpected client failure")).mockResolvedValue({ kind: "signed_out" });
    const store = new AuthStore({ client });
    await store.bootstrap();
    expect(store.getSnapshot()).toMatchObject({ status: "unavailable", unavailable: { reason: "unexpected" } });
    await store.bootstrap();
    expect(store.getSnapshot().status).toBe("signed_out");
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it("starts as 'checking' and asks the server once", async () => {
    const room = open(new FakeRoom());
    expect(authStore.getSnapshot().status).toBe("checking");
    const first = authStore.bootstrap();
    void authStore.bootstrap(); // joins the one in flight
    await first;
    expect(room.authRequests.filter((r) => r.path === "/api/v3/auth/session")).toHaveLength(1);
  });

  it("an authenticated operator", async () => {
    open(new FakeRoom());
    await authStore.bootstrap();
    const s = authStore.getSnapshot();
    expect(s.status).toBe("authenticated");
    expect(s.session?.access).toEqual({ actorId: "actor-1", name: "Mai", role: "operator" });
    expect(authStore.getContext()).toEqual({ workspaceId: "ws-1", generation: "gen-1" });
    expect(authStore.getScope()).toEqual({ actorId: "actor-1", workspaceId: "ws-1", generation: "gen-1" });
  });

  it("an authenticated viewer", async () => {
    open(new FakeRoom({ role: "viewer", actor: { id: "actor-2", name: "Linh" } }));
    await authStore.bootstrap();
    expect(authStore.getSnapshot().session?.access.role).toBe("viewer");
  });

  it("signed out (401) has no context and no scope, so nothing can be sent", async () => {
    open(new FakeRoom({ signedIn: false }));
    await authStore.bootstrap();
    expect(authStore.getSnapshot()).toMatchObject({ status: "signed_out", session: null });
    expect(authStore.getContext()).toBeNull();
    expect(authStore.getScope()).toBeNull();
  });

  it("an unavailable server is 'unavailable', not 'signed out'", async () => {
    const room = open(new FakeRoom());
    room.storageDown = true;
    await authStore.bootstrap();
    expect(authStore.getSnapshot()).toMatchObject({ status: "unavailable", session: null });
    expect(authStore.getSnapshot().unavailable?.reason).toBe("storage_unavailable");
    room.storageDown = false;
    room.backendDown = true;
    await authStore.bootstrap();
    expect(authStore.getSnapshot().unavailable?.reason).toBe("authority_unavailable");
    room.backendDown = false;
    await authStore.bootstrap();
    expect(authStore.getSnapshot().status).toBe("authenticated");
  });
});

describe("login", () => {
  it("success authenticates, clears errors and keeps no credential or token in browser storage", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await authStore.bootstrap();
    const password = room.accounts.mai.password;
    const result = await authStore.login({ username: "mai", password });
    expect(result.kind).toBe("authenticated");
    expect(authStore.getSnapshot()).toMatchObject({ status: "authenticated", loginError: null });
    expect(authStore.getSnapshot().session?.access.name).toBe("Mai");

    const stored: string[] = [];
    for (const area of [localStorage, sessionStorage]) for (let i = 0; i < area.length; i++) stored.push(`${area.key(i)}=${area.getItem(area.key(i) as string)}`);
    expect(stored.join("\n")).not.toContain(password);
    expect(stored.join("\n").toLowerCase()).not.toMatch(/token|cookie|bearer|livelift_session/);
    expect(JSON.stringify(authStore.getSnapshot())).not.toContain(password); // not held in state either
  });

  it("wrong credentials are one generic failure and leave the browser signed out", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await authStore.bootstrap();
    const unknownUser = await authStore.login({ username: "nobody", password: "x".repeat(20) });
    const wrongPassword = await authStore.login({ username: "mai", password: "wrong wrong wrong" });
    expect(unknownUser).toEqual({ kind: "invalid_credentials" });
    expect(wrongPassword).toEqual({ kind: "invalid_credentials" }); // indistinguishable
    expect(authStore.getSnapshot()).toMatchObject({ status: "signed_out", session: null, loginError: { kind: "invalid_credentials" } });
    expect(room.signedIn).toBe(false);
  });

  it("throttling and storage trouble are named for what they are", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await authStore.bootstrap();
    room.loginThrottled = true;
    await authStore.login({ username: "mai", password: room.accounts.mai.password });
    expect(authStore.getSnapshot().loginError).toEqual({ kind: "rate_limited" });
    room.loginThrottled = false;
    room.loginStorageDown = true;
    await authStore.login({ username: "mai", password: room.accounts.mai.password });
    expect(authStore.getSnapshot().loginError).toMatchObject({ kind: "unavailable", reason: "storage_unavailable" });
    expect(authStore.getSnapshot().status).toBe("signed_out");
  });

  it("a second submission while one is running joins it: exactly one login request is sent", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await authStore.bootstrap();
    const creds = { username: "mai", password: room.accounts.mai.password };
    const a = authStore.login(creds);
    expect(authStore.getSnapshot().status).toBe("signing_in");
    const b = authStore.login(creds);
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(rb);
    expect(room.authRequests.filter((r) => r.path === "/api/v3/auth/login")).toHaveLength(1);
  });

  it("the password is sent once, in the body, and never stored by the client", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await authStore.bootstrap();
    await authStore.login({ username: "mai", password: room.accounts.mai.password });
    const login = room.authRequests.find((r) => r.path === "/api/v3/auth/login")!;
    expect(login.body).toEqual({ username: "mai", password: room.accounts.mai.password });
    expect(login.headers["x-livelift-request"]).toBe("1");
    expect(login.headers["content-type"]).toContain("application/json");
    expect(JSON.stringify(room.authRequests.filter((r) => r !== login))).not.toContain(room.accounts.mai.password);
  });
});

describe("logout and ending a session", () => {
  it("logout asks the server, clears the session at once and says nothing was confirmed only when it was not", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap();
    const done = authStore.logout();
    expect(authStore.getSnapshot().status).toBe("signing_out"); // protected state is dropped before the server answers
    await done;
    expect(authStore.getSnapshot()).toMatchObject({ status: "signed_out", session: null, logoutNote: null });
    expect(room.authRequests.some((r) => r.method === "POST" && r.path === "/api/v3/auth/logout")).toBe(true);
    expect(room.signedIn).toBe(false);
    expect(texts()).toContain("Signed out.");
  });

  it("a logout the server could not confirm is still signed out here, with an honest note", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap();
    room.offline = true;
    await authStore.logout();
    expect(authStore.getSnapshot().status).toBe("signed_out");
    expect(authStore.getSnapshot().logoutNote).toMatch(/did not confirm/);
  });

  it("a 401 on an authenticated request is 'ended' (expired or revoked), announced once, assertively", async () => {
    open(new FakeRoom());
    await authStore.bootstrap();
    authStore.markSessionEnded();
    authStore.markSessionEnded();
    expect(authStore.getSnapshot()).toMatchObject({ status: "ended", session: null });
    expect(authStore.getContext()).toBeNull();
    const ended = announcer.getSnapshot().filter((a) => /session ended/i.test(a.text));
    expect(ended).toHaveLength(1);
    expect(ended[0].priority).toBe("assertive");
  });

  it("re-reading a session the server no longer has is 'ended'; one it never had is 'signed out'", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap();
    room.revokeSession();
    await authStore.refresh();
    expect(authStore.getSnapshot().status).toBe("ended");
    await authStore.bootstrap();
    expect(authStore.getSnapshot().status).toBe("signed_out"); // asked again from the start: there is none
  });
});

describe("the room's word on who this is", () => {
  it("a role change observed in the room replaces the role the session described, and is announced", async () => {
    open(new FakeRoom());
    await authStore.bootstrap();
    authStore.observeAccess({ actorId: "actor-1", name: "Mai", role: "viewer" });
    expect(authStore.getSnapshot().session?.access.role).toBe("viewer");
    expect(texts().some((t) => /read-only viewer/.test(t))).toBe(true);
  });

  it("a different actor in the room than in the session sends the session to be re-read", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap();
    room.actor = { id: "actor-9", name: "Someone" };
    authStore.observeAccess({ actorId: "actor-9", name: "Someone", role: "operator" });
    await authStore.refresh();
    expect(authStore.getSnapshot().session?.access.actorId).toBe("actor-9");
  });
});

describe("restore notice", () => {
  const notice = { restoredAtMs: Date.UTC(2026, 9, 7, 3, 0), backupTakenAtMs: Date.UTC(2026, 9, 6, 22, 0), backupRevision: 41 };

  it("a notice from the server is shown with its three facts, and dismissing it is remembered for this generation only", async () => {
    const room = open(new FakeRoom());
    room.generation = "gen-2";
    room.recoveryNotice = notice;
    await authStore.bootstrap();
    expect(authStore.getSnapshot().recovery).toEqual({ generation: "gen-2", notice });
    authStore.dismissRecovery();
    expect(authStore.getSnapshot().recovery).toBeNull();
    await authStore.refresh();
    expect(authStore.getSnapshot().recovery).toBeNull();

    room.generation = "gen-3"; // restored again: new generation, new notice
    room.recoveryNotice = { ...notice, backupRevision: 55 };
    await authStore.refresh();
    expect(authStore.getSnapshot().recovery?.notice?.backupRevision).toBe(55);
  });

  it("a generation that changed since this browser last saw it is a restore notice even without server facts", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap(); // sees gen-1
    room.restore({ generation: "gen-2" }); // no notice facts available
    await authStore.refresh().catch(() => undefined);
    expect(authStore.getSnapshot().status).toBe("ended"); // a restore clears every login session
    await authStore.login({ username: "mai", password: room.accounts.mai.password });
    expect(authStore.getSnapshot().recovery).toEqual({ generation: "gen-2", notice: null });
  });

  it("the same is true across page loads: the last generation seen is remembered (and is not a secret)", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap();
    authStore.reset(); // a new page load
    room.generation = "gen-2";
    await authStore.bootstrap();
    expect(authStore.getSnapshot().recovery).toEqual({ generation: "gen-2", notice: null });
    expect(localStorage.getItem("livelift.v3.lastGeneration")).toContain("gen-2");
  });

  it("no restore means no notice", async () => {
    open(new FakeRoom());
    await authStore.bootstrap();
    expect(authStore.getSnapshot().recovery).toBeNull();
  });
});

describe("where to go after sign-in", () => {
  it.each([
    ["/live/real-1/operate", "/live/real-1/operate"],
    ["/sessions?x=1", "/sessions?x=1"],
    [null, "/"],
    ["https://evil.example/", "/"],
    ["//evil.example/", "/"],
    ["/\\evil.example", "/"],
    ["/login?next=/", "/"],
    ["javascript:alert(1)", "/"],
  ])("%s → %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });
});

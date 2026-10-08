import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { TikTokStatusView } from "@/contracts/tiktok";
import type { TikTokClient, TikTokResult } from "@/lib/client/tiktokClient";

const mocks = vi.hoisted(() => ({
  auth: { current: null as unknown },
  ensureChecked: vi.fn(),
  refreshAuth: vi.fn(),
}));
vi.mock("@/lib/store/hooks", () => ({ useAuth: () => mocks.auth.current }));
vi.mock("@/lib/client/authStore", () => ({ authStore: { ensureChecked: mocks.ensureChecked, refresh: mocks.refreshAuth } }));

import { TikTokConnectionPanel } from "../TikTokConnectionPanel";
import { useTikTokConnection, PROFILE_REFRESH_AFTER_MS, type TikTokConnection, type TikTokPanelState } from "../useTikTokConnection";

const LIMITS = { live: "not_established", shop: "not_established", analytics: "not_established", nativeActions: "not_established" } as const;
const CONNECTION = { openId: "open-id-fixture-123", grantedScopes: ["user.info.basic"], notGrantedScopes: [], connectedAtMs: Date.UTC(2026, 9, 7), authorizationValidUntilMs: Date.UTC(2027, 9, 7), profile: { displayName: "Fixture Creator", avatarAvailable: true, username: null, isVerified: null }, profileState: "ok" as const, profileFetchedAtMs: Date.now(), lastCheckedAtMs: Date.now(), unavailableReason: null };
const view = (over: Partial<TikTokStatusView> = {}): TikTokStatusView => ({ provider: "tiktok", state: "ready", configIssues: [], requestedScopes: ["user.info.basic"], connection: null, disconnectedAtMs: null, lastRevocation: null, limits: LIMITS, ...over });
const connected = (over: Partial<TikTokStatusView> = {}) => view({ state: "connected", connection: CONNECTION, ...over });

function conn(state: TikTokPanelState, over: Partial<TikTokConnection> = {}): TikTokConnection {
  return { state, busy: null, notice: null, canManage: true, connect: vi.fn(async () => {}), refresh: vi.fn(async () => {}), disconnect: vi.fn(async () => {}), dismissNotice: vi.fn(), ...over };
}
const loaded = (v: TikTokStatusView): TikTokPanelState => ({ kind: "loaded", view: v });

afterEach(cleanup);

describe("TikTok panel: truthful states", () => {
  it.each([
    ["Not configured", view({ state: "not_configured", configIssues: ["LIVELIFT_TIKTOK_CLIENT_KEY", "LIVELIFT_PROVIDER_ENCRYPTION_KEY"] })],
    ["Ready to connect", view()],
    ["Connected", connected()],
    ["Authorization expired", view({ state: "expired", connection: CONNECTION })],
    ["Provider unavailable", view({ state: "unavailable", connection: { ...CONNECTION, unavailableReason: "network" } })],
    ["Disconnected", view({ state: "disconnected", disconnectedAtMs: Date.now(), lastRevocation: "confirmed" })],
  ])("shows the label %s", (label, v) => {
    render(<TikTokConnectionPanel connection={conn(loaded(v))} />);
    expect(screen.getByTestId("tiktok-state")).toHaveTextContent(label);
  });

  it("shows 'Connecting' while the sign-in is being opened, and offers nothing else to press", () => {
    render(<TikTokConnectionPanel connection={conn(loaded(view()), { busy: "connecting" })} />);
    expect(screen.getByTestId("tiktok-state")).toHaveTextContent("Connecting");
    expect(screen.getByTestId("tiktok-connect")).toBeDisabled();
  });

  it("not configured names variables but offers no Connect button and never shows values", () => {
    render(<TikTokConnectionPanel connection={conn(loaded(view({ state: "not_configured", configIssues: ["LIVELIFT_TIKTOK_CLIENT_KEY"] })))} />);
    expect(screen.getByTestId("tiktok-not-configured")).toHaveTextContent("LIVELIFT_TIKTOK_CLIENT_KEY");
    expect(screen.queryByTestId("tiktok-connect")).toBeNull();
  });

  it("connected shows display name, avatar through LiveLift only, open ID and granted scopes", () => {
    render(<TikTokConnectionPanel connection={conn(loaded(connected()))} />);
    expect(screen.getByTestId("tiktok-display-name")).toHaveTextContent("Fixture Creator");
    expect(screen.getByTestId("tiktok-open-id")).toHaveTextContent("open-id-fixture-123");
    expect(screen.getByTestId("tiktok-scopes")).toHaveTextContent("user.info.basic");
    const img = document.querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(/^\/api\/v3\/integrations\/tiktok\/avatar\?v=\d+$/);
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(document.body.innerHTML).not.toContain("tiktokcdn");
    expect(screen.getByTestId("tiktok-profile")).toHaveTextContent("Provider observed via TikTok User Info");
  });

  it("missing values read 'not available', never blank or zero; a missing grant is shown", () => {
    const partial = { ...CONNECTION, profile: { displayName: null, avatarAvailable: false, username: null, isVerified: null }, profileState: "partial" as const, notGrantedScopes: ["user.info.profile"] };
    render(<TikTokConnectionPanel connection={conn(loaded(connected({ connection: partial })))} />);
    expect(screen.getByTestId("tiktok-display-name")).toHaveTextContent("Display name not available");
    expect(screen.getByTestId("tiktok-profile")).toHaveTextContent("Avatar not available");
    expect(screen.getByTestId("tiktok-profile")).toHaveTextContent("Requested, not granted");
    expect(screen.getByTestId("tiktok-profile")).toHaveTextContent("user.info.profile");
    expect(document.querySelector("img")).toBeNull();
  });

  it("expired fails closed in the words: stopped using it, profile is last known not current, reconnect offered", () => {
    render(<TikTokConnectionPanel connection={conn(loaded(view({ state: "expired", connection: { ...CONNECTION, authorizationValidUntilMs: null } })))} />);
    expect(screen.getByTestId("tiktok-expired")).toHaveTextContent("stopped using it");
    expect(screen.getByTestId("tiktok-expired")).toHaveTextContent("not current");
    expect(screen.getByTestId("tiktok-profile")).toHaveTextContent("last read");
    expect(screen.getByTestId("tiktok-connect")).toHaveTextContent("Reconnect TikTok");
  });

  it("provider unavailable is 'unknown, not failed' and keeps the authorization", () => {
    render(<TikTokConnectionPanel connection={conn(loaded(view({ state: "unavailable", connection: { ...CONNECTION, unavailableReason: "rate_limited" } })))} />);
    const text = screen.getByTestId("tiktok-unavailable");
    expect(text).toHaveTextContent("limited requests");
    expect(text).toHaveTextContent("unknown, not failed");
    expect(screen.getByTestId("tiktok-refresh")).toBeEnabled();
  });

  it("disconnected says what was erased, and whether TikTok confirmed the revocation", () => {
    const { rerender } = render(<TikTokConnectionPanel connection={conn(loaded(view({ state: "disconnected", disconnectedAtMs: Date.now(), lastRevocation: "confirmed" })))} />);
    expect(screen.getByTestId("tiktok-disconnected")).toHaveTextContent("TikTok confirmed the revocation");
    rerender(<TikTokConnectionPanel connection={conn(loaded(view({ state: "disconnected", disconnectedAtMs: Date.now(), lastRevocation: "unconfirmed" })))} />);
    expect(screen.getByTestId("tiktok-disconnected")).toHaveTextContent("did not confirm the revocation");
  });

  it("no sign-in, or a server that cannot be asked, is not presented as 'disconnected'", () => {
    const { rerender } = render(<TikTokConnectionPanel connection={conn({ kind: "needs_sign_in" })} />);
    expect(screen.getByTestId("tiktok-needs-sign-in")).toHaveTextContent("Sign in to a LiveLift workspace");
    expect(screen.queryByTestId("tiktok-state")).toBeNull();
    rerender(<TikTokConnectionPanel connection={conn({ kind: "server_unavailable", message: "The server could not be reached." })} />);
    expect(screen.getByTestId("tiktok-server-unavailable")).toHaveTextContent("unknown, not disconnected");
    expect(screen.queryByTestId("tiktok-state")).toBeNull();
  });

  it("viewers see the connection but cannot change it", () => {
    render(<TikTokConnectionPanel connection={conn(loaded(connected()), { canManage: false })} />);
    expect(screen.getByTestId("tiktok-viewer-note")).toBeInTheDocument();
    expect(screen.getByTestId("tiktok-refresh")).toBeDisabled();
    expect(screen.getByTestId("tiktok-disconnect")).toBeDisabled();
  });

  it("disconnect needs a second, explicit confirmation", () => {
    const connection = conn(loaded(connected()));
    render(<TikTokConnectionPanel connection={connection} />);
    fireEvent.click(screen.getByTestId("tiktok-disconnect"));
    expect(connection.disconnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("tiktok-disconnect-confirm"));
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["not_configured", view({ state: "not_configured", configIssues: ["X"] })],
    ["ready", view()],
    ["connected", connected()],
    ["expired", view({ state: "expired", connection: CONNECTION })],
    ["unavailable", view({ state: "unavailable", connection: { ...CONNECTION, unavailableReason: "timeout" } })],
    ["disconnected", view({ state: "disconnected", disconnectedAtMs: 1, lastRevocation: null })],
  ])("never claims LIVE, Shop, analytics or native-action evidence (%s)", (_name, v) => {
    render(<TikTokConnectionPanel connection={conn(loaded(v))} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/LIVE connected|LIVE eligible|eligible for LIVE|Shop connected|analytics (are )?available|verified (the )?(pin|action)|platform[- ]confirmed (the )?(pin|action)/i);
    const limits = within(screen.getByTestId("tiktok-limits"));
    for (const name of ["TikTok LIVE eligibility", "TikTok Shop", "LIVE chat, engagement and analytics", "Pin / unpin or promotion verification"]) {
      expect(limits.getByText(name, { exact: false }).parentElement).toHaveTextContent("not established");
    }
  });
});

// ---- the hook ------------------------------------------------------------------------------------------------------
const ctx = { workspaceId: "11111111-1111-4111-8111-111111111111", generation: "22222222-2222-4222-8222-222222222222" };
const authenticated = (role: "operator" | "viewer" = "operator") => ({ status: "authenticated", session: { ...ctx, roomId: "r", expiresAtMs: Date.now() + 1e6, recoveryNotice: null, access: { actorId: "a", name: "n", role } }, loginError: null, unavailable: null, logoutNote: null, recovery: null });
function fakeClient(over: Partial<Record<keyof TikTokClient, unknown>> = {}) {
  const ok = <T,>(value: T): Promise<TikTokResult<T>> => Promise.resolve({ kind: "ok", value });
  return {
    getStatus: vi.fn(async () => ({ kind: "ok", value: view() }) as TikTokResult<TikTokStatusView>),
    refresh: vi.fn(() => ok(connected())),
    connect: vi.fn(() => ok({ authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/?client_key=k&state=s" })),
    disconnect: vi.fn(() => ok(view({ state: "disconnected", disconnectedAtMs: 1, lastRevocation: "confirmed" }))),
    ...over,
  } as unknown as TikTokClient & { getStatus: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
}

describe("useTikTokConnection", () => {
  beforeEach(() => { mocks.auth.current = authenticated(); vi.clearAllMocks(); window.history.replaceState(null, "", "/integrations"); });

  it("reads status with the session's workspace context and asks the auth store to check the session", async () => {
    const client = fakeClient();
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));
    expect(client.getStatus).toHaveBeenCalledWith(ctx);
    expect(mocks.ensureChecked).toHaveBeenCalled();
    expect(result.current.canManage).toBe(true);
  });

  it.each([["signed_out"], ["ended"], ["signing_out"]])("auth '%s' reads nothing and says sign in", async (status) => {
    mocks.auth.current = { ...authenticated(), status, session: null };
    const client = fakeClient();
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(result.current.state.kind).toBe("needs_sign_in"));
    expect(client.getStatus).not.toHaveBeenCalled();
  });

  it("an unreachable server is 'server_unavailable', not 'disconnected'", async () => {
    mocks.auth.current = { ...authenticated(), status: "unavailable", session: null, unavailable: { reason: "network", message: "The server could not be reached." } };
    const client = fakeClient();
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(result.current.state).toEqual({ kind: "server_unavailable", message: "The server could not be reached." }));
  });

  it("connect asks the server to start, then navigates to TikTok's own page and stays 'connecting'", async () => {
    const client = fakeClient();
    const navigate = vi.fn();
    const { result } = renderHook(() => useTikTokConnection(client, navigate));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));
    act(() => { void result.current.connect(); });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://www.tiktok.com/v2/auth/authorize/?client_key=k&state=s"));
    expect(result.current.busy).toBe("connecting");
    act(() => { void result.current.connect(); });
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it("a viewer cannot start, refresh or disconnect, and nothing is sent", async () => {
    mocks.auth.current = authenticated("viewer");
    const client = fakeClient();
    const navigate = vi.fn();
    const { result } = renderHook(() => useTikTokConnection(client, navigate));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));
    await act(async () => { await result.current.connect(); await result.current.refresh(); await result.current.disconnect(); });
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.refresh).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "rate_limited" }, /Too many TikTok sign-in attempts/],
    [{ kind: "not_configured" }, /not set up/],
    [{ kind: "forbidden" }, /Only operators/],
    [{ kind: "unavailable", message: "x" }, /could not be started\. Nothing was connected/],
  ] as const)("a failed start (%j) connects nothing and says so", async (answer, text) => {
    const client = fakeClient({ connect: vi.fn(async () => answer) });
    const navigate = vi.fn();
    const { result } = renderHook(() => useTikTokConnection(client, navigate));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));
    await act(async () => { await result.current.connect(); });
    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.notice?.text).toMatch(text);
    expect(result.current.busy).toBeNull();
  });

  it("the callback outcome in the address is shown once, then removed from the address bar", async () => {
    window.history.replaceState(null, "", "/integrations?tiktok=denied&keep=1");
    const client = fakeClient();
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(result.current.notice?.text).toMatch(/cancelled or denied\. Nothing was connected/));
    expect(window.location.search).toBe("?keep=1");
  });

  it("an unknown outcome value is ignored, so the address cannot inject a message", async () => {
    window.history.replaceState(null, "", "/integrations?tiktok=<b>hacked</b>");
    const client = fakeClient();
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));
    expect(result.current.notice).toBeNull();
  });

  it("an operator opening a stale connection re-reads it once; a fresh one and a viewer do not", async () => {
    const stale = connected({ connection: { ...CONNECTION, profileFetchedAtMs: Date.now() - PROFILE_REFRESH_AFTER_MS - 1000 } });
    const client = fakeClient({ getStatus: vi.fn(async () => ({ kind: "ok", value: stale })) });
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(client.refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.state.kind === "loaded" && result.current.state.view.connection?.profileFetchedAtMs).toBe(CONNECTION.profileFetchedAtMs));

    const fresh = fakeClient({ getStatus: vi.fn(async () => ({ kind: "ok", value: connected() })) });
    renderHook(() => useTikTokConnection(fresh, vi.fn()));
    await waitFor(() => expect(fresh.getStatus).toHaveBeenCalled());
    expect(fresh.refresh).not.toHaveBeenCalled();

    mocks.auth.current = authenticated("viewer");
    const viewerClient = fakeClient({ getStatus: vi.fn(async () => ({ kind: "ok", value: stale })) });
    renderHook(() => useTikTokConnection(viewerClient, vi.fn()));
    await waitFor(() => expect(viewerClient.getStatus).toHaveBeenCalled());
    expect(viewerClient.refresh).not.toHaveBeenCalled();
  });

  it("disconnect reports whether TikTok confirmed the revocation", async () => {
    const client = fakeClient({ getStatus: vi.fn(async () => ({ kind: "ok", value: connected() })) });
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));
    await act(async () => { await result.current.disconnect(); });
    expect(result.current.notice?.text).toMatch(/TikTok confirmed the authorization was revoked/);
    client.disconnect.mockResolvedValueOnce({ kind: "ok", value: view({ state: "disconnected", disconnectedAtMs: 1, lastRevocation: "unconfirmed" }) });
    await act(async () => { await result.current.disconnect(); });
    expect(result.current.notice?.text).toMatch(/did not confirm the revocation/);
  });

  it("a 401 from the server ends the TikTok view and re-reads the session", async () => {
    const client = fakeClient({ getStatus: vi.fn(async () => ({ kind: "signed_out" })) });
    const { result } = renderHook(() => useTikTokConnection(client, vi.fn()));
    await waitFor(() => expect(result.current.state.kind).toBe("needs_sign_in"));
    expect(mocks.refreshAuth).toHaveBeenCalled();
  });
});

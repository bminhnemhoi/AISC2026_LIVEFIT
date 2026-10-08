"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TIKTOK_CALLBACK_OUTCOMES, type TikTokCallbackOutcome, type TikTokStatusView } from "@/contracts/tiktok";
import { authStore } from "@/lib/client/authStore";
import { createTikTokClient, type TikTokClient, type TikTokResult } from "@/lib/client/tiktokClient";
import { useAuth } from "@/lib/store/hooks";

/** A profile older than this is re-read once when an operator opens the page. */
export const PROFILE_REFRESH_AFTER_MS = 15 * 60_000;

export type TikTokBusy = "connecting" | "refreshing" | "disconnecting" | null;
export type TikTokNotice = { variant: "info" | "warning" | "danger"; text: string };

export type TikTokPanelState =
  | { kind: "checking" }
  /** No signed-in session: nothing about TikTok can be read or changed. */
  | { kind: "needs_sign_in" }
  /** The server (or its storage) could not be asked. The connection state is unknown, not "disconnected". */
  | { kind: "server_unavailable"; message: string }
  | { kind: "loaded"; view: TikTokStatusView };

export interface TikTokConnection {
  state: TikTokPanelState;
  busy: TikTokBusy;
  notice: TikTokNotice | null;
  canManage: boolean;
  connect(): Promise<void>;
  refresh(): Promise<void>;
  disconnect(): Promise<void>;
  dismissNotice(): void;
}

const OUTCOME_NOTICE: Record<TikTokCallbackOutcome, TikTokNotice> = {
  connected: { variant: "info", text: "TikTok authorization received. LiveLift stored it on the server and read your TikTok profile." },
  denied: { variant: "warning", text: "TikTok authorization was cancelled or denied. Nothing was connected." },
  state_invalid: { variant: "warning", text: "That TikTok sign-in could not be matched to a request started from this browser, so it was ignored. Start again from Connect TikTok." },
  forbidden: { variant: "danger", text: "The operator who started this TikTok sign-in can no longer do so. Nothing was connected." },
  not_configured: { variant: "warning", text: "TikTok is not set up on this deployment. Nothing was connected." },
  exchange_failed: { variant: "danger", text: "TikTok did not accept the authorization code. Nothing was connected. Start again from Connect TikTok." },
  credentials_rejected: { variant: "danger", text: "TikTok rejected this deployment's app credentials. Nothing was connected. Check the client key and secret in the server environment." },
  provider_unavailable: { variant: "warning", text: "TikTok could not be reached to finish the connection. Nothing was connected; this is not a decision by TikTok. Try again shortly." },
};

function outcomeFromLocation(): TikTokCallbackOutcome | null {
  try {
    const value = new URLSearchParams(window.location.search).get("tiktok");
    return value && (TIKTOK_CALLBACK_OUTCOMES as readonly string[]).includes(value) ? (value as TikTokCallbackOutcome) : null;
  } catch { return null; }
}
function clearOutcomeFromLocation(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("tiktok");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* the address bar keeps the code; harmless */ }
}

const defaultNavigate = (url: string): void => { window.location.assign(url); };

export function useTikTokConnection(client: TikTokClient = defaultClient, navigate: (url: string) => void = defaultNavigate): TikTokConnection {
  const auth = useAuth();
  const [state, setState] = useState<TikTokPanelState>({ kind: "checking" });
  const [busy, setBusy] = useState<TikTokBusy>(null);
  const [notice, setNotice] = useState<TikTokNotice | null>(null);
  const autoRefreshed = useRef<string | null>(null);
  const running = useRef(false);

  const session = auth.status === "authenticated" ? auth.session : null;
  const workspaceId = session?.workspaceId ?? null;
  const generation = session?.generation ?? null;
  const canManage = session?.access.role === "operator";

  useEffect(() => { authStore.ensureChecked(); }, []);
  // Coming back to this page from TikTok via the back button restores it from the bfcache still "Connecting".
  useEffect(() => {
    const onShow = (event: PageTransitionEvent): void => { if (event.persisted) { running.current = false; setBusy(null); } };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  useEffect(() => {
    const outcome = outcomeFromLocation();
    if (outcome) { setNotice(OUTCOME_NOTICE[outcome]); clearOutcomeFromLocation(); }
  }, []);

  const apply = useCallback((result: TikTokResult<TikTokStatusView>): void => {
    if (result.kind === "ok") setState({ kind: "loaded", view: result.value });
    else if (result.kind === "signed_out") { setState({ kind: "needs_sign_in" }); void authStore.refresh(); }
    else if (result.kind === "unavailable") setState({ kind: "server_unavailable", message: result.message });
    else if (result.kind === "rate_limited") setNotice({ variant: "warning", text: "TikTok checks are being limited right now. Try again in a few minutes." });
    else if (result.kind === "forbidden") setNotice({ variant: "warning", text: "Only operators can change the TikTok connection." });
    else setNotice({ variant: "warning", text: "TikTok is not set up on this deployment." });
  }, []);

  useEffect(() => {
    if (auth.status === "checking" || auth.status === "signing_in") { setState({ kind: "checking" }); return; }
    if (auth.status === "signed_out" || auth.status === "ended" || auth.status === "signing_out") { setState({ kind: "needs_sign_in" }); return; }
    if (auth.status === "unavailable") { setState({ kind: "server_unavailable", message: auth.unavailable?.message ?? "The server could not be reached." }); return; }
    if (!workspaceId || !generation) return;
    let cancelled = false;
    void client.getStatus({ workspaceId, generation }).then((result) => { if (!cancelled) apply(result); });
    return () => { cancelled = true; };
  }, [auth.status, auth.unavailable, workspaceId, generation, client, apply]);

  // One automatic re-read per page load when an operator opens a stale or doubtful connection.
  useEffect(() => {
    if (state.kind !== "loaded" || !canManage || !workspaceId || !generation || autoRefreshed.current === `${workspaceId}:${generation}`) return;
    const view = state.view;
    const connection = view.connection;
    const stale = connection !== null && (connection.profileFetchedAtMs === null || Date.now() - connection.profileFetchedAtMs > PROFILE_REFRESH_AFTER_MS);
    if ((view.state === "connected" || view.state === "unavailable") && (stale || view.state === "unavailable")) {
      autoRefreshed.current = `${workspaceId}:${generation}`;
      void client.refresh({ workspaceId, generation }).then(apply);
    }
  }, [state, canManage, workspaceId, generation, client, apply]);

  const guarded = useCallback(async (kind: Exclude<TikTokBusy, null>, work: () => Promise<void>): Promise<void> => {
    if (running.current || !canManage || !workspaceId || !generation) return;
    running.current = true;
    setBusy(kind);
    setNotice(null);
    try { await work(); } finally { running.current = false; setBusy(null); }
  }, [canManage, workspaceId, generation]);

  return {
    state, busy, notice, canManage,
    dismissNotice: () => setNotice(null),
    connect: () => guarded("connecting", async () => {
      const result = await client.connect({ workspaceId: workspaceId!, generation: generation! });
      // The page is being replaced by TikTok's own; "Connecting" stays on screen until it is gone.
      if (result.kind === "ok") { navigate(result.value.authorizeUrl); await new Promise(() => {}); return; }
      if (result.kind === "signed_out") apply({ kind: "signed_out" });
      else if (result.kind === "not_configured") setNotice({ variant: "warning", text: "TikTok is not set up on this deployment." });
      else if (result.kind === "rate_limited") setNotice({ variant: "warning", text: "Too many TikTok sign-in attempts. Wait a few minutes and try again." });
      else if (result.kind === "forbidden") setNotice({ variant: "warning", text: "Only operators can connect TikTok." });
      else setNotice({ variant: "danger", text: "TikTok sign-in could not be started. Nothing was connected." });
    }),
    refresh: () => guarded("refreshing", async () => { apply(await client.refresh({ workspaceId: workspaceId!, generation: generation! })); }),
    disconnect: () => guarded("disconnecting", async () => {
      const result = await client.disconnect({ workspaceId: workspaceId!, generation: generation! });
      apply(result);
      if (result.kind === "ok") {
        setNotice(result.value.lastRevocation === "confirmed"
          ? { variant: "info", text: "Disconnected. TikTok confirmed the authorization was revoked, and LiveLift erased its stored credentials." }
          : { variant: "warning", text: "Disconnected. LiveLift erased its stored credentials, but TikTok did not confirm the revocation. You can also remove LiveLift in TikTok under Settings and privacy > Security & permissions > Apps and services." });
      }
    }),
  };
}

const defaultClient = createTikTokClient();

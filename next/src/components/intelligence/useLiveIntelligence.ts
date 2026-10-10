"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { HistoricalEvidence } from "@/contracts/liveIntelligence";
import type { Session } from "@/contracts";
import type { Review } from "@/lib/domain";
import { authStore, type AuthState } from "@/lib/client/authStore";
import { createLiveIntelligenceClient, type LiveIntelligenceClient } from "@/lib/intelligence/client";
import { DEFAULT_FIXTURE_SCENARIO, fixtureResultFor, providerFixtureCase, type FixtureScenarioId } from "@/lib/intelligence/fixtures";
import type { LiveIntelligenceState, ProviderCapability } from "@/lib/intelligence/types";

const defaultClient = createLiveIntelligenceClient();

/** Who is signed in, read straight from the auth store (the same source `useAuth` reads). */
const useAuth = (): AuthState => useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getServerSnapshot);

export interface LiveIntelligenceView {
  state: LiveIntelligenceState;
  /** Read the server's answer again (any signed-in viewer). */
  reload: () => void;
  /** Ask the server to fetch again. Operators only; never touches the show. */
  refresh: (providerSessionId?: string) => void;
  canRefresh: boolean;
  refreshing: boolean;
}

/**
 * Where a show's later evidence comes from, told truthfully.
 *
 *   SIMULATED  stored server evidence when available; otherwise an explicitly labelled shared-core demo fixture.
 *   archive    a pre-Phase-2 REAL show kept in this browser: not in the room, so the server has nothing to look up.
 *   REAL       the server, once `enabled`. Nothing is requested before the operator opens a surface that needs it.
 *
 * The result is a value the UI renders as-is. A failure is "unknown", never an empty or zero result.
 */
export function useLiveIntelligence(opts: {
  session: Session | null;
  review: Review | null;
  enabled: boolean;
  archive?: boolean;
  scenario?: FixtureScenarioId;
  client?: LiveIntelligenceClient;
}): LiveIntelligenceView {
  const { session, review, enabled, archive = false, scenario = DEFAULT_FIXTURE_SCENARIO, client = defaultClient } = opts;
  const auth = useAuth();
  const [remote, setRemote] = useState<LiveIntelligenceState>({ kind: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const epoch = useRef(0);

  const authed = auth.status === "authenticated" ? auth.session : null;
  const workspaceId = authed?.workspaceId ?? null;
  const generation = authed?.generation ?? null;
  const canRefresh = authed?.access.role === "operator";
  const mode = !enabled ? "off" : session?.environment === "SIMULATED" ? "fixture" : archive ? "archive" : "remote";
  const id = session?.id ?? "";
  const environment = session?.environment ?? "REAL";
  const roomId = authed?.roomId ?? null;

  useEffect(() => { epoch.current += 1; setRemote({ kind: "idle" }); setRefreshing(false); }, [id, mode, scenario, workspaceId, generation]);

  useEffect(() => {
    if (mode === "remote" || mode === "fixture") authStore.ensureChecked();
  }, [mode]);

  useEffect(() => {
    if (mode !== "remote" && !(mode === "fixture" && auth.status === "authenticated" && scenario === "rich")) return;
    if (auth.status === "checking" || auth.status === "signing_in") {
      setRemote({ kind: "fetching" });
      return;
    }
    if (!workspaceId || !generation) {
      setRemote(
        auth.status === "unavailable"
          ? { kind: "unavailable", reason: "network", message: auth.unavailable?.message ?? "The server could not be reached." }
          : { kind: "signed_out" }
      );
      return;
    }
    const mine = ++epoch.current;
    setRemote({ kind: "fetching" });
    void client.getSnapshot({ workspaceId, generation }, { roomId: roomId!, sessionId: id, environment, ...(environment === "SIMULATED" && session ? { session } : {}) }).then((result) => {
      if (epoch.current === mine) setRemote(mode === "fixture" && (result.kind === "not_configured" || result.kind === "unavailable" && result.reason === "not_found") ? { kind: "idle" } : result);
    });
    return () => {
      epoch.current += 1;
    };
  }, [mode, auth.status, auth.unavailable, workspaceId, generation, id, environment, roomId, session, scenario, client, tick]);


  const fixture = useMemo<LiveIntelligenceState>(() => {
    if (mode !== "fixture" || !review) return { kind: "idle" };
    return (session ? fixtureResultFor(session, review, scenario) : null) ?? { kind: "idle" };
  }, [mode, review, session, scenario]);

  const refresh = useCallback((providerSessionId?: string): void => {
    if ((mode !== "remote" && mode !== "fixture") || !workspaceId || !generation || !roomId || !canRefresh || !session) return;
    const mine = ++epoch.current;
    setRefreshing(true);
    setRemote({ kind: "fetching" });
    void client.requestRefresh({ workspaceId, generation }, { commandId: crypto.randomUUID(), roomId, sessionId: id, expectedSessionRevision: session.revision, action: "post_live", productMappings: remote.kind === "available" ? remote.snapshot.productMappings : environment === "SIMULATED" ? session.products.slice(0, 1).map(p => ({ liveLiftProductId: p.id, providerProductId: "100001" })) : [],
      ...(environment === "SIMULATED" ? { session, fixtureCase: providerFixtureCase(scenario) } : { providerSessionId: providerSessionId ?? (remote.kind === "available" ? remote.snapshot.providerSessionId : undefined) }) }, environment).then((result) => {
      if (epoch.current !== mine) return;
      setRefreshing(false);
      setRemote(result);
    });
  }, [mode, workspaceId, generation, roomId, canRefresh, client, id, session, environment, scenario, remote]);

  const state: LiveIntelligenceState =
    mode === "off"
      ? { kind: "idle" }
      : mode === "fixture"
        ? (remote.kind === "idle" ? fixture : remote)
        : mode === "archive"
          ? { kind: "not_applicable", message: "This is a local archive. It is not in the shared room, so the server has no provider evidence to look up for it." }
          : // Opened but not yet answered is "fetching", never "not requested": the request starts in the same commit.
            remote.kind === "idle" || remote.kind === "available" && remote.snapshot.sessionId !== id
            ? { kind: "fetching" }
            : remote;

  return { state, reload: () => setTick((t) => t + 1), refresh, canRefresh: (mode === "remote" || mode === "fixture") && canRefresh, refreshing };
}

export type CapabilitiesView = { server: ProviderCapability[] | "unreachable" | null };

/** The server's statement of what it can offer. null until asked; asked only when `enabled` and signed in. */
export function useProviderCapabilities(enabled: boolean, client: LiveIntelligenceClient = defaultClient): CapabilitiesView {
  const auth = useAuth();
  const [server, setServer] = useState<CapabilitiesView["server"]>(null);
  const authed = auth.status === "authenticated" ? auth.session : null;
  const workspaceId = authed?.workspaceId ?? null;
  const generation = authed?.generation ?? null;

  useEffect(() => {
    if (enabled) authStore.ensureChecked();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !workspaceId || !generation) { setServer(null); return; }
    let cancelled = false;
    void client.getCapabilities({ workspaceId, generation }).then((r) => {
      if (cancelled) return;
      if (r.kind === "ok") setServer(r.capabilities);
      else if (r.kind === "not_configured") setServer([]);
      else setServer("unreachable");
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, workspaceId, generation, client]);

  return { server };
}

/** Read the server's historical path, which cannot contain post-LIVE snapshots. */
export function useHistoricalEvidence(session: Session, enabled: boolean): { state: "unchecked" | "fetching" | "available" | "unavailable"; evidence: HistoricalEvidence | null } {
  const auth = useAuth();
  const [loaded, setLoaded] = useState<{ key: string; evidence: HistoricalEvidence | null } | null>(null);
  const authed = auth.status === "authenticated" ? auth.session : null;
  const key = `${authed?.workspaceId}:${authed?.generation}:${session.id}:${session.revision}`;
  useEffect(() => {
    if (!enabled || !authed || session.runtime.endedAtMs === null) return;
    let cancelled = false;
    void defaultClient.getHistorical(authed, { roomId: authed.roomId, sessionId: session.id, environment: session.environment, ...(session.environment === "SIMULATED" ? { session } : {}) }, session.runtime.endedAtMs).then(evidence => { if (!cancelled) setLoaded({ key, evidence }); });
    return () => { cancelled = true; };
  }, [enabled, authed, session, key]);
  if (!enabled || !authed) return { state: "unchecked", evidence: null };
  if (!loaded || loaded.key !== key) return { state: "fetching", evidence: null };
  return { state: loaded.evidence ? "available" : "unavailable", evidence: loaded.evidence };
}

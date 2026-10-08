"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiRequest, AiRunState, AiStatusView, OperateAvailable, OperateResult, ReviewAvailable, ReviewResult } from "@/contracts/ai";
import { createAiClient, type AiCallResult, type AiClient } from "@/lib/client/aiClient";
import { authStore } from "@/lib/client/authStore";
import type { RequestContext } from "@/lib/client/productionTransport";
import { useAuth } from "@/lib/store/hooks";

/**
 * One Copilot surface's lifecycle, told truthfully.
 *
 * The phase is exactly one of: checking, signed_out, status_unavailable, not_configured, ready, generating,
 * available, unavailable, rate_limited, invalid_response. Nothing is generated until the operator asks (a model
 * call costs money and takes seconds), nothing is retried silently, and a failure never touches the show: the
 * desk and Review work the same in every phase.
 */

export type CopilotPhase = "checking" | "signed_out" | "status_unavailable" | AiRunState;

type Result<A> =
  | A
  | Exclude<OperateResult, { status: "available" }>
  | Exclude<ReviewResult, { status: "available" }>;

type Run<A> =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "available"; result: A }
  | { kind: "unavailable"; reason: string }
  | { kind: "rate_limited"; retryAfterSec: number | null }
  | { kind: "invalid_response"; reason: string }
  | { kind: "not_applicable"; message: string };

type StatusState = { kind: "loading" } | { kind: "loaded"; view: AiStatusView } | { kind: "unavailable"; message: string };

export interface AiCopilot<A> {
  phase: CopilotPhase;
  /** The configured model name, once known. Never a key or a URL. */
  model: string | null;
  /** Names of environment variables to fix when not configured. */
  configIssues: string[];
  /** Why the last attempt did not produce an answer (a short fixed code or message), when it did not. */
  failure: { reason: string | null; retryAfterSec: number | null } | null;
  result: A | null;
  /** This browser is a viewer: it can read the Copilot's surface but not ask it. */
  viewer: boolean;
  canAsk: boolean;
  ask: (request: AiRequest) => void;
  recheck: () => void;
}

const defaultClient = createAiClient();

function useCopilotCore<A extends { status: "available" }>(
  generate: (client: AiClient, context: RequestContext, request: AiRequest) => Promise<AiCallResult<Result<A>>>,
  opts: { enabled: boolean; resetKey: string; client?: AiClient }
): AiCopilot<A> {
  const client = opts.client ?? defaultClient;
  const auth = useAuth();
  const [status, setStatus] = useState<StatusState>({ kind: "loading" });
  const [run, setRun] = useState<Run<A>>({ kind: "idle" });
  const epoch = useRef(0);
  const running = useRef(false);
  const generateRef = useRef(generate);
  generateRef.current = generate;

  const session = auth.status === "authenticated" ? auth.session : null;
  const workspaceId = session?.workspaceId ?? null;
  const generation = session?.generation ?? null;
  const viewer = session?.access.role === "viewer";
  const [checks, setChecks] = useState(0);

  // Rehearsal-only pages never talk to the server unprompted. Opening the Copilot is the operator asking, so only then
  // is the sign-in state read (a no-op when something REAL already did).
  useEffect(() => {
    if (opts.enabled) authStore.ensureChecked();
  }, [opts.enabled]);

  // A different show is a different question: drop any answer, and ignore one still on its way.
  useEffect(() => {
    epoch.current += 1;
    running.current = false;
    setRun({ kind: "idle" });
  }, [opts.resetKey]);

  // Whether the server can run a Copilot at all. Only asked once the surface is actually opened.
  useEffect(() => {
    if (!opts.enabled || !workspaceId || !generation) return;
    let cancelled = false;
    setStatus({ kind: "loading" });
    void client.getStatus({ workspaceId, generation }).then((result) => {
      if (cancelled) return;
      if (result.kind === "ok") setStatus({ kind: "loaded", view: result.value });
      else if (result.kind === "signed_out") setStatus({ kind: "unavailable", message: "You are signed out." });
      else setStatus({ kind: "unavailable", message: result.kind === "unavailable" ? result.message : "The AI status could not be read." });
    });
    return () => {
      cancelled = true;
    };
  }, [opts.enabled, workspaceId, generation, client, checks]);

  const ready = status.kind === "loaded" && status.view.state === "ready";
  const canAsk = ready && !viewer && workspaceId !== null && generation !== null && run.kind !== "generating";

  const ask = useCallback(
    (request: AiRequest): void => {
      if (!canAsk || running.current || !workspaceId || !generation) return;
      running.current = true;
      const mine = epoch.current;
      setRun({ kind: "generating" });
      void generateRef.current(client, { workspaceId, generation }, request).then((outcome) => {
        if (epoch.current !== mine) return;
        running.current = false;
        if (outcome.kind === "ok") {
          const r = outcome.value;
          if (r.status === "available") setRun({ kind: "available", result: r as A });
          else if (r.status === "not_configured") {
            setStatus({ kind: "loaded", view: { state: "not_configured", model: null, configIssues: r.configIssues } });
            setRun({ kind: "idle" });
          } else if (r.status === "rate_limited") setRun({ kind: "rate_limited", retryAfterSec: r.retryAfterSec });
          else if (r.status === "unavailable") setRun({ kind: "unavailable", reason: r.reason });
          else setRun({ kind: "invalid_response", reason: r.reason });
        } else if (outcome.kind === "rate_limited") setRun({ kind: "rate_limited", retryAfterSec: outcome.retryAfterSec });
        else if (outcome.kind === "not_applicable") setRun({ kind: "not_applicable", message: outcome.message });
        else if (outcome.kind === "forbidden") setRun({ kind: "unavailable", reason: "forbidden" });
        else if (outcome.kind === "signed_out") setRun({ kind: "unavailable", reason: "signed_out" });
        else setRun({ kind: "unavailable", reason: "network" });
      });
    },
    [canAsk, client, workspaceId, generation]
  );

  let phase: CopilotPhase;
  if (auth.status === "checking" || auth.status === "signing_in") phase = "checking";
  else if (!session) phase = "signed_out";
  else if (status.kind === "loading") phase = "checking";
  else if (status.kind === "unavailable") phase = "status_unavailable";
  else if (status.view.state === "not_configured") phase = "not_configured";
  else if (run.kind === "idle") phase = "ready";
  else if (run.kind === "generating") phase = "generating";
  else if (run.kind === "available") phase = "available";
  else if (run.kind === "rate_limited") phase = "rate_limited";
  else if (run.kind === "invalid_response") phase = "invalid_response";
  else phase = "unavailable";

  return {
    phase,
    model: status.kind === "loaded" ? status.view.model : null,
    configIssues: status.kind === "loaded" ? status.view.configIssues : [],
    failure:
      run.kind === "unavailable" ? { reason: run.reason, retryAfterSec: null }
      : run.kind === "invalid_response" ? { reason: run.reason, retryAfterSec: null }
      : run.kind === "rate_limited" ? { reason: null, retryAfterSec: run.retryAfterSec }
      : run.kind === "not_applicable" ? { reason: run.message, retryAfterSec: null }
      : null,
    result: run.kind === "available" ? run.result : null,
    viewer,
    canAsk,
    ask,
    recheck: () => setChecks((n) => n + 1),
  };
}

/** The Operate Copilot. `enabled` = the surface is open (nothing is requested while it is closed). */
export function useOperateCopilot(opts: { enabled: boolean; resetKey: string; client?: AiClient }): AiCopilot<OperateAvailable> {
  return useCopilotCore<OperateAvailable>((client, context, request) => client.operate(context, request), opts);
}

export function useReviewCopilot(opts: { enabled: boolean; resetKey: string; client?: AiClient }): AiCopilot<ReviewAvailable> {
  return useCopilotCore<ReviewAvailable>((client, context, request) => client.review(context, request), opts);
}

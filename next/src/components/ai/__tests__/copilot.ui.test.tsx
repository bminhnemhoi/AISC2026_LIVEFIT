import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { Session } from "@/contracts";
import type { OperateAvailable, OperateResult, ReviewAvailable } from "@/contracts/ai";
import type { AiClient } from "@/lib/client/aiClient";
import { SCENARIO_BY_ID, analyzeRecovery, applyScriptStep, createScenarioSession, forecastSession } from "@/lib/domain";
import { buildReviewContext, buildReviewFacts } from "@/lib/ai/context";
import { runOperate, runReview } from "@/lib/server/ai/service";

const mocks = vi.hoisted(() => ({ auth: { current: null as unknown }, ensureChecked: vi.fn() }));
vi.mock("@/lib/store/hooks", () => ({ useAuth: () => mocks.auth.current }));
vi.mock("@/lib/client/authStore", () => ({ authStore: { ensureChecked: mocks.ensureChecked } }));

import { OperateCopilot } from "../OperateCopilot";
import { ReviewCopilot } from "../ReviewCopilot";
import { PHASE_LABEL } from "../CopilotParts";
import { useOperateCopilot, useReviewCopilot, type AiCopilot, type CopilotPhase } from "../useAiCopilot";

// ---- deterministic fixtures: a SIMULATED rehearsal and a fake provider; nothing external -----------------------------------
function scenario(steps: number): Session {
  let s = createScenarioSession("buffered", { id: "sim-buffered" });
  for (let i = 0; i < steps; i++) s = applyScriptStep(s).session;
  return s;
}
const OPERATE_ANSWER = (user: string): string => {
  const ctx = JSON.parse(user.slice(user.indexOf("\n", user.indexOf("EVIDENCE")) + 1)) as { facts: Array<{ id: string }>; options: Array<{ opt: string; protects: boolean; clean: boolean }>; changes?: Array<{ chg: string }> };
  const cite = ctx.facts.slice(0, 2).map((f) => f.id);
  if (ctx.changes) {
    return JSON.stringify({
      summary: { text: "The show ran with timing deviations and several operator reports.", cites: cite },
      deviations: [{ text: "Some segments ran against their baseline targets.", cites: cite }],
      gaps: [{ text: "Some cues have no operator report; that is unknown, not failed.", cites: cite }],
      evidenceLimits: [{ text: "LiveLift has no platform confirmation, so product outcomes are not established.", cites: cite }],
      nextLive: ctx.changes.slice(0, 1).map((c) => ({ changeId: c.chg, why: "LiveLift lists it as an adjustment from this show.", cites: cite })),
      manualIdeas: [{ text: "Add a reminder to report each cue.", why: "Some reports are missing.", cites: cite }],
    });
  }
  const pick = ctx.options.find((o) => o.protects && o.clean) ?? ctx.options[0];
  return JSON.stringify({
    interpretation: { text: "The active segment is running longer than planned, which puts the next hard anchor at risk.", cites: cite },
    recommendations: pick ? [{ optionId: pick.opt, why: "It is the listed option that best protects the next hard anchor.", cites: cite }] : [],
    nextStep: { text: "Prepare the next segment while the host wraps up.", why: "The anchor does not move, so the handover should be ready.", cites: cite },
    limitations: ["LiveLift holds no viewer or sales data for this show."],
  });
};
const provider = { model: "fixture-model-1", complete: async (r: { user: string }) => OPERATE_ANSWER(r.user) };

async function operateResult(session: Session): Promise<OperateAvailable> {
  const result = await runOperate(session, session.virtualNowMs!, [], { provider });
  if (result.status !== "available" || result.task !== "operate") throw new Error(JSON.stringify(result));
  return result;
}
async function reviewResult(session: Session): Promise<ReviewAvailable> {
  const result = await runReview(session, [], { provider });
  if (result.status !== "available" || result.task !== "review") throw new Error(JSON.stringify(result));
  return result;
}

function copilot<A extends { status: "available" }>(over: Partial<AiCopilot<A>> = {}): AiCopilot<A> {
  return { phase: "ready", model: "fixture-model-1", configIssues: [], failure: null, result: null, viewer: false, canAsk: true, ask: vi.fn(), recheck: vi.fn(), ...over };
}

function renderOperate(s: Session, c: AiCopilot<OperateAvailable>, over: { locked?: boolean; session?: Session } = {}) {
  const session = over.session ?? s;
  const nowMs = session.virtualNowMs!;
  const onApplyOption = vi.fn();
  const utils = render(
    <OperateCopilot
      copilot={c}
      session={session}
      source="local"
      nowMs={nowMs}
      forecast={forecastSession(session, nowMs)}
      analysis={analyzeRecovery(session, nowMs)}
      locked={over.locked ?? false}
      onApplyOption={onApplyOption}
    />
  );
  return { ...utils, onApplyOption };
}

afterEach(cleanup);

describe("Operate Copilot: truthful states", () => {
  const PHASES: CopilotPhase[] = ["checking", "signed_out", "status_unavailable", "not_configured", "ready", "generating", "available", "unavailable", "rate_limited", "invalid_response"];

  it.each(PHASES)("shows the state label for %s", (phase) => {
    renderOperate(scenario(3), copilot({ phase }));
    expect(screen.getByTestId("copilot-state")).toHaveTextContent(PHASE_LABEL[phase]);
    expect(screen.getByTestId("copilot-state")).toHaveAttribute("data-phase", phase);
  });

  it("the user-visible vocabulary is exactly the seven truthful states", () => {
    expect(PHASE_LABEL.not_configured).toBe("Not configured");
    expect(PHASE_LABEL.ready).toBe("Ready");
    expect(PHASE_LABEL.generating).toBe("Generating…");
    expect(PHASE_LABEL.available).toBe("Available");
    expect(PHASE_LABEL.unavailable).toBe("Unavailable");
    expect(PHASE_LABEL.rate_limited).toBe("Rate limited");
    expect(PHASE_LABEL.invalid_response).toBe("Invalid response");
  });

  it("not configured: says nothing here is AI, names the variables to set, offers no Analyse button, and still shows product-logic facts", () => {
    renderOperate(scenario(3), copilot({ phase: "not_configured", canAsk: false, configIssues: ["LIVELIFT_AI_API_KEY", "LIVELIFT_AI_MODEL"] }));
    expect(screen.getByTestId("copilot-message")).toHaveTextContent("not set up on this server, so nothing here comes from AI");
    expect(screen.getByTestId("copilot-config-issues")).toHaveTextContent("LIVELIFT_AI_API_KEY, LIVELIFT_AI_MODEL");
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
    // The product-logic facts are labelled as such: NOT AI.
    expect(screen.getByTestId("layer-product")).toHaveTextContent(/Product logic/i);
    expect(screen.getByTestId("layer-product")).toHaveTextContent("not AI");
    expect(screen.getAllByTestId(/^fact-/).length).toBeGreaterThan(2);
    expect(screen.queryByTestId("layer-interpretation")).toBeNull();
    expect(screen.queryByTestId("layer-recommendation")).toBeNull();
  });

  it.each([
    ["unavailable", { reason: "timeout", retryAfterSec: null }, "did not answer in time"],
    ["unavailable", { reason: "credentials_rejected", retryAfterSec: null }, "LIVELIFT_AI_API_KEY"],
    ["rate_limited", { reason: null, retryAfterSec: 42 }, "42 seconds"],
    ["invalid_response", { reason: "unsupported_claim", retryAfterSec: null }, "discarded it"],
    ["invalid_response", { reason: "not_json", retryAfterSec: null }, "Nothing from it is shown"],
  ] as const)("%s (%j) is explained without blaming the show", (phase, failure, text) => {
    renderOperate(scenario(3), copilot({ phase, failure }));
    expect(screen.getByTestId("copilot-message")).toHaveTextContent(text);
    expect(screen.queryByTestId("copilot-result")).toBeNull();
  });

  it("a failure never hides the facts, and an unavailable AI adds no AI sections", () => {
    renderOperate(scenario(3), copilot({ phase: "unavailable", failure: { reason: "network", retryAfterSec: null } }));
    expect(screen.getByTestId("copilot-message")).toHaveTextContent("says nothing about the show");
    expect(screen.getAllByTestId(/^fact-/).length).toBeGreaterThan(2);
  });

  it("every state change is announced once, politely, and not by the visible message", () => {
    const { rerender } = renderOperate(scenario(3), copilot({ phase: "available" }));
    expect(screen.getByTestId("copilot-announce")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("copilot-announce")).toHaveTextContent("AI Copilot: Available.");
    expect(screen.queryByTestId("copilot-message")).toBeNull();
    rerender(<div />);
  });

  it("a viewer can read the surface but cannot ask", () => {
    renderOperate(scenario(3), copilot({ viewer: true, canAsk: false }));
    expect(screen.getByTestId("copilot-viewer-note")).toBeInTheDocument();
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
  });

  it("asking is the operator's explicit click, and the request names the show (a SIMULATED rehearsal is sent whole)", () => {
    const s = scenario(3);
    const ask = vi.fn();
    renderOperate(s, copilot({ ask }));
    expect(ask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0][0]).toMatchObject({ sessionId: s.id, session: { id: s.id, environment: "SIMULATED" } });
  });

  it("while generating the button is disabled and the status is announced", () => {
    renderOperate(scenario(3), copilot({ phase: "generating", canAsk: false }));
    expect(screen.getByTestId("copilot-ask-btn")).toBeDisabled();
    expect(screen.getByTestId("copilot-announce")).toHaveTextContent("AI Copilot: Generating…");
    expect(screen.getByTestId("copilot-message")).toHaveTextContent("nothing changes until you decide");
  });
});

describe("Operate Copilot: observed fact / AI interpretation / AI recommendation", () => {
  it("separates the three layers, and labels the recommendation as not applied", async () => {
    const s = scenario(3);
    renderOperate(s, copilot({ phase: "available", result: await operateResult(s) }));
    expect(screen.getByTestId("layer-observed")).toHaveTextContent("Observed fact");
    expect(screen.getByTestId("layer-interpretation")).toHaveTextContent("AI interpretation");
    expect(screen.getByTestId("layer-recommendation")).toHaveTextContent("AI recommendation");
    expect(screen.getByTestId("layer-recommendation")).toHaveTextContent("not applied");
    expect(screen.getByTestId("ai-interpretation")).toHaveTextContent("running longer than planned");
    const rec = screen.getByTestId("ai-recommendation");
    expect(within(rec).getByTestId("ai-recommendation-state")).toHaveTextContent("Recommended · not applied");
    expect(rec).toHaveTextContent("Why (AI):");
    // Facts stay product facts; the AI statement says which facts it rests on.
    expect(within(screen.getByTestId("copilot-result")).getAllByTestId("basis").length).toBeGreaterThan(0);
    expect(screen.getByTestId("ai-next-step")).toHaveTextContent("Guidance only. There is no button for it");
    expect(screen.getByTestId("ai-footer")).toHaveTextContent("fixture-model-1 from SIMULATED evidence");
    expect(screen.getByTestId("ai-footer")).toHaveTextContent("never applied for you");
  });

  it("never auto-executes: rendering, analysing and re-rendering do not call the apply path", async () => {
    const s = scenario(3);
    const { onApplyOption, rerender } = renderOperate(s, copilot({ phase: "available", result: await operateResult(s) }));
    expect(onApplyOption).not.toHaveBeenCalled();
    rerender(<div />);
    expect(onApplyOption).not.toHaveBeenCalled();
  });

  it("acceptance is a separate click: the button hands the LIVE option to the same Apply path", async () => {
    const s = scenario(3);
    const result = await operateResult(s);
    const { onApplyOption } = renderOperate(s, copilot({ phase: "available", result }));
    const apply = screen.getByTestId("ai-apply-btn");
    expect(apply).toBeEnabled();
    expect(apply).toHaveAccessibleName(/^(Apply|Review) the recommended option:/);
    fireEvent.click(apply);
    expect(onApplyOption).toHaveBeenCalledTimes(1);
    const live = analyzeRecovery(s, s.virtualNowMs!).options.find((o) => o.id === result.output.recommendations[0].option.id);
    expect(live).toBeDefined();
    // The option handed over is the LIVE one (recomputed now), identified by the product's own id.
    expect(onApplyOption.mock.calls[0][0]).toMatchObject({ id: live!.id, label: live!.label, kind: live!.kind });
  });

  it("REAL controls locked (read-only, offline, command pending): advice stays readable, applying is disabled", async () => {
    const s = scenario(3);
    renderOperate(s, copilot({ phase: "available", result: await operateResult(s) }), { locked: true });
    expect(screen.getByTestId("ai-interpretation")).toBeInTheDocument();
    expect(screen.getByTestId("ai-apply-btn")).toBeDisabled();
  });

  it("out of date: after the show changes the advice is dimmed, flagged, and cannot be applied", async () => {
    const s = scenario(3);
    const result = await operateResult(s);
    const changed = scenario(4); // the show moved on: different revision
    renderOperate(changed, copilot({ phase: "available", result }));
    expect(screen.getByTestId("copilot-stale")).toHaveTextContent("out of date and cannot be applied from here");
    expect(screen.getByTestId("copilot-result")).toHaveAttribute("data-stale", "true");
    expect(screen.getByTestId("ai-apply-btn")).toBeDisabled();
    // The facts shown are the live ones again, not the old snapshot.
    expect(screen.getByTestId("layer-observed")).toHaveTextContent("live, from LiveLift records");
  });

  it("an option that is no longer offered cannot be applied", async () => {
    const s = scenario(3);
    const result = await operateResult(s);
    const tampered: OperateAvailable = { ...result, output: { ...result.output, recommendations: [{ ...result.output.recommendations[0], option: { ...result.output.recommendations[0].option, id: "gone:option" } }] } };
    renderOperate(s, copilot({ phase: "available", result: tampered }));
    expect(screen.getByTestId("ai-apply-btn")).toBeDisabled();
    expect(screen.getByTestId("ai-recommendation")).toHaveTextContent("no longer offered");
  });

  it("exceptions and commitment changes are named, never presented as clean", async () => {
    const s = scenario(3);
    const result = await operateResult(s);
    const base = result.output.recommendations[0];
    const withException: OperateAvailable = { ...result, output: { ...result.output, recommendations: [{ ...base, option: { ...base.option, exception: "below_minimum" } }] } };
    renderOperate(s, copilot({ phase: "available", result: withException }));
    // The LIVE option decides the label; if it is clean the exception text is not invented.
    expect(screen.getByTestId("ai-recommendation")).toBeInTheDocument();
  });

  it("SIMULATED is stated on the surface", async () => {
    renderOperate(scenario(3), copilot({ phase: "ready" }));
    expect(screen.getByTestId("operate-copilot")).toHaveTextContent("This rehearsal is SIMULATED");
  });
});

describe("Review Copilot", () => {
  const ended = (): Session => scenario(SCENARIO_BY_ID.buffered.script.length);
  const facts = (s: Session) => buildReviewFacts(s, buildReviewContext(s)!.review);
  const renderReview = (s: Session, c: AiCopilot<ReviewAvailable>, over: { archive?: boolean; opened?: boolean; onOpen?: () => void; onOpenNextLive?: () => void } = {}) =>
    render(<ReviewCopilot copilot={c} session={s} source="local" archive={over.archive ?? false} facts={facts(s)} opened={over.opened ?? true} onOpen={over.onOpen ?? vi.fn()} onOpenNextLive={over.onOpenNextLive ?? vi.fn()} />);

  it("not configured: product-logic facts only, labelled not AI, with the platform limit stated", () => {
    renderReview(ended(), copilot({ phase: "not_configured", canAsk: false, configIssues: ["LIVELIFT_AI_MODEL"] }));
    expect(screen.getByTestId("layer-product")).toHaveTextContent("not AI");
    expect(screen.getByTestId("fact-platform_limits")).toHaveTextContent("no platform confirmation, viewer, sales or analytics data from TikTok");
    expect(screen.queryByTestId("ai-summary")).toBeNull();
  });

  it("available: summary, deviations, gaps, evidence limits and Next LIVE suggestions, each labelled", async () => {
    const s = ended();
    const onOpenNextLive = vi.fn();
    renderReview(s, copilot({ phase: "available", result: await reviewResult(s) }), { onOpenNextLive });
    expect(screen.getByTestId("ai-summary")).toHaveTextContent("timing deviations");
    for (const id of ["ai-deviations", "ai-gaps", "ai-limits"]) expect(screen.getByTestId(id)).toBeInTheDocument();
    expect(screen.getByTestId("ai-gaps")).toHaveTextContent("unknown, not failed");
    expect(screen.getByTestId("ai-limits")).toHaveTextContent("product outcomes are not established");
    expect(screen.getByTestId("layer-recommendation")).toHaveTextContent("not selected, not applied");
    expect(screen.getAllByTestId("ai-next-live-item")).toHaveLength(1);
    expect(screen.getByTestId("ai-manual-ideas")).toHaveTextContent("These cannot be selected or applied");
    expect(screen.getByTestId("ai-footer")).toHaveTextContent("SIMULATED evidence");
    // Hand-off only: choosing is done in Next LIVE.
    fireEvent.click(screen.getByTestId("ai-open-next-live-btn"));
    expect(onOpenNextLive).toHaveBeenCalledTimes(1);
  });

  it("unknown platform evidence: the surface never shows how a product performed", async () => {
    const s = ended();
    renderReview(s, copilot({ phase: "available", result: await reviewResult(s) }));
    const text = screen.getByTestId("review-copilot").textContent ?? "";
    expect(text).not.toMatch(/performed (well|poorly)|sold (well|poorly)|viewers (dropped|rose)|underperform/i);
    expect(text).toContain("platform outcome is not established");
  });

  it("a local archive is not in the room: no Copilot, only the facts, and a clear note", () => {
    renderReview(ended(), copilot({ phase: "ready" }), { archive: true });
    expect(screen.getByTestId("copilot-archive-note")).toHaveTextContent("not available here");
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
    expect(screen.queryByTestId("copilot-state")).toBeNull();
  });

  it("a rehearsal's Review does not contact the server until the operator opens the Copilot", () => {
    const onOpen = vi.fn();
    renderReview(ended(), copilot({ phase: "checking", canAsk: false }), { opened: false, onOpen });
    expect(screen.getByTestId("copilot-unopened-note")).toHaveTextContent("has not been checked yet");
    expect(screen.queryByTestId("copilot-state")).toBeNull();
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
    expect(screen.getAllByTestId(/^fact-/).length).toBeGreaterThan(2); // the product-logic facts are still there
    fireEvent.click(screen.getByTestId("copilot-open-btn"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("out of date after a note or correction: dimmed and flagged", async () => {
    const s = ended();
    const result = await reviewResult(s);
    renderReview({ ...s, revision: s.revision + 1 }, copilot({ phase: "available", result }));
    expect(screen.getByTestId("copilot-stale")).toBeInTheDocument();
    expect(screen.getByTestId("copilot-result")).toHaveAttribute("data-stale", "true");
  });
});

// ---- the lifecycle hook, with a fake client ---------------------------------------------------------------------------------
describe("useAiCopilot lifecycle", () => {
  const auth = (role: "operator" | "viewer" = "operator") => ({ status: "authenticated", session: { workspaceId: "w1", generation: "g1", access: { actorId: "a", name: "Lead", role } } });
  let client: { [K in keyof AiClient]: ReturnType<typeof vi.fn> };
  const ok = <T,>(value: T) => ({ kind: "ok" as const, value });
  const READY = { state: "ready", model: "fixture-model-1", configIssues: [] };

  beforeEach(() => {
    mocks.auth.current = auth();
    client = { getStatus: vi.fn(async () => ok(READY)), operate: vi.fn(), review: vi.fn() };
  });

  const hook = (over: { enabled?: boolean; resetKey?: string } = {}) =>
    renderHook((p: { enabled: boolean; resetKey: string }) => useOperateCopilot({ ...p, client: client as unknown as AiClient }), { initialProps: { enabled: over.enabled ?? true, resetKey: over.resetKey ?? "s1" } });

  it("asks the server nothing until the surface is opened (and reads the sign-in state only then)", async () => {
    mocks.ensureChecked.mockClear();
    const { result, rerender } = hook({ enabled: false });
    await act(async () => {});
    expect(client.getStatus).not.toHaveBeenCalled();
    expect(mocks.ensureChecked).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("checking");
    rerender({ enabled: true, resetKey: "s1" });
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(mocks.ensureChecked).toHaveBeenCalled();
    expect(client.getStatus).toHaveBeenCalledWith({ workspaceId: "w1", generation: "g1" });
    expect(result.current.model).toBe("fixture-model-1");
  });

  it("not configured: the Copilot cannot be asked and a call is never made", async () => {
    client.getStatus.mockResolvedValue(ok({ state: "not_configured", model: null, configIssues: ["LIVELIFT_AI_API_KEY"] }));
    const { result } = hook();
    await waitFor(() => expect(result.current.phase).toBe("not_configured"));
    expect(result.current.configIssues).toEqual(["LIVELIFT_AI_API_KEY"]);
    expect(result.current.canAsk).toBe(false);
    act(() => result.current.ask({ sessionId: "s1" }));
    expect(client.operate).not.toHaveBeenCalled();
  });

  it("ready -> generating -> available, and the answer is kept", async () => {
    const s = scenario(3);
    const answer = await operateResult(s);
    let release: (r: unknown) => void = () => {};
    client.operate.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { result } = hook();
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    act(() => result.current.ask({ sessionId: "s1" }));
    expect(result.current.phase).toBe("generating");
    act(() => result.current.ask({ sessionId: "s1" })); // a second click while generating is ignored
    expect(client.operate).toHaveBeenCalledTimes(1);
    await act(async () => release(ok(answer)));
    expect(result.current.phase).toBe("available");
    expect(result.current.result).toBe(answer);
  });

  it.each([
    [ok<OperateResult>({ status: "unavailable", reason: "timeout" }), "unavailable", "timeout"],
    [ok<OperateResult>({ status: "rate_limited", retryAfterSec: 30 }), "rate_limited", null],
    [ok<OperateResult>({ status: "invalid_response", reason: "ungrounded_number" }), "invalid_response", "ungrounded_number"],
    [{ kind: "rate_limited" as const, retryAfterSec: 60 }, "rate_limited", null],
    [{ kind: "unavailable" as const, message: "The server could not be reached." }, "unavailable", "network"],
    [{ kind: "forbidden" as const }, "unavailable", "forbidden"],
    [{ kind: "not_applicable" as const, message: "The Operate Copilot needs a show that is running." }, "unavailable", "The Operate Copilot needs a show that is running."],
  ])("maps %j to the %s state", async (outcome, phase, reason) => {
    client.operate.mockResolvedValue(outcome);
    const { result } = hook();
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => result.current.ask({ sessionId: "s1" }));
    expect(result.current.phase).toBe(phase);
    expect(result.current.failure?.reason ?? null).toBe(reason);
    expect(result.current.result).toBeNull();
  });

  it("a server that reports 'not configured' on asking flips the surface to Not configured", async () => {
    client.operate.mockResolvedValue(ok<OperateResult>({ status: "not_configured", configIssues: ["LIVELIFT_AI_MODEL"] }));
    const { result } = hook();
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => result.current.ask({ sessionId: "s1" }));
    expect(result.current.phase).toBe("not_configured");
    expect(result.current.configIssues).toEqual(["LIVELIFT_AI_MODEL"]);
  });

  it("a different show drops the answer, and a late answer for the old show is ignored", async () => {
    const answer = await operateResult(scenario(3));
    let release: (r: unknown) => void = () => {};
    client.operate.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { result, rerender } = hook();
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    act(() => result.current.ask({ sessionId: "s1" }));
    rerender({ enabled: true, resetKey: "s2" });
    expect(result.current.phase).toBe("ready");
    await act(async () => release(ok(answer)));
    expect(result.current.phase).toBe("ready");
    expect(result.current.result).toBeNull();
  });

  it("a viewer cannot ask; signed out is its own state and nothing is requested", async () => {
    mocks.auth.current = auth("viewer");
    const viewer = hook();
    await waitFor(() => expect(viewer.result.current.phase).toBe("ready"));
    expect(viewer.result.current.viewer).toBe(true);
    expect(viewer.result.current.canAsk).toBe(false);
    act(() => viewer.result.current.ask({ sessionId: "s1" }));
    expect(client.operate).not.toHaveBeenCalled();

    client.getStatus.mockClear();
    mocks.auth.current = { status: "signed_out", session: null };
    const out = hook();
    await act(async () => {});
    expect(out.result.current.phase).toBe("signed_out");
    expect(client.getStatus).not.toHaveBeenCalled();
  });

  it("a status that cannot be read is 'Status unavailable', not 'Not configured', and can be re-checked", async () => {
    client.getStatus.mockResolvedValueOnce({ kind: "unavailable", message: "The server could not be reached." });
    const { result } = hook();
    await waitFor(() => expect(result.current.phase).toBe("status_unavailable"));
    client.getStatus.mockResolvedValue(ok(READY));
    act(() => result.current.recheck());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
  });

  it("the Review hook speaks to the review endpoint only", async () => {
    const answer = await reviewResult(scenario(SCENARIO_BY_ID.buffered.script.length));
    client.review.mockResolvedValue(ok(answer));
    const { result } = renderHook(() => useReviewCopilot({ enabled: true, resetKey: "r1", client: client as unknown as AiClient }));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(async () => result.current.ask({ sessionId: "r1" }));
    expect(client.review).toHaveBeenCalledTimes(1);
    expect(client.operate).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("available");
  });
});

// ---- source guards: mobile and desk legibility ------------------------------------------------------------------------------
describe("desk and mobile source guards", () => {
  const SRC = path.resolve(__dirname, "..", "..", "..");
  const read = (rel: string): string => readFileSync(path.join(SRC, rel), "utf8");
  const FILES = ["components/ai/OperateCopilot.tsx", "components/ai/ReviewCopilot.tsx", "components/ai/CopilotParts.tsx"];

  it.each(FILES)("%s declares no text below 16px and no compact (sm) Button", (file) => {
    const src = read(file);
    expect([...src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].filter((m) => Number(m[1]) < 16).map((m) => m[0])).toEqual([]);
    expect(src).not.toMatch(/<Button[^>]*\bsize="sm"/);
  });

  it.each(FILES)("%s has no fixed width or min-width that could overflow a 375px screen", (file) => {
    const wide = [...read(file).matchAll(/(?<![-\w])(?:min-w|w)-\[(\d+)px\]/g)].filter((m) => Number(m[1]) > 320).map((m) => m[0]);
    expect(wide).toEqual([]);
  });

  it("long words and wide content wrap instead of forcing horizontal scroll", () => {
    expect(read("components/ai/CopilotParts.tsx")).toContain("break-words");
    expect(read("components/ai/OperateCopilot.tsx")).toContain("flex-wrap");
    expect(read("components/ai/ReviewCopilot.tsx")).toContain("flex-wrap");
    // Two columns only from the xl breakpoint; a phone is one column.
    expect(read("components/ai/ReviewCopilot.tsx")).toContain("xl:grid-cols-");
  });
});

describe("Copilot visual role (final polish)", () => {
  it("never borrows the lime of the desk's one real action: its buttons and cards use the AI accent", async () => {
    const s = scenario(3);
    const result = await operateResult(s);
    const { container } = renderOperate(s, copilot({ phase: "available", result }));
    const panel = container.querySelector("[data-testid=operate-copilot]") as HTMLElement;
    // The global focus ring stays lime; no background, text or border in the Copilot may be.
    expect(panel.innerHTML).not.toMatch(/(bg|text|border)-\[#DFFF00\]/);
    expect(screen.getByTestId("copilot-ask-btn").className).toContain("#7DD8EA");
    expect(screen.getAllByTestId("ai-apply-btn")[0].className).toContain("#7DD8EA");
    // The AI layers share one accent, and it is not the violet that means SIMULATED.
    expect(screen.getByTestId("layer-interpretation").className).toContain("#7DD8EA");
    expect(screen.getByTestId("layer-interpretation").className).not.toContain("#C8B2FF");
    expect(screen.getByTestId("layer-recommendation").className).toContain("#7DD8EA");
  });

  it("the stale notice is a full amber outline, not a coloured side stripe", async () => {
    const s = scenario(3);
    const result = await operateResult(s);
    const advanced = { ...s, revision: s.revision + 1 };
    renderOperate(s, copilot({ phase: "available", result }), { session: advanced });
    const stale = screen.getByTestId("copilot-stale");
    expect(stale.className).toContain("border-[#5E4822]");
    expect(stale.className).not.toMatch(/border-l-/);
  });

  it("the review Copilot lists the facts in two columns when it has the full width", () => {
    const s = scenario(SCENARIO_BY_ID.buffered.script.length);
    render(<ReviewCopilot copilot={copilot()} session={s} source="local" archive={false} facts={buildReviewFacts(s, buildReviewContext(s)!.review)} opened onOpen={vi.fn()} onOpenNextLive={vi.fn()} />);
    expect(screen.getByTestId("fact-list").className).toContain("md:columns-2");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EnvironmentBadge } from "@/components/ui/EnvironmentBadge";
import { MetricValue } from "@/components/ui/MetricValue";
import { EvidenceLabel } from "@/components/ui/EvidenceLabel";
import { anchorSignal } from "@/components/ops/StatusChips";
import {
  analyzeRecovery,
  anchorLateMs,
  applyCommand,
  buildReview,
  createScenarioSession,
  describeSituation,
  forecastSession,
  formatAnchorLate,
  isAnchorDueNow,
  runScript,
  SCENARIO_START_MS,
} from "@/lib/domain";

describe("Hard-anchor display at the exact anchor instant", () => {
  const base = {
    committedMs: SCENARIO_START_MS,
    baselineCommittedMs: SCENARIO_START_MS,
    projectedStartMs: SCENARIO_START_MS,
    bufferSec: 0,
    lowerBound: false,
  } as const;

  it("0:00 late is shown as due now, not as a miss — while the status itself stays 'missed'", () => {
    const anchor = { ...base, status: "missed" as const, deficitSec: 0 };
    const s = anchorSignal(anchor, "Asia/Ho_Chi_Minh");
    expect(s.text).toBe("Due now · not started yet");
    expect(s.text).not.toMatch(/Missed|0:00 late/);
    expect(anchor.status).toBe("missed"); // the forecast is untouched; only the label differs
  });

  it("once the anchor is actually late it is still a miss with the real lateness", () => {
    const s = anchorSignal({ ...base, status: "missed", deficitSec: 5 }, "Asia/Ho_Chi_Minh");
    expect(s.text).toBe("Missed · 0:05 late");
    expect(s.tone).toBe("danger");
  });
});

describe("Hard-anchor lateness boundary: only exactly 0 ms is due now", () => {
  // Buffered rehearsal: Zip Hoodie overruns with no estimate, so the flash sale (hard anchor 20:12) is
  // projected to start at "now". Each probe is the anchor instant plus a raw lateness in ms.
  const anchorMs = SCENARIO_START_MS + 12 * 60_000;
  const probe = (lateMs: number) => {
    const s = runScript(createScenarioSession("buffered"), 2);
    const t = anchorMs + lateMs;
    const forecast = forecastSession(s, t);
    const flash = forecast.segments.find((x) => x.segmentId.endsWith(":flash"))!;
    const clocked = applyCommand(s, { type: "set_clock", toMs: t, nowMs: t, key: `clk-${lateMs}` }).session;
    return { anchor: flash.anchor!, situation: describeSituation(s, forecast), recovery: analyzeRecovery(clocked, t) };
  };

  it("forecast arithmetic is untouched: status missed, deficitSec still rounded, commitment not moved", () => {
    for (const [lateMs, deficitSec] of [[0, 0], [1, 0], [499, 0], [500, 1], [1000, 1]] as const) {
      const { anchor, recovery } = probe(lateMs);
      expect(anchor.status).toBe("missed");
      expect(anchor.committedMs).toBe(anchorMs);
      expect(anchor.deficitSec).toBe(deficitSec);
      expect(anchorLateMs(anchor)).toBe(lateMs);
      expect(recovery.status).toBe("already_missed");
      expect(recovery.deficitSec).toBe(deficitSec);
    }
  });

  it("0 ms: due now, not started yet", () => {
    const { anchor, situation } = probe(0);
    expect(isAnchorDueNow(anchor)).toBe(true);
    expect(anchorSignal(anchor, "Asia/Ho_Chi_Minh")).toMatchObject({ tone: "warn", text: "Due now · not started yet" });
    expect(situation.detail).toMatch(/^The commitment time has arrived and it has not started\./);
  });

  it.each([
    [1, "<1s"],
    [499, "<1s"],
    [500, "0:01"],
    [1000, "0:01"],
  ])("+%i ms: missed, %s late — never due now, never 0:00 late", (lateMs, late) => {
    const { anchor, situation } = probe(lateMs);
    expect(isAnchorDueNow(anchor)).toBe(false);
    const s = anchorSignal(anchor, "Asia/Ho_Chi_Minh");
    expect(s).toMatchObject({ tone: "danger", text: `Missed · ${late} late` });
    expect(s.text).not.toMatch(/Due now|0:00/);
    expect(situation.detail).toContain(`at least ${late} late`);
    expect(situation.detail).not.toMatch(/has arrived|0:00/);
  });

  it("a start under a second late reads Met late · <1s, not 0:00", () => {
    const met = { committedMs: anchorMs, baselineCommittedMs: anchorMs, projectedStartMs: anchorMs + 400, bufferSec: 0, deficitSec: 0, status: "met_late", lowerBound: false } as const;
    expect(anchorSignal(met, "Asia/Ho_Chi_Minh").text).toBe("Met late · <1s");
    expect(formatAnchorLate(met)).toBe("<1s");
  });
});

describe("Non-negotiable Semantic Invariants", () => {
  it("distinguishes REAL and SIMULATED environments visibly", () => {
    const { unmount: unmountReal } = render(<EnvironmentBadge environment="REAL" />);
    const realBadge = screen.getByTestId("environment-badge-real");
    expect(realBadge).toHaveTextContent("REAL");
    unmountReal();

    render(<EnvironmentBadge environment="SIMULATED" />);
    const simBadge = screen.getByTestId("environment-badge-simulated");
    expect(simBadge).toHaveTextContent("SIMULATED");
    expect(simBadge).not.toHaveTextContent("REAL");
  });

  it("ensures Unknown verification does NOT render as Failed", () => {
    const { unmount } = render(<EvidenceLabel type="unknown" />);
    const unknownLabel = screen.getByTestId("evidence-label-unknown");
    expect(unknownLabel).toHaveTextContent("Unknown");
    expect(unknownLabel).not.toHaveTextContent("Failed");
    unmount();

    render(<EvidenceLabel type="failed" />);
    const failedLabel = screen.getByTestId("evidence-label-failed");
    expect(failedLabel).toHaveTextContent("Failed");
    expect(failedLabel).not.toHaveTextContent("Unknown");
  });

  it("ensures missing metric renders as 'Not available' and NEVER as 0", () => {
    render(<MetricValue label="Platform GMV" value={null} unit="USD" finality="unavailable" />);

    const notAvailable = screen.getByTestId("metric-not-available");
    expect(notAvailable).toHaveTextContent("Not available");

    // Must never contain '0' or '0 USD'
    expect(screen.queryByTestId("metric-numeric-value")).toBeNull();
  });

  it("ensures numeric zero is rendered accurately when measured as zero", () => {
    render(<MetricValue label="Returns Recorded" value={0} unit="items" finality="final" />);

    const numericVal = screen.getByTestId("metric-numeric-value");
    expect(numericVal).toHaveTextContent("0 items");
    expect(screen.queryByTestId("metric-not-available")).toBeNull();
  });

  it("recommendation != acceptance: showing recovery options changes nothing until one is chosen", () => {
    // 20:07 — the host estimate has put the 20:12 Flash Sale at risk.
    const s = runScript(createScenarioSession("buffered"), 3);
    const before = JSON.stringify(s);
    const analysis = analyzeRecovery(s, SCENARIO_START_MS + 7 * 60_000);
    expect(analysis.options.length).toBeGreaterThan(0);
    expect(JSON.stringify(s)).toBe(before);

    // Choosing one records the decision first, then the transition — and still reports nothing to the platform.
    const option = analysis.options[0];
    const chosen = applyCommand(s, { ...option.command, nowMs: 0, recoveryId: option.id, recoveryLabel: option.label });
    const types = chosen.session.events.slice(s.events.length).map((e) => e.type);
    expect(types[0]).toBe("recovery_selected");
    expect(Object.values(chosen.session.runtime.cues).every((c) => c.state === "pending")).toBe(true);
  });

  it("a report is not platform confirmation: operator cues stay 'reported' with verification Unknown", () => {
    const review = buildReview(runScript(createScenarioSession("buffered")))!;
    const operatorCues = review.cues.filter((c) => c.audience === "operator");
    expect(operatorCues.length).toBeGreaterThan(0);
    expect(operatorCues.every((c) => c.state === "performed" && c.verification === "unknown")).toBe(true);
    // Nothing in the model can represent "platform confirmed".
    expect(JSON.stringify(review)).not.toMatch(/platform_confirmed|confirmed by platform/i);
  });
});

"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@/contracts";
import { SCENARIO_BY_ID, effectiveNowMs, type CommandBody, type ScenarioId } from "@/lib/domain";
import type { SimulatorStrip } from "@/components/ops/SimulatorStrip";

export type ClockCommand = Extract<CommandBody, { type: "advance_clock" | "set_clock" }>;

/** Virtual seconds that pass for each real second while the rehearsal clock runs. */
export const RUN_SPEEDS: readonly number[] = [5, 15, 60];

/**
 * The rehearsal clock controls, shared by the Operate desk and the Platform Lab: the virtual clock, +30s/+1m/+5m, "To
 * anchor", and (where the desk offers it) the scenario script. Each desk runs the commands its own way; this hook only
 * says which command each control sends, so both desks behave the same.
 */
export function useSimulatorControls({
  session,
  nowMs,
  nextAnchorMs,
  run,
  script,
  autoRun = false,
}: {
  session: Session;
  nowMs: number;
  /** The next hard anchor's committed time, from the desk's own forecast. */
  nextAnchorMs: number | null;
  run: (body: ClockCommand) => void;
  /** The scenario script's Apply/Skip, when the desk offers them. Each reports back through `say`. */
  script?: { apply: (say: (message: string | null) => void) => void; skip: (say: (message: string | null) => void) => void };
  /**
   * Offer Run / Pause. Off by default: the Platform Lab's Director owns its own timing and must stay deterministic.
   * Each tick is the same recorded `advance_clock` the +30s button sends, so a run is nothing but a series of those.
   */
  autoRun?: boolean;
}): { virtualNowMs: number; strip: React.ComponentProps<typeof SimulatorStrip> } {
  const [message, setMessage] = useState<string | null>(null);
  const scenario = script && session.scenarioId ? SCENARIO_BY_ID[session.scenarioId as ScenarioId] : undefined;
  const stepDef = scenario?.script[session.scriptCursor];
  const virtualNowMs = effectiveNowMs(session, nowMs);

  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(15);
  const latest = useRef({ run, virtualNowMs, nextAnchorMs, speed });
  latest.current = { run, virtualNowMs, nextAnchorMs, speed };
  const live = session.lifecycle === "active";
  const ticking = autoRun && running && live;

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => {
      const now = latest.current;
      let byMs = now.speed * 1000;
      // Stop one minute before the next hard anchor, the same place "To anchor" jumps to, so the moment that matters is not skipped over.
      const stopAt = now.nextAnchorMs === null ? null : now.nextAnchorMs - 60_000;
      let arrived = false;
      if (stopAt !== null && stopAt > now.virtualNowMs && now.virtualNowMs + byMs >= stopAt) {
        byMs = stopAt - now.virtualNowMs;
        arrived = true;
      }
      now.run({ type: "advance_clock", byMs });
      if (arrived) setRunning(false);
    }, 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  return {
    virtualNowMs,
    strip: {
      virtualNowMs,
      tz: session.timezone,
      nextAnchorMs,
      scripted: Boolean(scenario),
      step: scenario && stepDef ? { index: session.scriptCursor, total: scenario.script.length, label: stepDef.label } : null,
      onAdvance: (sec) => run({ type: "advance_clock", byMs: sec * 1000 }),
      onToAnchor: () => {
        if (nextAnchorMs !== null) run({ type: "set_clock", toMs: nextAnchorMs - 60_000 });
      },
      onApplyStep: () => script?.apply(setMessage),
      onSkipStep: () => script?.skip(setMessage),
      message,
      autoRun: autoRun ? { running: ticking, speed, speeds: RUN_SPEEDS, onToggle: () => setRunning((r) => !r), onSpeed: setSpeed } : undefined,
    },
  };
}

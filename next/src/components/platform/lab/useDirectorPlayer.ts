"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DIRECTOR_DURATION_MS, DIRECTOR_STEPS } from "@/lib/platform";
import type { LabAction } from "./labReducer";

export const DIRECTOR_SPEEDS = [0.5, 1, 2] as const;
export type DirectorSpeed = (typeof DIRECTOR_SPEEDS)[number];

const TICK_MS = 100;

export interface DirectorPlayer {
  playing: boolean;
  /** Presentation time, 0 to 90 s. */
  elapsedMs: number;
  speed: DirectorSpeed;
  done: boolean;
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  setSpeed: (s: DirectorSpeed) => void;
}

/**
 * Plays the Demo Director in real time. The browser's timer only says WHEN the next step is due; what each step does
 * is decided by the pure reducer, so a slow or throttled tab plays the same story, just later.
 */
export function useDirectorPlayer(cursor: number, dispatch: (a: LabAction) => void): DirectorPlayer {
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState<DirectorSpeed>(1);
  const elapsedRef = useRef(0);
  const speedRef = useRef<DirectorSpeed>(1);
  const done = cursor >= DIRECTOR_STEPS.length;

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const moveTo = useCallback((ms: number) => {
    elapsedRef.current = ms;
    setElapsedMs(ms);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const next = Math.min(DIRECTOR_DURATION_MS, elapsedRef.current + (now - last) * speedRef.current);
      last = now;
      moveTo(next);
      dispatch({ type: "director-to", atMs: next });
      if (next >= DIRECTOR_DURATION_MS) setPlaying(false);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing, dispatch, moveTo]);

  const play = useCallback(() => {
    if (done) {
      dispatch({ type: "reset" });
      moveTo(0);
    }
    setPlaying(true);
  }, [done, dispatch, moveTo]);

  const pause = useCallback(() => setPlaying(false), []);

  const step = useCallback(() => {
    setPlaying(false);
    if (done) return;
    moveTo(Math.max(elapsedRef.current, DIRECTOR_STEPS[cursor].atMs));
    dispatch({ type: "director-step" });
  }, [cursor, dispatch, done, moveTo]);

  const reset = useCallback(() => {
    setPlaying(false);
    moveTo(0);
    dispatch({ type: "reset" });
  }, [dispatch, moveTo]);

  return { playing, elapsedMs, speed, done, play, pause, step, reset, setSpeed };
}

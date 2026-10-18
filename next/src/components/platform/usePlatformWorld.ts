"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@/contracts";
import { freshWorld, parseWorld, type PlatformWorld } from "@/lib/platform";

export { addNotices, freshWorld, type PlatformNotice, type PlatformWorld } from "@/lib/platform";

const KEY = (sessionId: string): string => `livelift.platformSim.v1.${sessionId}`;

/** The show's stored world, checked field by field (`parseWorld`). Anything damaged or unreadable is null. */
function load(sessionId: string): PlatformWorld | null {
  try {
    const raw = window.localStorage.getItem(KEY(sessionId));
    return raw ? parseWorld(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function save(sessionId: string, world: PlatformWorld): void {
  try {
    window.localStorage.setItem(KEY(sessionId), JSON.stringify(world));
  } catch {
    // Storage can be blocked or full. The rehearsal keeps working from memory; it just will not survive a reload.
  }
}

export function usePlatformWorld(session: Pick<Session, "id" | "products">): {
  world: PlatformWorld;
  /** Always the latest world, including changes made earlier in the same event handler. */
  latest: () => PlatformWorld;
  update: (fn: (w: PlatformWorld) => PlatformWorld) => PlatformWorld;
  reset: () => void;
} {
  const [world, setWorld] = useState<PlatformWorld>(() => freshWorld(session));
  const ref = useRef(world);
  const sessionId = session.id;

  useEffect(() => {
    // This show's own world: its stored copy, or a fresh one. Never the previous show's.
    const next = load(sessionId) ?? freshWorld(session);
    ref.current = next;
    setWorld(next);
    // Only when the show changes: a re-render must never replace the live state with an older stored copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const update = useCallback(
    (fn: (w: PlatformWorld) => PlatformWorld): PlatformWorld => {
      const next = fn(ref.current);
      ref.current = next;
      setWorld(next);
      save(sessionId, next);
      return next;
    },
    [sessionId]
  );

  const reset = useCallback(() => {
    update(() => freshWorld(session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, session.products]);

  return { world, latest: () => ref.current, update, reset };
}

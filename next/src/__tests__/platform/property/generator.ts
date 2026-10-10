import type { Session } from "@/contracts";
import { SCENARIO_START_MS, applyCommand, createScenarioSession } from "@/lib/domain";
import { catalogFromProducts, createShopeeLiveSim, initialSyncState, syncCycle } from "@/lib/platform";

export const T = SCENARIO_START_MS;
export const SEQUENCES = 2048;

export function seeded(seed: number): (limit: number) => number {
  let state = (seed >>> 0) || 1;
  return (limit) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % limit;
  };
}

export function world(session: Session = applyCommand(createScenarioSession("buffered"), { type: "start_live", nowMs: T }).session) {
  const sync = initialSyncState(session);
  const sim = createShopeeLiveSim({ catalog: catalogFromProducts(session.products, sync.links) });
  return { session, sim, sync };
}

export function linked() {
  const w = world();
  const result = syncCycle(w.session, w.sim, w.sync, T);
  return { session: w.session, sim: result.sim, sync: result.sync };
}

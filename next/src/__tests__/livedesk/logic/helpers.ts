import * as S from "@/lib/livedesk/session";

/** A desk with the sample pack synced and a live started at second 0. */
export function liveDesk(seed: number = S.DEFAULT_SEED): { state: S.DeskState; liveId: string } {
  const started = S.startLive(S.importSamplePack(S.connect(S.initialDeskState(seed))));
  if (!started.liveId) throw new Error("the sample pack should start a live");
  return { state: started.state, liveId: started.liveId };
}

export const idOf = (state: S.DeskState, name: string): string => {
  const p = state.products.find((x) => x.name === name);
  if (!p) throw new Error(`no product ${name}`);
  return p.id;
};

/** Every write the platform logged, as "endpoint:outcome" and host actions as "host:action". */
export const writes = (state: S.DeskState): string[] =>
  state.world.sim.ledger.flatMap((e) => (e.kind === "api" ? (e.readOnly ? [] : [`${e.endpoint}:${e.envelope.error || "ok"}`]) : [`host:${e.action}`]));

export const FORBIDDEN_PHRASES = ["synced with Shopee", "connected to Shopee", "confirmed by Shopee"];

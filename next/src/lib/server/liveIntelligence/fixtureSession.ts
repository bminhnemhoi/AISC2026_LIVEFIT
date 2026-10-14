import { createSession, applyCommand, type CommandBody } from "@/lib/domain/engine";
import { newSegment } from "@/lib/domain/plan";
import type { Session } from "@/contracts";
import type { FixtureCase } from "./fixtures";

export const FIXTURE_START = 1_791_000_000_000;
/** Deterministic domain histories for certification. Never used to manufacture a REAL room session. */
export function providerFixtureSession(kind: FixtureCase = "normal"): Session {
  const start = FIXTURE_START;
  const segments = ["Product A", "Product B", "Not reached"].map((title, i) => newSegment(`sim-v7:s${i + 1}`, { title, kind: "product", targetSec: 120, minSec: 0, optional: false, productId: i === 0 || kind === "repeated_product" && i === 1 ? "local-product-a" : null }));
  let session = createSession({ id: "sim-v7", title: "V7 fixture rehearsal", environment: "SIMULATED", timezone: "Asia/Ho_Chi_Minh", plannedStartMs: start - 30_000, nowMs: start - 60_000,
    products: [{ id: "local-product-a", code: "A", name: "Explicit fixture product", price: null, currency: "VND", priority: "normal", status: "enabled", talkingPoints: [], constraints: [], initials: "A" }], segments });
  let n = 0;
  const command = (body: CommandBody, nowMs: number) => {
    if (session.virtualNowMs !== nowMs) session = applyCommand(session, { type: "set_clock", toMs: nowMs, nowMs, key: `fixture-clock-${++n}`, actor: "Fixture operator" }).session;
    const result = applyCommand(session, { ...body, nowMs, key: `fixture-${++n}`, actor: "Fixture operator" });
    if (result.receipt.outcome !== "committed") throw new Error(result.receipt.message ?? "Fixture command rejected");
    session = result.session;
  };
  command({ type: "start_live" }, start);
  command({ type: "advance_segment", coverage: "complete" }, start + (kind === "boundary" ? 90_000 : 60_000));
  if (kind === "not_reached") command({ type: "end_live" }, start + 60_000);
  else command({ type: "end_live" }, start + 120_000);
  return session;
}

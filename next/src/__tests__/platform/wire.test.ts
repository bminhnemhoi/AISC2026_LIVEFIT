import { describe, expect, it } from "vitest";
import { createScenarioSession } from "@/lib/domain";
import { applyLabCommands, callJson, callLogDigest, initialLabState, readsOf, wireRows, type LabCommand, type LabState, type WireRow } from "@/lib/platform";

const STORY: LabCommand[] = [
  { kind: "show", body: { type: "start_live" } },
  { kind: "sync" },
  { kind: "pin", productId: "prod_m02" },
  { kind: "host", action: { type: "pin_item", itemId: 100002 } },
  { kind: "sync" },
  { kind: "fault", fault: "token_expired" },
  { kind: "sync" },
];

const run = () => applyLabCommands(initialLabState(createScenarioSession("buffered")), STORY);
const rowsOf = (s: LabState, showReads: boolean) => wireRows(s.world.sim.ledger, readsOf(s.world), s.trace, { showReads });
const digestOf = (s: LabState) => callLogDigest(s.world.sim.ledger, readsOf(s.world));
const label = (r: WireRow): string =>
  r.kind === "call" ? `call:${r.entry.endpoint}:${r.ok ? "ok" : r.entry.envelope.error}` : r.kind === "host" ? `host:${r.entry.action}` : `record:${r.trace.source}`;

describe("the wire", () => {
  it("shows writes, host actions, the read that noticed the host and the record it led to, in call order", () => {
    const s = run();
    const rows = rowsOf(s, false).map(label);
    expect(rows).toEqual([
      "call:create_session:ok",
      "call:add_item_list:ok",
      "call:start_session:ok",
      "call:create_promotion:ok",
      // Zip Hoodie is already in the live bag, so the pin needs no add_item_list first.
      "call:update_show_item:ok",
      "record:request_accepted",
      "host:pin_item",
      "call:get_session_detail:ok",
      "record:provider_observed",
      "call:get_promotion_list:error_auth",
      "call:get_session_detail:error_auth",
      "call:get_item_list:error_auth",
    ]);
  });

  it("the return arrow follows the exact read that noticed the change", () => {
    const s = run();
    const rows = rowsOf(s, false);
    const i = rows.findIndex((r) => r.kind === "record" && r.trace.source === "provider_observed");
    const read = rows[i - 1];
    const observed = s.trace.find((t) => t.source === "provider_observed")!;
    expect(observed.read).not.toBeNull();
    expect(read.kind === "call" && read.entry.kind === "read" && read.entry.n).toBe(observed.read);
    expect(read.kind === "call" && read.entry.endpoint).toBe("get_session_detail");
  });

  it("every call carries its basis, outcome and request id; routine reads appear when asked", () => {
    const s = run();
    const all = rowsOf(s, true);
    const calls = all.filter((r): r is Extract<WireRow, { kind: "call" }> => r.kind === "call");
    expect(calls.length).toBe(s.world.sim.ledger.filter((e) => e.kind === "api").length + readsOf(s.world).length);
    expect(calls.every((c) => /^[0-9a-f]{32}$/.test(c.entry.envelope.request_id))).toBe(true);
    // A read's request id never repeats a call's.
    expect(new Set(calls.map((c) => c.entry.envelope.request_id)).size).toBe(calls.length);
    expect(calls.find((c) => c.entry.endpoint === "update_show_item")!.entry.basis).toBe("documented");
    expect(calls.find((c) => c.entry.endpoint === "create_session")!.entry.basis).toBe("inferred");
  });

  it("a call's JSON shows what was sent and what came back", () => {
    const s = run();
    const pin = s.world.sim.ledger.find((e) => e.kind === "api" && e.endpoint === "update_show_item");
    expect(pin?.kind).toBe("api");
    if (pin?.kind !== "api") return;
    const json = callJson(pin);
    expect(json.startsWith("POST /api/v2/livestream/update_show_item\n")).toBe(true);
    expect(json).toContain('"item_id": 100001');
    expect(json).toContain(`"request_id": "${pin.envelope.request_id}"`);
  });

  it("the digest covers both logs: the same for the same run, different for a different one", () => {
    expect(digestOf(run())).toBe(digestOf(run()));
    expect(digestOf(run())).toMatch(/^[0-9a-f]{8}$/);
    // One more sync while authorisation is still expired: no write, but its refused reads are in the read log.
    const other = applyLabCommands(run(), [{ kind: "sync" }]);
    expect(other.world.sim.ledger).toEqual(run().world.sim.ledger);
    expect(digestOf(other)).not.toBe(digestOf(run()));
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { SCENARIO_START_MS, applyCommand, createScenarioSession, createSession, runScript } from "@/lib/domain";
import {
  applyLabCommand, applyLabCommands, initialLabState, labNow, labRecords, readsOf, type LabCommand, type LabState,
} from "@/lib/platform";

const T = SCENARIO_START_MS;

/** A lab run whose show has started and whose live LiveLift has opened. */
function live(): LabState {
  return applyLabCommands(initialLabState(createScenarioSession("buffered")), [{ kind: "show", body: { type: "start_live" } }, { kind: "sync" }]);
}

const noticeCodes = (s: LabState): string[] => s.world.notices.map((n) => n.code);

afterEach(() => vi.restoreAllMocks());

describe("a lab run", () => {
  it("starts from the show as planned, whatever the stored show is doing, and never aliases it", () => {
    const finished = runScript(createScenarioSession("buffered"));
    expect(finished.lifecycle).toBe("ended");
    const lab = initialLabState(finished);
    expect(lab.session.lifecycle).toBe("planned");
    expect(lab.session.id).toBe(finished.id);
    expect(labNow(lab)).toBe(T);
    expect(lab.world.sim.ledger).toEqual([]);
    lab.session.products[0].name = "changed in the lab";
    expect(finished.products[0].name).not.toBe("changed in the lab");
  });

  it("refuses a REAL show", () => {
    const real = createSession({ id: "real-1", title: "Real", environment: "REAL", timezone: "Asia/Ho_Chi_Minh", plannedStartMs: T, nowMs: T });
    expect(() => initialLabState(real)).toThrow(/SIMULATED/);
  });

  it("runs desk commands on the virtual clock", () => {
    const s = applyLabCommands(initialLabState(createScenarioSession("buffered")), [
      { kind: "show", body: { type: "set_clock", toMs: T + 60_000 } },
      { kind: "show", body: { type: "start_live" } },
    ]);
    expect(s.session.lifecycle).toBe("active");
    expect(s.session.runtime.startedAtMs).toBe(T + 60_000);
    expect(s.applied).toBe(2);
  });

  it("a refused desk command is said, and changes nothing in the show", () => {
    const before = initialLabState(createScenarioSession("buffered"));
    const after = applyLabCommand(before, { kind: "show", body: { type: "end_live" } });
    expect(after.session).toBe(before.session);
    expect(noticeCodes(after)).toEqual(["show_refused"]);
  });

  it("a pin from LiveLift is recorded as performed with its request id, and stays platform verification unknown", () => {
    const s = applyLabCommand(live(), { kind: "pin", productId: "prod_m02" });
    const pinCall = s.world.sim.ledger.find((e) => e.kind === "api" && e.endpoint === "update_show_item")!;
    expect(pinCall.kind === "api" && pinCall.envelope.error).toBe("");
    const [record] = labRecords(s.session, s.trace);
    expect(record).toMatchObject({ state: "performed", source: "request_accepted" });
    expect(record.reason).toContain(pinCall.kind === "api" ? pinCall.envelope.request_id : "?");
    expect(s.trace).toEqual([{ seq: pinCall.seq, read: null, recordId: expect.any(String), atMs: T, source: "request_accepted", summary: expect.stringContaining("platform verification unknown") }]);
  });

  it("a refused pin is an attempt in the platform's own words, and the platform is left as it was", () => {
    const before = applyLabCommand(live(), { kind: "fault", fault: "token_expired" });
    const s = applyLabCommand(before, { kind: "pin", productId: "prod_m02" });
    const [record] = labRecords(s.session, s.trace);
    expect(record).toMatchObject({ state: "attempted", source: "request_refused" });
    expect(record.reason).toContain("You are not authorized");
    expect(noticeCodes(s)).toContain("pin_refused");
    expect(s.world.sim.sessions).toEqual(before.world.sim.sessions);
  });

  it("a pin the host makes in the app is recorded only after a read notices it, as Provider observed (SIMULATED)", () => {
    const hosted = applyLabCommand(live(), { kind: "host", action: { type: "pin_item", itemId: 100002 } });
    expect(labRecords(hosted.session, hosted.trace)).toEqual([]);
    const s = applyLabCommand(hosted, { kind: "sync" });
    const [record] = labRecords(s.session, s.trace);
    expect(record).toMatchObject({ title: "Pin Cargo Pants", state: "performed", source: "provider_observed" });
    const hostSeq = hosted.world.sim.seq;
    const read = readsOf(s.world).find((e) => e.endpoint === "get_session_detail" && e.afterSeq === hostSeq)!;
    expect(read.envelope.error).toBe("");
    expect(s.trace.at(-1)).toMatchObject({ seq: hostSeq, read: read.n, source: "provider_observed" });
    // Reading changed nothing on the platform: its call log ends with the host's pin.
    expect(s.world.sim.ledger.at(-1)).toMatchObject({ kind: "host_app", seq: hostSeq });
  });

  it("LiveLift's own pin is never echoed back as observed", () => {
    const s = applyLabCommands(live(), [{ kind: "pin", productId: "prod_m02" }, { kind: "sync" }, { kind: "sync" }]);
    expect(labRecords(s.session, s.trace).map((r) => r.source)).toEqual(["request_accepted"]);
  });

  it("unpin has no endpoint, so it says so and calls nothing", () => {
    const before = live();
    const s = applyLabCommand(before, { kind: "unpin" });
    expect(s.world.sim.ledger).toEqual(before.world.sim.ledger);
    expect(s.world.notices[0].summary).toMatch(/No endpoint clears the pinned product/);
  });

  it("a platform problem is told once, and its recovery once", () => {
    const s = applyLabCommands(live(), [
      { kind: "fault", fault: "token_expired" }, { kind: "sync" }, { kind: "sync" }, { kind: "sync" },
      { kind: "fault", fault: null }, { kind: "sync" }, { kind: "sync" },
    ]);
    const codes = noticeCodes(s);
    expect(codes.filter((c) => c === "platform_problem")).toHaveLength(1);
    expect(codes.filter((c) => c === "platform_recovered")).toHaveLength(1);
  });

  it("assumptions and auto-sync are switches on the run", () => {
    const s = applyLabCommands(live(), [{ kind: "assume", patch: { detailExposesShowingItem: false } }, { kind: "auto", on: false }]);
    expect(s.world.sim.assumptions).toEqual({ appLiveControllable: true, detailExposesShowingItem: false });
    expect(s.world.auto).toBe(false);
  });

  it("is pure: the same commands give the same run, and nothing is stored", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const cmds: LabCommand[] = [
      { kind: "show", body: { type: "start_live" } }, { kind: "sync" }, { kind: "pin", productId: "prod_m02" },
      { kind: "host", action: { type: "pin_item", itemId: 100002 } }, { kind: "sync" },
    ];
    const a = applyLabCommands(initialLabState(createScenarioSession("buffered")), cmds);
    const b = applyLabCommands(initialLabState(createScenarioSession("buffered")), cmds);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("a record is attributed by the bridge's trace: the same records without it are operator reported", () => {
    const s = applyLabCommand(live(), { kind: "pin", productId: "prod_m02" });
    expect(labRecords(s.session, s.trace).map((r) => r.source)).toEqual(["request_accepted"]);
    expect(labRecords(s.session).map((r) => r.source)).toEqual(["operator_reported"]);
    expect(s.trace[0].recordId).toBe(labRecords(s.session)[0].id);
  });

  it("labRecords lists unplanned actions too, newest first", () => {
    const s = live();
    const r = applyCommand(s.session, { type: "report_manual_action", action: "pin_product", productId: "prod_m02", targetLabel: "Zip Hoodie", report: "performed", nowMs: 0, key: "k" });
    expect(labRecords(r.session)).toEqual([expect.objectContaining({ title: "Pin M02 Zip Hoodie", source: "operator_reported", state: "performed" })]);
  });
});

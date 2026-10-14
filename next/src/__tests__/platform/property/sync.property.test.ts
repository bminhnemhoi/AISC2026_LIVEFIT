import { describe, expect, it } from "vitest";
import { applyCommand, currentPlan, type CommandBody } from "@/lib/domain";
import {
  acceptedReason, hostAct, ongoingSession, pinFromLiveLift, reportCommand, syncCycle, withAssumptions, withFault,
  type ShopeeFault,
} from "@/lib/platform";
import { SEQUENCES, T, linked, seeded, world } from "./generator";

const faults: Array<ShopeeFault | null> = [null, "token_expired", "rate_limited", "region_unsupported", "server_error"];

function run(seed: number) {
  const pick = seeded(seed);
  let w = world();
  const commands: CommandBody[] = [];
  const notices: Array<{ code: string; summary: string }> = [];
  for (let step = 0; step < 8; step++) {
    const nowMs = T + step * 1000;
    const link = w.sync.links[pick(w.sync.links.length)];
    switch (pick(8)) {
      case 0: w.sim = hostAct(w.sim, nowMs, { type: "start_live", title: "Synthetic host" }).sim; break;
      case 1: w.sim = hostAct(w.sim, nowMs, { type: "pin_item", itemId: link.itemId }).sim; break;
      case 2: w.sim = hostAct(w.sim, nowMs, { type: "unpin_item" }).sim; break;
      case 3: {
        const pin = pinFromLiveLift(w.sim, w.sync, link.productId, nowMs);
        w = { ...w, sim: pin.sim, sync: pin.sync };
        break;
      }
      case 4: w.sim = withFault(w.sim, faults[pick(faults.length)]); break;
      case 5: w.sim = withAssumptions(w.sim, { detailExposesShowingItem: pick(2) === 0, appLiveControllable: pick(2) === 0 }); break;
      case 6: w = JSON.parse(JSON.stringify(w)) as typeof w; break;
      case 7: w.sim = hostAct(w.sim, nowMs, { type: "end_live" }).sim; break;
    }
    const result = syncCycle(w.session, w.sim, w.sync, nowMs);
    w = { ...w, sim: result.sim, sync: result.sync };
    commands.push(...result.commands);
    notices.push(...result.notices);
    expect(w.sim.ledger.length, `seed=${seed}, step=${step}`).toBeLessThanOrEqual(300);
    expect(w.sim.ledger.every((entry, i) => i === 0 || entry.seq > w.sim.ledger[i - 1].seq)).toBe(true);
  }
  return { ...w, commands, notices };
}

describe("seeded SIMULATED bridge properties", () => {
  it("replays 2,048 bridge sequences byte-identically across faults, assumptions, host actions and JSON reloads", { timeout: 60000 }, () => {
    for (let seed = 1; seed <= SEQUENCES; seed++) expect(JSON.stringify(run(seed)), `seed=${seed}`).toBe(JSON.stringify(run(seed)));
  });

  it("does not echo successful LiveLift pins, including after the accepted request falls off the ledger", { timeout: 60000 }, () => {
    const initial = linked();
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const pick = seeded(seed);
      let w = structuredClone(initial);
      for (let step = 0; step < 3; step++) {
        const productId = w.sync.links[pick(w.sync.links.length)].productId;
        const pin = pinFromLiveLift(w.sim, w.sync, productId, T);
        expect(pin.outcome.ok, `seed=${seed}, step=${step}`).toBe(true);
        if (!pin.outcome.ok) throw new Error("Pin setup refused");
        const requestId = pin.outcome.requestId;
        expect(pin.sim.ledger.some((entry) => entry.kind === "api" && entry.endpoint === "update_show_item" && entry.envelope.error === "" && entry.envelope.request_id === requestId)).toBe(true);
        const report = reportCommand(w.session, "pin_product", productId, "performed", acceptedReason(requestId));
        expect("reason" in report && report.reason).toContain(requestId);
        const result = syncCycle(w.session, pin.sim, pin.sync, T);
        expect(result.commands, `seed=${seed}, step=${step}`).toEqual([]);
        expect(result.notices, `seed=${seed}, step=${step}`).toEqual([]);
        expect(result.calls, `seed=${seed}, step=${step}`).toEqual([]);
        w = { ...w, sim: result.sim, sync: result.sync };
      }
    }
    let w = linked();
    const pin = pinFromLiveLift(w.sim, w.sync, w.sync.links[0].productId, T);
    expect(pin.outcome.ok).toBe(true);
    if (!pin.outcome.ok) throw new Error("Pin setup refused");
    const requestId = pin.outcome.requestId;
    w = { ...w, sim: pin.sim, sync: pin.sync };
    for (let i = 0; i < 101; i++) {
      const result = syncCycle(w.session, w.sim, w.sync, T);
      expect(result.commands).toEqual([]);
      expect(result.notices).toEqual([]);
      w = { ...w, sim: result.sim, sync: result.sync };
    }
    // Restated for the P01 decision (ROUND-2.md): reads live in a separate ring, so idle polling never evicts the write.
    expect(w.sim.ledger.some((entry) => entry.kind === "api" && entry.envelope.request_id === requestId)).toBe(true);
  });

  it("repeated healthy sync makes no writes or duplicate observations over 2,048 host/pin sequences", { timeout: 60000 }, () => {
    const initial = linked();
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const pick = seeded(seed);
      const w = structuredClone(initial);
      const itemId = w.sync.links[pick(w.sync.links.length)].itemId;
      const hosted = hostAct(w.sim, T, { type: "add_live_item", itemId });
      const pinned = hostAct(hosted.sim, T, { type: "pin_item", itemId });
      expect(pinned.ok).toBe(true);
      const first = syncCycle(w.session, pinned.sim, w.sync, T);
      expect(first.commands).toHaveLength(1);
      const second = syncCycle(w.session, first.sim, first.sync, T);
      expect(second.calls).toEqual([]);
      expect(second.commands).toEqual([]);
      expect(second.notices).toEqual([]);
      expect({ ...second.sim, seq: 0, ledger: [] }).toEqual({ ...first.sim, seq: 0, ledger: [] });
      expect(second.sync).toEqual(first.sync);
    }
  });

  it("reads host changes before an outbound end and leaves no linked live ongoing after 2,048 healthy endings", { timeout: 60000 }, () => {
    const initial = linked();
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const pick = seeded(seed);
      const w = structuredClone(initial);
      const itemId = w.sync.links[pick(w.sync.links.length)].itemId;
      let sim = hostAct(w.sim, T, { type: "add_live_item", itemId }).sim;
      sim = hostAct(sim, T, { type: "pin_item", itemId }).sim;
      const ended = applyCommand(w.session, { type: "end_live", nowMs: T });
      expect(ended.receipt.outcome).toBe("committed");
      const result = syncCycle(ended.session, sim, w.sync, T);
      expect(ongoingSession(result.sim), `seed=${seed}`).toBeNull();
      const newEntries = result.sim.ledger.filter((entry) => entry.seq > sim.seq);
      // Restated for the P01 decision (ROUND-2.md): the reads are in the read ring, made before any new call.
      expect(result.reads.slice(0, 3).map((read) => [read.endpoint, read.afterSeq])).toEqual([["get_promotion_list", sim.seq], ["get_session_detail", sim.seq], ["get_item_list", sim.seq]]);
      expect(newEntries[0]).toMatchObject({ kind: "api", endpoint: "end_session", envelope: { error: "" } });
      expect(result.notices.some((notice) => notice.code === "observed")).toBe(true);
    }
  });

  it("P01: idle syncCycle changes state and makes hidden read calls in all 2,048 seeded idempotence checks", { timeout: 60000 }, () => {
    const initial = linked();
    let changed = 0;
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const pick = seeded(seed);
      const w = structuredClone(initial);
      const pin = pinFromLiveLift(w.sim, w.sync, w.sync.links[pick(w.sync.links.length)].productId, T);
      expect(pin.outcome.ok).toBe(true);
      const again = syncCycle(w.session, pin.sim, pin.sync, T);
      expect(again.calls).toEqual([]);
      expect(again.commands).toEqual([]);
      if (JSON.stringify(again.sim) !== JSON.stringify(pin.sim)) changed++;
    }
    expect(changed).toBe(0);
  });

  it("P02: a refused pin erases the good baseline and recovery echoes LiveLift's own bag and promotion", () => {
    const w = linked();
    const refused = pinFromLiveLift(withFault(w.sim, "token_expired"), w.sync, w.sync.links[0].productId, T);
    expect(refused.outcome.ok).toBe(false);
    expect({ ...refused.sim, seq: 0, ledger: [], fault: null }).toEqual({ ...w.sim, seq: 0, ledger: [] });
    const healed = syncCycle(w.session, withFault(refused.sim, null), refused.sync, T);
    expect(healed.notices.filter((notice) => ["item_added_known", "promotion_scheduled", "observed"].includes(notice.code))).toEqual([]);
  });

  it("P02: recovery echoes own changes across 2,048 seeded refused-pin/fault sequences", { timeout: 60000 }, () => {
    const initial = linked();
    let echoes = 0;
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const pick = seeded(seed);
      const w = structuredClone(initial);
      const fault = faults[1 + pick(faults.length - 1)];
      const pin = pinFromLiveLift(withFault(w.sim, fault), w.sync, w.sync.links[pick(w.sync.links.length)].productId, T);
      expect(pin.outcome.ok).toBe(false);
      const healed = syncCycle(w.session, withFault(pin.sim, null), pin.sync, T);
      if (healed.notices.some((notice) => ["item_added_known", "promotion_scheduled", "observed"].includes(notice.code))) echoes++;
    }
    expect(echoes).toBe(0);
  });

  it("P02: a host pin during an outage is lost when a refused LiveLift pin overwrites the baseline", () => {
    const w = linked();
    const itemId = w.sync.last!.itemIds[0];
    const hosted = hostAct(withFault(w.sim, "token_expired"), T, { type: "pin_item", itemId });
    expect(hosted.ok).toBe(true);
    const pin = pinFromLiveLift(hosted.sim, w.sync, w.sync.links[0].productId, T);
    expect(pin.outcome.ok).toBe(false);
    const healed = syncCycle(w.session, withFault(pin.sim, null), pin.sync, T);
    expect(healed.commands).toHaveLength(1);
  });

  it("P03: a created live never starts after a refused product load is repaired", () => {
    const w = world();
    const refused = syncCycle(w.session, { ...w.sim, catalog: [] }, w.sync, T);
    expect(refused.calls.find((call) => call.endpoint === "add_item_list")?.ok).toBe(false);
    expect(refused.sync.providerSessionId).not.toBeNull();
    const retry = syncCycle(w.session, { ...refused.sim, catalog: w.sim.catalog }, refused.sync, T);
    expect(retry.calls.find((call) => call.endpoint === "add_item_list")?.ok).toBe(true);
    expect(ongoingSession(retry.sim)?.sessionId).toBe(retry.sync.providerSessionId);
  });

  it("P04: an unlinked host live stays ongoing at show end and LiveLift discloses the manual end once", () => {
    const w = world();
    const hosted = hostAct(w.sim, T, { type: "start_live", title: "Synthetic existing app live" });
    expect(hosted.ok).toBe(true);
    const host = ongoingSession(hosted.sim)!;
    const first = syncCycle(w.session, hosted.sim, w.sync, T);
    expect(first.calls.find((call) => call.endpoint === "start_session")?.ok).toBe(false);
    expect(first.sync.providerSessionId).not.toBe(host.sessionId);
    const ended = applyCommand(w.session, { type: "end_live", nowMs: T });
    expect(ended.receipt.outcome).toBe("committed");
    const result = syncCycle(ended.session, first.sim, first.sync, T);
    expect(ongoingSession(result.sim)).toEqual(host);
    expect(result.calls).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.sync.problem).toMatch(/SIMULATED Live.*nothing to end.*end it there/);
    expect(result.notices).toEqual([{ code: "platform_problem", summary: result.sync.problem }]);
    const repeated = syncCycle(ended.session, result.sim, result.sync, T);
    expect(repeated.calls).toEqual([]);
    expect(repeated.notices).toEqual([]);
    expect(repeated.sync.problem).toBe(result.sync.problem);
    expect(ongoingSession(repeated.sim)).toEqual(host);
  });

  it("P05: a performed provider observation carries its SIMULATED source and no outbound request id", () => {
    const w = linked();
    const productId = currentPlan(w.session).cues.find((cue) => cue.action === "pin_product")!.productId!;
    const itemId = w.sync.links.find((link) => link.productId === productId)!.itemId;
    const hosted = hostAct(w.sim, T, { type: "pin_item", itemId });
    expect(hosted.ok).toBe(true);
    const result = syncCycle(w.session, hosted.sim, w.sync, T);
    expect(result.commands).toHaveLength(1);
    const command = result.commands[0];
    expect(command).toMatchObject({ report: "performed", reason: expect.stringMatching(/^Provider observed \(SIMULATED\)/) });
    expect("reason" in command && command.reason).not.toContain("request_id");
    expect(result.calls).toEqual([]);
    expect(result.reads.some((read) => read.endpoint === "get_session_detail" && read.error === "")).toBe(true);
  });
});

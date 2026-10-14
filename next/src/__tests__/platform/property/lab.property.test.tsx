import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScenarioSession, type ScenarioId } from "@/lib/domain";
import { acceptedReason, applyLabCommand, applyLabCommands, initialLabState, labRecords, callLogDigest, readsOf, runDirector } from "@/lib/platform";
import { initLabUi, labReducer } from "@/components/platform/lab/labReducer";
import { useLabPreferences } from "@/components/platform/lab/useLabPreferences";
import { PlatformLab } from "@/components/platform/lab/PlatformLab";
import { seeded } from "./generator";

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Lab reducer and preference properties", () => {
  it("2,048 seeded presentation schedules produce the same full Director state and ledger", () => {
    const scenarios: ScenarioId[] = ["buffered", "missed", "minimum"];
    for (let seed = 1; seed <= 2048; seed++) {
      const pick = seeded(seed);
      const show = createScenarioSession(scenarios[pick(scenarios.length)]);
      let ui = initLabUi(show);
      let elapsed = 0;
      while (elapsed < 90_000) {
        elapsed = Math.min(90_000, elapsed + 1 + pick(20_000));
        ui = labReducer(ui, { type: "director-to", atMs: elapsed });
      }
      expect(ui.cursor, `seed ${seed}`).toBe(12);
      const expected = runDirector(initialLabState(show));
      expect(JSON.stringify(ui.lab), `seed ${seed}`).toBe(JSON.stringify(expected));
      expect(callLogDigest(ui.lab.world.sim.ledger, readsOf(ui.lab.world))).toBe(callLogDigest(expected.world.sim.ledger, readsOf(expected.world)));
    }
  }, 60_000);

  it("duplicate due ticks and reset do not duplicate evidence, and replay matches byte for byte", () => {
    const show = createScenarioSession("buffered");
    const initial = initLabUi(show);
    const ended = labReducer(initial, { type: "director-to", atMs: 90_000 });
    expect(labReducer(ended, { type: "director-to", atMs: 90_000 })).toBe(ended);
    const reset = labReducer(ended, { type: "reset" });
    expect(reset).toEqual(initial);
    expect(labReducer(reset, { type: "director-to", atMs: 90_000 })).toEqual(ended);
  });

  it("accepted and provider-observed records from the real bridge stay distinct through JSON round trips", () => {
    const start = applyLabCommands(initialLabState(createScenarioSession("buffered")), [
      { kind: "show", body: { type: "start_live" } }, { kind: "sync" },
      { kind: "pin", productId: "prod_m02" },
      { kind: "host", action: { type: "pin_item", itemId: 100002 } }, { kind: "sync" },
    ]);
    const restored: typeof start = JSON.parse(JSON.stringify(start));
    const records = labRecords(restored.session, restored.trace);
    expect(records.map(record => record.source).sort()).toEqual(["provider_observed", "request_accepted"]);
    expect(records.find(record => record.source === "provider_observed")?.reason).toMatch(/^Provider observed \(SIMULATED\)/);
    expect(records.find(record => record.source === "provider_observed")?.reason).not.toContain("request_id");
    expect(records.find(record => record.source === "request_accepted")?.reason).toContain("request_id");
  });

  it.each([
    { marker: "provider-observed", reason: "Provider observed (SIMULATED): operator typed this" },
    { marker: "accepted request", reason: acceptedReason("synthetic-unaccepted-request") },
  ])("L01: operator reason can spoof $marker provenance ", ({ reason }) => {
    const started = applyLabCommand(initialLabState(createScenarioSession("buffered")), { kind: "show", body: { type: "start_live" } });
    const reported = applyLabCommand(started, { kind: "show", body: {
      type: "report_manual_action", action: "pin_product", productId: "prod_m02", targetLabel: "Zip Hoodie", report: "performed", reason,
    } });
    expect(Object.values(reported.session.runtime.actions)).toHaveLength(1);
    expect(reported.world.sim.ledger).toEqual([]);
    expect(reported.trace).toEqual([]);
    expect(labRecords(reported.session, reported.trace)[0].source).toBe("operator_reported");
  });

  it.each(["director", "assumptions"])("L02: %s has no SIMULATED label of its own before playback", (surface) => {
    render(<PlatformLab show={createScenarioSession("buffered")} />);
    expect(screen.getByTestId(surface).textContent).toMatch(/\bSIMULATED\b/);
  });

  it("L06: Vietnamese mode leaves LiveLift's generated host-pin notice in English", () => {
    window.localStorage.setItem("livelift.lab.lang", "vi");
    render(<PlatformLab show={createScenarioSession("buffered")} />);
    expect(screen.getByTestId("platform-lab").getAttribute("lang")).toBe("vi");
    for (let step = 0; step < 6; step++) fireEvent.click(screen.getByTestId("director-step"));
    expect(screen.getByTestId("lab-notices").textContent).not.toContain("Host pinned Cargo Pants on the platform");
  });

  it("restores valid preferences and ignores damaged values", () => {
    for (const [language, presenter, expectedLanguage, expectedPresenter] of [
      ["vi", "1", "vi", true], ["en", "0", "en", false], ["broken", "true", "en", false],
    ] as const) {
      window.localStorage.setItem("livelift.lab.lang", language);
      window.localStorage.setItem("livelift.lab.presenter", presenter);
      const mounted = renderHook(() => useLabPreferences());
      expect(mounted.result.current.lang).toBe(expectedLanguage);
      expect(mounted.result.current.presenter).toBe(expectedPresenter);
      expect(window.localStorage.getItem("livelift.lab.presenter")).toBe(expectedPresenter ? "1" : "0");
      mounted.unmount();
    }
  });

  it("storage refusal keeps language and Presenter usable in memory", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Synthetic blocked storage"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Synthetic quota"); });
    const mounted = renderHook(() => useLabPreferences());
    act(() => { mounted.result.current.setLang("vi"); mounted.result.current.togglePresenter(); });
    expect(mounted.result.current.lang).toBe("vi");
    expect(mounted.result.current.presenter).toBe(true);
  });

  it("P ignores input/select/textarea, modifiers and repeated keys; the listener is removed on unmount", () => {
    const mounted = renderHook(() => useLabPreferences());
    for (const tag of ["input", "select", "textarea"]) {
      const field = document.createElement(tag);
      document.body.appendChild(field);
      fireEvent.keyDown(field, { key: "p" });
      field.remove();
    }
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "repeat"]) fireEvent.keyDown(window, { key: "p", [modifier]: true });
    expect(mounted.result.current.presenter).toBe(false);
    fireEvent.keyDown(window, { key: "P" });
    expect(mounted.result.current.presenter).toBe(true);
    mounted.unmount();
    const set = vi.spyOn(Storage.prototype, "setItem");
    fireEvent.keyDown(window, { key: "p" });
    expect(set).not.toHaveBeenCalled();
  });
});

describe("Lab accessibility names", () => {
  it("the wire's scrollable log has a role that allows its name, distinct from the wire's own", () => {
    render(<PlatformLab show={createScenarioSession("buffered")} />);
    const scroll = screen.getByTestId("wire-scroll");
    expect(scroll.getAttribute("role")).toBe("region");
    expect(scroll.getAttribute("aria-label")).toBeTruthy();
    expect(scroll.getAttribute("aria-label")).not.toBe(screen.getByTestId("lab-wire").getAttribute("aria-label"));
  });
});

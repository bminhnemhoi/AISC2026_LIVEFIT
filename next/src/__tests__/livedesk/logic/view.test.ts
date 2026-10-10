import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureDeskView, fixtureStartView } from "@/lib/livedesk/fixtures";
import * as S from "@/lib/livedesk/session";
import { COMMENT_INTENTS, type LiveDeskViewModel, type StartViewModel } from "@/lib/livedesk/types";
import { FORBIDDEN_PHRASES, idOf, liveDesk } from "./helpers";

const keys = (o: object): string[] => Object.keys(o).sort();

/** A long rehearsal that touches everything: pins, unpins, the host, conditions, suggestions, end. Every view is kept. */
function everything(): { starts: StartViewModel[]; desks: LiveDeskViewModel[] } {
  const starts: StartViewModel[] = [];
  const desks: LiveDeskViewModel[] = [];
  let s = S.initialDeskState();
  const look = (): void => {
    starts.push(S.buildStartView(s));
    if (s.live) desks.push(S.buildDeskView(s, s.live.id)!);
  };
  look();
  s = S.importText(s, "X-1, Sock, 1"); look();
  s = S.connect(s); look();
  s = S.importSamplePack(s); look();
  s = S.startLive(s).state; look();
  s = S.pin(s, idOf(s, "Zip Hoodie")); look();
  for (let i = 0; i < 20; i++) { s = S.advance(s, 30); look(); }
  s = S.hostAction(s, { type: "pin", productId: idOf(s, "Cargo Pants") });
  s = S.advance(s, 10); look();
  s = S.hostAction(s, { type: "unpin" });
  s = S.advance(s, 10); look();
  for (const fault of ["token_expired", "rate_limited", "server_error", "region_unsupported"] as const) {
    s = S.unpin(S.setPlatformFault(s, fault)); look();
  }
  s = S.pin(S.setPlatformFault(s, null), idOf(s, "Linen Shirt")); look();
  s = S.unpin(s); look();
  s = S.pin(s, idOf(s, "Linen Shirt")); look();
  for (let i = 0; i < 20; i++) {
    s = S.advance(s, 30);
    const p = s.live!.suggestions.find((x) => x.state === "proposed");
    if (p) s = i % 2 ? S.acceptSuggestionAction(s, p.id) : S.dismissSuggestionAction(s, p.id);
    look();
  }
  // Accepted while the platform refuses: it stays accepted, never performed.
  s = S.advance(s, 120);
  const waiting = s.live!.suggestions.find((x) => x.state === "proposed");
  if (waiting) { s = S.acceptSuggestionAction(S.setPlatformFault(s, "server_error"), waiting.id); look(); s = S.setPlatformFault(s, null); }
  s = S.endLive(s); look();
  return { starts, desks };
}

describe("view models", () => {
  it("have exactly the contract's shape (the fixtures' keys)", () => {
    const { state, liveId } = liveDesk();
    const desk = S.buildDeskView(S.advance(S.pin(state, idOf(state, "Zip Hoodie")), 700), liveId)!;
    const fx = fixtureDeskView();
    expect(keys(desk)).toEqual(keys(fx));
    expect(keys(desk.clock)).toEqual(keys(fx.clock));
    expect(keys(desk.copilot)).toEqual(keys(fx.copilot));
    expect(keys(desk.charts.viewers)).toEqual(keys(fx.charts.viewers));
    expect(keys(desk.products[0])).toEqual(keys(fx.products[0]));
    expect(keys(desk.comments[0])).toEqual(keys(fx.comments[0]));
    expect(keys(desk.copilot.suggestions[0])).toEqual(keys(fx.copilot.suggestions[0]));
    expect(keys(desk.intentCounts)).toEqual([...COMMENT_INTENTS].sort());
    expect(keys(S.buildStartView(state))).toEqual(keys(fixtureStartView()));
  });

  it("return null for a live id that is not this desk's", () => {
    const { state } = liveDesk();
    expect(S.buildDeskView(state, "live-99")).toBeNull();
    expect(S.buildDeskView(S.initialDeskState(), "live-1")).toBeNull();
  });

  it("say 'not simulated yet' as null, never zero, and label the clocks", () => {
    const { state, liveId } = liveDesk();
    const first = S.buildDeskView(state, liveId)!;
    expect(first.viewers).toBeNull();
    expect(first.fingerprint).toBeNull();
    expect(first.clock).toEqual({ running: false, speed: 1, speeds: [1, 5, 15, 60], elapsedLabel: "00:00", virtualNowLabel: "20:00:00" });
    const later = S.buildDeskView(S.advance(state, 3725), liveId)!;
    expect(later.clock.elapsedLabel).toBe("1:02:05");
    expect(later.clock.virtualNowLabel).toBe("21:02:05");
    expect(later.viewers).toBeGreaterThan(0);
    expect(later.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(S.buildDeskView(S.advance(liveDesk().state, 3725), liveId)!.fingerprint).toBe(later.fingerprint);
  });

  it("count intents over the last two minutes and list comments newest first, masked", () => {
    const { state, liveId } = liveDesk();
    const s = S.advance(S.pin(state, idOf(state, "Zip Hoodie")), 900);
    const v = S.buildDeskView(s, liveId)!;
    const recent = s.live!.comments.filter((c) => c.atSec > 900 - 120);
    for (const i of COMMENT_INTENTS) expect(v.intentCounts[i]).toBe(recent.filter((c) => c.intent === i).length);
    expect(v.comments.length).toBeLessThanOrEqual(50);
    expect(v.comments.every((c, i) => i === 0 || c.atSec <= v.comments[i - 1].atSec)).toBe(true);
    expect(JSON.stringify(v.comments)).not.toMatch(/\d{3,4}[\s.]?\d{3}[\s.]?\d{3}|@example\.com/);
  });

  it("chart add-to-carts per minute for the product on show, with markers and a text alternative", () => {
    const { state, liveId } = liveDesk();
    let s = S.advance(state, 59);
    s = S.pin(s, idOf(s, "Linen Shirt"));
    s = S.advance(s, 181);
    const { addToCart, viewers } = S.buildDeskView(s, liveId)!.charts;
    expect(addToCart.points.map((p) => p.atSec)).toEqual([0, 60, 120, 180]);
    expect(addToCart.points[0].value).toBe(0);
    expect(addToCart.points.slice(1).reduce((n, p) => n + p.value, 0)).toBeGreaterThan(0);
    expect(viewers.points[0]).toEqual({ atSec: 1, value: expect.any(Number) });
    expect(viewers.markers).toEqual([{ atSec: 59, kind: "pin", label: "You pinned Linen Shirt (SIMULATED)" }]);
    for (const c of [addToCart, viewers]) expect(c.summary).toMatch(/Markers show when you acted, not what caused a change\.$/);
  });
});

describe("honesty", () => {
  const run = everything();

  it("carries SIMULATED in every label that shows simulated state", () => {
    for (const v of run.starts) expect(v.platformLabel).toContain("SIMULATED");
    expect(run.desks.length).toBeGreaterThan(40);
    const banners = new Set<string>();
    for (const v of run.desks) {
      expect(v.platformLabel).toContain("SIMULATED");
      expect(v.title).toContain("SIMULATED");
      expect(v.copilot.statusLabel).toContain("SIMULATED");
      for (const c of [v.charts.viewers, v.charts.addToCart]) {
        expect(c.title).toContain("SIMULATED");
        expect(c.summary).toContain("SIMULATED");
        for (const m of c.markers) expect(m.label).toContain("SIMULATED");
      }
      if (v.banner) { expect(v.banner.text).toContain("SIMULATED"); banners.add(v.banner.tone); }
      for (const a of v.assumptions) expect(a).toContain("SIMULATED");
    }
    expect(banners).toEqual(new Set(["danger", "warn", "info"]));
    const kinds = new Set(run.desks.flatMap((v) => v.charts.viewers.markers.map((m) => m.kind)));
    expect(kinds).toEqual(new Set(["pin", "unpin", "host_pin", "host_unpin"]));
    expect(new Set(run.desks.flatMap((v) => v.copilot.suggestions.map((x) => x.state)))).toEqual(new Set(["proposed", "accepted", "dismissed", "performed"]));
  });

  it("never produces a forbidden phrase, in any view or any livedesk source string", () => {
    const text = JSON.stringify(run).toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) expect(text).not.toContain(phrase.toLowerCase());
    const root = path.resolve(import.meta.dirname, "../../../lib/livedesk");
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
      const full = path.join(dir, f);
      return statSync(full).isDirectory() ? files(full) : full.endsWith(".ts") ? [full] : [];
    });
    for (const file of files(root)) {
      const source = readFileSync(file, "utf8").toLowerCase();
      for (const phrase of FORBIDDEN_PHRASES) expect(source, file).not.toContain(phrase.toLowerCase());
    }
  });

  it("says 'signals suggest', never a cause, a promise or a probability", () => {
    const suggestions = run.desks.flatMap((v) => v.copilot.suggestions);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.headline).toMatch(/^Signals suggest /);
      expect(JSON.stringify(s)).not.toMatch(/%|probab|caus|will increase|guarantee/i);
    }
  });
});

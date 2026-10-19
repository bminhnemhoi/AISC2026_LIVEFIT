import { describe, expect, it } from "vitest";
import { roomPulse, verdict, type EstimateState } from "../desk";
import type { Tick } from "../types";
import { KET_LUAN_THEO_MA, LOI_THUONG } from "@/lib/tu-ngu";

/**
 * Ideas taken from Round-2 teams (15/10/2026), turned into tested behaviour:
 * - AISC26-0080: say "change / keep / measure more", not a bare p-value  → verdict()
 * - AISC26-0068: alert only when several signals stay bad together        → roomPulse().alert
 * - AISC26-0072, 0051: compare to a reference band of comparable history → roomPulse() bands
 */

const est = (lo: number, hi: number): EstimateState => ({
  kind: "estimate", estimate: (lo + hi) / 2, ciLow: lo, ciHigh: hi, pValue: 0.01, pText: "p = 0,010", nBlocks: 16, nOn: 8, nOff: 8,
  crossesZero: lo <= 0 && hi >= 0,
});

describe("verdict — đổi / giữ / đo thêm (học từ AISC26-0080)", () => {
  it("interval above 0 → change to LiveLift's pin strategy", () => {
    expect(verdict(est(0.2, 0.9)).kind).toBe("doi");
  });
  it("interval below 0 → keep the old way, with exactly the canon sentence (no extra sentence appended)", () => {
    const v = verdict(est(-0.9, -0.1));
    expect(v.kind).toBe("giu");
    expect(v.detail).toBe(KET_LUAN_THEO_MA.GIU.cau);
  });
  it("interval containing 0, or too few blocks → measure more, with the 90-minute rule", () => {
    expect(verdict(est(-0.2, 0.6)).kind).toBe("do_them");
    const few = verdict({ kind: "not_enough", nBlocks: 4, message: "x" });
    expect(few.kind).toBe("do_them");
    expect(few.detail).toBe(LOI_THUONG.chuaDuKhoi);
    expect(few.detail).toMatch(/90 phút/);
  });
  it("locked or observational sessions never get a causal decision", () => {
    expect(verdict({ kind: "locked", reason: "x" }).kind).toBe("cho");
    expect(verdict({ kind: "observational", reason: "x" }).kind).toBe("cho");
  });
});

function ticks(perWindow: Array<[number, number]>): Tick[] {
  // each window = 10 buckets of 30 s; [viewers, clicks per bucket]
  const out: Tick[] = [];
  perWindow.forEach(([v, c], w) => {
    for (let i = 0; i < 10; i++) {
      out.push({ ts_bucket: new Date(((w * 10 + i) * 30) * 1000).toISOString(), viewers: v, comment_rate: 0, click_count: c });
    }
  });
  return out;
}

describe("roomPulse — dải tham chiếu + cảnh báo nhiều tín hiệu (học từ AISC26-0068, 0072, 0051)", () => {
  it("needs some history before it has a normal band", () => {
    const p = roomPulse(ticks([[50, 2], [50, 2], [50, 2]]));
    expect(p.viewersBand).toBeNull();
    expect(p.alert).toBe(false);
  });

  it("alerts only when viewers AND clicks stay under their band for two windows", () => {
    const normal: Array<[number, number]> = [[60, 3], [55, 3], [62, 4], [58, 3], [61, 3]];
    expect(roomPulse(ticks([...normal, [20, 0], [18, 0]])).alert).toBe(true);
  });

  it("one bad window, or only one bad signal, is not an alert", () => {
    const normal: Array<[number, number]> = [[60, 3], [55, 3], [62, 4], [58, 3], [61, 3]];
    expect(roomPulse(ticks([...normal, [60, 3], [18, 0]])).alert).toBe(false);
    expect(roomPulse(ticks([...normal, [20, 3], [18, 3]])).alert).toBe(false);
  });

  it("states that it is descriptive, never causal", () => {
    const normal: Array<[number, number]> = [[60, 3], [55, 3], [62, 4], [58, 3], [61, 3]];
    expect(roomPulse(ticks([...normal, [20, 0], [18, 0]])).note).toMatch(/chỉ là mô tả, chưa nói được vì sao/);
  });
});

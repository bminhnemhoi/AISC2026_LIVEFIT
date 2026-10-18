import { describe, expect, it } from "vitest";
import { blockStrip, estimateState, fmtFixed, fmtP, funnel, mmss, sourceLabel } from "../desk";
import { SessionSchema, type BaoCao, type Block, type Tick } from "../types";

const block = (i: number, arm: "ON" | "OFF" | null, start: number, end: number): Block => ({
  block_id: `b${i}`,
  block_index: i,
  phase: "mid",
  assignment: arm,
  is_washout: arm === null,
  start_offset_s: start,
  end_offset_s: end,
});

describe("sourceLabel — simulated data is never presented as real", () => {
  it.each([
    [{ platform: "lab", is_demo: false, dry_run: false }, "dan_dung", "DÀN DỰNG"],
    [{ platform: "sim", is_demo: false, dry_run: false }, "mo_phong", "MÔ PHỎNG"],
    [{ platform: "replay", is_demo: false, dry_run: false }, "mo_phong", "MÔ PHỎNG"],
    [{ platform: "youtube", is_demo: true, dry_run: false }, "mo_phong", "MÔ PHỎNG"],
    [{ platform: "youtube", is_demo: false, dry_run: true }, "chay_thu", "CHẠY THỬ"],
    [{ platform: "facebook", is_demo: false, dry_run: false }, "that", "THẬT"],
  ])("%o → %s", (session, kind, text) => {
    const l = sourceLabel(session);
    expect(l.kind).toBe(kind);
    expect(l.text).toBe(text);
  });

  it("synthetic comments downgrade a real-looking session to CHẠY THỬ", () => {
    expect(sourceLabel({ platform: "youtube", is_demo: false, dry_run: false }, 12).kind).toBe("chay_thu");
  });

  it("a dry_run lab room (mo_phong_xem.py --thu-noi-bo) says DÀN DỰNG · THỬ NỘI BỘ, never THẬT or plain CHẠY THỬ", () => {
    const l = sourceLabel({ platform: "lab", is_demo: false, dry_run: true });
    expect(l.text).toBe("DÀN DỰNG · THỬ NỘI BỘ");
    expect(l.kind).toBe("dan_dung");
    expect(l.note).toContain("không vào kết quả gộp");
    // Synthetic comments do not change it either: the lab branch decides first.
    expect(sourceLabel({ platform: "lab", is_demo: false, dry_run: true }, 5).text).toBe("DÀN DỰNG · THỬ NỘI BỘ");
  });

  it("a lab room without dry_run keeps the plain DÀN DỰNG label", () => {
    expect(sourceLabel({ platform: "lab", is_demo: false, dry_run: false }).text).toBe("DÀN DỰNG");
  });

  it("the API's dry_run field reaches the label after parsing (SessionSchema keeps it)", () => {
    const s = SessionSchema.parse({
      session_id: "s-1",
      platform: "lab",
      title: "Thử nội bộ · Phòng xem LiveLift",
      mode: "auto",
      status: "live",
      planned_duration_min: 180,
      dry_run: true,
      is_demo: false,
    });
    expect(sourceLabel(s).text).toBe("DÀN DỰNG · THỬ NỘI BỘ");
  });
});

describe("blockStrip", () => {
  const blocks = [block(0, "ON", 0, 300), block(1, null, 300, 360), block(2, "OFF", 360, 660)];
  it("widths add up to 100% and states follow the clock", () => {
    const s = blockStrip(blocks, 400);
    expect(s.reduce((a, b) => a + b.widthPct, 0)).toBeCloseTo(100, 6);
    expect(s.map(b => b.state)).toEqual(["past", "past", "now"]);
    expect(s.map(b => b.arm)).toEqual(["ON", "WASH", "OFF"]);
  });
  it("empty schedule gives an empty strip", () => {
    expect(blockStrip([], 0)).toEqual([]);
  });
});

describe("funnel", () => {
  const ticks: Tick[] = [
    { ts_bucket: "a", viewers: 10, comment_rate: 0, click_count: 2 },
    { ts_bucket: "b", viewers: 20, comment_rate: 0, click_count: 4 },
  ];
  it("computes exposure from 30-second buckets", () => {
    const f = funnel(ticks, { tong_don: 3, tong_san_pham: 3, tong_doanh_thu: 300_000 });
    expect(f.viewerMinutes).toBeCloseTo(15, 9); // (10+20)*30 s = 900 s
    expect(f.clicks).toBe(6);
    expect(f.clickRate).toBeCloseTo((6 / 900) * 1000, 9);
    expect(f.ctor).toBeCloseTo(0.5, 9);
    expect(f.revenuePer1000ViewerMin).toBeCloseTo((300_000 / 15) * 1000, 6);
  });
  it("says nothing when there is no exposure", () => {
    const f = funnel([], null);
    expect(f.clickRate).toBeNull();
    expect(f.ctor).toBeNull();
    expect(f.revenuePer1000ViewerMin).toBeNull();
  });
});

describe("estimateState — never a number the server did not give", () => {
  const base = { nhan: "x", loai_phien: "thi_nghiem" } as Pick<BaoCao, "nhan" | "loai_phien">;
  it("observational session has no causal number", () => {
    expect(estimateState({ ...base, loai_phien: "quan_sat", ket_qua_thi_nghiem: null }).kind).toBe("observational");
  });
  it("locked by preregistration", () => {
    const s = estimateState({ ...base, ket_qua_thi_nghiem: { khoa: true, ly_do_khoa: "khoá §7", estimable: false, n_blocks: 0, n_on: 0, n_off: 0 } });
    expect(s).toEqual({ kind: "locked", reason: "khoá §7" });
  });
  it("not enough blocks", () => {
    const s = estimateState({ ...base, ket_qua_thi_nghiem: { khoa: false, estimable: false, n_blocks: 3, n_on: 2, n_off: 1, message: "cần thêm khối" } });
    expect(s).toEqual({ kind: "not_enough", nBlocks: 3, message: "cần thêm khối" });
  });
  it("estimate with CI, flags when the interval crosses zero", () => {
    const s = estimateState({
      ...base,
      ket_qua_thi_nghiem: { khoa: false, estimable: true, n_blocks: 18, n_on: 9, n_off: 9, estimate: 0.12, ci_low: -0.03, ci_high: 0.27, p_value: 0.11 },
    });
    expect(s.kind).toBe("estimate");
    if (s.kind === "estimate") expect(s.crossesZero).toBe(true);
  });
  it("no report yet", () => {
    expect(estimateState(null).kind).toBe("not_enough");
  });
  it("p prints the permutation floor like the server summary, and decimals are fixed", () => {
    expect(fmtP(1 / 1001, 1000)).toBe("p < 0,001");
    expect(fmtP(1 / 201, 200)).toBe("p < 0,005");
    expect(fmtP(0.3147, 1000)).toBe("p = 0,315");
    expect(fmtP(null, 1000)).toBeNull();
    expect(fmtFixed(-0.49, 3)).toBe("-0,490");
    expect(fmtFixed(1.2235, 3)).toBe("1,224");
  });
});

describe("mmss", () => {
  it("formats and clamps", () => {
    expect(mmss(125.9)).toBe("02:05");
    expect(mmss(-3)).toBe("00:00");
  });
});

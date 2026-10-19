import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "../client";
import { verdict } from "../desk";
import {
  ExperimentSummarySchema,
  PlatformReadinessSchema,
  SUMMARY_DEMO_PATH,
  chuanHoaChu,
  dongNenTang,
  gopApi,
  gopState,
  loiTiengViet,
  lyDoLoai,
  soCoDau,
  summaryPath,
  tomTatGop,
} from "../gop";
import gopVang from "./fixtures/gop-demo-vang.json";
import gopMot from "./fixtures/gop-demo-mot-phien.json";
import nenTang from "./fixtures/nen-tang-chua-khoa.json";

/**
 * Fixtures are real payloads of the API (`GET /experiment/summary?env=demo` after `demo/seed-vang` with 6 then 1 ended
 * sample sessions; `GET /platforms` with no platform key set).
 */

describe("schemas parse the real payloads", () => {
  it("pooled DEMO summary", () => {
    const s = ExperimentSummarySchema.parse(gopVang);
    expect(s.env).toBe("demo");
    expect(s.n_sessions).toBe(6);
    expect(s.tom_tat_3_cau).toHaveLength(3);
  });

  it("platform readiness, five rows", () => {
    const rows = PlatformReadinessSchema.array().parse(nenTang);
    expect(rows.map((r) => r.platform)).toEqual(["youtube", "facebook", "shopee", "tiktok", "mo_phong"]);
  });

  it("a payload that lost a required field fails loudly", () => {
    expect(() => ExperimentSummarySchema.parse({ ...gopVang, env: "prod" })).toThrow(z.ZodError);
  });
});

describe("gopState: the pooled result uses the one-session rule", () => {
  it("finite interval above 0: estimate, ĐỔI", () => {
    const st = gopState(ExperimentSummarySchema.parse(gopVang));
    expect(st.kind).toBe("estimate");
    if (st.kind !== "estimate") return;
    expect(st.estimate).toBe(gopVang.estimate);
    expect(st.ciLow).toBe(gopVang.ci_low);
    expect(st.crossesZero).toBe(false);
    expect(st.pText).toBe("p < 0,001");
    expect(verdict(st).kind).toBe("doi");
  });

  it("not estimable: not_enough with the server's reason, cleaned", () => {
    const st = gopState(ExperimentSummarySchema.parse(gopMot));
    expect(st.kind).toBe("not_enough");
    if (st.kind !== "not_enough") return;
    expect(st.nBlocks).toBe(16);
    expect(st.message).toContain("cần ≥ 2 phiên đã kết thúc");
    expect(st.message).not.toMatch(/—/);
  });

  it("estimable flag without numbers is still not_enough (never a made-up number)", () => {
    const st = gopState(ExperimentSummarySchema.parse({ ...gopVang, ci_high: null }));
    expect(st.kind).toBe("not_enough");
  });
});

describe("chuanHoaChu: public text has no long dash, no KTC, canon terms and spelling", () => {
  it.each([
    ["(KTC 95% [+0,458; +0,819] — không chứa 0)", "(khoảng tin cậy 95% [+0,458; +0,819], không chứa 0)"],
    ["kiểm định hoán vị 1.000 lần", "kiểm định ngẫu nhiên hoá 1.000 lần"],
    ["bàn trợ live", "bàn thí nghiệm"],
    ["Khóa lịch, tối ưu hóa, xóa", "Khoá lịch, tối ưu hoá, xoá"],
    ["minh họa tùy chọn", "minh hoạ tuỳ chọn"],
    ["phiên THẬT — không thuộc bản gộp dữ liệu mẫu (xem env=real)", "phiên THẬT, không thuộc bản gộp dữ liệu mẫu"],
    ["80–95 s", "80–95 s"],
    ["a – b", "a, b"],
  ])("%s", (vao, ra) => {
    expect(chuanHoaChu(vao)).toBe(ra);
  });

  it("the three pooled sentences come out clean, badges kept", () => {
    const cau = tomTatGop(ExperimentSummarySchema.parse(gopVang));
    expect(cau).toHaveLength(3);
    for (const c of cau) {
      expect(c.text).not.toMatch(/—|\bKTC\b|hoán vị/);
      expect(c.text.length).toBeGreaterThan(0);
    }
    expect(cau.map((c) => c.badge)).toEqual(["thi_nghiem", "thi_nghiem", "quan_sat"]);
    expect(tomTatGop({ tom_tat_3_cau: [{ text: "  " }] })).toEqual([]);
  });
});

describe("soCoDau", () => {
  it("typographic minus, plus sign, exact zero", () => {
    expect(soCoDau(0.636)).toBe("+0,636");
    expect(soCoDau(-0.12)).toBe("−0,120");
    expect(soCoDau(0)).toBe("0,000");
    expect(soCoDau(-0.0001)).toBe("0,000");
    expect(soCoDau(1.23456, 2)).toBe("+1,23");
  });
});

describe("lyDoLoai: excluded sessions are counted, never hidden", () => {
  it("non-zero reasons only, cleaned", () => {
    expect(lyDoLoai(ExperimentSummarySchema.parse(gopMot))).toEqual([{ text: "phiên chưa kết thúc hoặc đã huỷ (không có khối đo hoàn tất)", n: 1 }]);
    expect(lyDoLoai({ sessions_excluded: { a: 0 } })).toEqual([]);
  });
});

describe("dongNenTang: says exactly what ready/mode/missing say", () => {
  const rows = PlatformReadinessSchema.array().parse(nenTang).map(dongNenTang);

  it("one row per platform, server order", () => {
    expect(rows.map((r) => r.tinhTrang)).toEqual(["chua_noi", "chua_noi", "chua_noi", "khong_ho_tro", "du_phong"]);
    expect(rows[1].nhan).toBe("Chưa nối, thiếu 2 khoá");
    expect(rows[2].thieu).toHaveLength(4);
    expect(rows[3].nhan).toBe("Không có đường thu tự động");
    expect(rows[4].nhan).toBe("Dùng được, đường dự phòng");
  });

  it("names of missing keys only, never values; notes cleaned", () => {
    for (const r of rows) {
      expect(r.thieu.every((k) => /^[A-Z_]+$/.test(k))).toBe(true);
      expect(r.ghiChu).not.toMatch(/—/);
    }
  });

  it("ready official API", () => {
    const r = dongNenTang(PlatformReadinessSchema.parse({ platform: "x", ten: "X", ready: true, mode: "chinh_thuc" }));
    expect(r).toMatchObject({ tinhTrang: "san_sang", nhan: "Sẵn sàng, API chính thức", thieu: [] });
    const m = dongNenTang(PlatformReadinessSchema.parse({ platform: "x", ten: "X", ready: false, mode: "du_phong" }));
    expect(m.nhan).toBe("Chưa nối");
  });
});

describe("loiTiengViet: never the browser's English or a zod dump", () => {
  it.each([
    [new ApiError(403, "Đường này chưa được mở cho bàn thí nghiệm."), "Đường này chưa được mở cho bàn thí nghiệm."],
    [new TypeError("Failed to fetch"), "Không kết nối được máy chủ LiveLift."],
    [new Error("boom"), "dự phòng"],
  ])("%s", (e, ra) => {
    expect(loiTiengViet(e, "dự phòng")).toBe(ra);
  });

  it("zod error", () => {
    const r = ExperimentSummarySchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(loiTiengViet(r.error, "x")).toBe("Máy chủ trả dữ liệu không đúng dạng bàn thí nghiệm chờ đợi.");
  });
});

describe("gopApi through the proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("paths keep only the env query the proxy lets through", () => {
    expect(SUMMARY_DEMO_PATH).toBe("experiment/summary?env=demo");
    expect(summaryPath("real")).toBe("experiment/summary?env=real");
  });

  it("reads and validates; GET, no-store, abortable", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(gopVang), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const ac = new AbortController();
    const s = await gopApi.summary("demo", ac.signal);
    expect(s.n_blocks).toBe(83);
    expect(f).toHaveBeenCalledWith("/api/ll/experiment/summary?env=demo", { method: "GET", cache: "no-store", signal: ac.signal });
  });

  it("proxy refusal becomes an ApiError carrying the server's Vietnamese detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Không được phép." }), { status: 403 })));
    await expect(gopApi.platforms()).rejects.toMatchObject({ status: 403, message: "Không được phép." });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 502 })));
    await expect(gopApi.summaryDemo()).rejects.toMatchObject({ status: 502, message: "Lỗi 502" });
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../client";
import { BaoCaoSchema, BlockSchema, CommentSchema, SessionSchema, TickSchema, type BaoCao, type Session } from "../../types";
import doi1Json from "@/lib/bieu-do/__tests__/fixtures/phien-doi-1.json";
import khoaJson from "@/lib/bieu-do/__tests__/fixtures/phien-thu-noi-bo-khoa.json";
import liveJson from "@/lib/bieu-do/__tests__/fixtures/phien-mo-phong-dang-live.json";

const api = vi.hoisted(() => ({
  session: vi.fn(),
  schedule: vi.fn(),
  ticks: vi.fn(),
  comments: vi.fn(),
  orders: vi.fn(),
  baoCao: vi.fn(),
}));

vi.mock("../../client", async (goc) => ({ ...(await goc<typeof import("../../client")>()), api }));

const { BAO_CAO_MOI_N_LUOT, taiDuLieuPhien, useBaoCao, useDuLieuPhien, useHoiDinhKy, useTicks } = await import("..");

function phienMau(json: unknown) {
  const j = json as Record<string, unknown>;
  return {
    phien: SessionSchema.parse(j.phien),
    khoi: BlockSchema.array().parse(j.khoi),
    ticks: TickSchema.array().parse(j.ticks),
    binhLuan: CommentSchema.array().parse(j.binhLuan),
    baoCao: BaoCaoSchema.parse(j.baoCao),
    don: { tong_don: 0, tong_san_pham: 0, tong_doanh_thu: 0 },
  };
}

type Mau = ReturnType<typeof phienMau>;

function napApi(m: Mau): void {
  api.session.mockResolvedValue(m.phien);
  api.schedule.mockResolvedValue(m.khoi);
  api.ticks.mockResolvedValue(m.ticks);
  api.comments.mockResolvedValue(m.binhLuan);
  api.orders.mockResolvedValue(m.don);
  api.baoCao.mockResolvedValue(m.baoCao);
}

let trangThaiTab: DocumentVisibilityState = "visible";
function datTab(tt: DocumentVisibilityState): void {
  trangThaiTab = tt;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  trangThaiTab = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => trangThaiTab });
  for (const f of Object.values(api)) f.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Một lời hứa mình tự giải quyết. */
function hua<T>() {
  let giai!: (v: T) => void;
  let tuChoi!: (e: unknown) => void;
  const p = new Promise<T>((a, b) => {
    giai = a;
    tuChoi = b;
  });
  return { p, giai, tuChoi };
}

describe("useHoiDinhKy: hỏi định kỳ không chồng lượt", () => {
  it("lượt sau chỉ hẹn khi lượt trước xong; làm mới giữa chừng không mở lượt thứ hai", async () => {
    let dangChay = 0;
    let toiDa = 0;
    const cho: Array<ReturnType<typeof hua<number>>> = [];
    const tai = vi.fn(() => {
      dangChay++;
      toiDa = Math.max(toiDa, dangChay);
      const h = hua<number>();
      cho.push(h);
      return h.p.finally(() => dangChay--);
    });
    const { result } = renderHook(() => useHoiDinhKy("a", tai, { chuKyMs: 3000 }));
    expect(tai).toHaveBeenCalledTimes(1);
    expect(result.current.dangTai).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(tai).toHaveBeenCalledTimes(1);

    act(() => result.current.lamMoi());
    expect(tai).toHaveBeenCalledTimes(1);

    await act(async () => {
      cho[0].giai(1);
      await vi.advanceTimersByTimeAsync(0);
    });
    // Lượt bị dồn chạy ngay sau khi lượt đầu xong, không song song.
    expect(tai).toHaveBeenCalledTimes(2);
    expect(result.current.duLieu).toBe(1);

    await act(async () => {
      cho[1].giai(2);
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(tai).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(tai).toHaveBeenCalledTimes(3);
    expect(toiDa).toBe(1);
    expect(tai.mock.calls.map((c) => (c as unknown[])[0]).map((ng) => (ng as { lan: number }).lan)).toEqual([0, 1, 2]);
  });

  it("dừng khi tab ẩn, hiện lại thì hỏi ngay một lượt", async () => {
    const tai = vi.fn(async () => 7);
    renderHook(() => useHoiDinhKy("a", tai, { chuKyMs: 3000 }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(tai).toHaveBeenCalledTimes(1);

    act(() => datTab("hidden"));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(tai).toHaveBeenCalledTimes(1);

    act(() => datTab("visible"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(tai).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(tai).toHaveBeenCalledTimes(3);
  });

  it("dừng hẳn khi dungKhi trả true", async () => {
    const tai = vi.fn(async () => ({ xong: true }));
    const { result } = renderHook(() => useHoiDinhKy("a", tai, { chuKyMs: 3000, dungKhi: (d) => d.xong }));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(tai).toHaveBeenCalledTimes(1);
    expect(result.current.daDung).toBe(true);
  });

  it("khoá null thì không hỏi gì; gỡ hook thì ngừng hẳn", async () => {
    const tai = vi.fn(async () => 1);
    renderHook(() => useHoiDinhKy(null, tai));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(tai).not.toHaveBeenCalled();

    const { unmount } = renderHook(() => useHoiDinhKy("b", tai, { chuKyMs: 1000 }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(tai).toHaveBeenCalledTimes(1);
  });

  it("lỗi: lời tiếng Việt, giữ dữ liệu cũ", async () => {
    const tai = vi.fn().mockResolvedValueOnce(5).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValueOnce(new ApiError(403, "Đường này chưa mở."));
    const { result } = renderHook(() => useHoiDinhKy<number>("a", tai, { chuKyMs: 1000 }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.duLieu).toBe(5);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.loi).toBe("Không kết nối được máy chủ LiveLift.");
    expect(result.current.duLieu).toBe(5);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.loi).toBe("Đường này chưa mở.");
  });

  it("đổi khoá: bỏ dữ liệu cũ, bắt đầu lại từ lượt 0", async () => {
    const tai = vi.fn(async ({ lan }: { lan: number }) => lan);
    const { result, rerender } = renderHook(({ k }) => useHoiDinhKy(k, tai, { chuKyMs: 1000 }), { initialProps: { k: "a" } });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.duLieu).toBe(2);
    rerender({ k: "b" });
    expect(result.current.duLieu).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.duLieu).toBe(0);
  });
});

describe("taiDuLieuPhien: một lượt đọc", () => {
  it("báo cáo nặng chỉ đọc mỗi lượt thứ 5 và khi phiên đổi trạng thái; lịch đọc một lần", async () => {
    const m = phienMau(liveJson);
    napApi(m);
    vi.useRealTimers();
    let truoc = await taiDuLieuPhien("x", 0, null);
    expect(api.baoCao).toHaveBeenCalledTimes(1);
    for (let lan = 1; lan < BAO_CAO_MOI_N_LUOT; lan++) truoc = await taiDuLieuPhien("x", lan, truoc);
    expect(api.baoCao).toHaveBeenCalledTimes(1);
    expect(api.schedule).toHaveBeenCalledTimes(1);
    truoc = await taiDuLieuPhien("x", BAO_CAO_MOI_N_LUOT, truoc);
    expect(api.baoCao).toHaveBeenCalledTimes(2);
    api.session.mockResolvedValue({ ...m.phien, status: "ended" });
    await taiDuLieuPhien("x", 6, truoc);
    expect(api.baoCao).toHaveBeenCalledTimes(3);
  });

  it("đường phụ lỗi thì giữ số cũ, đường chính lỗi thì cả lượt lỗi", async () => {
    const m = phienMau(liveJson);
    napApi(m);
    vi.useRealTimers();
    const truoc = await taiDuLieuPhien("x", 0, null);
    api.ticks.mockRejectedValue(new Error("x"));
    const sau = await taiDuLieuPhien("x", 1, truoc);
    expect(sau.ticks).toBe(truoc.ticks);
    api.session.mockRejectedValue(new ApiError(404, "Không có phiên."));
    await expect(taiDuLieuPhien("x", 2, sau)).rejects.toMatchObject({ status: 404 });
  });
});

describe("useDuLieuPhien: khoá §7", () => {
  it("phòng thử nội bộ đang khoá: không có ước lượng, không tính tỷ lệ từng khối, kể cả khi máy chủ lỡ gửi số", async () => {
    const m = phienMau(khoaJson);
    const loGui: BaoCao = { ...m.baoCao, ket_qua_thi_nghiem: { ...m.baoCao.ket_qua_thi_nghiem!, estimable: true, estimate: 3, ci_low: 1, ci_high: 5, p_value: 0.01 } };
    napApi({ ...m, baoCao: loGui });
    const { result } = renderHook(() => useDuLieuPhien("x"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.phien?.platform).toBe("lab");
    expect(result.current.khoa).toBe(true);
    expect(result.current.khoiDo).toBeNull();
    expect(result.current.baoCao?.ket_qua_thi_nghiem).toMatchObject({ khoa: true, estimate: null, ci_low: null, ci_high: null, p_value: null });
    // Phòng THỬ NỘI BỘ đang live: khoá như phiên thật, không tô nền khối, không đường nhỏ Tỷ lệ nhấp (khoá §7).
    expect(result.current.toNen.cho).toBe(false);
    expect(result.current.toNen.dong).toContain("THỬ NỘI BỘ đang live");
    expect(result.current.nguon?.text).toBe("DÀN DỰNG · THỬ NỘI BỘ");
  });

  it("phiên THẬT đang live: khoá, không tô nền khối", async () => {
    const m = phienMau(liveJson);
    const phien: Session = { ...m.phien, platform: "youtube", is_demo: false, dry_run: false, status: "live" };
    const baoCao: BaoCao = { ...m.baoCao, is_demo: false, ket_qua_thi_nghiem: { ...m.baoCao.ket_qua_thi_nghiem!, khoa: true, ly_do_khoa: "Phiên đang chạy." } };
    napApi({ ...m, phien, baoCao });
    const { result } = renderHook(() => useDuLieuPhien("x"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.nguon?.kind).toBe("that");
    expect(result.current.dangLive).toBe(true);
    expect(result.current.khoa).toBe(true);
    expect(result.current.khoiDo).toBeNull();
    expect(result.current.toNen.cho).toBe(false);
    expect(result.current.baoCao?.ket_qua_thi_nghiem?.estimate).toBeNull();
  });

  it("phiên MÔ PHỎNG đã xong: mở khoá, có tỷ lệ từng khối, ngừng hỏi", async () => {
    const m = phienMau(doi1Json);
    napApi(m);
    const { result } = renderHook(() => useDuLieuPhien("x"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.khoa).toBe(false);
    expect(result.current.khoiDo).toHaveLength(16);
    expect(result.current.toNen.cho).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(api.session).toHaveBeenCalledTimes(1);
  });

  it("chưa có mã phiên: không hỏi, coi như khoá", async () => {
    const { result } = renderHook(() => useDuLieuPhien(null));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(api.session).not.toHaveBeenCalled();
    expect(result.current.khoa).toBe(true);
    expect(result.current.dangTai).toBe(false);
  });
});

describe("useBaoCao, useTicks", () => {
  it("useBaoCao xoá ước lượng khi khoá", async () => {
    const m = phienMau(khoaJson);
    api.baoCao.mockResolvedValue({ ...m.baoCao, ket_qua_thi_nghiem: { ...m.baoCao.ket_qua_thi_nghiem!, estimate: 9 } });
    const { result } = renderHook(() => useBaoCao("x"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.duLieu?.ket_qua_thi_nghiem?.khoa).toBe(true);
    expect(result.current.duLieu?.ket_qua_thi_nghiem?.estimate).toBeNull();
  });

  it("useBaoCao ngừng hỏi khi đã mở khoá nếu được yêu cầu", async () => {
    api.baoCao.mockResolvedValue(phienMau(doi1Json).baoCao);
    renderHook(() => useBaoCao("x", { dungKhiMoKhoa: true }));
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(api.baoCao).toHaveBeenCalledTimes(1);
  });

  it("useTicks hỏi mỗi 3 giây", async () => {
    api.ticks.mockResolvedValue([]);
    renderHook(() => useTicks("x"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(api.ticks).toHaveBeenCalledTimes(4);
  });
});

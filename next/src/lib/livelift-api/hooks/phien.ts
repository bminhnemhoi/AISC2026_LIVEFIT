"use client";

import { useMemo } from "react";
import { daMoKhoa, chanUocLuongKhiKhoa, quyenToNenKhoi, type QuyenToNen } from "@/lib/bieu-do/khoa";
import { khoiTuTicks, type KhoiDo } from "@/lib/bieu-do/chuoi";
import { api } from "../client";
import { sourceLabel, type SourceLabel } from "../desk";
import { gopApi, type ExperimentSummary } from "../gop";
import type { BaoCao, Block, Comment, OrderSummary, Session, Tick } from "../types";
import { CHU_KY_MAC_DINH_MS, useHoiDinhKy, type KetQuaHoi } from "./useHoiDinhKy";

/**
 * Hook dữ liệu cho biểu đồ: hỏi máy chủ mỗi 3 giây, không chồng lượt, dừng khi tab ẩn (xem `useHoiDinhKy`).
 * Khoá §7: báo cáo đang khoá được xoá mọi ước lượng trước khi trả ra, và tỷ lệ từng khối (`khoiDo`) chỉ được tính khi
 * máy chủ nói kết quả đã mở (`khoa === false`).
 */

/** Báo cáo nặng hơn các đường khác: mỗi lượt thứ 5 mới đọc lại (khoảng 15 giây), và luôn đọc khi phiên đổi trạng thái. */
export const BAO_CAO_MOI_N_LUOT = 5;

const XONG = new Set(["ended", "cancelled"]);

async function deYen<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

/** Điểm đo người xem/lượt nhấp của một phiên. */
export function useTicks(sessionId: string | null, tuyChon: { chuKyMs?: number } = {}): KetQuaHoi<Tick[]> {
  return useHoiDinhKy<Tick[]>(sessionId, () => api.ticks(sessionId as string), {
    chuKyMs: tuyChon.chuKyMs ?? CHU_KY_MAC_DINH_MS,
    loiMacDinh: "Không đọc được điểm đo của phiên.",
  });
}

/**
 * Báo cáo sau phiên của một phiên, đã qua khoá §7. `dungKhiMoKhoa`: ngừng hỏi khi kết quả đã mở (đặt khi biết phiên
 * đã kết thúc; phiên mẫu đang live cũng "mở" nhưng số vẫn đổi theo từng khối).
 */
export function useBaoCao(sessionId: string | null, tuyChon: { chuKyMs?: number; dungKhiMoKhoa?: boolean } = {}): KetQuaHoi<BaoCao> {
  const { chuKyMs = CHU_KY_MAC_DINH_MS, dungKhiMoKhoa = false } = tuyChon;
  return useHoiDinhKy<BaoCao>(sessionId, async () => chanUocLuongKhiKhoa(await api.baoCao(sessionId as string)), {
    chuKyMs,
    dungKhi: dungKhiMoKhoa ? (b) => daMoKhoa(b) : undefined,
    loiMacDinh: "Không đọc được báo cáo của phiên.",
  });
}

export interface DuLieuPhienTho {
  phien: Session;
  khoi: Block[];
  ticks: Tick[];
  binhLuan: Comment[];
  don: OrderSummary | null;
  baoCao: BaoCao | null;
}

/** Một lượt đọc của `useDuLieuPhien`. Tách riêng để test không cần React. */
export async function taiDuLieuPhien(sessionId: string, lan: number, truoc: DuLieuPhienTho | null): Promise<DuLieuPhienTho> {
  const [phien, khoi, ticks, binhLuan, don] = await Promise.all([
    api.session(sessionId),
    truoc && truoc.khoi.length > 0 ? Promise.resolve(truoc.khoi) : api.schedule(sessionId),
    deYen(api.ticks(sessionId)),
    deYen(api.comments(sessionId)),
    deYen(api.orders(sessionId)),
  ]);
  const doiTrangThai = !truoc || truoc.phien.status !== phien.status;
  const canBaoCao = doiTrangThai || lan % BAO_CAO_MOI_N_LUOT === 0 || truoc?.baoCao == null;
  const baoCaoMoi = canBaoCao ? await deYen(api.baoCao(sessionId)) : undefined;
  const baoCao = baoCaoMoi === undefined ? (truoc?.baoCao ?? null) : baoCaoMoi ? chanUocLuongKhiKhoa(baoCaoMoi) : (truoc?.baoCao ?? null);
  return {
    phien,
    khoi,
    ticks: ticks ?? truoc?.ticks ?? [],
    binhLuan: binhLuan ?? truoc?.binhLuan ?? [],
    don: don ?? truoc?.don ?? null,
    baoCao,
  };
}

/** Phiên đã xong và báo cáo đã có: dữ liệu không còn đổi, ngừng hỏi. */
export function phienDaXong(d: DuLieuPhienTho): boolean {
  return XONG.has(d.phien.status) && d.baoCao != null;
}

export interface DuLieuPhien {
  phien: Session | null;
  khoi: Block[];
  ticks: Tick[];
  binhLuan: Comment[];
  don: OrderSummary | null;
  /** Đã qua khoá §7: khi khoá thì không có ước lượng. */
  baoCao: BaoCao | null;
  nguon: SourceLabel | null;
  dangLive: boolean;
  /** True trừ khi máy chủ nói rõ kết quả đã mở. Dùng cho ThuocKhoangTinCay và ChamTheoKhoi. */
  khoa: boolean;
  /** Tỷ lệ nhấp từng khối; null khi còn khoá. */
  khoiDo: KhoiDo[] | null;
  /** Có được tô nền BẬT/TẮT lên DuongThoiGian không, kèm dòng giải thích. */
  toNen: QuyenToNen;
  loi: string | null;
  dangTai: boolean;
  capNhatLuc: number | null;
  lamMoi: () => void;
}

/** Mọi thứ bàn thí nghiệm và tổng kết cần để vẽ biểu đồ của một phiên. */
export function useDuLieuPhien(sessionId: string | null, chuKyMs = CHU_KY_MAC_DINH_MS): DuLieuPhien {
  const hoi = useHoiDinhKy<DuLieuPhienTho>(sessionId, ({ lan, truoc }) => taiDuLieuPhien(sessionId as string, lan, truoc), {
    chuKyMs,
    dungKhi: phienDaXong,
    loiMacDinh: "Không đọc được dữ liệu phiên.",
  });
  const d = hoi.duLieu;
  const suyRa = useMemo(() => {
    if (!d) return { nguon: null, dangLive: false, khoa: true, khoiDo: null, toNen: { cho: false, dong: null } };
    const nguon = sourceLabel(d.phien, d.baoCao?.binh_luan_tong_hop ?? 0);
    const dangLive = d.phien.status === "live";
    const moKhoa = daMoKhoa(d.baoCao);
    return {
      nguon,
      dangLive,
      khoa: !moKhoa,
      khoiDo: moKhoa ? khoiTuTicks(d.khoi, d.ticks, d.phien.start_ts, d.phien.end_ts) : null,
      toNen: quyenToNenKhoi(nguon, dangLive),
    };
  }, [d]);
  return {
    phien: d?.phien ?? null,
    khoi: d?.khoi ?? [],
    ticks: d?.ticks ?? [],
    binhLuan: d?.binhLuan ?? [],
    don: d?.don ?? null,
    baoCao: d?.baoCao ?? null,
    ...suyRa,
    loi: hoi.loi,
    dangTai: hoi.dangTai,
    capNhatLuc: hoi.capNhatLuc,
    lamMoi: hoi.lamMoi,
  };
}

/**
 * Kết quả gộp nhiều phiên (`/experiment/summary`). Đổi chậm nên mặc định 15 giây. Cần N3 mở cặp GET này trong
 * allowlist.ts; trước đó hook trả lỗi tiếng Việt từ proxy.
 */
export function useKetQuaGop(env: "real" | "demo" = "demo", chuKyMs = 15000): KetQuaHoi<ExperimentSummary> {
  return useHoiDinhKy<ExperimentSummary>(`gop-${env}`, ({ signal }) => gopApi.summary(env, signal), {
    chuKyMs,
    loiMacDinh: "Không đọc được kết quả gộp.",
  });
}

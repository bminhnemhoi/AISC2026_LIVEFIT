import { estimateState, sourceLabel, type EstimateState } from "@/lib/livelift-api/desk";
import { chuanHoaChu, gopState, type ExperimentSummary } from "@/lib/livelift-api/gop";
import type { BaoCao, Session } from "@/lib/livelift-api/types";
import { vungCua, type VungKetLuan } from "./ket-luan";

/**
 * Hàng của biểu đồ rừng: mỗi phiên một hàng, hàng cuối là kết quả gộp (vẽ hình thoi). Mọi số lấy nguyên từ máy chủ
 * (`/bao-cao` từng phiên, `/experiment/summary` cho hàng gộp). Phiên không có ước lượng vẫn có hàng, kèm lý do,
 * để không ai tưởng phiên đó bị giấu.
 */

interface DongChung {
  id: string;
  ten: string;
  /** Nhãn nguồn: MÔ PHỎNG, DÀN DỰNG, THẬT... */
  nhan: string | null;
  loai: "phien" | "gop";
}

export interface DongRungCoSo extends DongChung {
  coSo: true;
  uocLuong: number;
  thap: number;
  cao: number;
  nKhoi: number;
  vung: VungKetLuan;
}

export interface DongRungKhongSo extends DongChung {
  coSo: false;
  lyDo: string;
}

export type DongRung = DongRungCoSo | DongRungKhongSo;

/** Một hàng từ trạng thái ước lượng (đã qua khoá §7 của máy chủ). */
export function dongRungTuTrangThai(chung: DongChung, s: EstimateState): DongRung {
  if (s.kind === "estimate") {
    const vung = vungCua(s.ciLow, s.ciHigh);
    if (vung) return { ...chung, coSo: true, uocLuong: s.estimate, thap: s.ciLow, cao: s.ciHigh, nKhoi: s.nBlocks, vung };
    return { ...chung, coSo: false, lyDo: "Khoảng tin cậy không xác định." };
  }
  if (s.kind === "locked") return { ...chung, coSo: false, lyDo: "Khoá tới khi hết phiên." };
  if (s.kind === "observational") return { ...chung, coSo: false, lyDo: "Phiên quan sát, không bốc thăm nên không có ước lượng." };
  return { ...chung, coSo: false, lyDo: chuanHoaChu(s.message) };
}

export function tenPhien(p: Pick<Session, "session_id" | "title">): string {
  return p.title?.trim() || `Phiên ${p.session_id.slice(0, 8)}`;
}

/** Hàng của một phiên, từ phiên và báo cáo của nó. Báo cáo chưa đọc được thì hàng nói đúng như vậy. */
export function dongRungTuBaoCao(phien: Pick<Session, "session_id" | "title" | "platform" | "is_demo" | "dry_run">, baoCao: BaoCao | null): DongRung {
  const chung: DongChung = { id: phien.session_id, ten: tenPhien(phien), nhan: sourceLabel(phien, baoCao?.binh_luan_tong_hop ?? 0).text, loai: "phien" };
  return dongRungTuTrangThai(chung, estimateState(baoCao));
}

/** Nhãn nguồn của kết quả gộp: kho DEMO chỉ chứa phiên `is_demo`, nên luôn là MÔ PHỎNG. */
export function nhanGop(s: Pick<ExperimentSummary, "env">): string {
  return s.env === "demo" ? "MÔ PHỎNG" : "THẬT";
}

/** Hàng gộp (hình thoi), cùng luật ĐỔI / GIỮ / ĐO THÊM như một phiên. */
export function dongRungGop(s: ExperimentSummary): DongRung {
  const chung: DongChung = { id: `gop-${s.env}`, ten: `Gộp ${s.n_sessions} phiên`, nhan: nhanGop(s), loai: "gop" };
  return dongRungTuTrangThai(chung, gopState(s));
}

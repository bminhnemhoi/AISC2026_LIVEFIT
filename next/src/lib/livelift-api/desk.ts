import type { BaoCao, Block, KetQua, OrderSummary, Session, Tick } from "./types";

/**
 * Pure mappings from API payloads to what the experiment desk shows. No fetching, no React: every number on the
 * desk can be traced to one function here and one API field, and each function is unit-tested.
 */

export type SourceKind = "mo_phong" | "dan_dung" | "chay_thu" | "that";

export interface SourceLabel {
  kind: SourceKind;
  text: string;
  note: string;
}

/** The label that must be visible on every screen state. Simulated data is never presented as real. */
export function sourceLabel(session: Pick<Session, "platform" | "is_demo" | "dry_run">, syntheticComments = 0): SourceLabel {
  if (session.platform === "lab") {
    return { kind: "dan_dung", text: "DÀN DỰNG", note: "Người thật ẩn danh trong phòng dàn dựng, mua bằng tiền ảo." };
  }
  if (session.is_demo || session.platform === "sim" || session.platform === "replay") {
    return { kind: "mo_phong", text: "MÔ PHỎNG", note: "Dữ liệu do máy sinh. Không phải buổi live thật." };
  }
  if (session.dry_run || syntheticComments > 0) {
    return { kind: "chay_thu", text: "CHẠY THỬ", note: "Phiên tập dượt, bị loại khỏi kết quả gộp." };
  }
  return { kind: "that", text: "THẬT", note: "Buổi live thật, dữ liệu qua API chính thức." };
}

export interface StripBlock {
  index: number;
  arm: "ON" | "OFF" | "WASH";
  widthPct: number;
  state: "past" | "now" | "future";
}

/** The BẬT/TẮT strip for the OPERATOR only (the host and viewers never see arms). */
export function blockStrip(blocks: Block[], elapsedS: number): StripBlock[] {
  if (blocks.length === 0) return [];
  const total = Math.max(...blocks.map(b => b.end_offset_s)) || 1;
  return blocks.map(b => ({
    index: b.block_index,
    arm: b.is_washout || !b.assignment ? "WASH" : b.assignment,
    widthPct: ((b.end_offset_s - b.start_offset_s) / total) * 100,
    state: elapsedS >= b.end_offset_s ? "past" : elapsedS >= b.start_offset_s ? "now" : "future",
  }));
}

export interface Funnel {
  viewerMinutes: number;
  clicks: number;
  orders: number;
  /** clicks per 1,000 viewer-seconds — the pre-registered outcome. */
  clickRate: number | null;
  /** orders / clicks; only when both exist. */
  ctor: number | null;
  /** revenue per 1,000 viewer-minutes, only when there are priced orders. */
  revenuePer1000ViewerMin: number | null;
}

const BUCKET_S = 30;

export function funnel(ticks: Tick[], orders: OrderSummary | null): Funnel {
  const viewerSeconds = ticks.reduce((s, t) => s + Math.max(0, t.viewers) * BUCKET_S, 0);
  const clicks = ticks.reduce((s, t) => s + (t.click_count ?? 0), 0);
  const nOrders = orders?.tong_don ?? 0;
  const revenue = orders?.tong_doanh_thu ?? 0;
  return {
    viewerMinutes: viewerSeconds / 60,
    clicks,
    orders: nOrders,
    clickRate: viewerSeconds > 0 ? (clicks / viewerSeconds) * 1000 : null,
    ctor: clicks > 0 && nOrders > 0 ? nOrders / clicks : null,
    revenuePer1000ViewerMin: viewerSeconds > 0 && revenue > 0 ? (revenue / (viewerSeconds / 60)) * 1000 : null,
  };
}

export type EstimateState =
  | { kind: "locked"; reason: string }
  | { kind: "observational"; reason: string }
  | { kind: "not_enough"; nBlocks: number; message: string }
  | { kind: "estimate"; estimate: number; ciLow: number; ciHigh: number; pValue: number | null; nBlocks: number; nOn: number; nOff: number; crossesZero: boolean };

/** The estimate card: an honest state for every case, never a number the server did not give. */
export function estimateState(report: Pick<BaoCao, "loai_phien" | "ket_qua_thi_nghiem" | "nhan"> | null): EstimateState {
  if (!report) return { kind: "not_enough", nBlocks: 0, message: "Chưa đọc được báo cáo của phiên." };
  if (report.loai_phien !== "thi_nghiem" || !report.ket_qua_thi_nghiem) {
    return { kind: "observational", reason: report.nhan };
  }
  const k: KetQua = report.ket_qua_thi_nghiem;
  if (k.khoa) return { kind: "locked", reason: k.ly_do_khoa ?? "Kết quả đang khoá theo tiền đăng ký." };
  if (!k.estimable || k.estimate == null || k.ci_low == null || k.ci_high == null) {
    return { kind: "not_enough", nBlocks: k.n_blocks, message: k.message ?? "Chưa đủ khối bốc thăm để ước lượng." };
  }
  return {
    kind: "estimate",
    estimate: k.estimate,
    ciLow: k.ci_low,
    ciHigh: k.ci_high,
    pValue: k.p_value ?? null,
    nBlocks: k.n_blocks,
    nOn: k.n_on,
    nOff: k.n_off,
    crossesZero: k.ci_low <= 0 && k.ci_high >= 0,
  };
}

/** Display names of the 11 intent labels — same table as src/livelift/nlp/labels.py LABEL_DISPLAY. */
/** Badges of `livelift.analysis.narrate` (BADGE_THI_NGHIEM / BADGE_QUAN_SAT / BADGE_THIEU_DU_LIEU). */
export const SUMMARY_BADGE: Readonly<Record<string, string>> = {
  thi_nghiem: "Bốc thăm",
  quan_sat: "Quan sát",
  thieu_du_lieu: "Thiếu dữ liệu",
};

export interface SummaryLine {
  text: string;
  badge: string | null;
}

/** The report's three-sentence summary, each with the kind of evidence behind it. Empty texts are dropped. */
export function summaryLines(report: Pick<BaoCao, "tom_tat_3_cau"> | null): SummaryLine[] {
  if (!report) return [];
  return report.tom_tat_3_cau
    .filter(c => c.text.trim().length > 0)
    .map(c => ({ text: c.text, badge: c.badge ? (SUMMARY_BADGE[c.badge] ?? c.badge) : null }));
}

export const INTENT_DISPLAY: Readonly<Record<string, string>> = {
  hoi_gia: "Hỏi giá",
  hoi_size: "Hỏi size",
  che_dat: "Chê đắt",
  chot_don: "Chốt đơn",
  van_chuyen: "Vận chuyển",
  chao_hoi: "Chào hỏi",
  cam_on_khen: "Cảm ơn / khen",
  hoi_sanpham: "Hỏi sản phẩm",
  hoi_daily: "Hỏi mở đại lý",
  bao_gia_shop: "Shop tự báo giá",
  khac: "Khác",
};

export function intentLabel(intent: string | null | undefined): string | null {
  if (!intent) return null;
  return INTENT_DISPLAY[intent] ?? intent;
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

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

/**
 * The label that must be visible on every screen state. Simulated data is never presented as real.
 * A `lab` session created with `dry_run` (scripts/mo_phong_xem.py --thu-noi-bo) is the team's own internal trial:
 * it keeps kind `dan_dung` (same badge style) but says THỬ NỘI BỘ, because the server keeps it out of the pooled result.
 * Only when NOT `is_demo`: the server marks a session `is_demo` when a guest created it without the operator token on
 * the public showcase (auth.py), and a guest's room is never the team's internal trial; it keeps plain DÀN DỰNG.
 */
export function sourceLabel(session: Pick<Session, "platform" | "is_demo" | "dry_run">, syntheticComments = 0): SourceLabel {
  if (session.platform === "lab") {
    if (session.dry_run && !session.is_demo) {
      return {
        kind: "dan_dung",
        text: "DÀN DỰNG · THỬ NỘI BỘ",
        note: "Nhóm tự thử phòng dàn dựng, mua bằng tiền ảo. Khai báo lúc tạo phiên nên không vào kết quả gộp.",
      };
    }
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
  | { kind: "estimate"; estimate: number; ciLow: number; ciHigh: number; pValue: number | null; pText: string | null; nBlocks: number; nOn: number; nOff: number; crossesZero: boolean };

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
    pText: fmtP(k.p_value ?? null, k.n_draws ?? null),
    nBlocks: k.n_blocks,
    nOn: k.n_on,
    nOff: k.n_off,
    crossesZero: k.ci_low <= 0 && k.ci_high >= 0,
  };
}

export interface PulseWindow {
  viewers: number;
  clickRate: number;
}

export interface RoomPulse {
  /** Windows of the session so far (5 minutes each, oldest first). */
  windows: PulseWindow[];
  last: PulseWindow | null;
  /** Interquartile band of the EARLIER windows — the session's own "normal". */
  viewersBand: [number, number] | null;
  clickBand: [number, number] | null;
  /** Both signals under their band in the last TWO windows. */
  alert: boolean;
  note: string;
}

const PULSE_WINDOW_S = 300;
const PULSE_MIN_REFERENCE = 4;

function quartiles(xs: number[]): [number, number] {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number): number => {
    const i = (s.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  return [q(0.25), q(0.75)];
}

/**
 * "Nhịp phòng": the last 5 minutes against the session's own normal band, DESCRIPTIVE only. Two Round-2 ideas:
 * a reference band built from comparable history (AISC26-0072, AISC26-0051), and raising an alert only when
 * SEVERAL signals stay bad together (AISC26-0068) — here viewers AND click rate under their band for two windows
 * in a row, so one noisy minute never pages the operator. It never feeds the causal estimate.
 */
export function roomPulse(ticks: Tick[]): RoomPulse {
  const per = PULSE_WINDOW_S / BUCKET_S;
  const windows: PulseWindow[] = [];
  for (let i = 0; i + per <= ticks.length; i += per) {
    const w = ticks.slice(i, i + per);
    const vs = w.reduce((s, t) => s + Math.max(0, t.viewers) * BUCKET_S, 0);
    const clicks = w.reduce((s, t) => s + (t.click_count ?? 0), 0);
    windows.push({ viewers: vs / PULSE_WINDOW_S, clickRate: vs > 0 ? (clicks / vs) * 1000 : 0 });
  }
  const last = windows.length ? windows[windows.length - 1] : null;
  const ref = windows.slice(0, -2);
  if (ref.length < PULSE_MIN_REFERENCE) {
    return { windows, last, viewersBand: null, clickBand: null, alert: false, note: "Chưa đủ lịch sử trong phiên để có dải bình thường (cần khoảng 30 phút)." };
  }
  const viewersBand = quartiles(ref.map(w => w.viewers));
  const clickBand = quartiles(ref.map(w => w.clickRate));
  const tail = windows.slice(-2);
  const alert = tail.length === 2 && tail.every(w => w.viewers < viewersBand[0] && w.clickRate < clickBand[0]);
  const note = alert
    ? "Người xem và lượt nhấp cùng dưới dải bình thường 10 phút liền. Đây là mô tả, không phải kết luận nhân quả; lịch thí nghiệm vẫn giữ nguyên."
    : "Trong hoặc trên dải bình thường của phiên.";
  return { windows, last, viewersBand, clickBand, alert, note };
}

export type VerdictKind = "doi" | "giu" | "do_them" | "cho";

export interface Verdict {
  kind: VerdictKind;
  label: string;
  detail: string;
}

/**
 * The decision the seller reads first: change, keep, or measure more — never a bare p-value. Borrowed from a
 * Round-2 team (AISC26-0080) that compares every option to the current schedule and dares to say "keep" or
 * "measure more"; here the comparison is the randomized OFF arm, and the rule is the 95% interval alone.
 */
export function verdict(state: EstimateState): Verdict {
  switch (state.kind) {
    case "estimate":
      if (state.ciLow > 0) {
        return {
          kind: "doi",
          label: "ĐỔI SANG cách ghim của LiveLift",
          detail: "Khoảng tin cậy nằm hẳn trên 0: chiến lược ghim của LiveLift tạo thêm lượt nhấp so với cách làm thường lệ của đội.",
        };
      }
      if (state.ciHigh < 0) {
        return {
          kind: "giu",
          label: "GIỮ cách làm cũ",
          detail: "Khoảng tin cậy nằm hẳn dưới 0: ghim theo LiveLift làm giảm lượt nhấp. Tác dụng ngược cũng là một phép đo thật.",
        };
      }
      return {
        kind: "do_them",
        label: "ĐO THÊM",
        detail: "Khoảng tin cậy còn chứa 0: chưa đủ bằng chứng theo hướng nào. Chạy thêm phiên từ 90 phút, khối 5 phút, rồi gộp.",
      };
    case "not_enough":
      return {
        kind: "do_them",
        label: "ĐO THÊM",
        detail: `Mới có ${state.nBlocks} khối đo được, chưa đủ để kết luận. Phiên thí nghiệm cần từ 90 phút với khối 5 phút.`,
      };
    case "locked":
      return { kind: "cho", label: "CHỜ HẾT PHIÊN", detail: "Kết quả khoá đến khi phiên kết thúc, để không ai nhìn trộm giữa chừng." };
    case "observational":
      return { kind: "cho", label: "KHÔNG CÓ QUYẾT ĐỊNH NHÂN QUẢ", detail: "Phiên quan sát: không có bốc thăm nên không kết luận được tác động." };
  }
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

/** Exactly `digits` decimals ("-0,490", not "-0,49"): the card and the summary sentence print the same string. */
export function fmtFixed(n: number, digits = 3): string {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/**
 * p-value with the honest permutation floor, the same rule as narrate._p_text on the server:
 * a test with N redraws cannot report p below 1/(N+1), so at the floor it prints "p < floor".
 */
export function fmtP(p: number | null, nDraws: number | null): string | null {
  if (p == null) return null;
  const floor = nDraws ? 1 / (nDraws + 1) : null;
  if (floor != null && p <= floor * 1.001) return `p < ${fmtFixed(floor, 3)}`;
  return `p = ${fmtFixed(p, 3)}`;
}

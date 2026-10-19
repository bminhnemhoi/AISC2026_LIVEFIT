import { z } from "zod";
import { ApiError } from "./client";
import { fmtFixed, fmtP, type EstimateState } from "./desk";

/**
 * Two read-only panels of the session list, with their schemas, calls and pure mappings:
 *
 * - "Kết quả gộp nhiều phiên": `GET /experiment/summary?env=demo` (reports.py `experiment_summary`). The DEMO pool holds
 *   ONLY `is_demo` sessions; the server never mixes it with real ones, so the panel always says MÔ PHỎNG.
 * - "Sẵn sàng nền tảng": `GET /platforms` (ingest.py `platforms`, ingest_jobs.py `muc_san_sang_nen_tang`). It names the
 *   missing keys, never their values; the operator token itself stays in the Next proxy and never reaches the browser.
 *
 * No number is computed here: every value on the panels is one API field, formatted. Schemas are loose (`.passthrough()`)
 * like `types.ts`: the Python models are the source of truth and may grow.
 */

export const ExperimentSummarySchema = z
  .object({
    label: z.string(),
    env: z.enum(["real", "demo"]),
    n_sessions: z.number(),
    n_blocks: z.number(),
    n_on: z.number(),
    n_off: z.number(),
    valid_clicks: z.number().nullish(),
    sessions_excluded: z.record(z.number()).default({}),
    estimable: z.boolean(),
    estimate: z.number().nullish(),
    ci_low: z.number().nullish(),
    ci_high: z.number().nullish(),
    p_value: z.number().nullish(),
    n_draws: z.number().nullish(),
    message: z.string().nullish(),
    // livelift.analysis.narrate.Cau, same shape as the one-session report.
    tom_tat_3_cau: z.array(z.object({ text: z.string(), badge: z.string().nullish() }).passthrough()).default([]),
  })
  .passthrough();
export type ExperimentSummary = z.infer<typeof ExperimentSummarySchema>;

export const PlatformReadinessSchema = z
  .object({
    platform: z.string(),
    ten: z.string(),
    ready: z.boolean(),
    mode: z.enum(["chinh_thuc", "du_phong", "khong_ho_tro"]),
    missing: z.array(z.string()).default([]),
    note: z.string().default(""),
  })
  .passthrough();
export type PlatformReadiness = z.infer<typeof PlatformReadinessSchema>;

/**
 * Paths through the proxy; `env` is one of the query keys it lets through. NOT YET in `allowlist.ts`: N3 adds the two
 * GET pairs `experiment/summary` and `platforms` (plan 3.1 §5). Until then the proxy answers 403 and the panels say so
 * in Vietnamese (`loiTiengViet`).
 */
export const SUMMARY_DEMO_PATH = "experiment/summary?env=demo";
export const PLATFORMS_PATH = "platforms";
export function summaryPath(env: "real" | "demo"): string {
  return `experiment/summary?env=${env}`;
}

/** Vietnamese text for whatever went wrong, never the browser's English ("Failed to fetch") or a zod dump. */
export function loiTiengViet(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof z.ZodError) return "Máy chủ trả dữ liệu không đúng dạng bàn thí nghiệm chờ đợi.";
  if (e instanceof TypeError) return "Không kết nối được máy chủ LiveLift.";
  return fallback;
}

async function getJson<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/ll/${path}`, { method: "GET", cache: "no-store", signal });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail = json && typeof json === "object" && "detail" in json ? String((json as { detail: unknown }).detail) : `Lỗi ${res.status}`;
    throw new ApiError(res.status, detail);
  }
  return schema.parse(json);
}

export const gopApi = {
  summaryDemo: (signal?: AbortSignal) => getJson(SUMMARY_DEMO_PATH, ExperimentSummarySchema, signal),
  summary: (env: "real" | "demo", signal?: AbortSignal) => getJson(summaryPath(env), ExperimentSummarySchema, signal),
  platforms: (signal?: AbortSignal) => getJson(PLATFORMS_PATH, PlatformReadinessSchema.array(), signal),
};

/**
 * Server sentences written for logs and notebooks carry a long dash, short forms and old product terms; the public
 * screen uses none of them (thuat-ngu.yaml). Punctuation, terms and spelling only: no fact in the sentence changes.
 * An en dash is a range ("80–95 s") unless spaces surround it, so only the spaced one is a sentence dash.
 */
export function chuanHoaChu(text: string): string {
  return text
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/bàn trợ live/gi, "bàn thí nghiệm")
    .replace(/\bKTC\b/g, "khoảng tin cậy")
    .replace(/kiểm định hoán vị/gi, "kiểm định ngẫu nhiên hoá")
    .replace(/(kh|h|x)óa/gi, (_m, dau: string) => `${dau}oá`)
    .replace(/họa/g, "hoạ")
    .replace(/(t)ùy/gi, (_m, dau: string) => `${dau}uỳ`)
    .replace(/\s*\(xem env=\w+\)/g, "")
    .replace(/,\s*,/g, ",")
    .trim();
}

export interface CauGop {
  text: string;
  badge: string | null;
}

/** The pooled three-sentence summary, cleaned for the public screen. Empty sentences are dropped. */
export function tomTatGop(s: Pick<ExperimentSummary, "tom_tat_3_cau">): CauGop[] {
  return s.tom_tat_3_cau
    .map((c) => ({ text: chuanHoaChu(c.text), badge: c.badge ?? null }))
    .filter((c) => c.text.length > 0);
}

/**
 * The pooled summary in the desk's own `EstimateState`, so `verdict()` gives ĐỔI / GIỮ / ĐO THÊM by the same rule as
 * one session: the 95% interval alone. A pooled payload without a finite interval is "not enough", with the server's
 * reason (fewer than 2 ended sessions or 8 blocks, an untestable design, or the §7 lock on the real pool).
 */
export function gopState(s: ExperimentSummary): EstimateState {
  if (!s.estimable || s.estimate == null || s.ci_low == null || s.ci_high == null) {
    return { kind: "not_enough", nBlocks: s.n_blocks, message: chuanHoaChu(s.message ?? "Chưa đủ khối bốc thăm để ước lượng.") };
  }
  return {
    kind: "estimate",
    estimate: s.estimate,
    ciLow: s.ci_low,
    ciHigh: s.ci_high,
    pValue: s.p_value ?? null,
    pText: fmtP(s.p_value ?? null, s.n_draws ?? null),
    nBlocks: s.n_blocks,
    nOn: s.n_on,
    nOff: s.n_off,
    crossesZero: s.ci_low <= 0 && s.ci_high >= 0,
  };
}

/** A signed number with the typographic minus: "+0,636", "−0,120", "0,000". */
export function soCoDau(n: number, digits = 3): string {
  const abs = Number(Math.abs(n).toFixed(digits));
  if (abs === 0) return fmtFixed(0, digits);
  return `${n > 0 ? "+" : "−"}${fmtFixed(abs, digits)}`;
}

export interface LyDoLoai {
  text: string;
  n: number;
}

/** Sessions the pre-registered rule kept out of the pool (§8.2), counted, never hidden. Zero counts are dropped. */
export function lyDoLoai(s: Pick<ExperimentSummary, "sessions_excluded">): LyDoLoai[] {
  return Object.entries(s.sessions_excluded)
    .filter(([, n]) => n > 0)
    .map(([text, n]) => ({ text: chuanHoaChu(text), n }));
}

export type TinhTrangNenTang = "san_sang" | "du_phong" | "chua_noi" | "khong_ho_tro";

export interface DongNenTang {
  platform: string;
  ten: string;
  tinhTrang: TinhTrangNenTang;
  /** Short status, from `ready` + `mode` only. */
  nhan: string;
  /** Names of the missing settings, as the server lists them. Never values. */
  thieu: string[];
  ghiChu: string;
}

/** One row per platform, in the server's order, saying exactly what `ready`, `mode` and `missing` say. */
export function dongNenTang(p: PlatformReadiness): DongNenTang {
  const base = { platform: p.platform, ten: p.ten, thieu: p.missing, ghiChu: chuanHoaChu(p.note) };
  if (p.mode === "khong_ho_tro") return { ...base, tinhTrang: "khong_ho_tro", nhan: "Không có đường thu tự động" };
  if (!p.ready) {
    const n = p.missing.length;
    const vat = p.mode === "chinh_thuc" ? "khoá" : "mục";
    return { ...base, tinhTrang: "chua_noi", nhan: n > 0 ? `Chưa nối, thiếu ${n} ${vat}` : "Chưa nối" };
  }
  if (p.mode === "du_phong") return { ...base, tinhTrang: "du_phong", nhan: "Dùng được, đường dự phòng" };
  return { ...base, tinhTrang: "san_sang", nhan: "Sẵn sàng, API chính thức" };
}

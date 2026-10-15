import { z } from "zod";

/**
 * Shapes of the FastAPI responses the experiment desk reads. Deliberately loose (`.passthrough()`, optional fields):
 * the Python schemas are the source of truth and may grow; the desk must not break when they add a field.
 */

export const SessionSchema = z
  .object({
    session_id: z.string(),
    platform: z.string(),
    title: z.string().nullish(),
    mode: z.string(),
    status: z.string(),
    planned_duration_min: z.number(),
    start_ts: z.string().nullish(),
    end_ts: z.string().nullish(),
    dry_run: z.boolean().optional().default(false),
    is_demo: z.boolean().optional().default(false),
  })
  .passthrough();
export type Session = z.infer<typeof SessionSchema>;

export const BlockSchema = z
  .object({
    block_id: z.string(),
    block_index: z.number(),
    phase: z.string(),
    assignment: z.enum(["ON", "OFF"]).nullish(),
    is_washout: z.boolean(),
    start_offset_s: z.number(),
    end_offset_s: z.number(),
  })
  .passthrough();
export type Block = z.infer<typeof BlockSchema>;

export const OperatorStateSchema = z
  .object({
    role: z.literal("operator"),
    session_id: z.string(),
    status: z.string(),
    mode: z.string(),
    elapsed_s: z.number(),
    current_block: z
      .object({
        index: z.number(),
        phase: z.string(),
        assignment: z.enum(["ON", "OFF"]).nullish(),
        is_washout: z.boolean(),
        seconds_remaining: z.number(),
      })
      .passthrough()
      .nullish(),
    pinned_product: z
      .object({ product_id: z.string(), name: z.string(), price: z.number(), stock: z.number() })
      .passthrough()
      .nullish(),
    cards: z.array(z.object({ card_id: z.string(), product_id: z.string(), product_name: z.string(), headline: z.string(), rationale: z.string() }).passthrough()).default([]),
    cards_note: z.string().nullish(),
    is_demo: z.boolean().optional().default(false),
  })
  .passthrough();
export type OperatorState = z.infer<typeof OperatorStateSchema>;

export const HostStateSchema = z
  .object({
    pinned_product: z.string().nullish(),
    price: z.number().nullish(),
    stock: z.number().nullish(),
    elapsed_s: z.number().optional().default(0),
  })
  .passthrough();
export type HostState = z.infer<typeof HostStateSchema>;

export const TickSchema = z
  .object({ ts_bucket: z.string(), viewers: z.number(), comment_rate: z.number(), click_count: z.number().optional().default(0) })
  .passthrough();
export type Tick = z.infer<typeof TickSchema>;

export const CommentSchema = z
  .object({ comment_id: z.string(), ts: z.string(), text: z.string(), intent: z.string().nullish(), pii_kinds: z.array(z.string()).default([]) })
  .passthrough();
export type Comment = z.infer<typeof CommentSchema>;

export const KetQuaSchema = z
  .object({
    khoa: z.boolean().default(false),
    ly_do_khoa: z.string().nullish(),
    estimable: z.boolean().default(false),
    n_blocks: z.number().default(0),
    n_on: z.number().default(0),
    n_off: z.number().default(0),
    estimate: z.number().nullish(),
    ci_low: z.number().nullish(),
    ci_high: z.number().nullish(),
    p_value: z.number().nullish(),
    n_draws: z.number().nullish(),
    message: z.string().nullish(),
  })
  .passthrough();
export type KetQua = z.infer<typeof KetQuaSchema>;

export const BaoCaoSchema = z
  .object({
    session_id: z.string(),
    tieu_de: z.string().nullish(),
    platform: z.string(),
    loai_phien: z.string(),
    nhan: z.string(),
    is_demo: z.boolean().default(false),
    dry_run: z.boolean().default(false),
    binh_luan_tong_hop: z.number().default(0),
    tong_quan: z
      .object({
        thoi_luong_s: z.number().nullish(),
        tong_binh_luan: z.number().default(0),
        luot_nhap_hop_le: z.number().nullish(),
        luot_nhap_tho: z.number().nullish(),
      })
      .passthrough(),
    ket_qua_thi_nghiem: KetQuaSchema.nullish(),
    // livelift.analysis.narrate.Cau: {text, badge, refs}. The desk once read `cau` here and rendered an empty card.
    tom_tat_3_cau: z.array(z.object({ text: z.string(), badge: z.string().nullish() }).passthrough()).default([]),
  })
  .passthrough();
export type BaoCao = z.infer<typeof BaoCaoSchema>;

export const OrderSummarySchema = z
  .object({ tong_don: z.number().default(0), tong_san_pham: z.number().default(0), tong_doanh_thu: z.number().default(0) })
  .passthrough();
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

export const AnyObjectSchema = z.object({}).passthrough();

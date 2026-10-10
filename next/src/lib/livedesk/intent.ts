import type { CommentIntent } from "./types";

/**
 * Comment intents: a TypeScript port of the original LiveLift keyword baseline (`src/livelift/nlp/intent.py`).
 *
 * The original checks its labels in a fixed priority order, first match wins, else `khac`:
 *   chot_don > hoi_size > van_chuyen > hoi_gia > che_dat
 * Matching is case- and diacritics-insensitive and works on whole words. The Live Desk shows five intents, so the
 * original labels are mapped: chot_don -> ready_to_buy, hoi_size -> ask_size, hoi_gia -> ask_price, and van_chuyen
 * and che_dat -> other (they still win over a price keyword, exactly as in the original, so "phí ship bao nhiêu" is a
 * shipping question, not a price question).
 *
 * `praise` has no keyword set in the original baseline: its `cam_on_khen` class exists only in the trained v2 model.
 * The phrases below are LiveLift's own, taken from that class's guideline in `labels.py`, and are checked last so
 * they never override an intent the original recognises.
 *
 * Only PII-masked text should reach `classifyIntent`; it neither stores nor logs its input.
 */

export type OriginalIntentLabel = "chot_don" | "hoi_size" | "van_chuyen" | "hoi_gia" | "che_dat" | "cam_on_khen" | "khac";

/** Lowercase and remove Vietnamese diacritics ("Gò Vấp" -> "go vap"). "đ" has no combining mark, so it is mapped. */
export function stripDiacritics(text: string): string {
  return text.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/\p{Mn}/gu, "");
}

const KEYWORDS: ReadonlyArray<readonly [OriginalIntentLabel, readonly string[]]> = [
  ["chot_don", ["chốt", "chốt đơn", "lấy 1", "lấy một", "em lấy", "order", "mua", "đặt hàng", "đặt mua", "cho em 1", "cho mình 1"]],
  ["hoi_size", ["size", "sz", "bao ký", "bao nhiêu ký", "mấy ký", "bao kg", "cân nặng", "chiều cao", "form", "mặc vừa", "xl", "xxl"]],
  ["van_chuyen", ["ship", "giao", "giao hàng", "vận chuyển", "phí ship", "freeship", "cod", "bao lâu tới", "bao lâu nhận", "khi nào nhận", "khi nào tới"]],
  ["hoi_gia", ["bao nhiêu", "bn", "giá", "nhiêu tiền", "bao tiền", "giá nhiêu", "nhiu tiền"]],
  ["che_dat", ["đắt quá", "đắt thế", "đắt vậy", "mắc quá", "mắc thế", "mắc vậy", "quá đắt", "quá mắc", "cao thế", "cao vậy", "hố quá", "chát quá"]],
  // LiveLift's addition (see above).
  ["cam_on_khen", ["cảm ơn", "cám ơn", "chúc mừng", "tuyệt vời", "đẹp quá", "xinh quá", "xịn quá", "đỉnh quá", "yêu shop", "thích quá", "ủng hộ shop"]],
];

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word matcher, longest phrase first. `\b` in JavaScript is ASCII-only, so word edges are spelled out. */
function compile(phrases: readonly string[]): RegExp {
  const stripped = [...new Set(phrases.map(stripDiacritics))].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${stripped.map(escape).join("|")})(?![\\p{L}\\p{N}_])`, "u");
}

const MATCHERS: ReadonlyArray<readonly [OriginalIntentLabel, RegExp]> = KEYWORDS.map(([label, phrases]) => [label, compile(phrases)] as const);

/** The original label for a comment: first matching label in priority order, else `khac`. */
export function classifyOriginal(text: string): OriginalIntentLabel {
  const normalised = stripDiacritics(text);
  for (const [label, pattern] of MATCHERS) if (pattern.test(normalised)) return label;
  return "khac";
}

export const INTENT_FROM_ORIGINAL: Record<OriginalIntentLabel, CommentIntent> = {
  chot_don: "ready_to_buy",
  hoi_size: "ask_size",
  hoi_gia: "ask_price",
  cam_on_khen: "praise",
  van_chuyen: "other",
  che_dat: "other",
  khac: "other",
};

export const classifyIntent = (text: string): CommentIntent => INTENT_FROM_ORIGINAL[classifyOriginal(text)];

export const INTENT_LABEL: Record<CommentIntent, string> = {
  ask_price: "Ask price",
  ask_size: "Ask size",
  ready_to_buy: "Ready to buy",
  praise: "Praise",
  other: "Other",
};

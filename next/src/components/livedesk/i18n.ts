import type { CommentIntent, CopilotAiStatus, CopilotSuggestion, LiveDeskViewModel } from "@/lib/livedesk/types";
import type { DeskLang } from "./prefs";

/**
 * The Live Desk logic speaks English (its contract is pinned by its own tests); the screens default to Vietnamese.
 * These helpers translate the logic's fixed sentences and fill-in-the-blank sentences word for word. Anything they do
 * not recognise, such as a model's own wording or the platform's own error text, is shown exactly as given: a
 * translation must never change what a sentence claims.
 */

/** mm:ss (or h:mm:ss) for a second of the live. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${two(m)}:${two(r)}`;
}

export function duration(sec: number, lang: DeskLang): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  if (lang === "vi") return m === 0 ? `${s} giây` : s === 0 ? `${m} phút` : `${m} phút ${s} giây`;
  return m === 0 ? `${s} s` : s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** Thousands with the locale's separator: 1.234 in Vietnamese, 1,234 in English. */
export const num = (n: number, lang: DeskLang): string => n.toLocaleString(lang === "vi" ? "vi-VN" : "en-US");

const START_BLOCKED: Record<string, string> = {
  "A SIMULATED live is already running. Open the Live Desk.": "Một buổi live SIMULATED đang chạy. Mở Live Desk.",
  "Connect SIMULATED Live first.": "Kết nối SIMULATED Live trước.",
  "Import at least one product first.": "Nhập ít nhất một sản phẩm trước.",
  "No product has synced to SIMULATED Live yet.": "Chưa có sản phẩm nào lên SIMULATED Live.",
};

export function tStartBlocked(reason: string | null, lang: DeskLang): string | null {
  if (reason === null || lang === "en") return reason;
  return START_BLOCKED[reason] ?? reason;
}

function tSkipReason(reason: string): string {
  if (reason === "no code or name") return "thiếu mã hoặc tên";
  if (reason === "code already imported") return "mã đã được nhập";
  const stock = /^stock "(.*)" is not a whole number$/.exec(reason);
  if (stock) return `tồn kho "${stock[1]}" không phải số nguyên`;
  const price = /^price "(.*)" is not a number$/.exec(reason);
  if (price) return `giá "${price[1]}" không phải là số`;
  return reason;
}

export function tImportNote(note: string | null, lang: DeskLang): string | null {
  if (note === null || lang === "en") return note;
  if (note === "Nothing to import: the text has no rows.") return "Không có gì để nhập: văn bản không có dòng nào.";
  const refused = /^Start live: SIMULATED Live refused: "(.*)"$/.exec(note);
  if (refused) return `Bắt đầu live: SIMULATED Live từ chối: "${refused[1]}"`;
  const m = /^(\d+) imported, (\d+) rows? skipped(?:: (.*))?$/.exec(note);
  if (!m) return note;
  const reasons = m[3] ? `: ${m[3].split("; ").map(tSkipReason).join("; ")}` : "";
  return `Đã nhập ${m[1]}, bỏ qua ${m[2]} dòng${reasons}`;
}

export function tBanner(text: string, lang: DeskLang): string {
  if (lang === "en") return text;
  if (text === "SIMULATED Live is answering again.") return "SIMULATED Live đã trả lời trở lại.";
  const tail = "The Live Desk stopped calling it. Carry on in the app by hand.";
  const tailVi = "Live Desk đã ngừng gọi nền tảng. Bạn tiếp tục thao tác bằng tay trong ứng dụng.";
  let m = new RegExp(`^Authorisation expired on SIMULATED Live: "(.*)"\\. ${tail.replace(/\./g, "\\.")}$`).exec(text);
  if (m) return `Hết hạn quyền truy cập trên SIMULATED Live: "${m[1]}". ${tailVi}`;
  m = new RegExp(`^SIMULATED Live is rate limiting: "(.*)"\\. ${tail.replace(/\./g, "\\.")}$`).exec(text);
  if (m) return `SIMULATED Live đang giới hạn tần suất gọi: "${m[1]}". ${tailVi}`;
  m = new RegExp(`^SIMULATED Live server error: "(.*)"\\. ${tail.replace(/\./g, "\\.")}$`).exec(text);
  if (m) return `SIMULATED Live báo lỗi máy chủ: "${m[1]}". ${tailVi}`;
  m = /^SIMULATED Live refused: "(.*)"\.$/.exec(text);
  if (m) return `SIMULATED Live từ chối: "${m[1]}".`;
  return text;
}

const ASSUMPTIONS_VI: Record<string, string> = {
  "SIMULATED: viewers follow a seeded curve that climbs over the first few minutes and then wobbles. A pinned product lifts them a little.":
    "SIMULATED: người xem theo một đường cong sinh từ hạt giống cố định, tăng trong vài phút đầu rồi dao động. Sản phẩm đang ghim làm số người xem nhích lên một chút.",
  "SIMULATED: comments per second grow with the number of viewers.": "SIMULATED: số bình luận mỗi giây tăng theo số người xem.",
  "SIMULATED: while a product is pinned, comments ask more about its price and size and more viewers say they will buy it. Comments about other products name them.":
    "SIMULATED: khi một sản phẩm đang ghim, bình luận hỏi giá, hỏi cỡ và chốt đơn về nó nhiều hơn. Bình luận về sản phẩm khác thì gọi tên sản phẩm đó.",
  "SIMULATED: a pinned product draws far more add-to-carts than the others, rising over its first two minutes on show.":
    "SIMULATED: sản phẩm đang ghim có nhiều lượt thêm giỏ hơn hẳn các sản phẩm khác, tăng dần trong hai phút đầu được ghim.",
  "SIMULATED: about one add-to-cart in three becomes a purchase at once. A purchase lowers stock only when stock was entered.":
    "SIMULATED: khoảng một phần ba lượt thêm giỏ thành lượt mua ngay. Lượt mua chỉ làm giảm tồn kho khi tồn kho đã được nhập.",
  "SIMULATED: a few comments carry obviously fake phone numbers and emails so the PII mask is visible.":
    "SIMULATED: một số bình luận chứa số điện thoại và email giả rõ ràng, để thấy được việc che thông tin cá nhân.",
  "SIMULATED: these are assumptions written into the simulation, not findings about real viewers or about any real platform.":
    "SIMULATED: đây là giả định viết vào bản mô phỏng, không phải phát hiện về người xem thật hay về nền tảng thật nào.",
};

export const tAssumption = (text: string, lang: DeskLang): string => (lang === "en" ? text : ASSUMPTIONS_VI[text] ?? text);

const AI_STATUS: Record<CopilotAiStatus, { vi: string; en: string }> = {
  rules_only: { vi: "Chỉ dùng luật (dữ liệu SIMULATED)", en: "Rules only (SIMULATED data)" },
  ai_ok: { vi: "Mô hình AI, luật làm dự phòng (dữ liệu SIMULATED)", en: "AI model, rules as fallback (SIMULATED data)" },
  ai_fallback: { vi: "Mô hình AI không phản hồi, đang dùng luật (dữ liệu SIMULATED)", en: "AI model unavailable, showing rules (SIMULATED data)" },
};

/** The logic's own label in English; the Vietnamese one for its known status. */
export const tAiStatus = (view: LiveDeskViewModel["copilot"], lang: DeskLang): string => (lang === "en" ? view.statusLabel : AI_STATUS[view.aiStatus].vi);

// ---- Copilot signals ---------------------------------------------------------------------------------------------

/** Which signal a label is, so the screens can pick the telling numbers. null for a label the rules do not write. */
export type SignalKey = "ready" | "price" | "size" | "cart" | "cartBefore" | "stock" | "lastShown";

const SIGNAL_KEYS: Record<string, SignalKey> = {
  "Ready to buy, last 2 min": "ready",
  "Ask price, last 2 min": "price",
  "Ask size, last 2 min": "size",
  "Add to cart, last 2 min": "cart",
  "Add to cart, 2 min before": "cartBefore",
  Stock: "stock",
  "Last shown": "lastShown",
};

const SIGNAL_LABEL: Record<SignalKey, { vi: string; en: string }> = {
  ready: { vi: "bình luận chốt đơn", en: "ready-to-buy comments" },
  price: { vi: "bình luận hỏi giá", en: "ask-price comments" },
  size: { vi: "bình luận hỏi cỡ", en: "ask-size comments" },
  cart: { vi: "lượt thêm giỏ, 2 phút qua", en: "add-to-carts, last 2 min" },
  cartBefore: { vi: "lượt thêm giỏ, 2 phút trước đó", en: "add-to-carts, 2 min before" },
  stock: { vi: "còn trong kho", en: "in stock" },
  lastShown: { vi: "lần ghim gần nhất", en: "last on show" },
};

export interface ReadSignal {
  key: SignalKey | null;
  label: string;
  /** The number the signal states, or null when it states none ("Not entered", "Not shown yet"). */
  count: number | null;
  /** The value as words, translated. */
  text: string;
  /** True for "Not entered": missing, not zero. */
  missing: boolean;
}

export function readSignal(signal: { label: string; value: string }, lang: DeskLang): ReadSignal {
  const key = SIGNAL_KEYS[signal.label] ?? null;
  const label = key ? SIGNAL_LABEL[key][lang] : signal.label;
  const value = signal.value;
  const comments = /^(\d+) comments?$/.exec(value);
  if (comments) return { key, label, count: Number(comments[1]), text: lang === "vi" ? `${comments[1]} bình luận` : value, missing: false };
  if (/^\d+$/.test(value)) return { key, label, count: Number(value), text: value, missing: false };
  if (value === "Not entered") return { key, label, count: null, text: lang === "vi" ? "Chưa nhập" : value, missing: true };
  if (value === "Not shown yet") return { key, label, count: null, text: lang === "vi" ? "Chưa ghim lần nào" : value, missing: false };
  const ago = /^(\d+:\d\d) ago$/.exec(value);
  if (ago) return { key, label, count: null, text: lang === "vi" ? `${ago[1]} trước` : value, missing: false };
  return { key, label, count: null, text: value, missing: false };
}

/**
 * The suggestion's headline. The rules' headline is a fixed sentence about the product, so it is written in the
 * viewer's language here; a model's headline is its own wording and is shown as given.
 */
export function headline(
  s: Pick<CopilotSuggestion, "kind" | "source" | "headline"> & Partial<Pick<CopilotSuggestion, "confidence">>, productName: string, lang: DeskLang,
): string {
  if (s.source === "ai") return s.headline;
  // A thin sample is said as interest, not as an instruction; the pin stays the operator's call.
  if (s.kind === "show_next" && s.confidence === "low") return lang === "vi" ? `Có tín hiệu quan tâm tới ${productName}` : `Early interest in ${productName}`;
  if (s.kind === "show_next") return lang === "vi" ? `Nên ghim tiếp: ${productName}` : `Pin next: ${productName}`;
  return lang === "vi" ? `Nên chạy flash sale cho ${productName} trong 1 phút` : `Run a flash sale on ${productName} in the next minute`;
}

export const INTENT_ORDER: readonly CommentIntent[] = ["ask_price", "ask_size", "ready_to_buy", "praise", "other"];

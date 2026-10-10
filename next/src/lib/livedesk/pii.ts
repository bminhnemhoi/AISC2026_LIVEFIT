/**
 * Vietnamese PII masking for live comments: a TypeScript port of the original LiveLift scrubber
 * (`src/livelift/ingest/pii/patterns.py`, `filter.py`).
 *
 * Same design bias as the original: recall over precision. Over-masking a fragment of harmless text costs a little
 * signal; showing one phone number breaks a hard project rule. The engine runs every comment through `maskPii`
 * before anything else sees it, so raw comment text never leaves the engine.
 *
 * Ported: phones (split, letter-O-for-zero, +84, spelled-out and mixed digits), emails, social links and handles,
 * bank accounts after a context word, order and tracking codes, addresses (street numbers, keyword-led spans, an
 * "địa chỉ:" announcement, "q7", and an administrative unit after a shipping word), and names (after "tên", surname-led,
 * after an honorific, lowercase vocatives and self-introductions). Not ported: the original's full list of 63+
 * provinces; a shorter list of large cities and districts stands in for it (see `UNITS`).
 *
 * Detection runs on an NFKC copy with keycap marks removed, and the masked text is built from that same copy. A
 * comment with nothing to mask comes back unchanged.
 */

export type PiiKind = "email" | "social" | "bank" | "order" | "phone" | "address" | "name";

/** Lower number wins when spans overlap, as in the original. */
const KIND_PRIORITY: Record<PiiKind, number> = { email: 0, social: 1, bank: 2, order: 3, phone: 4, address: 5, name: 6 };

export const PII_REPLACEMENT: Record<PiiKind, string> = {
  phone: "[SĐT]",
  email: "[EMAIL]",
  order: "[MÃ ĐƠN]",
  address: "[ĐỊA CHỈ]",
  name: "[TÊN]",
  social: "[MXH]",
  bank: "[STK]",
};

export interface PiiMask {
  text: string;
  masked: boolean;
  counts: Partial<Record<PiiKind, number>>;
}

interface Span { kind: PiiKind; start: number; end: number }

// JavaScript's \b only knows ASCII, so word edges are spelled out with Unicode classes.
const W = "[\\p{L}\\p{N}_]";
const B = `(?<!${W})`;
const E = `(?!${W})`;

// ---- Phone -----------------------------------------------------------------------------------------------------------
const PHONE = /(?<!\d)(?:\+\s?84|84|0|(?<![A-Za-z])[oO])(?:[\s.,;/_*\-·]{0,3}[0-9oO]){8,11}(?![0-9oO])/gu;
const phoneDigits = (s: string): number => [...s].filter((c) => /[0-9oO]/.test(c)).length;
const SPELLED = "(?:không|khong|một|mot|mốt|hai|ba|bốn|bon|tư|tu|năm|nam|lăm|lam|sáu|sau|bảy|bay|bẩy|tám|tam|chín|chin)";
const SPELLED_PHONE = new RegExp(`(?:${B}${SPELLED}${E}[\\s.,\\-]*){9,12}`, "giu");
const MIXED_PHONE = new RegExp(`(?<!\\d)(?=(?:\\d[\\s.,\\-]*)*${SPELLED})(?:(?:\\d|${SPELLED}${E})[\\s.,\\-]*){8,11}(?:\\d|${SPELLED}${E})`, "giu");

// ---- Email, social, bank, order ----------------------------------------------------------------------------------------
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu;
const SOCIAL_URL = /(?<![A-Za-z0-9.])(?:https?:\/\/)?(?:www\.)?(?:fb\.com|fb\.me|facebook\.com|m\.me|zalo\.me|tiktok\.com|instagram\.com|threads\.net)\/[A-Za-z0-9._@~/-]{2,60}/giu;
// "@" also means a price, a time or a size in shopping chat ("@50k", "hẹn@7h30", "size@2XL"): those are not handles.
const NOT_HANDLE = `(?!(?:\\d[\\d.]*(?:k|đ|d|vnđ|vnd|tr|triệu|trieu|ngàn|ngan|nghìn|nghin)\\d*|\\d{1,3}(?:\\.\\d{3})+|\\d{1,2}[hg]\\d{0,2}(?:p|ph)?|\\d?x{0,4}[sml])(?![.\\-]*${W}))`;
const HANDLE_BODY = `${W}[\\p{L}\\p{N}_.\\-]{1,30}${W}`;
const SOCIAL_HANDLE = new RegExp(`(?<![\\p{L}\\p{N}_.@])@${NOT_HANDLE}${HANDLE_BODY}`, "giu");
const SOCIAL_HANDLE_GLUED = new RegExp(`(?<=[\\p{L}\\p{N}_.@])@${NOT_HANDLE}(?<body>${HANDLE_BODY})`, "dgiu");
function isGluedHandle(body: string): boolean {
  if (!/\p{L}/u.test(body)) return false;
  if (/[\d._]/.test(body)) return true;
  return [...body].filter((c) => /\p{L}/u.test(c)).length >= 5;
}
const BANK = new RegExp(`${B}(?:stk|số\\s*tk|so\\s*tk|số\\s*tài\\s*khoản|so\\s*tai\\s*khoan|tk\\s*:)\\s*(?:là|la|:|số|so)?\\s*(?<acct>\\d(?:[\\s.\\-]?\\d){5,18})(?!\\d)`, "dgiu");
const ORDER_CONTEXT = /(?:mã\s*đơn(?:\s*hàng)?|ma\s*don(?:\s*hang)?|đơn\s*hàng|don\s*hang|mã\s*vận\s*đơn|vận\s*đơn|van\s*don|mvđ|mvd|tracking|order|mã\s*kiện|ma\s*kien)\s*(?:là|la|số|so|:|#)?\s*(?<code>[A-Za-z0-9][A-Za-z0-9-]{4,24})/dgiu;
const ORDER_CARRIER = new RegExp(`${B}(?:SPXVN|SPX|GHN|GHTK|VTP|VNPOST|J&?T|NJV)[A-Z0-9\\-]{6,20}${E}`, "giu");
const ORDER_SHOPEE = new RegExp(`${B}\\d{6}[A-Z0-9]{6,12}${E}`, "gu");

// ---- Address -------------------------------------------------------------------------------------------------------------
const STREET_NUM = new RegExp(
  `(?:số\\s*(?:nhà)?\\s*)?${B}\\d{1,4}(?:\\s*/\\s*\\d{1,4}){0,3}\\s*(?:đường|duong|phố|pho|ngõ|ngo|hẻm|hem|tổ|ấp|thôn|khu\\s*phố|kp|lô|block|tòa|toà|chung\\s*cư)${E}[^,.;!?\\n]{0,45}`,
  "giu",
);
const ADDR_KEYWORD = new RegExp(
  `${B}(?:đường|duong|phố|ngõ|ngo|hẻm|hem|thôn|ấp|khu\\s*phố|khu\\s*đô\\s*thị|kđt|chung\\s*cư|chung\\s*cu|tòa\\s*nhà|toà\\s*nhà|phường|phuong|xã|quận|quan|huyện|huyen|thị\\s*trấn|thị\\s*xã|t[pt]\\.|thành\\s*phố|thanh\\s*pho|tỉnh|tinh)\\s+` +
    `(?!(?:nào|gì|gi|này|nay|đó|do|kia|đấy|mình|minh|bạn|ban|ai|đông|vắng)${E})[^\\s,.;!?\\n]{1,25}(?:\\s+[^\\s,.;!?\\n]{1,25}){0,3}`,
  "giu",
);
const ADDR_ANNOUNCE = /(?<!\[)(?:(?:địa\s*chỉ|dia\s*chi)\s*:?|(?:đ\/?c|add)\s*:)\s*[^,.;!?\n[\]]{4,60}/giu;
const ADDR_Q = /(?<![A-Za-zÀ-ỹ0-9])[qQ]\.?\s?\d{1,2}(?!\d)/gu;
const ADDR_QP = /(?<![A-Za-zÀ-ỹ0-9])[qpQP]\.?\s?\d{1,2}(?!\d)/gu;
const ADDR_CONTEXT = /(?:ship|giao|gửi|gui|chuyển|chuyen|về|ve|ở|tại|tai|đến|den|quê|que|từ|tu|bên|ben|tận|tan)\s*$/iu;

/** Large cities and districts most buyers name. The original carries every province; this list is shorter on purpose. */
const UNITS = [
  "hà nội", "hồ chí minh", "sài gòn", "đà nẵng", "hải phòng", "cần thơ", "huế", "nha trang", "đà lạt", "vũng tàu", "bình dương",
  "đồng nai", "bắc ninh", "quảng ninh", "nghệ an", "thanh hóa", "khánh hòa", "lâm đồng", "an giang", "kiên giang", "cà mau",
  "bến tre", "đắk lắk", "gia lai", "long an", "tây ninh", "gò vấp", "thủ đức", "bình thạnh", "tân bình", "phú nhuận", "bình tân",
  "cầu giấy", "đống đa", "hoàn kiếm", "ba đình", "thanh xuân", "hà đông", "long biên", "hai bà trưng",
];
const unaccent = (s: string): string => s.replace(/đ/g, "d").normalize("NFD").replace(/\p{Mn}/gu, "");
const UNIT = new RegExp(
  `${B}(?:${[...new Set(UNITS.flatMap((u) => [u, unaccent(u)]))].sort((a, b) => b.length - a.length).map((u) => u.replace(/\s+/g, "\\s+")).join("|")})${E}`,
  "giu",
);

// ---- Names ---------------------------------------------------------------------------------------------------------------
const SURNAMES = "Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Đinh|Đào|Trịnh|Trương|Lâm|Mai|Tô|Hà|Tạ|Châu|Lưu|Cao|Thái|Quách";
const CAP = "[A-ZĐÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zà-ỹ]+";
const HONORIFIC = "(?:chị|chi|anh|cô|co|chú|chu|bác|bac|bạn|ban|em)";
const NAME_STOP =
  "ơi|oi|ui|ạ|nha|nhé|nhe|nè|ne|gì|gi|nào|nao|với|voi|và|va|là|la|ai|có|co|không|khong|ko|hông|hong|chưa|chua|rồi|roi|đi|di|" +
  "giúp|giup|cho|xem|mua|bán|ban|lấy|lay|chốt|chot|đặt|dat|đắt|gửi|gui|hỏi|hoi|trả|tra|xin|cần|can|shop|size|ship|hàng|hang|đơn|don|" +
  "em|anh|chị|chi|bạn|mình|minh|cô|chú|chu|bác|bac|bé|be|gái|gai|trai|yêu|iu|hai|út|ut|khách|khach|quen|mới|moi|cũ|cu";
const LOWER_NAME = `(?!(?:${NAME_STOP})${E})[a-zà-ỹ]+`;
const NAME_SURNAME = new RegExp(`${B}(?:${SURNAMES})\\s+${CAP}(?:\\s+${CAP}){0,3}`, "gu");
const NAME_CONTEXT = new RegExp(`(?:tên|ten)\\s*(?:là|la|em|chị|chi|anh|mình|minh|tôi|toi|khách|khach)?\\s*(?:là|la)?\\s+(?<name>${CAP}(?:\\s+${CAP}){0,3})`, "dgu");
const HONORIFIC_NAME = new RegExp(`${B}${HONORIFIC}\\s+(?<name>${CAP}(?:\\s+${CAP}){0,2})`, "dgu");
const VOCATIVE_NAME = new RegExp(`${B}${HONORIFIC}\\s+(?<name>${LOWER_NAME}(?:\\s+${LOWER_NAME})?)\\s+(?:ơi|oi)${E}`, "dgu");
const NAME_CONTEXT_LOWER = new RegExp(
  `${B}(?:(?:tên|ten)\\s*(?:em|chị|chi|anh|mình|minh|tôi|toi|khách|khach)?|mình|minh|tôi|toi)\\s*(?:là|la)\\s+(?<name>${LOWER_NAME}(?:\\s+${LOWER_NAME}){0,2})`,
  "dgu",
);
const NAME_SURNAME_LOWER = new RegExp(`${B}(?:${SURNAMES.toLowerCase()})\\s+(?:thị|văn)\\s+${LOWER_NAME}(?:\\s+${LOWER_NAME})?`, "gu");

// ---- Engine --------------------------------------------------------------------------------------------------------------

function whole(re: RegExp, text: string, kind: PiiKind, spans: Span[], accept: (m: RegExpMatchArray) => boolean = () => true): void {
  for (const m of text.matchAll(re)) if (m[0].length > 0 && accept(m)) spans.push({ kind, start: m.index!, end: m.index! + m[0].length });
}

function group(re: RegExp, name: string, text: string, kind: PiiKind, spans: Span[]): void {
  for (const m of text.matchAll(re)) {
    const at = m.indices?.groups?.[name];
    if (at && at[1] > at[0]) spans.push({ kind, start: at[0], end: at[1] });
  }
}

function withContext(re: RegExp, text: string, spans: Span[]): void {
  for (const m of text.matchAll(re)) {
    const prefix = text.slice(Math.max(0, m.index! - 16), m.index!);
    if (ADDR_CONTEXT.test(prefix)) spans.push({ kind: "address", start: m.index!, end: m.index! + m[0].length });
  }
}

function findSpans(text: string): Span[] {
  const spans: Span[] = [];
  whole(EMAIL, text, "email", spans);
  whole(SOCIAL_URL, text, "social", spans);
  whole(SOCIAL_HANDLE, text, "social", spans);
  whole(SOCIAL_HANDLE_GLUED, text, "social", spans, (m) => m.groups !== undefined && isGluedHandle(m.groups.body));
  group(BANK, "acct", text, "bank", spans);
  group(ORDER_CONTEXT, "code", text, "order", spans);
  whole(ORDER_CARRIER, text, "order", spans);
  whole(ORDER_SHOPEE, text, "order", spans);
  whole(PHONE, text, "phone", spans, (m) => { const n = phoneDigits(m[0]); return n >= 10 && n <= 12; });
  whole(SPELLED_PHONE, text, "phone", spans);
  whole(MIXED_PHONE, text, "phone", spans);
  whole(STREET_NUM, text, "address", spans);
  whole(ADDR_KEYWORD, text, "address", spans);
  whole(ADDR_ANNOUNCE, text, "address", spans);
  whole(ADDR_Q, text, "address", spans);
  withContext(UNIT, text, spans);
  withContext(ADDR_QP, text, spans);
  group(NAME_CONTEXT, "name", text, "name", spans);
  whole(NAME_SURNAME, text, "name", spans);
  group(HONORIFIC_NAME, "name", text, "name", spans);
  group(VOCATIVE_NAME, "name", text, "name", spans);
  group(NAME_CONTEXT_LOWER, "name", text, "name", spans);
  whole(NAME_SURNAME_LOWER, text, "name", spans);
  return spans;
}

/** The highest-priority span wins an overlap; overlapping spans of one kind merge into one. */
function resolveOverlaps(spans: Span[]): Span[] {
  const ordered = [...spans].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || a.start - b.start || b.end - b.start - (a.end - a.start));
  let kept: Span[] = [];
  for (const s of ordered) {
    const clashing = kept.filter((k) => !(s.end <= k.start || s.start >= k.end));
    if (clashing.length === 0) { kept.push(s); continue; }
    if (clashing.every((k) => k.kind === s.kind)) {
      kept = kept.filter((k) => !clashing.includes(k));
      kept.push({ kind: s.kind, start: Math.min(s.start, ...clashing.map((k) => k.start)), end: Math.max(s.end, ...clashing.map((k) => k.end)) });
    }
  }
  return kept.sort((a, b) => a.start - b.start);
}

const normalise = (text: string): string => text.normalize("NFKC").replace(/[️⃣]/g, "");

/** Mask PII in one comment. Pure. */
export function maskPii(text: string): PiiMask {
  const scanned = normalise(text);
  const spans = resolveOverlaps(findSpans(scanned));
  if (spans.length === 0) return { text, masked: false, counts: {} };
  let out = "";
  let cursor = 0;
  const counts: Partial<Record<PiiKind, number>> = {};
  for (const s of spans) {
    out += scanned.slice(cursor, s.start) + PII_REPLACEMENT[s.kind];
    cursor = s.end;
    counts[s.kind] = (counts[s.kind] ?? 0) + 1;
  }
  return { text: out + scanned.slice(cursor), masked: true, counts };
}

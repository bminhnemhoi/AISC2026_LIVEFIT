/**
 * Công cụ kiểm chữ dùng chung cho test của U3 (minh-hoa, co-che, dien-thoai). Không phải test.
 */

/**
 * Chữ tiếng Anh: từ chỉ gồm chữ Latinh không dấu mà không phải một âm tiết tiếng Việt viết không dấu
 * (phụ âm đầu + nguyên âm + phụ âm cuối hợp lệ), hoặc nằm trong danh sách từ tiếng Anh ngắn hay gặp.
 * Được phép: live/LIVE (từ mượn của canon, kế hoạch: "LIVE/GHIM"), SHA (SHA-256), tên riêng LiveLift, Live Desk,
 * tên nền tảng và từ mượn có trong canon.
 */
const DUOC_PHEP = new Set([
  "LIVE",
  "live",
  "Live",
  "SHA",
  "LiveLift",
  "Desk",
  // tên nền tảng, từ mượn có trong canon (cau_ghim: "API", "demo", "(autopilot)")
  "Shopee",
  "TikTok",
  "Facebook",
  "YouTube",
  "API",
  "demo",
  "autopilot",
  // canon: "video người dẫn do AI tạo"
  "video",
  "Video",
  // tên món của bộ hàng D-025
  "cotton",
  "basic",
  "tote",
  "canvas",
  "inox",
  "ml",
]);
const AM_TIET_VIET = /^(ngh|ng|gh|gi|kh|nh|ph|qu|th|tr|ch|[bcdghklmnprstvx])?[aeiouy]{1,3}(ch|ng|nh|[cmnpt])?$/i;
const TU_ANH_NGAN = new Set(["the", "and", "off", "now", "buy", "play", "pause", "mute", "next", "back", "done", "step", "view", "on", "pin"]);
export const TU_ANH_CU = ["INSTRUCTIONS", "PREPARE", "THE SHOW", "PIN WHAT SELLS", "ON AIR", "SIMULATED", "Unknown"];

/** Mọi chữ người dùng thấy hoặc trình đọc màn hình đọc: nội dung chữ, aria-label, title, alt. */
export function chuCua(el: Element): string {
  const thuocTinh = Array.from(el.querySelectorAll("[aria-label],[title],[alt]")).flatMap((n) =>
    ["aria-label", "title", "alt"].map((a) => n.getAttribute(a) ?? ""),
  );
  const nut: string[] = [];
  const di = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = di.nextNode(); n; n = di.nextNode()) nut.push(n.textContent ?? "");
  return [...nut, el.getAttribute("aria-label") ?? "", ...thuocTinh].join(" ");
}

export function tuTiengAnh(chu: string): string[] {
  const tu = chu.match(/[\p{L}]+/gu) ?? [];
  return tu.filter((t) => t.length >= 2 && /^[A-Za-z]+$/.test(t) && !DUOC_PHEP.has(t) && (TU_ANH_NGAN.has(t.toLowerCase()) || !AM_TIET_VIET.test(t)));
}

/** Mọi góc xoay trong mã HTML: transform="rotate(a ...)" và style rotate: a deg. */
export function gocXoay(html: string): number[] {
  const goc: number[] = [];
  for (const m of html.matchAll(/rotate\((-?[\d.]+)/g)) goc.push(Number(m[1]));
  for (const m of html.matchAll(/rotate:\s*(-?[\d.]+)deg/g)) goc.push(Number(m[1]));
  return goc;
}

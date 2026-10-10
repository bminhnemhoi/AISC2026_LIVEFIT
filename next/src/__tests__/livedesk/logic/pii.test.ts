import { describe, expect, it } from "vitest";
import { maskPii } from "@/lib/livedesk/pii";

const masked = (text: string): string => maskPii(text).text;

describe("Vietnamese PII mask (port of the original scrubber)", () => {
  it("returns a clean comment unchanged", () => {
    expect(maskPii("Giá bao nhiêu vậy shop")).toEqual({ text: "Giá bao nhiêu vậy shop", masked: false, counts: {} });
  });

  it.each([
    ["sđt 0123 456 789 nha", "sđt [SĐT] nha"],
    ["09.01.23.45.67", "[SĐT]"],
    ["O9O1234567", "[SĐT]"],
    ["+84 912 345 678", "[SĐT]"],
    ["không chín không một hai ba bốn năm sáu bảy", "[SĐT]"],
  ])("phone %s", (text, out) => expect(masked(text)).toBe(out));

  it("emails, links, handles and bank accounts", () => {
    expect(masked("mail test@example.com nhé")).toBe("mail [EMAIL] nhé");
    expect(masked("fb.com/some.profile")).toBe("[MXH]");
    expect(masked("cảm ơn @TrầnThịMai-k3x.")).toBe("cảm ơn [MXH].");
    expect(masked("giá @50k")).toBe("giá @50k");
    expect(masked("stk 0071000123456")).toBe("stk [STK]");
  });

  it("order codes", () => {
    expect(masked("mã đơn ABC12345")).toBe("mã đơn [MÃ ĐƠN]");
    expect(masked("SPXVN0123456789")).toBe("[MÃ ĐƠN]");
  });

  it("addresses", () => {
    expect(masked("ship về Gò Vấp nha shop")).toBe("ship về [ĐỊA CHỈ] nha shop");
    expect(masked("ship ve go vap")).toBe("ship ve [ĐỊA CHỈ]");
    expect(masked("số 12/3 đường Lê Lợi")).toContain("[ĐỊA CHỈ]");
    expect(masked("địa chỉ: 45 Nguyễn Trãi Thanh Xuân")).toBe("[ĐỊA CHỈ]");
    expect(masked("ở q7")).toBe("ở [ĐỊA CHỈ]");
    // A city named without a shipping word is not an address.
    expect(masked("Hà Nội hôm nay mưa")).not.toContain("[ĐỊA CHỈ]");
  });

  it("names", () => {
    expect(masked("tên chị là Nguyễn Thị Hoa")).toContain("[TÊN]");
    expect(masked("chị Hương lấy 1")).toBe("chị [TÊN] lấy 1");
    expect(masked("chị hương ơi")).toBe("chị [TÊN] ơi");
    expect(masked("chị ơi")).toBe("chị ơi");
    expect(masked("tên em là hoa")).toBe("tên em là [TÊN]");
  });

  it("counts what it masked and is idempotent", () => {
    const once = maskPii("chốt đơn, sđt 0123 456 789, email test@example.com");
    expect(once.masked).toBe(true);
    expect(once.counts).toEqual({ phone: 1, email: 1 });
    expect(masked(once.text)).toBe(once.text);
  });

  it("catches fullwidth and keycap digits", () => {
    expect(masked("０９０１２３４５６７")).toBe("[SĐT]");
    expect(masked("0️⃣9️⃣0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣")).toBe("[SĐT]");
  });
});

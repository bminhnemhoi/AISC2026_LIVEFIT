import { describe, expect, it } from "vitest";
import { classifyIntent, classifyOriginal, stripDiacritics } from "@/lib/livedesk/intent";

describe("comment intents (port of the original keyword baseline)", () => {
  it("strips Vietnamese diacritics and đ", () => {
    expect(stripDiacritics("Gò Vấp ĐƯỜNG")).toBe("go vap duong");
  });

  it.each([
    ["Giá bao nhiêu vậy shop", "hoi_gia"],
    ["bn tiền vậy", "hoi_gia"],
    ["GIA NHIEU", "hoi_gia"],
    ["Mình cao 1m65 nặng 52kg lấy size nào ạ", "hoi_size"],
    ["form rộng không", "hoi_size"],
    ["Chốt đơn cho em", "chot_don"],
    ["em lấy 1 cái", "chot_don"],
    ["phí ship bao nhiêu", "van_chuyen"],
    ["đắt quá shop", "che_dat"],
    ["Đẹp quá shop ơi", "cam_on_khen"],
    ["Cảm ơn shop nhiều", "cam_on_khen"],
    ["Chào cả nhà", "khac"],
  ])("%s -> %s", (text, label) => {
    expect(classifyOriginal(text)).toBe(label);
  });

  it("keeps the original priority: buying beats asking, shipping beats price", () => {
    expect(classifyOriginal("chốt size L giá bao nhiêu")).toBe("chot_don");
    expect(classifyOriginal("size M giá bao nhiêu")).toBe("hoi_size");
    expect(classifyOriginal("ship về tỉnh bao nhiêu tiền")).toBe("van_chuyen");
  });

  it("praise never overrides an intent the original recognises", () => {
    expect(classifyOriginal("đẹp quá, giá bao nhiêu")).toBe("hoi_gia");
    expect(classifyOriginal("đẹp quá, chốt 1 cái")).toBe("chot_don");
  });

  it("matches whole words only, accent-insensitively ('mua' is not inside 'muadong')", () => {
    expect(classifyOriginal("muadong")).toBe("khac");
    expect(classifyOriginal("MUA")).toBe("chot_don");
  });

  it("maps to the five desk intents", () => {
    expect(classifyIntent("Giá bao nhiêu")).toBe("ask_price");
    expect(classifyIntent("size nào")).toBe("ask_size");
    expect(classifyIntent("chốt")).toBe("ready_to_buy");
    expect(classifyIntent("tuyệt vời quá")).toBe("praise");
    expect(classifyIntent("phí ship bao nhiêu")).toBe("other");
    expect(classifyIntent("đắt quá")).toBe("other");
    expect(classifyIntent("hello")).toBe("other");
  });
});

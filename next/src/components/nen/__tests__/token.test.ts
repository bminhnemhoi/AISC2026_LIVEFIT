import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAP_TONE, MAU_NEN, TONE_NHAN_CONG_BO, TONE_NHAN_NGUON, bienCss, tuongPhan, type TenMauNen } from "@/components/nen";
import { MA_NHAN_CONG_BO, MA_NHAN_NGUON, timLoiChu } from "@/lib/tu-ngu";
import { docTep, tachQuyTac } from "./css-doc";

const nen = docTep("src/components/nen/nen.css");
const quyTac = tachQuyTac(nen);
const goc = Object.fromEntries(
  quyTac.filter((q) => q.boChon === ":root" && q.cha.length === 0).flatMap((q) => q.khai.map((k) => [k.ten, k.giaTri])),
);
const khaiCua = (boChon: string, ten: string): string | undefined =>
  quyTac.find((q) => q.boChon === boChon && q.cha.length === 0 && q.khai.some((k) => k.ten === ten))?.khai.find(
    (k) => k.ten === ten,
  )?.giaTri;

/** Trộn màu rgba lên nền đặc (để kiểm chữ trên lớp nền trong suốt). */
function tron(rgb: [number, number, number], a: number, duoi: string): string {
  const n = parseInt(duoi.slice(1), 16);
  const d = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `#${rgb.map((c, i) => Math.round(c * a + d[i] * (1 - a)).toString(16).padStart(2, "0")).join("")}`;
}

describe("nen.css khớp token.ts", () => {
  it("mỗi màu của token.ts có đúng một biến --n-* cùng giá trị", () => {
    for (const ten of Object.keys(MAU_NEN) as TenMauNen[]) {
      expect(goc[bienCss(ten)], bienCss(ten)).toBe(MAU_NEN[ten]);
    }
  });

  it("bảng D-026 đúng giá trị quyết định", () => {
    expect(MAU_NEN.bat).toBe("#3d6b4f");
    expect(MAU_NEN.tat).toBe("#8a8f98");
    expect(MAU_NEN.nguoiXem).toBe("#2f74b5");
    expect(MAU_NEN.luotNhap).toBe("#c8691c");
    expect(MAU_NEN.don).toBe("#9b4fb0");
    for (const [bd, n] of [
      ["--bd-bat", "--n-bat"],
      ["--bd-tat", "--n-tat"],
      ["--bd-nguoi-xem", "--n-nguoi-xem"],
      ["--bd-luot-nhap", "--n-luot-nhap"],
      ["--bd-don", "--n-don"],
      ["--bd-trung", "--n-trung"],
    ]) {
      expect(goc[bd]).toBe(`var(${n})`);
    }
  });

  it("nút 44 px, nút chính 48 px, vùng bấm nhãn nguồn 44 px, bo thẻ 12 px", () => {
    expect(goc["--n-nut"]).toBe("44px");
    expect(goc["--n-nut-chinh"]).toBe("48px");
    expect(goc["--n-bo"]).toBe("12px");
    expect(khaiCua(".nen-nut", "min-height")).toBe("var(--n-nut)");
    expect(khaiCua(".nen-nut", "min-width")).toBe("var(--n-nut)");
    expect(khaiCua('.nen-nut[data-cao="48"]', "min-height")).toBe("var(--n-nut-chinh)");
    expect(khaiCua(".nen-nhan-nguon__nut", "min-height")).toBe("var(--n-nut)");
    expect(khaiCua(".nen-nhan-nguon__nut", "min-width")).toBe("var(--n-nut)");
    expect(khaiCua(".nen-the", "border-radius")).toBe("var(--n-bo)");
    expect(khaiCua(".nen-muc", "min-height")).toBe("var(--n-nut)");
  });

  it("chữ không nhỏ hơn 12 px", () => {
    for (const [ten, v] of Object.entries(goc)) {
      if (/^--n-c\d+$/.test(ten)) expect(parseInt(v, 10), ten).toBeGreaterThanOrEqual(12);
    }
    const coDinh = quyTac.flatMap((q) =>
      q.khai.filter((k) => k.ten === "font-size" && /^\d+px$/.test(k.giaTri)).map((k) => [q.boChon, k.giaTri]),
    );
    // chỉ dấu "?" trong vòng tròn 16 px được nhỏ hơn (biểu tượng aria-hidden, không phải chữ đọc)
    expect(coDinh.filter(([b, v]) => parseInt(v, 10) < 12 && b !== ".nen-nhan-nguon__dau-hoi")).toEqual([]);
  });

  it("giảm chuyển động: thời lượng về 0 và tắt hoạt ảnh", () => {
    const giam = quyTac.filter((q) => q.cha.some((c) => c.includes("prefers-reduced-motion: reduce")));
    const bien = Object.fromEntries(giam.flatMap((q) => q.khai.map((k) => [k.ten, k.giaTri])));
    expect(bien["--n-t-nhanh"]).toBe("0ms");
    expect(bien["--n-t-vua"]).toBe("0ms");
    expect(bien["--n-t-cham"]).toBe("0ms");
    expect(giam.some((q) => q.boChon.includes(".nen-live__cham") && q.khai.some((k) => k.ten === "animation" && k.giaTri === "none"))).toBe(true);
  });
});

describe("tương phản ≥ 4.5:1 cho mọi cặp chữ/nền", () => {
  const M = MAU_NEN;
  const cap: Array<[string, string, string]> = [
    ["chữ chính trên nền", M.muc, M.nen],
    ["chữ phụ trên nền", M.muc2, M.nen],
    ["chú thích trên nền", M.muc3, M.nen],
    ["chú thích trên thẻ", M.muc3, M.beMat],
    ["chú thích trên chip", M.muc3, M.beMat2],
    ["chữ nút chính", M.chuSang, M.gach],
    ["chữ nút chính khi rê", M.chuSang, M.gachDam],
    ["chữ nút phụ", M.muc, M.beMat2],
    ["chữ nút phụ khi rê", M.muc, M.beMat3],
    ["mục điều hướng", M.muc2, M.beMat],
    ["câu nghĩa nhãn nguồn", M.chuSang, M.muc],
    ["thay đổi tốt trên thẻ", M.bat, M.beMat],
    ["thay đổi xấu trên thẻ", M.gachDam, M.beMat],
    ["ĐANG LIVE", M.chuSang, M.gach],
    ["nhãn người dẫn AI trên video trắng", M.chuSang, tron([31, 26, 23], 0.86, "#ffffff")],
    ["nhãn người dẫn AI trên video đen", M.chuSang, tron([31, 26, 23], 0.86, "#000000")],
  ];
  it.each(cap)("%s", (_ten, chu, nenMau) => {
    expect(tuongPhan(chu, nenMau)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(CAP_TONE))("chip %s", (_tone, { chu, nen: nenMau }) => {
    expect(tuongPhan(chu, nenMau)).toBeGreaterThanOrEqual(4.5);
  });

  it("viền nút viền đủ 3:1 (thành phần giao diện)", () => {
    expect(tuongPhan(M.muc3, M.nen)).toBeGreaterThanOrEqual(3);
  });

  it("mọi nhãn nguồn và nhãn công bố có sắc", () => {
    for (const m of MA_NHAN_NGUON) expect(CAP_TONE[TONE_NHAN_NGUON[m]]).toBeDefined();
    for (const m of MA_NHAN_CONG_BO) expect(CAP_TONE[TONE_NHAN_CONG_BO[m]]).toBeDefined();
  });

  it("xám TẮT không bao giờ làm màu chữ (chỉ 2,94:1)", () => {
    expect(tuongPhan(M.tat, M.nen)).toBeLessThan(4.5);
    expect(nen).not.toMatch(/(^|[^-])color:\s*var\(--n-tat\)/m);
  });
});

describe("chữ trong components/nen sạch", () => {
  const thuMuc = path.resolve(process.cwd(), "src/components/nen");
  const tep = readdirSync(thuMuc).filter((t) => /\.(tsx?|css)$/.test(t));

  it("không dấu gạch dài, không chữ cấm, không chính tả cũ", () => {
    for (const t of tep) {
      const nd = readFileSync(path.join(thuMuc, t), "utf8");
      expect(nd.includes("—"), t).toBe(false);
      expect(timLoiChu(nd), t).toEqual([]);
    }
  });

  it("không chuỗi tiếng Anh hiện trên giao diện (chữ JSX giữa hai thẻ)", () => {
    const tiengAnh = /\b(Close|Cancel|Confirm|OK|Skip|Loading|Menu|Home|Settings|Dashboard|Live now|Source)\b/;
    for (const t of tep.filter((x) => x.endsWith(".tsx"))) {
      const nd = readFileSync(path.join(thuMuc, t), "utf8");
      const chuJsx = [...nd.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter(Boolean);
      for (const c of chuJsx) expect(tiengAnh.test(c), `${t}: "${c}"`).toBe(false);
      const chuChuoi = [...nd.matchAll(/"([^"\n]{2,})"/g)].map((m) => m[1]);
      for (const c of chuChuoi) expect(tiengAnh.test(c), `${t}: "${c}"`).toBe(false);
    }
  });
});

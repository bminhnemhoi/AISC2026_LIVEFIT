/**
 * Luật hình bản 3.1 (mục 3) cho Live Desk: không phần tử nào chứa nút được nghiêng. Token --tilt-* bằng 0; chỉ giả
 * phần tử (::before/::after, không nhận bấm) và hình trang trí aria-hidden được nghiêng, tối đa 2°; biểu tượng mũi tên
 * gập/mở xoay theo bội 90° là đổi hướng, không phải nghiêng.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { docTep, goc, tachQuyTac } from "./css-doc";

const CALM = "src/components/livedesk/calm.css";
const css = docTep(CALM);
const quyTac = tachQuyTac(css);
const NGHIENG_TOI_DA = 2;

/** Hình trang trí (không phải giả phần tử) được phép nghiêng; markup phải có aria-hidden="true". */
const TRANG_TRI = ["unknown-sticker"] as const;

function laGiaPhanTu(boChon: string): boolean {
  return boChon.split(",").every((s) => /::?(before|after)\s*$/.test(s.trim()));
}
function laTrangTri(boChon: string): boolean {
  return boChon.split(",").every((s) => TRANG_TRI.some((c) => new RegExp(`\\.${c}\\s*$`).test(s.trim())));
}
function laMuiTenGap(boChon: string): boolean {
  return boChon.split(",").every((s) => /\.fold-chev\s*$/.test(s.trim()));
}

describe("calm.css: không nghiêng phần chứa nút", () => {
  it("mọi token --tilt-* bằng 0", () => {
    const tilt = quyTac.flatMap((q) => q.khai.filter((k) => k.ten.startsWith("--tilt-")));
    expect(tilt.map((k) => k.ten).sort()).toEqual(["--tilt-card", "--tilt-phone", "--tilt-stamp"]);
    for (const k of tilt) expect(goc(k.giaTri), `${k.ten}: ${k.giaTri}`).toBe(0);
  });

  it("thẻ ghim, dấu MÔ PHỎNG và điện thoại chỉ dùng token (bằng 0)", () => {
    const rotateCua = (boChon: string): string[] =>
      quyTac.filter((q) => q.boChon === boChon).flatMap((q) => q.khai.filter((k) => k.ten === "rotate").map((k) => k.giaTri));
    expect(rotateCua(".ld .product.is-pinned")).toEqual(["var(--tilt-card)"]);
    expect(rotateCua(".ld .sim-tag")).toEqual(["var(--tilt-stamp)"]);
    expect(rotateCua(".ld .phone")).toEqual(["var(--tilt-phone)"]);
  });

  it("mỗi khai báo rotate đều hợp luật", () => {
    const sai: string[] = [];
    let soTrangTri = 0;
    for (const q of quyTac) {
      for (const k of q.khai) {
        if (k.ten !== "rotate") continue;
        const v = k.giaTri;
        if (/^var\(--tilt-[a-z]+\)$/.test(v)) continue;
        const g = goc(v);
        if (g === 0) continue;
        if (g !== null && laMuiTenGap(q.boChon) && g % 90 === 0) continue;
        if (g !== null && Math.abs(g) <= NGHIENG_TOI_DA && (laGiaPhanTu(q.boChon) || laTrangTri(q.boChon))) {
          soTrangTri++;
          continue;
        }
        sai.push(`${q.boChon} { rotate: ${v} }`);
      }
    }
    expect(sai).toEqual([]);
    // băng dính thẻ ghim, băng dưới chữ, nhãn "Chưa biết"
    expect(soTrangTri).toBe(3);
  });

  it("không có transform xoay hay xô nghiêng, không có skew ở đâu cả", () => {
    expect(css).not.toMatch(/skew/i);
    const sai = quyTac.flatMap((q) =>
      q.khai
        .filter((k) => k.ten === "transform" && /rotate|matrix/i.test(k.giaTri))
        .map((k) => `${q.boChon} { transform: ${k.giaTri} }`),
    );
    expect(sai).toEqual([]);
  });

  it("hình trang trí được nghiêng đều mang aria-hidden trong markup", () => {
    const thuMuc = path.resolve(process.cwd(), "src/components/livedesk");
    const tsx = readdirSync(thuMuc)
      .filter((t) => t.endsWith(".tsx"))
      .map((t) => readFileSync(path.join(thuMuc, t), "utf8"))
      .join("\n");
    for (const lop of TRANG_TRI) {
      const the = tsx.match(new RegExp(`<[a-z]+[^>]*className="[^"]*\\b${lop}\\b[^"]*"[^>]*>`, "g")) ?? [];
      expect(the.length, lop).toBeGreaterThan(0);
      for (const t of the) expect(t, lop).toContain('aria-hidden="true"');
    }
  });
});

describe("nen.css cũng không nghiêng gì", () => {
  it("không rotate, skew, matrix", () => {
    const nen = docTep("src/components/nen/nen.css");
    const q = tachQuyTac(nen);
    const sai = q.flatMap((r) =>
      r.khai.filter((k) => k.ten === "rotate" || /rotate|skew|matrix/i.test(k.giaTri)).map((k) => `${r.boChon} ${k.ten}`),
    );
    expect(sai).toEqual([]);
  });
});

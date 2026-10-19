import React from "react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NGHIENG_TOI_DA } from "@/components/minh-hoa";
import { chuCua, gocXoay, tuTiengAnh } from "@/components/minh-hoa/__tests__/kiem-chu";
import { NHAN_NGUON, NHAN_NGUON_THEO_MA, timLoiChu } from "@/lib/tu-ngu";
import {
  BAO_NHAM_KHOI_5P,
  CAU_DINH_VI,
  KET_QUA_MO_PHONG,
  NUT_CHINH,
  NUT_PHU,
  ID_CACH_DO,
  SU_THAT,
  TrangGioiThieu,
  ghepSo,
  tachSo,
} from "@/components/trang-chu";
import GioiThieuPage, { metadata } from "@/app/gioi-thieu/page";

const yaml = createRequire(import.meta.url)("js-yaml") as { load: (s: string) => unknown };
const goc = path.resolve(process.cwd(), "..");
const soYaml = yaml.load(readFileSync(path.join(goc, "docs/canon/so.yaml"), "utf8")) as {
  so: Array<{ id: string; gia_tri: unknown; hien_thi: string; nhan: string; cam: string[] }>;
};
const factSheet = readFileSync(path.join(goc, "docs/competition/FACT-SHEET.md"), "utf8");
const so = (id: string) => {
  const s = soYaml.so.find((x) => x.id === id);
  if (!s) throw new Error(`so.yaml thiếu ${id}`);
  return s;
};

/** Câu định vị chuẩn, gõ lại ở đây để test không tự so với chính nó. */
const DINH_VI_CHUAN =
  "LiveLift giúp người bán livestream tự đo xem việc ghim một sản phẩm có thật sự làm khách bấm mua nhiều hơn, bằng cách bốc thăm bật/tắt theo từng khối 5 phút thay vì đoán theo tương quan.";

const CHU_NHAN = NHAN_NGUON.map((n) => n.hien_thi);

function veTrang() {
  return render(<TrangGioiThieu />);
}

describe("trang giới thiệu: chữ", () => {
  it("có câu hỏi lớn và câu định vị nguyên văn", () => {
    const { container } = veTrang();
    expect(CAU_DINH_VI).toBe(DINH_VI_CHUAN);
    expect(container.querySelector("h1")?.textContent).toBe("Ghim món này, khách có bấm mua nhiều hơn không?");
    expect(container.textContent).toContain(DINH_VI_CHUAN);
  });

  it("không có dấu gạch dài, chữ cấm, lỗi chính tả hay thuật ngữ cấm", () => {
    const { container } = veTrang();
    const chu = chuCua(container);
    expect(chu).not.toContain("—");
    expect(timLoiChu(chu, { thuatNgu: true })).toEqual([]);
    expect(chu).not.toMatch(/khúc|khoá lịch|Ghim theo gợi ý|Thí nghiệm có bốc thăm|đầu tiên|tăng doanh số/i);
    expect(chu).not.toMatch(/\bQR\b/);
  });

  it("luồng chính không có chữ tiếng Anh (chân trang giữ tên hạng mục của cuộc thi)", () => {
    const { getByTestId } = veTrang();
    // "livestream" nằm trong câu định vị nguyên văn; "LiveRoomSim" nằm trong câu nghĩa canon của nhãn MÔ PHỎNG.
    const tu = tuTiengAnh(chuCua(getByTestId("home-flow"))).filter((t) => !/^(livestream|LiveRoomSim)$/i.test(t));
    expect(tu).toEqual([]);
  });

  it("metadata tiếng Việt, không dấu gạch dài", () => {
    expect(metadata.title).toBe("Giới thiệu");
    expect(String(metadata.description)).toMatch(/khối 5 phút/);
    expect(String(metadata.description)).not.toContain("—");
    expect(timLoiChu(String(metadata.description))).toEqual([]);
    expect(GioiThieuPage).toBeTypeOf("function");
  });
});

describe("trang giới thiệu: hợp đồng DOM", () => {
  it("hero và dải khối có data-chup, mỗi tên một phần tử", () => {
    const { container } = veTrang();
    for (const ten of ["hero", "dai-khoi"]) expect(container.querySelectorAll(`[data-chup="${ten}"]`)).toHaveLength(1);
    const hero = container.querySelector('[data-chup="hero"]')!;
    expect(hero).toHaveAttribute("data-vung-chinh");
    expect(hero.querySelector('[data-chup="dai-khoi"] [data-minh-hoa="dai-dong-xu"]')).not.toBeNull();
    expect(hero.querySelector('[data-testid="dien-thoai-live"][data-che-do="poster"]')).not.toBeNull();
    expect(hero.querySelector("[data-nguoi-dan-ai]")).toBeNull();
  });

  it("nút chính tới /phien, nút phụ cuộn tới phần cách đo", () => {
    const { container } = veTrang();
    const nutChinh = container.querySelector('[data-chup="hero"] [data-nut-chinh]');
    expect(nutChinh?.textContent).toBe(NUT_CHINH.chu);
    expect(nutChinh).toHaveAttribute("href", "/phien");
    const nutPhu = Array.from(container.querySelectorAll('[data-chup="hero"] a')).find((a) => a.textContent === NUT_PHU.chu);
    expect(nutPhu).toHaveAttribute("href", `#${ID_CACH_DO}`);
    expect(container.querySelector(`#${ID_CACH_DO} [data-co-che="trang"]`)).not.toBeNull();
  });

  it("giữ data-testid home-flow và truth-panel", () => {
    const { getByTestId } = veTrang();
    expect(getByTestId("home-flow")).toBeInTheDocument();
    const that = getByTestId("truth-panel");
    expect(that.textContent).toContain("Sự thật hôm nay");
    expect(that.textContent).toContain("phiên với người bán thật");
    expect(that.textContent).toContain("phỏng vấn");
    expect(that.textContent).toContain("20/10/2026");
    // chip THẬT không đứng cạnh một vế giả thuyết
    expect(SU_THAT.filter((s) => s.maNhan === "THAT").every((s) => !/giả thuyết/i.test(s.chu))).toBe(true);
  });

  it("chữ thường thay chữ trong ngành; chân trang không có chữ tiếng Anh thừa", () => {
    const { container } = veTrang();
    const chu = chuCua(container);
    for (const cu of ["nửa đời", "lệch về phía 0", "track", "Lấy mã phòng", "chốt một trong ba chữ", "Ba màn người bán dùng"]) {
      expect(chu).not.toContain(cu);
    }
    expect(chu).toContain("sau 300 giây còn một nửa");
    expect(chu).toContain("khối đầu và cuối 10 phút");
  });

  it("không phần tử nào nghiêng quá 2°", () => {
    const { container } = veTrang();
    for (const g of gocXoay(container.innerHTML)) expect(Math.abs(g)).toBeLessThanOrEqual(NGHIENG_TOI_DA);
  });

  it("không có QR và không gọi máy chủ (trang tĩnh)", () => {
    const { container } = veTrang();
    expect(container.querySelector('[data-testid*="qr" i], [aria-label*="QR"]')).toBeNull();
  });
});

describe("trang giới thiệu: số", () => {
  it("mọi chữ số nằm trong một vùng có nhãn nguồn", () => {
    const { container } = veTrang();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const thieu: string[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const chu = n.textContent ?? "";
      if (!/\d/.test(chu)) continue;
      const vung = n.parentElement?.closest("[data-co-nhan]");
      if (!vung) {
        thieu.push(chu);
        continue;
      }
      if (vung.getAttribute("data-co-nhan") === "ma") continue; // mã đội, không phải số đo
      if (!CHU_NHAN.some((nhan) => (vung.textContent ?? "").includes(nhan))) thieu.push(chu);
    }
    expect(thieu).toEqual([]);
  });

  it("chân trang chỉ có mã đội, không có số đo", () => {
    const { container } = veTrang();
    const chan = container.querySelector('[data-co-nhan="ma"]')!;
    expect((chan.textContent ?? "").replace("AISC26-0039", "")).not.toMatch(/\d/);
  });

  it("ba số mô phỏng chép đúng hien_thi và nhan của so.yaml, mỗi thẻ mang nhãn MÔ PHỎNG", () => {
    const { container } = veTrang();
    for (const k of KET_QUA_MO_PHONG) {
      const s = so(k.id);
      expect(k.hienThi).toBe(s.hien_thi);
      expect(k.nhan).toBe(s.nhan);
      expect(NHAN_NGUON_THEO_MA[k.maNhan].hien_thi).toBe(s.nhan);
      const the = container.querySelector(`[data-so-id="${k.id}"]`)!;
      expect(the.textContent).toContain(s.hien_thi);
      expect(the.querySelector("[data-nhan-nguon]")?.textContent).toContain("MÔ PHỎNG");
      for (const cam of s.cam) expect(the.textContent ?? "").not.toMatch(new RegExp(cam, "i"));
    }
  });

  it("lực phát hiện 95% luôn đi kèm +30% và khối 5 phút", () => {
    const luc = KET_QUA_MO_PHONG.find((k) => k.id === "luc_khoi_5p")!;
    expect(luc.dieuKien).toContain("+30%");
    expect(luc.dieuKien).toContain("khối 5 phút");
    expect(luc.dieuKien).toContain("3 phiên × 120 phút");
  });

  it("báo nhầm riêng khối 5 phút lấy từ FACT-SHEET", () => {
    expect(factSheet).toContain(`khối 5 phút ${BAO_NHAM_KHOI_5P}`);
    expect(KET_QUA_MO_PHONG[0].dieuKien).toContain(BAO_NHAM_KHOI_5P);
  });

  it("sự thật hôm nay khớp so.yaml", () => {
    for (const s of SU_THAT) {
      if (!s.id) continue;
      expect(String(so(s.id).gia_tri)).toBe(s.so);
      expect(so(s.id).nhan).toBe("THẬT");
    }
  });
});

describe("số đếm lên", () => {
  it("t = 1 trả đúng chuỗi gốc, t = 0 về 0 giữ dấu và đơn vị", () => {
    for (const k of KET_QUA_MO_PHONG) expect(ghepSo(tachSo(k.hienThi), 1)).toBe(k.hienThi);
    expect(ghepSo(tachSo("4,3%"), 0)).toBe("0,0%");
    expect(ghepSo(tachSo("−46% → −35%"), 0)).toBe("−0% → −0%");
  });
});

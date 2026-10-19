import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAU_GHIM,
  CHINH_TA,
  CHO_CANON,
  MA_NHAN_CONG_BO,
  MA_NHAN_NGUON,
  NHAN_CONG_BO,
  NHAN_CONG_BO_THEO_MA,
  KET_LUAN,
  KET_LUAN_THEO_MA,
  MA_KET_LUAN,
  NHAN_NGUON,
  NHAN_NGUON_THEO_MA,
  PHIEN_BAN_CANON,
  PHU_DE_KHOI,
  QUY_TAC_KHAC,
  THUAT_NGU,
  TU,
  TU_CAM,
  boNgoac,
  hoaChuDau,
  nhanVaPhuDe,
  theoCanon,
  timLoiChu,
  veMauCam,
} from "@/lib/tu-ngu";

// js-yaml đi kèm eslint trong node_modules; nạp bằng require để test không cần khai báo kiểu riêng.
const yaml = createRequire(import.meta.url)("js-yaml") as { load: (s: string) => unknown };

interface CanonYaml {
  phien_ban: string;
  thuat_ngu: Array<Record<string, unknown>>;
  cau_ghim: string;
  nhan_nguon: Array<{ id: string; hien_thi: string; nghia: string }>;
  nhan_cong_bo: Array<{ id: string; hien_thi: string; nghia: string }>;
  ket_luan: Array<{ id: string; chu: string; nhan_thuoc: string; cau: string }>;
  tu_cam: Array<{ mau: string; ly_do: string }>;
  quy_tac_khac: string[];
  chinh_ta: { dung: string[]; cam: string[] };
}

const canon = yaml.load(
  readFileSync(path.resolve(process.cwd(), "../docs/canon/thuat-ngu.yaml"), "utf8"),
) as CanonYaml;

/** Bỏ khoá không có giá trị để so sánh sâu không vấp vào thứ tự hay undefined. */
const gon = (o: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

describe("tu-ngu.ts khớp từng chữ với docs/canon/thuat-ngu.yaml", () => {
  it("cùng phiên bản canon", () => {
    expect(PHIEN_BAN_CANON).toBe(canon.phien_ban);
  });

  it("thuật ngữ: cùng số dòng, cùng thứ tự, cùng mọi trường", () => {
    expect(THUAT_NGU.map(gon)).toEqual(canon.thuat_ngu.map(gon));
  });

  it("câu ghim, chữ cấm, chính tả, quy tắc khác", () => {
    expect(CAU_GHIM).toBe(canon.cau_ghim);
    expect(TU_CAM.map(gon)).toEqual(canon.tu_cam);
    expect({ dung: [...CHINH_TA.dung], cam: [...CHINH_TA.cam] }).toEqual(canon.chinh_ta);
    expect([...QUY_TAC_KHAC]).toEqual(canon.quy_tac_khac);
  });

  it("nhãn nguồn và nhãn công bố: cùng mã, chữ hiện và nghĩa", () => {
    expect(NHAN_NGUON.map(gon)).toEqual(canon.nhan_nguon);
    expect(NHAN_CONG_BO.map(gon)).toEqual(canon.nhan_cong_bo);
    expect([...MA_NHAN_NGUON]).toEqual(canon.nhan_nguon.map((n) => n.id));
    expect([...MA_NHAN_CONG_BO]).toEqual(canon.nhan_cong_bo.map((n) => n.id));
    expect(NHAN_NGUON_THEO_MA.MO_PHONG.hien_thi).toBe("MÔ PHỎNG");
    expect(NHAN_CONG_BO_THEO_MA.NGUOI_DAN_AI.hien_thi).toBe("NGƯỜI DẪN AI · GIỌNG TỔNG HỢP");
  });

  it("kết luận ĐỔI / GIỮ / ĐO THÊM: cùng mã, chữ, nhãn thước và câu", () => {
    expect(KET_LUAN.map(gon)).toEqual(canon.ket_luan);
    expect([...MA_KET_LUAN]).toEqual(canon.ket_luan.map((k) => k.id));
    expect(KET_LUAN_THEO_MA.DO_THEM.chu).toBe("ĐO THÊM");
  });

  it("tệp nguồn không chứa ký tự gạch dài thật (chỉ mã \\u2014)", () => {
    const nguon = readFileSync(path.resolve(process.cwd(), "src/lib/tu-ngu.ts"), "utf8");
    expect(nguon.includes("\u2014")).toBe(false);
  });
});

describe("lối tắt TU và phụ đề", () => {
  it("mọi mục TU trỏ về đúng một dòng canon", () => {
    const dung = new Set(canon.thuat_ngu.map((t) => t.dung));
    for (const muc of Object.values(TU)) expect(dung.has(muc.dung)).toBe(true);
  });

  it("Tỷ lệ nhấp: dạng ngắn kèm phụ đề đầy đủ", () => {
    expect(TU.tyLeNhap.hien).toBe("Tỷ lệ nhấp");
    expect(nhanVaPhuDe(TU.tyLeNhap)).toEqual({ nhan: "Tỷ lệ nhấp", phuDe: "lượt nhấp hợp lệ / 1.000 giây·người xem" });
  });

  it("thuật ngữ có phụ đề lời thường", () => {
    expect(nhanVaPhuDe(TU.niemPhongLich)).toEqual({
      nhan: "Niêm phong lịch",
      phuDe: "khoá bằng mã băm trước giờ live, không ai sửa lén được",
    });
    expect(nhanVaPhuDe(TU.khoangTinCay).nhan).toBe("Khoảng tin cậy 95%");
    expect(nhanVaPhuDe(TU.phongXem)).toEqual({ nhan: "Phòng xem" });
    expect(TU.ghimMonKhoiNay.hien).toBe("Ghim món của khối này");
    expect(TU.danhSachPhien.hien).toBe("Các phiên live đang đo hiệu quả ghim");
  });

  it("phụ đề khối tách được ba phần", () => {
    expect(PHU_DE_KHOI).toEqual({
      chung: "mỗi khối 5 phút, máy tung đồng xu chọn khối nào ghim",
      bat: "LiveLift ghim",
      tat: "đội làm như thường",
    });
  });

  it("boNgoac và hoaChuDau", () => {
    expect(boNgoac("radar ý định (tín hiệu phụ)")).toBe("radar ý định");
    expect(boNgoac("bốc thăm")).toBe("bốc thăm");
    expect(hoaChuDau("đoán theo số liệu cũ")).toBe("Đoán theo số liệu cũ");
    expect(hoaChuDau("")).toBe("");
  });

  it("theoCanon ném lỗi khi chữ không có trong canon", () => {
    expect(() => theoCanon("bàn trợ live")).toThrow(/không thấy/);
  });

  it("lời chờ canon: chưa có trong yaml và tự nó sạch chữ cấm", () => {
    const tatCaChu = JSON.stringify(canon);
    for (const chu of Object.values(CHO_CANON)) {
      expect(timLoiChu(chu, { thuatNgu: true })).toEqual([]);
      // Khi đã vào yaml thì chuyển sang TU và xoá khỏi CHO_CANON.
      expect(tatCaChu.includes(chu), `"${chu}" đã có trong yaml: chuyển sang TU`).toBe(false);
    }
  });
});

describe("timLoiChu", () => {
  it("bắt từng mẫu cấm của canon", () => {
    const mau: Array<[string, string]> = [
      ["có 2,5 triệu phiên mỗi tháng", "2,5 triệu (phiên|buổi)"],
      ["hơn > 50.000 nhà bán", ">\\s*50\\.000 nhà bán"],
      ["báo nhầm 4,5 %", "4,5\\s*%"],
      ["macro-F1 0,271", "0,271"],
      ["giúp Tăng doanh số", "tăng doanh số"],
      ["chỉ shop Mall/Preferred", "Mall/Preferred"],
      ["LiveLift không bao giờ tự ghim", "không bao giờ tự ghim"],
      ["xem estimated GMV", "estimated GMV"],
      ["đây là công cụ đầu tiên", "(là|đội|công cụ|sản phẩm) đầu tiên"],
      ["phiên có 18 khối", "18 khối"],
      ["mỗi khúc 5 phút", "khúc 5 phút"],
      ["a \u2014 b", "\u2014"],
      ["một bước đột phá", "đột phá|toàn diện|nâng tầm|hệ sinh thái|then chốt|cốt lõi"],
      ["không chỉ đo mà còn ghim", "không chỉ\\b.{0,80}\\bmà còn"],
    ];
    for (const [van, m] of mau) {
      expect(timLoiChu(van).map((l) => l.mau), van).toContain(m);
    }
  });

  it("ranh giới từ hiểu chữ có dấu (\\b của Python)", () => {
    expect(veMauCam("không chỉ\\b.{0,80}\\bmà còn").test("không chỉ đo mà còn")).toBe(true);
    expect(timLoiChu("không chỉnh gì mà còn")).toEqual([]);
  });

  it("không báo nhầm số canon hợp lệ", () => {
    expect(timLoiChu("báo nhầm 4,3% (riêng khối 5 phút 4,5–6%) · phiên 90 phút = 16 khối")).toEqual([]);
    expect(timLoiChu("Tỷ lệ nhấp · lượt nhấp hợp lệ / 1.000 giây·người xem")).toEqual([]);
  });

  it("chính tả cũ và thuật ngữ cấm (khi bật)", () => {
    expect(timLoiChu("bản minh họa").map((l) => l.loai)).toEqual(["chinh_ta"]);
    expect(timLoiChu("Thí nghiệm có bốc thăm")).toEqual([]);
    expect(timLoiChu("Thí nghiệm có bốc thăm", { thuatNgu: true }).map((l) => l.mau)).toEqual(["Thí nghiệm có bốc thăm"]);
    expect(timLoiChu("Ghim theo gợi ý", { thuatNgu: true })[0]?.ly_do).toBe('viết "Ghim món của khối này"');
    // "lát" là thuật ngữ cấm nhưng chỉ khớp nguyên từ
    expect(timLoiChu("phát lát", { thuatNgu: true }).map((l) => l.mau)).toEqual(["lát"]);
    expect(timLoiChu("phát lại", { thuatNgu: true })).toEqual([]);
  });

  it("chuẩn hoá NFD trước khi so", () => {
    expect(timLoiChu("minh họa".normalize("NFD")).length).toBe(1);
  });
});

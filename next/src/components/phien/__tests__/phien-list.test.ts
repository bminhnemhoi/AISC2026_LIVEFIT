import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isAllowed } from "@/lib/livelift-api/allowlist";
import type { BaoCao, KetQua, Session } from "@/lib/livelift-api/types";
import { CHO_CANON, TU, timLoiChu } from "@/lib/tu-ngu";
import { demTheoNhan, groupSessions, ketLuanPhien, maNhanPhien, TEN_O_NHAN, thoiLuongVaKhoi } from "../PhienList";

function s(id: string, status: string, start: string | null, them: Partial<Session> = {}): Session {
  return {
    session_id: id,
    platform: "youtube",
    title: id,
    mode: "auto",
    status,
    planned_duration_min: 90,
    start_ts: start,
    end_ts: null,
    dry_run: false,
    is_demo: false,
    ...them,
  };
}

const MO_PHONG: Partial<Session> = { platform: "sim", is_demo: true };
const THU_NOI_BO: Partial<Session> = { platform: "lab", dry_run: true };

function baoCao(kq: Partial<KetQua> | null, loai: "thi_nghiem" | "quan_sat" = "thi_nghiem"): BaoCao {
  return {
    session_id: "x",
    platform: "sim",
    loai_phien: loai,
    nhan: "",
    is_demo: true,
    dry_run: false,
    binh_luan_tong_hop: 0,
    tong_quan: { tong_binh_luan: 0 },
    tom_tat_3_cau: [],
    ket_qua_thi_nghiem:
      kq === null
        ? null
        : { khoa: false, estimable: false, n_blocks: 0, n_on: 0, n_off: 0, ...kq },
  } as BaoCao;
}

describe("trang /phien: danh sách phiên", () => {
  it("nhóm Đang live trước, rồi Đã lên lịch, rồi Đã xong; mới nhất trước; bỏ nhóm rỗng", () => {
    const g = groupSessions([
      s("a", "ended", "2026-10-14T10:00:00Z"),
      s("b", "live", "2026-10-15T09:00:00Z"),
      s("c", "ended", "2026-10-15T08:00:00Z"),
    ]);
    expect(g.map(x => x.title)).toEqual(["Đang live", "Đã xong"]);
    expect(g[1].items.map(x => x.session_id)).toEqual(["c", "a"]);
  });

  it("chỉ gọi những đường proxy phía máy chủ cho phép", () => {
    expect(isAllowed("GET", "sessions")).toBe(true);
    expect(isAllowed("GET", "sessions/635571a0-8671-41d7-a056-38818bfba4ad/bao-cao")).toBe(true);
    expect(isAllowed("GET", "sessions/635571a0-8671-41d7-a056-38818bfba4ad/schedule")).toBe(true);
    expect(isAllowed("POST", "demo/seed")).toBe(true);
    expect(isAllowed("POST", "demo/seed-vang")).toBe(true);
  });
});

describe("nhãn nguồn của phiên", () => {
  it("mỗi phiên mang đúng một mã canon", () => {
    expect(maNhanPhien(s("t", "ended", null))).toBe("THAT");
    expect(maNhanPhien(s("m", "ended", null, MO_PHONG))).toBe("MO_PHONG");
    expect(maNhanPhien(s("r", "live", null, { platform: "replay", is_demo: true }))).toBe("MO_PHONG");
    expect(maNhanPhien(s("n", "live", null, THU_NOI_BO))).toBe("THU_NOI_BO");
    expect(maNhanPhien(s("d", "live", null, { platform: "lab" }))).toBe("DAN_DUNG");
    // tập dượt trên nền tảng thật: không bao giờ tính là THẬT
    expect(maNhanPhien(s("c", "ended", null, { dry_run: true }))).toBe("THU_NOI_BO");
  });

  it("đếm tách theo nhãn, không cộng gộp; THẬT luôn có ô kể cả khi bằng 0", () => {
    const dem = demTheoNhan([
      s("m1", "ended", null, MO_PHONG),
      s("m2", "ended", null, MO_PHONG),
      s("m3", "live", null, MO_PHONG),
      s("n1", "live", null, THU_NOI_BO),
    ]);
    expect(dem).toEqual([
      { ma: "THAT", tong: 0, live: 0, xong: 0 },
      { ma: "THU_NOI_BO", tong: 1, live: 1, xong: 0 },
      { ma: "MO_PHONG", tong: 3, live: 1, xong: 2 },
    ]);
    expect(demTheoNhan([s("d", "live", null, { platform: "lab" })]).map(d => d.ma)).toContain("DAN_DUNG");
    for (const d of dem) expect(TEN_O_NHAN[d.ma]).toBeTruthy();
  });
});

describe("kết luận trên hàng: khoá §7", () => {
  const moDoi = baoCao({ khoa: false, estimable: true, estimate: 1.2, ci_low: 0.9, ci_high: 1.5 });

  it("THẬT hoặc THỬ NỘI BỘ đang live: luôn khoá, kể cả khi máy chủ lỡ trả khoa=false", () => {
    expect(ketLuanPhien(s("t", "live", null), moDoi)).toEqual({ loai: "khoa" });
    expect(ketLuanPhien(s("n", "live", null, THU_NOI_BO), moDoi)).toEqual({ loai: "khoa" });
    expect(ketLuanPhien(s("n", "live", null, THU_NOI_BO), undefined)).toEqual({ loai: "khoa" });
  });

  it("chỉ mở khi máy chủ nói rõ khoa=false; thiếu báo cáo hay lỗi mạng đều là khoá", () => {
    const xong = s("m", "ended", null, MO_PHONG);
    expect(ketLuanPhien(xong, undefined)).toEqual({ loai: "dang_tai" });
    expect(ketLuanPhien(xong, null)).toEqual({ loai: "khoa" });
    expect(ketLuanPhien(xong, baoCao(null))).toEqual({ loai: "khoa" });
    expect(ketLuanPhien(xong, baoCao({ khoa: true }))).toEqual({ loai: "khoa" });
    expect(ketLuanPhien(xong, baoCao(null, "quan_sat"))).toEqual({ loai: "quan_sat" });
    expect(ketLuanPhien(s("p", "planned", null), moDoi)).toEqual({ loai: "chua_phat" });
  });

  it("ĐỔI / GIỮ / ĐO THÊM theo khoảng tin cậy; thiếu khối thì ĐO THÊM", () => {
    const xong = s("m", "ended", null, MO_PHONG);
    expect(ketLuanPhien(xong, moDoi)).toMatchObject({ loai: "mo", ma: "DOI", thieuKhoi: false, somVi: null });
    expect(ketLuanPhien(xong, baoCao({ khoa: false, estimable: true, estimate: -1, ci_low: -1.5, ci_high: -0.2 }))).toMatchObject({ ma: "GIU" });
    expect(ketLuanPhien(xong, baoCao({ khoa: false, estimable: true, estimate: 0.5, ci_low: -0.8, ci_high: 1.4 }))).toMatchObject({ ma: "DO_THEM" });
    expect(ketLuanPhien(xong, baoCao({ khoa: false, estimable: false, n_blocks: 3 }))).toMatchObject({ ma: "DO_THEM", thieuKhoi: true });
  });

  it("MÔ PHỎNG đang live mà máy chủ mở: hiện kèm lý do mở sớm", () => {
    expect(ketLuanPhien(s("m", "live", null, MO_PHONG), moDoi)).toMatchObject({ loai: "mo", ma: "DOI", somVi: "MÔ PHỎNG" });
  });
});

describe("chữ trên trang", () => {
  const nguon = readFileSync(join(__dirname, "..", "PhienList.tsx"), "utf8");

  it("tiêu đề và phụ đề lấy từ canon; không còn tên cũ", () => {
    expect(TU.danhSachPhien.chu).toBe("Các phiên live đang đo hiệu quả ghim");
    expect(CHO_CANON.danhSachPhienPhuDe).toBe("Mỗi phiên chia khối 5 phút, máy tung đồng xu chọn khối nào ghim");
    expect(nguon).toContain("TU.danhSachPhien.chu");
    expect(nguon).toContain("CHO_CANON.danhSachPhienPhuDe");
    expect(nguon).not.toContain("Thí nghiệm có bốc thăm");
  });

  it("không có chữ cấm, dấu gạch dài hay lỗi chính tả trong mã nguồn của trang", () => {
    expect(timLoiChu(nguon)).toEqual([]);
  });

  it("giữ hợp đồng DOM cho script chụp và test", () => {
    for (const thuocTinh of ['data-testid="phien-list"', 'data-chup="danh-sach"', "data-vung-chinh", "data-an-khi-chup"]) {
      expect(nguon).toContain(thuocTinh);
    }
  });

  it("thời lượng kèm số khối khi đã có lịch", () => {
    expect(thoiLuongVaKhoi(90, 16)).toBe("90 phút · 16 khối");
    expect(thoiLuongVaKhoi(90, null)).toBe("90 phút");
    expect(thoiLuongVaKhoi(240, undefined)).toBe("240 phút");
  });
});

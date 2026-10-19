/**
 * Cấu hình thanh điều hướng của giao diện 2.0: một mảng duy nhất cho thanh trái (máy tính) và thanh dưới (điện thoại).
 *
 * Mục nào chưa có trang thì để `bat: false`; khi trang đã ghép vào nhánh, đổi thành `true` (một dòng) hoặc truyền
 * `batThem` vào AppShell để bật tạm. Biểu tượng lấy từ components/minh-hoa/icons (U3), chỉ để trang trí.
 */
import type React from "react";
import {
  IconGioiThieu,
  IconMinhHoa,
  IconPhatLai,
  IconPhienLive,
  IconQuanTri,
  IconTongQuan,
  type IconProps,
} from "@/components/minh-hoa/icons";

export type MaMuc = "gioi-thieu" | "tong-quan" | "phien" | "phat-lai" | "minh-hoa" | "quan-tri";
export type VaiTro = "quan-tri" | "nguoi-ban" | "chi-xem";

export interface MucDieuHuong {
  readonly id: MaMuc;
  /** Chữ trên thanh trái. */
  readonly nhan: string;
  /** Chữ dưới biểu tượng ở thanh mảnh và thanh dưới (tối đa khoảng 10 ký tự). */
  readonly ngan: string;
  readonly href: string;
  /** Đường dẫn khác cũng tính là mục này, so khớp đúng từng chữ (ví dụ "/" khi landing chuyển về trang gốc). */
  readonly cungTrang?: readonly string[];
  readonly Icon: (p: IconProps) => React.ReactElement;
  /** false: chưa có trang, ẩn khỏi thanh. */
  readonly bat: boolean;
  /** Chỉ hiện cho các vai này (bỏ trống: mọi vai). */
  readonly chiVai?: readonly VaiTro[];
}

export const DIEU_HUONG: readonly MucDieuHuong[] = Object.freeze([
  { id: "gioi-thieu", nhan: "Giới thiệu", ngan: "Giới thiệu", href: "/gioi-thieu", Icon: IconGioiThieu, bat: true },
  { id: "tong-quan", nhan: "Tổng quan", ngan: "Tổng quan", href: "/tong-quan", Icon: IconTongQuan, bat: false },
  { id: "phien", nhan: "Phiên live", ngan: "Phiên live", href: "/phien", Icon: IconPhienLive, bat: true },
  { id: "phat-lai", nhan: "Phát lại", ngan: "Phát lại", href: "/phat-lai", Icon: IconPhatLai, bat: false },
  {
    id: "minh-hoa",
    nhan: "Live Desk minh hoạ",
    ngan: "Minh hoạ",
    href: "/minh-hoa",
    Icon: IconMinhHoa,
    bat: false,
  },
  {
    id: "quan-tri",
    nhan: "Quản trị",
    ngan: "Quản trị",
    href: "/quan-tri",
    Icon: IconQuanTri,
    bat: false,
    chiVai: ["quan-tri"],
  },
] satisfies MucDieuHuong[]);

/** Số mục tối đa trên thanh dưới của điện thoại. */
export const TOI_DA_THANH_DUOI = 5;

export interface TuyChonMuc {
  /** Bật thêm các mục đang tắt trong cấu hình (trang mới ghép, chưa kịp sửa cấu hình). */
  readonly batThem?: readonly MaMuc[];
  /** Vai của người đang xem; không truyền thì ẩn các mục có `chiVai`. */
  readonly vai?: VaiTro;
}

/** Các mục được hiện, giữ đúng thứ tự cấu hình. */
export function mucHien(tuyChon: TuyChonMuc = {}, cauHinh: readonly MucDieuHuong[] = DIEU_HUONG): MucDieuHuong[] {
  const them = new Set(tuyChon.batThem ?? []);
  return cauHinh.filter((m) => {
    if (!m.bat && !them.has(m.id)) return false;
    if (m.chiVai && !(tuyChon.vai && m.chiVai.includes(tuyChon.vai))) return false;
    return true;
  });
}

/** Bỏ dấu "/" ở cuối, chuỗi query và mảnh băm. */
function chuanDuong(duong: string): string {
  const goc = duong.split(/[?#]/)[0] || "/";
  return goc.length > 1 ? goc.replace(/\/+$/, "") : goc;
}

/** Đường dẫn hiện tại có thuộc mục này không: trùng href, nằm dưới href, hoặc trùng một đường `cungTrang`. */
export function laMucHienTai(muc: Pick<MucDieuHuong, "href" | "cungTrang">, duongDan: string | null | undefined): boolean {
  if (!duongDan) return false;
  const d = chuanDuong(duongDan);
  const h = chuanDuong(muc.href);
  if (d === h || d.startsWith(`${h}/`)) return true;
  return (muc.cungTrang ?? []).some((c) => chuanDuong(c) === d);
}

/** Mã mục đang mở trong danh sách, hoặc null. Mục có href dài hơn thắng (khớp cụ thể hơn). */
export function mucDangMo(ds: readonly MucDieuHuong[], duongDan: string | null | undefined): MaMuc | null {
  let tot: MucDieuHuong | null = null;
  for (const m of ds) {
    if (laMucHienTai(m, duongDan) && (!tot || m.href.length > tot.href.length)) tot = m;
  }
  return tot?.id ?? null;
}

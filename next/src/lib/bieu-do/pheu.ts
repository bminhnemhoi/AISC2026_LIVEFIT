import type { Funnel } from "@/lib/livelift-api/desk";
import type { Session } from "@/lib/livelift-api/types";
import type { TenMau } from "./mau";
import { soGon, soNguyen } from "./so";

/**
 * "Từ xem đến mua": ba bước (phút·người xem, lượt nhấp hợp lệ, đơn) đo bằng ba đơn vị khác nhau, nên KHÔNG vẽ thành
 * phễu có độ rộng tỷ lệ (độ rộng sẽ nói dối). Mỗi bước là một ô số có tên và đơn vị; giữa hai bước là tỷ lệ chuyển.
 * Mọi số lấy từ `funnel()` của desk.ts. Phiên không có nguồn đơn thì bước cuối nói "chưa có nguồn đơn", không in 0.
 */

export type KhoaBuoc = "xem" | "nhap" | "don";

export interface BuocPheu {
  khoa: KhoaBuoc;
  ten: string;
  /** Số đã viết theo vi-VN; null khi bước này không có nguồn. */
  so: string | null;
  donVi: string;
  mau: TenMau;
  /** Câu thay khi không có số. */
  thieu: string | null;
}

export interface NoiPheu {
  ten: string;
  /** Giá trị đã viết; null khi chưa tính được. */
  giaTri: string | null;
  donVi: string;
}

export interface Pheu {
  buoc: [BuocPheu, BuocPheu, BuocPheu];
  noi: [NoiPheu, NoiPheu];
}

/** Phòng xem (platform `lab`) ghi đơn tiền ảo; phiên mô phỏng và phiên nền tảng chưa nối thì chưa có nguồn đơn. */
export function coNguonDon(phien: Pick<Session, "platform"> | null | undefined): boolean {
  return phien?.platform === "lab";
}

export function pheuTuXemDenMua(p: Funnel, coDon: boolean, tenDon = "Đơn"): Pheu {
  return {
    buoc: [
      { khoa: "xem", ten: "Thời gian xem", so: soNguyen(p.viewerMinutes), donVi: "phút·người xem", mau: "nguoiXem", thieu: null },
      { khoa: "nhap", ten: "Lượt nhấp hợp lệ", so: soNguyen(p.clicks), donVi: "lượt nhấp", mau: "luotNhap", thieu: null },
      coDon
        ? { khoa: "don", ten: tenDon, so: soNguyen(p.orders), donVi: "đơn", mau: "don", thieu: null }
        : { khoa: "don", ten: tenDon, so: null, donVi: "đơn", mau: "don", thieu: "Chưa có nguồn đơn cho phiên này" },
    ],
    noi: [
      { ten: "Tỷ lệ nhấp", giaTri: p.clickRate == null ? null : soGon(p.clickRate, 2), donVi: "lượt nhấp hợp lệ / 1.000 giây·người xem" },
      { ten: "Đơn trên 100 lượt nhấp", giaTri: coDon && p.ctor != null ? soGon(p.ctor * 100, 1) : null, donVi: "đơn / 100 lượt nhấp" },
    ],
  };
}

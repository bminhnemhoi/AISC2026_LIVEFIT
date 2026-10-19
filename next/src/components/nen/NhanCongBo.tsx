import React from "react";
import { NHAN_CONG_BO_THEO_MA, type MaNhanCongBo } from "@/lib/tu-ngu";
import { TONE_NHAN_CONG_BO } from "./token";
import "./nen.css";

export interface NhanCongBoProps {
  ma: MaNhanCongBo;
  /**
   * "noi": nền tối trong suốt, đặt đè lên video hay khung điện thoại (mặc định cho NGƯỜI DẪN AI).
   * "phang": chip nằm trong dòng, trên nền kem.
   */
  kieu?: "noi" | "phang";
  /** Hiện thêm câu nghĩa của canon ngay dưới nhãn (trang tổng kết, trang giới thiệu). */
  hienNghia?: boolean;
  className?: string;
}

/** Chữ của nhãn công bố, lấy nguyên từ canon. */
export function chuNhanCongBo(ma: MaNhanCongBo): string {
  const n = NHAN_CONG_BO_THEO_MA[ma];
  if (!n) throw new Error(`NhanCongBo: mã "${ma}" không có trong thuat-ngu.yaml`);
  return n.hien_thi;
}

/**
 * Nhãn công bố (D-015, D-022, D-023): "NGƯỜI DẪN AI · GIỌNG TỔNG HỢP", "MÁY CHÉP LỜI", "DÀN DỰNG · CHƯA XÁC MINH".
 * Luôn hiện, không đóng được, không ẩn khi tạm dừng; chữ 13 px, không bao giờ nhỏ hơn 12 px.
 * Mang `data-nhan-cong-bo` để công cụ kiểm tìm được (mọi khung `data-nguoi-dan-ai` phải chứa nhãn NGUOI_DAN_AI).
 */
export function NhanCongBo({ ma, kieu, hienNghia = false, className }: NhanCongBoProps): React.ReactElement {
  const n = NHAN_CONG_BO_THEO_MA[ma];
  const chu = chuNhanCongBo(ma);
  const k = kieu ?? (ma === "NGUOI_DAN_AI" ? "noi" : "phang");
  const nhan = (
    <span
      className={["nen-cong-bo", hienNghia ? undefined : className].filter(Boolean).join(" ")}
      data-nhan-cong-bo={ma}
      data-kieu={k}
      data-tone={TONE_NHAN_CONG_BO[ma]}
    >
      <span className="nen-cong-bo__cham" aria-hidden="true" />
      {chu}
    </span>
  );
  if (!hienNghia) return nhan;
  return (
    <span className={["nen-cong-bo-khoi", className].filter(Boolean).join(" ")}>
      {nhan}
      <span className="nen-cong-bo__nghia">{n.nghia}</span>
    </span>
  );
}

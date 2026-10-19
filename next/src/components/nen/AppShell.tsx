import React from "react";
import type { MaMuc, VaiTro } from "./dieu-huong";
import type { MaNhan } from "./nhan";
import { ThanhDuoi } from "./ThanhDuoi";
import { ThanhTrai } from "./ThanhTrai";
import { ThanhTren } from "./ThanhTren";
import "./nen.css";

export interface AppShellProps {
  children: React.ReactNode;
  /** Tiêu đề trang ở thanh trên. Bỏ trống thì không có thanh trên (trang tự dựng phần đầu). */
  tieuDe?: React.ReactNode;
  phuDe?: React.ReactNode;
  nhanNguon?: MaNhan;
  live?: boolean;
  /** Nút ở thanh trên. */
  hanhDong?: React.ReactNode;
  /** Phần bên trái tiêu đề ở thanh trên (ví dụ liên kết quay lại). */
  traiThanhTren?: React.ReactNode;
  /** Thanh trên dựng sẵn (thay cho tieuDe/phuDe/...). */
  thanhTren?: React.ReactNode;
  /** Thanh trái thu thành thanh mảnh 80 px (bàn thí nghiệm). */
  thuGon?: boolean;
  /** Mục điều hướng đang mở; bỏ trống thì đoán theo đường dẫn. */
  hienTai?: MaMuc | null;
  /** Bật thêm mục đang tắt trong dieu-huong.ts (trang mới ghép). */
  batThem?: readonly MaMuc[];
  /** Vai người đang xem (hiện mục Quản trị cho vai quản trị). */
  vai?: VaiTro;
  /** Chân thanh trái (tài khoản, chế độ dữ liệu). */
  chanThanhTrai?: React.ReactNode;
  /** Đệm vùng nội dung: "vua" 24 px (16 px trên điện thoại), "khong" 0 (trang tự dàn, ví dụ bàn thí nghiệm). */
  dem?: "vua" | "khong";
  className?: string;
}

/**
 * Khung chung của giao diện 2.0: thanh trái (máy tính) hoặc thanh dưới (điện thoại), thanh trên, vùng nội dung
 * `<main id="main-content">` (đích của liên kết "Bỏ qua, tới nội dung chính" trong layout).
 * Dùng được trong thành phần máy chủ; phần cần trình duyệt (đường dẫn hiện tại, nhãn bấm được) nằm ở thành phần con.
 */
export function AppShell({
  children,
  tieuDe,
  phuDe,
  nhanNguon,
  live,
  hanhDong,
  traiThanhTren,
  thanhTren,
  thuGon = false,
  hienTai,
  batThem,
  vai,
  chanThanhTrai,
  dem = "vua",
  className,
}: AppShellProps): React.ReactElement {
  const dieuHuong = { hienTai, batThem, vai };
  return (
    <div
      className={["nen", "nen-app", className].filter(Boolean).join(" ")}
      data-thu-gon={thuGon ? "1" : undefined}
      data-testid="nen-app"
    >
      <ThanhTrai {...dieuHuong} chan={chanThanhTrai} />
      <div className="nen-khung">
        {thanhTren ??
          (tieuDe != null ? (
            <ThanhTren
              tieuDe={tieuDe}
              phuDe={phuDe}
              nhanNguon={nhanNguon}
              live={live}
              hanhDong={hanhDong}
              trai={traiThanhTren}
            />
          ) : null)}
        <main id="main-content" tabIndex={-1} className="nen-noi-dung" data-dem={dem}>
          {children}
        </main>
      </div>
      <ThanhDuoi {...dieuHuong} />
    </div>
  );
}

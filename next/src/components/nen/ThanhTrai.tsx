"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { IconPin } from "@/components/minh-hoa/icons";
import { DIEU_HUONG, mucDangMo, mucHien, type MaMuc, type MucDieuHuong, type TuyChonMuc } from "./dieu-huong";
import "./nen.css";

export interface ThanhDieuHuongProps extends TuyChonMuc {
  /** Mục đang mở; bỏ trống thì đoán theo đường dẫn hiện tại. */
  hienTai?: MaMuc | null;
  /** Thay cấu hình (chỉ dùng trong test). */
  cauHinh?: readonly MucDieuHuong[];
}

/** Mục đang mở và danh sách mục hiện; dùng chung cho thanh trái và thanh dưới. */
export function useDieuHuong({ hienTai, cauHinh, batThem, vai }: ThanhDieuHuongProps): {
  ds: MucDieuHuong[];
  dangMo: MaMuc | null;
} {
  const duongDan = usePathname();
  const ds = mucHien({ batThem, vai }, cauHinh ?? DIEU_HUONG);
  const dangMo = hienTai !== undefined ? hienTai : mucDangMo(ds, duongDan);
  return { ds, dangMo };
}

export interface ThanhTraiProps extends ThanhDieuHuongProps {
  /** Phần ở chân thanh (tài khoản, chế độ dữ liệu). */
  chan?: React.ReactNode;
}

/**
 * Thanh trái 232 px (thu thành thanh mảnh 80 px trên bàn thí nghiệm hoặc màn 768–1023 px; AppShell điều khiển).
 * Ẩn trên điện thoại, khi đó ThanhDuoi thay.
 */
export function ThanhTrai({ chan, ...props }: ThanhTraiProps): React.ReactElement {
  const { ds, dangMo } = useDieuHuong(props);
  return (
    <aside className="nen-thanh-trai" data-testid="nen-thanh-trai">
      <Link href="/gioi-thieu" className="nen-thuong-hieu">
        <span className="nen-thuong-hieu__dau" aria-hidden="true">
          <IconPin size={18} />
        </span>
        <span className="nen-thuong-hieu__chu">LiveLift</span>
      </Link>
      <nav aria-label="Điều hướng chính">
        <ul className="nen-dieu-huong">
          {ds.map((m) => (
            <li key={m.id}>
              <Link
                href={m.href}
                className="nen-muc"
                data-muc={m.id}
                aria-current={dangMo === m.id ? "page" : undefined}
                title={m.nhan}
              >
                <m.Icon size={20} />
                <span className="nen-muc__chu">{m.nhan}</span>
                <span className="nen-muc__chu-ngan" aria-hidden="true">
                  {m.ngan}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {chan != null ? <div className="nen-thanh-trai__chan">{chan}</div> : null}
    </aside>
  );
}

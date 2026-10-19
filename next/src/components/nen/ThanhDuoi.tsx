"use client";

import Link from "next/link";
import React from "react";
import { TOI_DA_THANH_DUOI } from "./dieu-huong";
import { useDieuHuong, type ThanhDieuHuongProps } from "./ThanhTrai";
import "./nen.css";

/** Thanh dưới cho điện thoại (≤ 767 px): tối đa 5 mục, mỗi mục cao 64 px, chữ dưới biểu tượng. */
export function ThanhDuoi(props: ThanhDieuHuongProps): React.ReactElement {
  const { ds, dangMo } = useDieuHuong(props);
  return (
    <nav className="nen-thanh-duoi" aria-label="Điều hướng chính trên điện thoại" data-testid="nen-thanh-duoi">
      <ul className="nen-thanh-duoi__ds">
        {ds.slice(0, TOI_DA_THANH_DUOI).map((m) => (
          <li key={m.id}>
            <Link
              href={m.href}
              className="nen-muc-duoi"
              data-muc={m.id}
              aria-current={dangMo === m.id ? "page" : undefined}
            >
              <m.Icon size={22} />
              <span>{m.ngan}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

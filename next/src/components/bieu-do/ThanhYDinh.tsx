"use client";

import { useMemo } from "react";
import { bangYDinh } from "@/lib/bieu-do/bang";
import { demYDinh, yDinhSapXep } from "@/lib/bieu-do/chuoi";
import { BIEN } from "@/lib/bieu-do/mau";
import { moTaYDinh } from "@/lib/bieu-do/mo-ta";
import { phanTram, soNguyen } from "@/lib/bieu-do/so";
import type { Comment } from "@/lib/livelift-api/types";
import { KhungBieuDo, OTrong, type MucTieuDe } from "./dung-chung";

/**
 * Thanh ý định bình luận ("khách nói gì"): thanh ngang sắp giảm dần, "Khác" luôn cuối, một màu trung tính (đây là
 * độ lớn của một chuỗi, không phải nhiều danh tính). Số ở đầu thanh. Nhãn ý định do máy đoán từ chữ, có thể sai.
 */

export interface ThanhYDinhProps {
  /** Danh sách bình luận (chỉ đọc trường `intent`). */
  binhLuan?: Pick<Comment, "intent">[];
  /** Hoặc số đã đếm sẵn theo nhãn. */
  dem?: Record<string, number>;
  /** Số nhóm tối đa trước khi gộp đuôi vào "Khác". */
  toiDa?: number;
  tieuDe?: string;
  nhan?: string | null;
  dangTai?: boolean;
  muc?: MucTieuDe;
}

export function ThanhYDinh({ binhLuan, dem, toiDa = 6, tieuDe = "Khách nói gì", nhan, dangTai, muc }: ThanhYDinhProps) {
  const dong = useMemo(() => yDinhSapXep(dem ?? demYDinh(binhLuan ?? []), toiDa), [dem, binhLuan, toiDa]);
  const lonNhat = dong.reduce((m, d) => Math.max(m, d.so), 0);
  return (
    <KhungBieuDo
      tieuDe={tieuDe}
      phuDe="Bình luận theo ý định, sắp từ nhiều tới ít"
      nhan={nhan}
      moTa={moTaYDinh(dong)}
      bang={dong.length ? bangYDinh(dong) : null}
      dangTai={dangTai}
      muc={muc}
      testId="bd-y-dinh"
      ghiChu="Ý định do máy đoán từ chữ bình luận, có thể sai."
    >
      {dong.length === 0 ? (
        <OTrong>Chưa có bình luận nào được gán nhãn ý định.</OTrong>
      ) : (
        <ul className="bd-thanh-ds">
          {dong.map((d) => (
            <li key={d.nhan} className="bd-thanh" data-y-dinh={d.nhan}>
              <span className="bd-thanh-ten">{d.ten}</span>
              <span className="bd-thanh-ray" aria-hidden="true">
                <span className="bd-thanh-dac" style={{ width: `${lonNhat > 0 ? (d.so / lonNhat) * 100 : 0}%`, background: BIEN.trung }} />
              </span>
              <span className="bd-thanh-so">
                {soNguyen(d.so)} <span>· {phanTram(d.tyLe)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </KhungBieuDo>
  );
}

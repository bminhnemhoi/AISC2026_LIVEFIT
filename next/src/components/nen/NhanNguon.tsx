"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Chip } from "./Chip";
import { chonCanh, chuNhanNguon, dsMaNhan, nghiaNhanNguon, type MaNhan } from "./nhan";
import { TONE_NHAN_NGUON } from "./token";
import "./nen.css";

export type { MaNhan } from "./nhan";

export interface NhanNguonProps {
  /** Một mã hoặc nhiều mã (ví dụ ["DAN_DUNG", "THU_NOI_BO"]). */
  ma: MaNhan;
  /** Phía mở câu nghĩa; nhãn sát mép phải màn hình thì truyền "phai". Mặc định "trai". */
  canh?: "trai" | "phai";
  /**
   * Chỉ hiện chip, không bấm được (dùng giữa dòng chữ dày). Câu nghĩa khi đó chỉ nằm ở thuộc tính title, nên
   * trên màn chính luôn để mặc định (bấm được).
   */
  tinh?: boolean;
  className?: string;
}

/**
 * Chip nhãn nguồn của số (THẬT, DÀN DỰNG, THỬ NỘI BỘ, MÔ PHỎNG, ...). Rê chuột, đưa bàn phím tới hoặc chạm vào thì
 * hiện câu nghĩa lấy từ canon; Esc hoặc chạm ra ngoài thì ẩn. Vùng bấm cao 44 px, chip nhìn thấy cao 28 px.
 */
export function NhanNguon({ ma, canh = "trai", tinh = false, className }: NhanNguonProps): React.ReactElement {
  const ds = dsMaNhan(ma);
  const chu = chuNhanNguon(ds);
  const dong = nghiaNhanNguon(ds);
  const tone = TONE_NHAN_NGUON[ds[0]];
  const idNghia = useId();
  const goc = useRef<HTMLSpanElement>(null);
  /** Đã ghim mở bằng một lần bấm/chạm. */
  const [mo, setMo] = useState(false);
  /** Đã ẩn bằng Esc dù chuột hay bàn phím còn ở đó (WCAG 1.4.13); hết khi rời chuột hoặc rời tiêu điểm. */
  const [an, setAn] = useState(false);
  /** Phía mở thật sự, đổi khi nhãn sát mép màn. */
  const [canhThat, setCanhThat] = useState<"trai" | "phai">(canh);
  const doCanh = (): void => {
    const r = goc.current?.getBoundingClientRect();
    if (!r || typeof window === "undefined") return;
    setCanhThat(chonCanh(r.left, r.right, window.innerWidth, canh));
  };

  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: PointerEvent): void => {
      if (goc.current && !goc.current.contains(e.target as Node)) setMo(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMo(false);
    };
    document.addEventListener("pointerdown", ngoai);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", ngoai);
      document.removeEventListener("keydown", esc);
    };
  }, [mo]);

  const maDuLieu = ds.join(",");

  if (tinh) {
    return (
      <span className={["nen-nhan-nguon", className].filter(Boolean).join(" ")} data-tinh="1" data-nhan-nguon={maDuLieu}>
        <Chip tone={tone} title={dong.map((d) => `${d.ten}: ${d.nghia}`).join("\n")}>
          {chu}
        </Chip>
      </span>
    );
  }

  return (
    <span
      ref={goc}
      className={["nen-nhan-nguon", className].filter(Boolean).join(" ")}
      data-nhan-nguon={maDuLieu}
      data-canh={canhThat}
      data-mo={mo && !an ? "1" : undefined}
      data-an={an ? "1" : undefined}
      onKeyDown={(e) => {
        // Esc đầu tiên chỉ ẩn câu nghĩa (không để hộp thoại hay ngăn kéo bao ngoài đóng theo); Esc lần sau đi tiếp.
        if (e.key !== "Escape" || an) return;
        e.stopPropagation();
        setMo(false);
        setAn(true);
      }}
      onMouseEnter={doCanh}
      onFocus={doCanh}
      onMouseLeave={() => setAn(false)}
      onBlur={(e) => {
        if (!goc.current?.contains(e.relatedTarget as Node | null)) {
          setMo(false);
          setAn(false);
        }
      }}
    >
      <button
        type="button"
        className="nen-nhan-nguon__nut"
        aria-describedby={idNghia}
        onClick={() => {
          doCanh();
          setAn(false);
          setMo((m) => !m);
        }}
      >
        <span className="nen-an">Nhãn nguồn: </span>
        <Chip tone={tone}>
          {chu}
          <span className="nen-nhan-nguon__dau-hoi" aria-hidden="true">
            ?
          </span>
        </Chip>
      </button>
      <span role="tooltip" id={idNghia} className="nen-bong-nghia">
        {dong.map((d) => (
          <span key={d.ten} className="nen-bong-nghia__dong">
            <span className="nen-bong-nghia__ten">{d.ten}:</span> {d.nghia}
          </span>
        ))}
      </span>
    </span>
  );
}

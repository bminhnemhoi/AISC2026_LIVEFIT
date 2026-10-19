"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDaGan, useLopPhu } from "./lop-phu";
import { NutBam } from "./NutBam";
import "./nen.css";

export interface HopProps {
  mo: boolean;
  /** Đóng mà không xác nhận (nút Huỷ, Esc, chạm nền). */
  onDong: () => void;
  tieuDe: React.ReactNode;
  /** Câu nói rõ bấm xác nhận thì chuyện gì xảy ra. */
  moTa?: React.ReactNode;
  children?: React.ReactNode;
  /** Chữ nút xác nhận; nên là động từ cụ thể ("Kết thúc phiên"), mặc định "Đồng ý". */
  nutXacNhan?: string;
  /** Chữ nút huỷ; mặc định "Huỷ". null: không có nút huỷ (hộp chỉ báo tin). */
  nutHuy?: string | null;
  /** Bấm xác nhận. Trả về Promise thì hộp khoá và hiện đang chạy cho tới khi xong; hộp không tự đóng. */
  onXacNhan?: () => void | Promise<void>;
  /** Việc khó hoàn tác: dùng role="alertdialog" và đặt tiêu điểm đầu tiên vào nút Huỷ. */
  nguyHiem?: boolean;
  /** Đang chạy do bên ngoài điều khiển. */
  dangChay?: boolean;
  /** Khoá nút xác nhận (ví dụ chưa điền đủ). */
  tatXacNhan?: boolean;
  /** Thuộc tính data-* gắn lên nút xác nhận (ví dụ { "data-chup-bam": "xac-nhan-rut-lui" } cho script chụp). */
  thuocTinhXacNhan?: Readonly<Record<`data-${string}`, string>>;
  className?: string;
}

/** Hộp thoại xác nhận của giao diện 2.0, dùng thay window.confirm. Hai nút cùng cao 48 px. */
export function Hop({
  mo,
  onDong,
  tieuDe,
  moTa,
  children,
  nutXacNhan = "Đồng ý",
  nutHuy = "Huỷ",
  onXacNhan,
  nguyHiem = false,
  dangChay: dangChayNgoai = false,
  tatXacNhan = false,
  thuocTinhXacNhan,
  className,
}: HopProps): React.ReactElement | null {
  const daGan = useDaGan();
  const lop = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const nutHuyRef = useRef<HTMLButtonElement>(null);
  const nutXacNhanRef = useRef<HTMLButtonElement>(null);
  const idTieuDe = useId();
  const idMoTa = useId();
  const [dangChayTrong, setDangChayTrong] = useState(false);
  const dangChay = dangChayNgoai || dangChayTrong;
  const conGan = useRef(true);
  useEffect(() => {
    conGan.current = true;
    return () => {
      conGan.current = false;
    };
  }, []);

  useLopPhu(mo && daGan, onDong, hop, lop, {
    khoaDong: dangChay,
    focusDau: nguyHiem && nutHuy !== null ? nutHuyRef : nutXacNhanRef,
  });

  const xacNhan = async (): Promise<void> => {
    if (!onXacNhan) return;
    const kq = onXacNhan();
    if (kq && typeof (kq as Promise<void>).then === "function") {
      setDangChayTrong(true);
      try {
        await kq;
      } finally {
        if (conGan.current) setDangChayTrong(false);
      }
    }
  };

  if (!daGan || !mo) return null;
  return createPortal(
    <div
      ref={lop}
      className="nen-lop-phu"
      data-loai="hop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !dangChay) onDong();
      }}
    >
      <div
        ref={hop}
        role={nguyHiem ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={idTieuDe}
        aria-describedby={moTa != null ? idMoTa : undefined}
        aria-busy={dangChay || undefined}
        tabIndex={-1}
        className={["nen-hop", className].filter(Boolean).join(" ")}
      >
        <h2 id={idTieuDe} className="nen-hop__tieu-de">
          {tieuDe}
        </h2>
        {moTa != null ? (
          <p id={idMoTa} className="nen-hop__mo-ta">
            {moTa}
          </p>
        ) : null}
        {children != null ? <div className="nen-hop__than">{children}</div> : null}
        <div className="nen-hop__nut">
          {nutHuy !== null ? (
            <NutBam ref={nutHuyRef} bien="vien" cao={48} onClick={onDong} disabled={dangChay}>
              {nutHuy}
            </NutBam>
          ) : null}
          <NutBam
            {...thuocTinhXacNhan}
            ref={nutXacNhanRef}
            bien="chinh"
            cao={48}
            onClick={onXacNhan ? () => void xacNhan() : onDong}
            disabled={tatXacNhan}
            dangChay={dangChay}
          >
            {nutXacNhan}
          </NutBam>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export interface CauHoi {
  tieuDe: string;
  moTa?: React.ReactNode;
  nutXacNhan?: string;
  nutHuy?: string;
  nguyHiem?: boolean;
}

/**
 * Thay `window.confirm` bằng một dòng: `const { hoi, hop } = useXacNhan();` rồi đặt `{hop}` trong JSX và
 * `if (await hoi({ tieuDe: "Kết thúc phiên?", nutXacNhan: "Kết thúc phiên", nguyHiem: true })) { ... }`.
 */
export function useXacNhan(): { hoi: (cau: CauHoi) => Promise<boolean>; hop: React.ReactElement } {
  const [cau, setCau] = useState<(CauHoi & { traLoi: (dong: boolean) => void }) | null>(null);
  const dangCho = useRef<((dong: boolean) => void) | null>(null);

  const hoi = useCallback((c: CauHoi): Promise<boolean> => {
    dangCho.current?.(false);
    return new Promise<boolean>((resolve) => {
      const traLoi = (dong: boolean): void => {
        if (dangCho.current === traLoi) dangCho.current = null;
        resolve(dong);
      };
      dangCho.current = traLoi;
      setCau({ ...c, traLoi });
    });
  }, []);

  useEffect(
    () => () => {
      dangCho.current?.(false);
    },
    [],
  );

  const xong = (dong: boolean): void => {
    cau?.traLoi(dong);
    setCau(null);
  };

  const hop = (
    <Hop
      mo={cau !== null}
      onDong={() => xong(false)}
      onXacNhan={() => xong(true)}
      tieuDe={cau?.tieuDe ?? ""}
      moTa={cau?.moTa}
      nutXacNhan={cau?.nutXacNhan}
      nutHuy={cau?.nutHuy}
      nguyHiem={cau?.nguyHiem}
    />
  );
  return { hoi, hop };
}

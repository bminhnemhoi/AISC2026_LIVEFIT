"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { BangDuLieu } from "@/lib/bieu-do/bang";
import "./bieu-do.css";

/**
 * Phần dùng chung của bộ biểu đồ: đo bề rộng (ResizeObserver), khung có tiêu đề + phụ đề + nút "Xem dạng bảng",
 * câu mô tả thay ảnh, ô báo khoá §7 và ô trống. Không component nào ở đây vẽ số liệu.
 */

/** Bề rộng dùng khi chưa đo được (máy chủ dựng trang, môi trường test không có ResizeObserver). */
export const RONG_MAC_DINH = 640;

/**
 * Đo bề rộng phần tử (ref dạng hàm, nên đo lại cả khi phần tử được gắn lại, ví dụ sau khi rời "Xem dạng bảng").
 * Trả `macDinh` tới khi đo được.
 */
export function useBeRong<T extends HTMLElement>(macDinh = RONG_MAC_DINH): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [rong, setRong] = useState(0);
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      setRong((cu) => (Math.abs(cu - w) >= 1 ? w : cu));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, rong > 0 ? rong : macDinh];
}

/** Mã id dùng được trong url(#...) của SVG (useId của React có dấu hai chấm). */
export function useMaSvg(tienTo: string): string {
  return `${tienTo}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export type MucTieuDe = 2 | 3 | 4;

export interface KhungBieuDoProps {
  /** Tên biểu đồ, viết thường kiểu câu. */
  tieuDe: string;
  /** Phụ đề lời thường (đơn vị đầy đủ, nghĩa của thuật ngữ). */
  phuDe?: ReactNode;
  /** Nhãn nguồn của số (MÔ PHỎNG, DÀN DỰNG, THẬT...). */
  nhan?: string | null;
  /** Câu mô tả thay ảnh (aria-label của vùng vẽ). */
  moTa: string;
  /** Bảng thay biểu đồ; có thì hiện nút "Xem dạng bảng". */
  bang?: BangDuLieu | null;
  /** Chú giải (HTML), đặt dưới vùng vẽ. */
  chuGiai?: ReactNode;
  /** Dòng ghi chú cuối khung. */
  ghiChu?: ReactNode;
  /** Đang tải lại: giữ hình cũ, mờ đi, không nháy khung trống. */
  dangTai?: boolean;
  muc?: MucTieuDe;
  testId?: string;
  className?: string;
  children: ReactNode;
}

export function KhungBieuDo({ tieuDe, phuDe, nhan, moTa, bang, chuGiai, ghiChu, dangTai, muc = 3, testId, className, children }: KhungBieuDoProps) {
  const [xemBang, setXemBang] = useState(false);
  const maBang = useMaSvg("bd-bang");
  const TieuDe = `h${muc}` as "h2" | "h3" | "h4";
  return (
    <figure className={`bd bd-khung${dangTai ? " bd-dang-tai" : ""}${className ? ` ${className}` : ""}`} data-testid={testId} aria-busy={dangTai || undefined}>
      <div className="bd-dau">
        <div className="bd-dau-chu">
          <TieuDe className="bd-tieu-de">{tieuDe}</TieuDe>
          {phuDe ? <p className="bd-phu-de">{phuDe}</p> : null}
        </div>
        <div className="bd-dau-phai">
          {nhan ? <span className="bd-nhan">{nhan}</span> : null}
          {/* Một nhãn cố định; trạng thái nằm ở aria-pressed (đổi nhãn kèm aria-pressed làm trình đọc màn hình đọc lẫn). */}
          {bang ? (
            <button type="button" className="bd-nut" aria-pressed={xemBang} aria-controls={maBang} onClick={() => setXemBang((v) => !v)} data-an-khi-chup="">
              Xem dạng bảng
            </button>
          ) : null}
        </div>
      </div>
      <div id={maBang}>
        {xemBang && bang ? (
          <BangThay bang={bang} />
        ) : (
          <div className="bd-ve" role="img" aria-label={moTa}>
            {children}
          </div>
        )}
      </div>
      {chuGiai}
      {ghiChu ? <figcaption className="bd-ghi-chu">{ghiChu}</figcaption> : null}
    </figure>
  );
}

export function BangThay({ bang }: { bang: BangDuLieu }) {
  return (
    <div className="bd-bang-cuon">
      <table className="bd-bang">
        <caption>{bang.tieuDe}</caption>
        <thead>
          <tr>
            {bang.cot.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bang.hang.map((h, i) => (
            <tr key={i}>
              {h.map((o, j) => (
                <td key={j}>{o}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Biểu tượng ổ khoá (trang trí). */
export function BieuTuongKhoa({ co = 24 }: { co?: number }) {
  return (
    <svg width={co} height={co} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export const CAU_KHOA_MAC_DINH = "Khoá tới khi hết phiên, để không ai nhìn trộm kết quả giữa chừng.";

/**
 * Ô thay biểu đồ khi kết quả còn khoá (§7 tiền đăng ký). Không có số nào ở đây, cũng không có chỗ trống hình
 * biểu đồ (để không đoán được hình dạng).
 */
export function OKhoa({ tieuDe, cau = CAU_KHOA_MAC_DINH, testId }: { tieuDe: string; cau?: string; testId?: string }) {
  return (
    <div className="bd bd-khoa" data-testid={testId} data-khoa="true">
      <BieuTuongKhoa />
      <p>
        <strong>{tieuDe}</strong>
        {cau}
      </p>
    </div>
  );
}

export function OTrong({ children }: { children: ReactNode }) {
  return <p className="bd-trong">{children}</p>;
}

export interface DongNhac {
  /** Giá trị (đậm, đứng trước). */
  giaTri: string;
  ten: string;
  /** Biến màu của chuỗi (nét ngắn đặt cạnh). */
  mau?: string;
}

/** Ô nhắc khi rê chuột: giá trị đậm trước, tên chuỗi sau, nét màu ngắn làm khoá. Chỉ bổ sung, bảng vẫn có đủ số. */
export function ONhac({ trai, dau, dong, rongKhung }: { trai: number; dau: string; dong: DongNhac[]; rongKhung: number }) {
  const rong = 220;
  const x = Math.max(0, Math.min(trai + 12, rongKhung - rong));
  return (
    <div className="bd-nhac" style={{ left: x }} aria-hidden="true">
      <div className="bd-nhac-dau">{dau}</div>
      {dong.map((d) => (
        <div className="bd-nhac-dong" key={d.ten}>
          {d.mau ? <i className="bd-mau-net" style={{ color: d.mau }} /> : null}
          <strong>{d.giaTri}</strong>
          <span>{d.ten}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Mẫu sọc chéo 45° của khối TẮT (mã phụ cho màu xám, D-026). Dấu TẮT (chấm): sọc đậm `--bd-tat-soc` (≥ 3:1).
 * Dải nền khối (`nen`): sọc nhạt `--bd-tat-soc-nen` để không lấn đường số liệu; chữ T ở đầu dải mang thông tin.
 */
export function MauSocTat({ id, nen = false }: { id: string; nen?: boolean }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
      {nen ? <rect width="6" height="6" fill="var(--bd-tat-nen)" /> : null}
      {/* sọc chéo 45° vẽ thẳng, không xoay phần tử nào */}
      <path d="M-1,1L1,-1M0,6L6,0M5,7L7,5" stroke={nen ? "var(--bd-tat-soc-nen)" : "var(--bd-tat-soc)"} strokeWidth={nen ? 1.6 : 1.2} />
    </pattern>
  );
}

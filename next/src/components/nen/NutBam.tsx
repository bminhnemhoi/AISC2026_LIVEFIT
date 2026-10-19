import Link from "next/link";
import React from "react";
import "./nen.css";

/** chinh: đỏ gạch, cao 48 px (một nút chính mỗi vùng). phu: nền chip. vien: viền mực. */
export type BienNut = "chinh" | "phu" | "vien";
export type CaoNut = 44 | 48;

interface ChungNut {
  /** Mặc định "phu". */
  bien?: BienNut;
  /**
   * Nút khác mặc định 44; nút chính luôn 48 (truyền 44 cũng thành 48). Nút cùng nhóm với một nút chính thì truyền 48
   * để cao bằng nhau.
   */
  cao?: CaoNut;
  /** Biểu tượng bên trái chữ (chỉ trang trí; chữ của nút luôn phải có). */
  bieuTuong?: React.ReactNode;
  /** Kéo rộng hết chiều ngang của khung chứa. */
  rong?: boolean;
}

export interface NutBamProps extends ChungNut, React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Đang chạy: khoá nút, báo aria-busy, hiện ba chấm thay biểu tượng. */
  dangChay?: boolean;
}

export interface NutLienKetProps extends ChungNut, Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
}

/** Cao thật của nút theo biến thể (để test và để trang tính bố cục). Nút chính không bao giờ thấp hơn 48. */
export function caoNut(bien: BienNut = "phu", cao?: CaoNut): CaoNut {
  if (bien === "chinh") return 48;
  return cao ?? 44;
}

function lopNut(bien: BienNut, className?: string): string {
  return ["nen-nut", `nen-nut--${bien}`, className].filter(Boolean).join(" ");
}

function ChoChay(): React.ReactElement {
  return (
    <span className="nen-nut__cho" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

/** Nút bấm của giao diện 2.0. Mặc định type="button" để không lỡ gửi biểu mẫu. */
export const NutBam = React.forwardRef<HTMLButtonElement, NutBamProps>(function NutBam(
  { bien = "phu", cao, bieuTuong, rong, dangChay = false, className, type = "button", disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={lopNut(bien, className)}
      data-bien={bien}
      data-cao={caoNut(bien, cao)}
      data-nut-chinh={bien === "chinh" ? "" : undefined}
      data-rong={rong ? "1" : undefined}
      disabled={disabled || dangChay}
      aria-busy={dangChay || undefined}
      {...rest}
    >
      {dangChay ? <ChoChay /> : bieuTuong ? <span className="nen-nut__bieu-tuong">{bieuTuong}</span> : null}
      {children}
    </button>
  );
});

/** Liên kết trông như nút (ví dụ "Dùng thử bản demo"). Dùng next/link, giữ nút Lùi của trình duyệt. */
export const NutLienKet = React.forwardRef<HTMLAnchorElement, NutLienKetProps>(function NutLienKet(
  { bien = "phu", cao, bieuTuong, rong, className, href, children, ...rest },
  ref,
) {
  return (
    <Link
      ref={ref}
      href={href}
      className={lopNut(bien, className)}
      data-bien={bien}
      data-cao={caoNut(bien, cao)}
      data-nut-chinh={bien === "chinh" ? "" : undefined}
      data-rong={rong ? "1" : undefined}
      {...rest}
    >
      {bieuTuong ? <span className="nen-nut__bieu-tuong">{bieuTuong}</span> : null}
      {children}
    </Link>
  );
});

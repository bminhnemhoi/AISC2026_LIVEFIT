"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGiamChuyenDong } from "./chuyen-dong";
import { LICH_MINH_HOA, MatXu, TEN_MAT, demLich, type MatKhoi, type MatXuKieu } from "./mat-xu";
import "./minh-hoa.css";

/**
 * Đồng xu hai mặt BẬT / TẮT. Đổi `mat` là đồng xu lật trong 600 ms: nửa đầu mặt cũ khép lại, nửa sau mặt mới mở ra
 * (co giãn theo chiều ngang, không xoay, nên không phần tử nào bị nghiêng). Giảm chuyển động thì đổi mặt ngay.
 */
export function DongXu({ mat, nho = false, kichThuoc, title, className }: { mat: MatXuKieu; nho?: boolean; kichThuoc?: number; title?: string; className?: string }) {
  const [hienTai, setHienTai] = useState(mat);
  const [truoc, setTruoc] = useState<MatXuKieu | null>(null);
  const [lan, setLan] = useState(0);
  // lưu mặt trước ngay trong lúc render (mẫu "giá trị của lần render trước" của React), để lần lật đầu không chớp
  if (mat !== hienTai) {
    setTruoc(hienTai);
    setHienTai(mat);
    setLan((n) => n + 1);
  }
  const style = kichThuoc ? { width: kichThuoc, height: kichThuoc } : undefined;
  const nhan = title ?? (mat === "chua" ? "Đồng xu chưa tung" : `Đồng xu: khối ${TEN_MAT[mat]}`);
  return (
    <span className={`mh-xu${className ? ` ${className}` : ""}`} style={style} role="img" aria-label={nhan} data-mat={mat}>
      {lan > 0 && truoc && truoc !== mat && (
        <span key={`ra-${lan}`} className="mh-xu-mat mh-xu-ra" aria-hidden="true"><MatXu mat={truoc} nho={nho} /></span>
      )}
      <span key={`vao-${lan}`} className={`mh-xu-mat${lan > 0 ? " mh-xu-vao" : ""}`} aria-hidden="true"><MatXu mat={mat} nho={nho} /></span>
    </span>
  );
}

export interface DaiDongXuProps {
  /** lịch cần hiện; mặc định LICH_MINH_HOA (8 BẬT, 8 TẮT) */
  lich?: readonly MatKhoi[];
  /** khoảng cách giữa hai lần lật, ms */
  buocMs?: number;
  /** false: đứng yên ở trạng thái chưa tung */
  phat?: boolean;
  /** chỉ bắt đầu khi dải lọt vào màn hình (mặc định true) */
  choKhiThay?: boolean;
  /** hiện nút "Tung lại" (44 px) */
  nutTungLai?: boolean;
  /** chip nguồn, mặc định MINH HOẠ; null để ẩn */
  nhan?: string | null;
  /** hiện chú thích B/T theo canon (mặc định true) */
  chuThich?: boolean;
  onXong?: () => void;
  className?: string;
}

/**
 * Dải 16 khối (landing): mỗi khối một đồng xu, lật lần lượt cho tới hết lịch. Đánh số khối 1..n; chú thích theo canon:
 * "BẬT: ghim món theo lịch · TẮT: đội làm như thường". Giảm chuyển động thì hiện ngay cả lịch.
 */
export function DaiDongXu({ lich = LICH_MINH_HOA, buocMs = 180, phat = true, choKhiThay = true, nutTungLai = false, nhan = "MINH HOẠ", chuThich = true, onXong, className }: DaiDongXuProps) {
  const giam = useGiamChuyenDong();
  const goc = useRef<HTMLDivElement>(null);
  const [thay, setThay] = useState(!choKhiThay);
  const [daLat, setDaLat] = useState(0);
  const [luot, setLuot] = useState(0);
  const xongRef = useRef(onXong);
  useEffect(() => {
    xongRef.current = onXong;
  }, [onXong]);

  // chờ dải lọt vào màn hình (máy không có IntersectionObserver thì chạy luôn)
  useEffect(() => {
    if (thay) return;
    const el = goc.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setThay(true);
      return;
    }
    const io = new IntersectionObserver((ds) => {
      if (ds.some((d) => d.isIntersecting)) {
        setThay(true);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [thay]);

  useEffect(() => {
    if (!phat || !thay) return;
    if (giam) {
      setDaLat(lich.length);
      xongRef.current?.();
      return;
    }
    setDaLat(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setDaLat(i);
      if (i >= lich.length) {
        window.clearInterval(id);
        xongRef.current?.();
      }
    }, buocMs);
    return () => window.clearInterval(id);
  }, [phat, thay, giam, lich, buocMs, luot]);

  const dem = demLich(lich);
  const xong = daLat >= lich.length;
  return (
    <div ref={goc} className={`mh-dai${className ? ` ${className}` : ""}`} data-minh-hoa="dai-dong-xu">
      <ol className="mh-dai-hang" aria-label={`${lich.length} khối 5 phút, mỗi khối một lần tung đồng xu`}>
        {lich.map((m, i) => {
          const mat: MatXuKieu = i < daLat ? m : "chua";
          return (
            <li key={i} className="mh-dai-o" data-mat={mat}>
              <DongXu mat={mat} nho title={`Khối ${i + 1}: ${mat === "chua" ? "chưa tung" : TEN_MAT[mat]}`} />
              <span className="mh-dai-so" aria-hidden="true">{i + 1}</span>
            </li>
          );
        })}
      </ol>
      <div className="mh-dai-chan">
        <p className="mh-dai-dem" aria-live="polite">
          {xong ? `${dem.bat} khối BẬT · ${dem.tat} khối TẮT` : `Đã tung ${daLat}/${lich.length} khối`}
        </p>
        {chuThich && (
          <p className="mh-dai-chu-thich">
            <span className="mh-o-mau is-bat" aria-hidden="true" />BẬT: ghim món theo lịch
            <span className="mh-cham" aria-hidden="true">·</span>
            <span className="mh-o-mau is-tat" aria-hidden="true" />TẮT: đội làm như thường
          </p>
        )}
        {nhan && <span className="mh-chip mh-chip-nguon">{nhan}</span>}
        {nutTungLai && (
          <button type="button" className="mh-nut" onClick={() => setLuot((n) => n + 1)} disabled={!xong && phat && thay && !giam}>
            Tung lại
          </button>
        )}
      </div>
    </div>
  );
}

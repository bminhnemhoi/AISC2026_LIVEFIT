"use client";

import { useMemo, useState } from "react";
import { bangCham, tenNhanh } from "@/lib/bieu-do/bang";
import { trungBinhNhanh, type KhoiDo } from "@/lib/bieu-do/chuoi";
import { PHU_DE_BAT, PHU_DE_TAT, TY_LE_NHAP, TY_LE_NHAP_DAY_DU } from "@/lib/bieu-do/ket-luan";
import { BIEN, BIEN_VIEN_TAT } from "@/lib/bieu-do/mau";
import { moTaCham } from "@/lib/bieu-do/mo-ta";
import { moc, soGon } from "@/lib/bieu-do/so";
import { thangTuyenTinh, vachTu0 } from "@/lib/bieu-do/thang";
import { KhungBieuDo, MauSocTat, OKhoa, ONhac, OTrong, useBeRong, useMaSvg, type MucTieuDe } from "./dung-chung";

/**
 * Chấm theo khối: mỗi khối một chấm Tỷ lệ nhấp. BẬT là chấm đặc xanh; TẮT là chấm rỗng xám có sọc (mã phụ cho màu
 * xám). Một đường ngang trung bình cho mỗi nhánh, nhãn trực tiếp ở đầu phải. Khối không đo được không vẽ (không phải
 * bằng 0), được đếm ở ghi chú và có trong bảng.
 *
 * Khoá §7: khi `khoa` là true chỉ có ô khoá, không chấm nào, kể cả khi lỡ truyền `khoiDo`.
 */

export interface ChamTheoKhoiProps {
  /** True trừ khi máy chủ nói rõ kết quả đã mở. */
  khoa: boolean;
  /** Tỷ lệ nhấp từng khối (`useDuLieuPhien().khoiDo`, null khi khoá). */
  khoiDo: KhoiDo[] | null;
  nhan?: string | null;
  tieuDe?: string;
  cao?: number;
  dangTai?: boolean;
  muc?: MucTieuDe;
}

const DEM = { trai: 44, phai: 132, phaiHep: 16, tren: 16, duoi: 28 };

export function ChamTheoKhoi({ khoa, khoiDo, nhan, tieuDe = "Tỷ lệ nhấp từng khối", cao = 240, dangTai, muc }: ChamTheoKhoiProps) {
  const [refVe, rong] = useBeRong<HTMLDivElement>();
  const [tro, setTro] = useState<number | null>(null);
  const maSoc = useMaSvg("bd-soc-cham");
  const khoi = useMemo(() => (khoa || !khoiDo ? [] : [...khoiDo].sort((a, b) => a.tu - b.tu)), [khoa, khoiDo]);

  if (khoa) {
    return <OKhoa tieuDe={tieuDe} testId="bd-cham-khoa" />;
  }

  const tb = trungBinhNhanh(khoi);
  const phuDe = `${TY_LE_NHAP} (${TY_LE_NHAP_DAY_DU}) của mỗi khối, đã bỏ 60 giây đầu khối`;
  if (khoi.length === 0) {
    return (
      <KhungBieuDo tieuDe={tieuDe} phuDe={phuDe} nhan={nhan} moTa={moTaCham(khoi, tb)} dangTai={dangTai} muc={muc} testId="bd-cham">
        <OTrong>Chưa có khối BẬT hay TẮT nào để vẽ.</OTrong>
      </KhungBieuDo>
    );
  }

  const W = Math.max(280, rong);
  const H = Math.max(160, cao);
  // Màn hẹp: nhãn trung bình chuyển xuống chú giải, nhường bề ngang cho chấm.
  const hep = W < 480;
  const veW = W - DEM.trai - (hep ? DEM.phaiHep : DEM.phai);
  const day = H - DEM.duoi;
  const tru = vachTu0(Math.max(0.5, ...khoi.map((k) => k.tyLe ?? 0)), 3);
  const y = thangTuyenTinh([0, tru.max], [day, DEM.tren]);
  const buoc = veW / khoi.length;
  const xI = (i: number): number => DEM.trai + buoc * (i + 0.5);
  const nhanMoi = Math.max(1, Math.ceil(khoi.length / Math.max(2, Math.floor(veW / 44))));

  const yBat = tb.bat == null ? null : y(tb.bat);
  const yTat = tb.tat == null ? null : y(tb.tat);
  // Hai nhãn trung bình quá sát nhau thì đẩy ra hai phía cho khỏi đè (chỉ hai nhãn, không cần đường dẫn).
  let yNhanBat = yBat;
  let yNhanTat = yTat;
  if (yBat != null && yTat != null && Math.abs(yBat - yTat) < 16) {
    const giua = (yBat + yTat) / 2;
    const batTren = yBat <= yTat;
    yNhanBat = giua + (batTren ? -8 : 8);
    yNhanTat = giua + (batTren ? 8 : -8);
  }

  const k = tro != null ? khoi[tro] : null;
  const ghiChu = tb.nBo > 0 ? `${tb.nBo} khối không đo được (quá ít người xem hoặc không phát), không vẽ; xem bảng.` : "Chấm là mô tả từng khối; kết luận lấy từ phân tích đã đăng ký trước.";

  return (
    <KhungBieuDo
      tieuDe={tieuDe}
      phuDe={phuDe}
      nhan={nhan}
      moTa={moTaCham(khoi, tb)}
      bang={bangCham(khoi, tb)}
      dangTai={dangTai}
      muc={muc}
      testId="bd-cham"
      chuGiai={
        <ul className="bd-chu-giai">
          <li>
            <i className="bd-mau-cham" style={{ background: BIEN.bat }} aria-hidden="true" />
            {PHU_DE_BAT}
            {tb.bat != null ? `, trung bình ${soGon(tb.bat, 2)}` : ""}
          </li>
          <li>
            <i className="bd-mau-cham bd-cham-tat" aria-hidden="true" />
            {PHU_DE_TAT}
            {tb.tat != null ? `, trung bình ${soGon(tb.tat, 2)}` : ""}
          </li>
        </ul>
      }
      ghiChu={ghiChu}
    >
      <div ref={refVe} style={{ position: "relative" }}>
        <svg className="bd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" data-testid="bd-cham-ve">
          <defs>
            <MauSocTat id={maSoc} />
          </defs>
          {tru.vach.map((v) => (
            <g key={v}>
              <line x1={DEM.trai} x2={DEM.trai + veW} y1={y(v)} y2={y(v)} className={v === 0 ? "bd-truc" : "bd-luoi"} />
              <text x={DEM.trai - 8} y={y(v) + 4} textAnchor="end">
                {soGon(v, 2)}
              </text>
            </g>
          ))}
          {khoi.map((kk, i) =>
            i % nhanMoi === 0 ? (
              <text key={`n${kk.index}`} x={xI(i)} y={H - 8} textAnchor="middle" className="bd-chu-nhat">
                {kk.index + 1}
              </text>
            ) : null,
          )}
          <text x={DEM.trai - 8} y={H - 8} textAnchor="end" className="bd-chu-nhat">
            khối
          </text>

          {yBat != null ? <line x1={DEM.trai} x2={DEM.trai + veW} y1={yBat} y2={yBat} stroke={BIEN.bat} strokeWidth={2} data-testid="bd-tb-bat" /> : null}
          {yTat != null ? <line x1={DEM.trai} x2={DEM.trai + veW} y1={yTat} y2={yTat} stroke={BIEN_VIEN_TAT} strokeWidth={2} strokeDasharray="6 4" data-testid="bd-tb-tat" /> : null}
          {!hep && yNhanBat != null ? (
            <text x={DEM.trai + veW + 8} y={yNhanBat + 4} className="bd-chu-dam">
              {`BẬT trung bình ${soGon(tb.bat as number, 2)}`}
            </text>
          ) : null}
          {!hep && yNhanTat != null ? (
            <text x={DEM.trai + veW + 8} y={yNhanTat + 4}>
              {`TẮT trung bình ${soGon(tb.tat as number, 2)}`}
            </text>
          ) : null}

          {khoi.map((kk, i) =>
            kk.tyLe == null ? null : kk.nhanh === "ON" ? (
              <circle key={kk.index} cx={xI(i)} cy={y(kk.tyLe)} r={6} fill={BIEN.bat} stroke="var(--bd-nen)" strokeWidth={2} data-nhanh="ON" />
            ) : (
              <g key={kk.index} data-nhanh="OFF">
                <circle cx={xI(i)} cy={y(kk.tyLe)} r={7} fill="var(--bd-nen)" />
                <circle cx={xI(i)} cy={y(kk.tyLe)} r={5.5} fill={`url(#${maSoc})`} stroke={BIEN_VIEN_TAT} strokeWidth={2} />
              </g>
            ),
          )}
          {k && k.tyLe != null ? <circle cx={xI(tro as number)} cy={y(k.tyLe)} r={10} fill="none" stroke="var(--bd-chu)" strokeWidth={1.5} pointerEvents="none" /> : null}

          {/* vùng bắt chuột: cả cột của khối, rộng hơn chấm nhiều */}
          {khoi.map((kk, i) => (
            <rect
              key={`h${kk.index}`}
              x={DEM.trai + buoc * i}
              y={DEM.tren}
              width={buoc}
              height={day - DEM.tren}
              fill="transparent"
              onPointerEnter={() => setTro(i)}
              onPointerDown={() => setTro(i)}
              onPointerLeave={() => setTro((cu) => (cu === i ? null : cu))}
            />
          ))}
        </svg>
        {k ? (
          <ONhac
            trai={(xI(tro as number) / W) * Math.min(W, rong)}
            rongKhung={Math.min(W, rong)}
            dau={`Khối ${k.index + 1} · ${tenNhanh(k.nhanh)} · ${moc(k.tu)} đến ${moc(k.den)}`}
            dong={[{ giaTri: k.tyLe == null ? "không đo được" : soGon(k.tyLe, 2), ten: TY_LE_NHAP.toLowerCase(), mau: k.nhanh === "ON" ? BIEN.bat : BIEN.tat }]}
          />
        ) : null}
      </div>
    </KhungBieuDo>
  );
}

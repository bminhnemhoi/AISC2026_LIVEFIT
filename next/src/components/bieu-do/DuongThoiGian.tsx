"use client";

import React, { useMemo, useState } from "react";
import { bangDuongThoiGian, nhanhTai, tenNhanh } from "@/lib/bieu-do/bang";
import { chuoiThoiGian, daiKhoi, O_DO_S, type DaiKhoi } from "@/lib/bieu-do/chuoi";
import { PHU_DE_BAT, PHU_DE_TAT, TY_LE_NHAP, TY_LE_NHAP_DAY_DU } from "@/lib/bieu-do/ket-luan";
import { choHienTyLeNhapTheoThoiGian, quyenToNenKhoi } from "@/lib/bieu-do/khoa";
import { BIEN } from "@/lib/bieu-do/mau";
import { moTaDuongThoiGian } from "@/lib/bieu-do/mo-ta";
import { moc, soGon } from "@/lib/bieu-do/so";
import { thangTuyenTinh, vachThoiGian, vachTu0 } from "@/lib/bieu-do/thang";
import { duongDut, ganNhat, kep, vungDuoi } from "@/lib/bieu-do/ve";
import type { SourceLabel } from "@/lib/livelift-api/desk";
import type { Block, Tick } from "@/lib/livelift-api/types";
import { KhungBieuDo, MauSocTat, ONhac, OTrong, useBeRong, useMaSvg, type MucTieuDe } from "./dung-chung";

/**
 * Đường thời gian: hai biểu đồ nhỏ dùng chung trục thời gian (người xem ở trên, Tỷ lệ nhấp ở dưới), không có trục y
 * thứ hai. Trục giá trị bắt đầu ở 0. Nhãn trực tiếp ở điểm cuối mỗi đường; rê chuột có vạch dọc và ô nhắc.
 *
 * Khoá §7 (D-027): nền BẬT/TẮT chỉ tô khi `toNenKhoi` VÀ có `nguon` VÀ `quyenToNenKhoi(nguon, dangLive, khoa).cho`.
 * Chuỗi Tỷ lệ nhấp theo thời gian (đường, nhãn đầu đường, ô nhắc, bảng thay ảnh, câu mô tả) chỉ có khi
 * `choHienTyLeNhapTheoThoiGian(nguon, dangLive, khoa)`: MÔ PHỎNG, hoặc máy chủ đã trả `khoa=false`. Phiên THẬT, CHẠY
 * THỬ, THỬ NỘI BỘ hay DÀN DỰNG còn khoá chỉ có biểu đồ Người xem và một dòng giải thích. `khoa` mặc định true.
 */

export interface DuongThoiGianProps {
  ticks: Tick[];
  /** `start_ts` của phiên. Không có thì chưa có trục thời gian. */
  batDauTs: string | null | undefined;
  /** Lịch khối (chỉ dùng để tô nền khi được phép). */
  khoi?: Block[];
  /** Muốn tô nền BẬT/TẮT. Chỉ có tác dụng khi có `nguon` và nguồn là MÔ PHỎNG, hoặc máy chủ đã mở (`khoa={false}`). */
  toNenKhoi?: boolean;
  /** Nhãn nguồn của phiên; biểu đồ tự kiểm quyền tô nền (lớp bảo vệ thứ hai). Thiếu thì không tô nền. */
  nguon?: Pick<SourceLabel, "kind" | "text"> | null;
  dangLive?: boolean;
  /** True trừ khi máy chủ nói rõ kết quả đã mở (`DuLieuPhien.khoa`). Mặc định true: thiếu thì coi như còn khoá. */
  khoa?: boolean;
  /** Dòng giải thích dưới biểu đồ (thường là `DuLieuPhien.toNen.dong`). Không truyền thì lấy theo `nguon`, không có thì không ghi gì. */
  ghiChu?: string | null;
  /** Độ dài dự kiến (giây): trục x kéo tới đây để đường mọc dần khi live. */
  thoiLuongS?: number | null;
  /** Cửa sổ trượt của Tỷ lệ nhấp (giây). */
  cuaSoS?: number;
  tieuDe?: string;
  /** Chiều cao vùng vẽ (px). */
  cao?: number;
  dangTai?: boolean;
  muc?: MucTieuDe;
}

const DEM = { trai: 44, phai: 60, tren: 32, trenCoKhoi: 40, duoi: 26, giua: 34 };

export function DuongThoiGian({
  ticks,
  batDauTs,
  khoi = [],
  toNenKhoi = false,
  nguon = null,
  dangLive = false,
  khoa = true,
  ghiChu,
  thoiLuongS,
  cuaSoS = 120,
  tieuDe = "Người xem và Tỷ lệ nhấp theo thời gian",
  cao = 280,
  dangTai,
  muc,
}: DuongThoiGianProps) {
  const [refVe, rong] = useBeRong<HTMLDivElement>();
  const [tro, setTro] = useState<number | null>(null);
  const maSoc = useMaSvg("bd-soc-tat");

  const hienNhap = choHienTyLeNhapTheoThoiGian(nguon, dangLive, khoa);
  const diemDu = useMemo(() => chuoiThoiGian(ticks, batDauTs, cuaSoS), [ticks, batDauTs, cuaSoS]);
  // Khoá: bỏ hẳn tỷ lệ nhấp khỏi dữ liệu vẽ, để không chỗ nào (bảng, ô nhắc, câu mô tả) lỡ in ra.
  const diem = useMemo(() => (hienNhap ? diemDu : diemDu.map((d) => ({ ...d, tyLeNhap: null }))), [hienNhap, diemDu]);
  const quyen = nguon ? quyenToNenKhoi(nguon, dangLive, khoa) : null;
  const choToNen = hienNhap && toNenKhoi && khoi.length > 0 && quyen?.cho === true;
  const dai: DaiKhoi[] | null = useMemo(() => (choToNen ? daiKhoi(khoi) : null), [choToNen, khoi]);
  // Câu mở sớm chỉ nói khi thật sự có nền khối; lời giải thích vì sao khoá thì luôn được nói.
  const dong = ghiChu ?? (quyen && (!quyen.cho || choToNen) ? quyen.dong : null);

  const moTa = moTaDuongThoiGian(diem, { cuaSoS, dai, coTyLeNhap: hienNhap });
  const bang = diem.length ? bangDuongThoiGian(diem, dai, { cuaSoS, coTyLeNhap: hienNhap }) : null;
  const phutCuaSo = Math.round(cuaSoS / 60);

  const cuoiT = diem.length ? diem[diem.length - 1].t + O_DO_S : 0;
  const mien = Math.max(60, cuoiT, thoiLuongS ?? 0, dai?.length ? Math.max(...dai.map((d) => d.den)) : 0);
  const W = Math.max(280, rong);
  const H = Math.max(180, cao);
  const veW = W - DEM.trai - DEM.phai;
  const tren = dai ? DEM.trenCoKhoi : DEM.tren;
  const veH = H - tren - DEM.duoi - (hienNhap ? DEM.giua : 0);
  const caoTren = hienNhap ? Math.round(veH * 0.55) : veH;
  const caoDuoi = hienNhap ? veH - caoTren : 0;
  const yTren0 = tren;
  const yDuoi0 = tren + caoTren + (hienNhap ? DEM.giua : 0);
  const x = thangTuyenTinh([0, mien], [DEM.trai, DEM.trai + veW]);

  const truXem = vachTu0(Math.max(1, ...diem.map((d) => d.nguoiXem)), 2);
  const truNhap = vachTu0(Math.max(0.5, ...diem.map((d) => d.tyLeNhap ?? 0)), 2);
  const yXem = thangTuyenTinh([0, truXem.max], [yTren0 + caoTren, yTren0]);
  const yNhap = thangTuyenTinh([0, truNhap.max], [yDuoi0 + caoDuoi, yDuoi0]);

  const ptXem = diem.map((d) => ({ x: x(d.t), y: yXem(d.nguoiXem) }));
  const ptNhap = diem.map((d) => ({ x: x(d.t), y: d.tyLeNhap == null ? null : yNhap(d.tyLeNhap) }));
  const vachX = vachThoiGian(mien, veW, 76);
  const xs = useMemo(() => diem.map((d) => d.t), [diem]);

  const cuoiXem = diem.length ? diem[diem.length - 1] : null;
  const cuoiNhapI = (() => {
    for (let i = diem.length - 1; i >= 0; i--) if (diem[i].tyLeNhap != null) return i;
    return -1;
  })();

  const diChuot = (e: React.PointerEvent<SVGRectElement>): void => {
    const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const tiLe = box.width > 0 ? W / box.width : 1;
    const px = (e.clientX - box.left) * tiLe;
    const t = ((px - DEM.trai) / veW) * mien;
    setTro(ganNhat(xs, t));
  };

  const d = tro != null && tro >= 0 ? diem[tro] : null;
  const nhanhTro = d && dai ? nhanhTai(dai, d.t) : null;
  const dayVe = hienNhap ? yDuoi0 + caoDuoi : yTren0 + caoTren;

  return (
    <KhungBieuDo
      tieuDe={hienNhap ? tieuDe : "Người xem theo thời gian"}
      phuDe={
        hienNhap
          ? `${TY_LE_NHAP}: ${TY_LE_NHAP_DAY_DU}, tính trên ${phutCuaSo} phút gần nhất`
          : "Người xem cùng lúc. Tỷ lệ nhấp theo thời gian mở khi hết phiên."
      }
      nhan={nguon?.text ?? null}
      moTa={moTa}
      bang={bang}
      dangTai={dangTai}
      muc={muc}
      testId="bd-duong-thoi-gian"
      chuGiai={
        <ul className="bd-chu-giai">
          <li>
            <i className="bd-mau-net" style={{ color: BIEN.nguoiXem }} aria-hidden="true" />
            Người xem cùng lúc
          </li>
          {hienNhap ? (
            <li>
              <i className="bd-mau-net" style={{ color: BIEN.luotNhap }} aria-hidden="true" />
              {TY_LE_NHAP}
            </li>
          ) : null}
          {dai ? (
            <>
              <li>
                <i className="bd-mau-o bd-o-bat" aria-hidden="true" style={{ opacity: 0.5 }} />
                {PHU_DE_BAT}
              </li>
              <li>
                <i className="bd-mau-o bd-o-tat" aria-hidden="true" />
                {PHU_DE_TAT}
              </li>
            </>
          ) : null}
        </ul>
      }
      ghiChu={dong ? <span data-testid="bd-dong-to-nen">{dong}</span> : null}
    >
      <div ref={refVe} style={{ position: "relative" }}>
        {diem.length === 0 ? (
          <OTrong>{batDauTs ? "Chưa có điểm đo người xem nào." : "Phiên chưa bắt đầu, chưa có trục thời gian."}</OTrong>
        ) : (
          <svg className="bd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
            <defs>
              <MauSocTat id={maSoc} nen />
            </defs>

            {dai ? (
              <g data-testid="bd-dai-khoi">
                {dai.map((k) => {
                  if (k.nhanh === "WASH") return null;
                  const x0 = x(k.tu) + 1;
                  const w = Math.max(0, x(Math.min(k.den, mien)) - x(k.tu) - 2);
                  const fill = k.nhanh === "ON" ? "var(--bd-bat-nen)" : `url(#${maSoc})`;
                  // Hai dải riêng cho hai biểu đồ: khe giữa để trống cho nhãn "Tỷ lệ nhấp".
                  return (
                    <g key={k.index} data-nhanh={k.nhanh}>
                      <rect x={x0} y={yTren0 - 16} width={w} height={caoTren + 16} fill={fill} />
                      <rect x={x0} y={yDuoi0} width={w} height={caoDuoi} fill={fill} />
                      {w >= 9 ? (
                        <text x={x0 + w / 2} y={yTren0 - 5} textAnchor="middle" className="bd-chu-nhat" fontSize={w >= 18 ? undefined : 10}>
                          {k.nhanh === "ON" ? "B" : "T"}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            ) : null}

            {/* lưới và trục: người xem */}
            {truXem.vach.map((v) => (
              <g key={`vx${v}`}>
                <line x1={DEM.trai} x2={DEM.trai + veW} y1={yXem(v)} y2={yXem(v)} className={v === 0 ? "bd-truc" : "bd-luoi"} />
                <text x={DEM.trai - 8} y={yXem(v) + 4} textAnchor="end">
                  {soGon(v)}
                </text>
              </g>
            ))}
            {(hienNhap ? truNhap.vach : []).map((v) => (
              <g key={`vn${v}`}>
                <line x1={DEM.trai} x2={DEM.trai + veW} y1={yNhap(v)} y2={yNhap(v)} className={v === 0 ? "bd-truc" : "bd-luoi"} />
                <text x={DEM.trai - 8} y={yNhap(v) + 4} textAnchor="end">
                  {soGon(v, 2)}
                </text>
              </g>
            ))}
            <text x={0} y={dai ? 12 : yTren0 - 14} className="bd-chu-dam">
              Người xem
            </text>
            {hienNhap ? (
              <text x={0} y={yDuoi0 - 12} className="bd-chu-dam">
                {TY_LE_NHAP}
              </text>
            ) : null}
            {vachX.map((t, i) => (
              <text key={`t${t}`} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : t >= mien - 1 ? "end" : "middle"}>
                {moc(t)}
              </text>
            ))}

            {/* chuỗi */}
            <path d={vungDuoi(ptXem, yTren0 + caoTren)} fill={BIEN.nguoiXem} fillOpacity={0.1} />
            <path d={duongDut(ptXem)} className="bd-duong" stroke={BIEN.nguoiXem} data-testid="bd-duong-nguoi-xem" />
            {hienNhap ? <path d={duongDut(ptNhap)} className="bd-duong" stroke={BIEN.luotNhap} data-testid="bd-duong-ty-le-nhap" /> : null}

            {cuoiXem ? (
              <g>
                <circle cx={x(cuoiXem.t)} cy={yXem(cuoiXem.nguoiXem)} r={4} fill={BIEN.nguoiXem} stroke="var(--bd-nen)" strokeWidth={2} />
                <text x={x(cuoiXem.t) + 8} y={yXem(cuoiXem.nguoiXem) + 4} className="bd-chu-dam">
                  {soGon(cuoiXem.nguoiXem)}
                </text>
              </g>
            ) : null}
            {hienNhap && cuoiNhapI >= 0 ? (
              <g>
                <circle cx={x(diem[cuoiNhapI].t)} cy={yNhap(diem[cuoiNhapI].tyLeNhap as number)} r={4} fill={BIEN.luotNhap} stroke="var(--bd-nen)" strokeWidth={2} />
                <text x={x(diem[cuoiNhapI].t) + 8} y={yNhap(diem[cuoiNhapI].tyLeNhap as number) + 4} className="bd-chu-dam">
                  {soGon(diem[cuoiNhapI].tyLeNhap as number, 2)}
                </text>
              </g>
            ) : null}

            {d ? (
              <g pointerEvents="none">
                <line x1={x(d.t)} x2={x(d.t)} y1={yTren0} y2={dayVe} className="bd-ngang" />
                <circle cx={x(d.t)} cy={yXem(d.nguoiXem)} r={4} fill={BIEN.nguoiXem} stroke="var(--bd-nen)" strokeWidth={2} />
                {hienNhap && d.tyLeNhap != null ? <circle cx={x(d.t)} cy={yNhap(d.tyLeNhap)} r={4} fill={BIEN.luotNhap} stroke="var(--bd-nen)" strokeWidth={2} /> : null}
              </g>
            ) : null}
            <rect
              x={DEM.trai}
              y={yTren0}
              width={veW}
              height={dayVe - yTren0}
              fill="transparent"
              onPointerMove={diChuot}
              onPointerDown={diChuot}
              onPointerLeave={() => setTro(null)}
            />
          </svg>
        )}
        {d ? (
          <ONhac
            trai={(kep(x(d.t), 0, W) / W) * Math.min(W, rong)}
            rongKhung={Math.min(W, rong)}
            dau={`${moc(d.t)}${nhanhTro && nhanhTro.nhanh !== "WASH" ? ` · khối ${nhanhTro.index + 1} ${tenNhanh(nhanhTro.nhanh)}` : ""}`}
            dong={[
              { giaTri: soGon(d.nguoiXem), ten: "người xem", mau: BIEN.nguoiXem },
              ...(hienNhap
                ? [
                    {
                      giaTri: d.tyLeNhap == null ? "chưa tính được" : soGon(d.tyLeNhap, 2),
                      ten: `${TY_LE_NHAP.toLowerCase()}, ${phutCuaSo} phút trước`,
                      mau: BIEN.luotNhap,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </div>
    </KhungBieuDo>
  );
}

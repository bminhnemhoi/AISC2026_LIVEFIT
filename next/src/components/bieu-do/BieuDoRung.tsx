"use client";

import { bangRung } from "@/lib/bieu-do/bang";
import { KET_LUAN, TY_LE_NHAP, TY_LE_NHAP_DAY_DU } from "@/lib/bieu-do/ket-luan";
import { moTaRung } from "@/lib/bieu-do/mo-ta";
import type { DongRung } from "@/lib/bieu-do/rung";
import { soDau, soGon } from "@/lib/bieu-do/so";
import { mienDoiXung, thangTuyenTinh } from "@/lib/bieu-do/thang";
import { hinhThoiKhoang } from "@/lib/bieu-do/ve";
import { KhungBieuDo, OTrong, useBeRong, type MucTieuDe } from "./dung-chung";

/**
 * Biểu đồ rừng: mỗi phiên một hàng (điểm + khoảng tin cậy 95%), hàng cuối là kết quả gộp vẽ hình thoi. Một chuỗi nên
 * một màu mực; kết luận ĐỔI / GIỮ / ĐO THÊM viết bằng chữ ở cột phải. Vạch 0 đậm, miền đối xứng quanh 0.
 * Phiên chưa có ước lượng (khoá, thiếu khối) vẫn có hàng, kèm lý do, không bị giấu.
 */

export interface BieuDoRungProps {
  dong: DongRung[];
  /** Hàng gộp (`dongRungGop`), vẽ hình thoi. */
  gop?: DongRung | null;
  tieuDe?: string;
  nhan?: string | null;
  dangTai?: boolean;
  muc?: MucTieuDe;
}

const HANG = 40;
const DAU = 28;
const CHAN = 24;
const LE = 12;

export function BieuDoRung({ dong, gop = null, tieuDe = "Kết quả từng phiên và kết quả gộp", nhan, dangTai, muc }: BieuDoRungProps) {
  const [refVe, rong] = useBeRong<HTMLDivElement>(320);
  const tatCa = gop ? [...dong, gop] : dong;
  const phuDe = `Chênh lệch ${TY_LE_NHAP} khối BẬT trừ khối TẮT (${TY_LE_NHAP_DAY_DU}), kèm khoảng tin cậy 95%`;
  const moTa = moTaRung(dong, gop);

  if (tatCa.length === 0) {
    return (
      <KhungBieuDo tieuDe={tieuDe} phuDe={phuDe} nhan={nhan} moTa={moTa} dangTai={dangTai} muc={muc} testId="bd-rung">
        <OTrong>Chưa có phiên nào để so.</OTrong>
      </KhungBieuDo>
    );
  }

  const coSo = tatCa.flatMap((d) => (d.coSo ? [d.thap, d.cao, d.uocLuong] : []));
  const mien = mienDoiXung(coSo, 2);
  const W = Math.max(120, rong);
  const H = DAU + tatCa.length * HANG + CHAN;
  const x = thangTuyenTinh([mien.min, mien.max], [LE, W - LE]);
  const x0 = x(0);
  const yHang = (i: number): number => DAU + i * HANG + HANG / 2;

  return (
    <KhungBieuDo tieuDe={tieuDe} phuDe={phuDe} nhan={nhan} moTa={moTa} bang={bangRung(dong, gop)} dangTai={dangTai} muc={muc} testId="bd-rung">
      <div className="bd-rung">
        <div className="bd-rung-cot">
          <div className="bd-rung-dau" />
          {tatCa.map((d) => (
            <div key={d.id} className={`bd-rung-o${d.loai === "gop" ? " is-gop" : ""}`} title={d.nhan ? `${d.ten} · ${d.nhan}` : d.ten}>
              <span className="bd-rung-ten-khoi">
                <span className="bd-rung-ten">{d.ten}</span>
                {d.nhan && d.loai !== "gop" ? <span className="bd-rung-nguon">{d.nhan}</span> : null}
              </span>
            </div>
          ))}
          <div className="bd-rung-chan" />
        </div>

        <div className="bd-rung-cot" ref={refVe}>
          <svg className="bd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" data-testid="bd-rung-ve">
            <rect x={LE} y={DAU - 4} width={Math.max(0, x0 - LE)} height={tatCa.length * HANG + 4} fill="var(--bd-vung-giu)" />
            <rect x={x0} y={DAU - 4} width={Math.max(0, W - LE - x0)} height={tatCa.length * HANG + 4} fill="var(--bd-vung-doi)" />
            <text x={LE + 4} y={16} className="bd-chu-nhat">
              GIỮ
            </text>
            <text x={W - LE - 4} y={16} textAnchor="end" className="bd-chu-nhat">
              ĐỔI
            </text>
            {gop ? <line x1={0} x2={W} y1={DAU + dong.length * HANG} y2={DAU + dong.length * HANG} className="bd-luoi" /> : null}
            <line x1={x0} x2={x0} y1={DAU - 4} y2={H - CHAN + 4} className="bd-vach-0" />
            {mien.vach.map((v) => (
              <text key={v} x={x(v)} y={H - 6} textAnchor={v === mien.min ? "start" : v === mien.max ? "end" : "middle"} className="bd-chu-nhat">
                {v === 0 ? "0" : soGon(v, 2)}
              </text>
            ))}

            {tatCa.map((d, i) => {
              const yy = yHang(i);
              if (!d.coSo) {
                return (
                  <text key={d.id} x={x0 + 8} y={yy + 4} className="bd-chu-nhat">
                    chưa có số
                  </text>
                );
              }
              return d.loai === "gop" ? (
                <g key={d.id} data-testid="bd-rung-gop">
                  <path d={hinhThoiKhoang(Math.min(x(d.thap), x(d.uocLuong) - 6), x(d.uocLuong), Math.max(x(d.cao), x(d.uocLuong) + 6), yy, 10)} fill="var(--bd-chu)" stroke="var(--bd-nen)" strokeWidth={2}>
                    <title>{`${d.ten}: ${soDau(d.uocLuong)}, từ ${soDau(d.thap)} đến ${soDau(d.cao)}`}</title>
                  </path>
                </g>
              ) : (
                <g key={d.id} data-testid="bd-rung-phien">
                  <line x1={x(d.thap)} x2={x(d.cao)} y1={yy} y2={yy} stroke="var(--bd-trung)" strokeWidth={2} strokeLinecap="round" />
                  <rect x={x(d.uocLuong) - 5} y={yy - 5} width={10} height={10} rx={2} fill="var(--bd-chu)" stroke="var(--bd-nen)" strokeWidth={2}>
                    <title>{`${d.ten}: ${soDau(d.uocLuong)}, từ ${soDau(d.thap)} đến ${soDau(d.cao)}`}</title>
                  </rect>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="bd-rung-cot">
          <div className="bd-rung-dau" />
          {tatCa.map((d) => (
            <div key={d.id} className={`bd-rung-o${d.loai === "gop" ? " is-gop" : ""}`}>
              {d.coSo ? <span className="bd-rung-ket-luan">{KET_LUAN[d.vung].chu}</span> : <span className="bd-rung-ly-do" title={d.lyDo}>{d.lyDo.startsWith("Khoá") ? "Đang khoá" : "Chưa có"}</span>}
            </div>
          ))}
          <div className="bd-rung-chan" />
        </div>
      </div>
    </KhungBieuDo>
  );
}

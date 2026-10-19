import React from "react";
import { CanCan, DienThoaiKhoi, LichNiemPhong, MAU, MatXu, PHONG } from "@/components/minh-hoa";
import { BUOC_CO_CHE, CAU_DAN_CO_CHE, GHI_CHU_GHIM, KET_LUAN_CO_CHE, TIEU_DE_CO_CHE, ngatDong, type BuocCoChe, type MaBuoc, type MaKetLuan } from "./noi-dung";

/**
 * CoChe bản SVG tĩnh cho slide, poster và video (D-021): một thẻ `<svg>` tự đủ, màu viết thẳng, không CSS, không id,
 * không chuyển động. Chữ ngắt dòng sẵn (SVG không tự xuống dòng). Hình là MINH HOẠ.
 * - `ngang`: 1600 × 900 (16:9), bốn thẻ nằm ngang, cho slide và video;
 * - `doc`: rộng 1000, bốn hàng chồng dọc, cho poster.
 * Xuất ra chuỗi: `xuatCoCheSvg()` trong `xuat.tsx`.
 */

export type HuongCoChe = "ngang" | "doc";

const MAU_KET_LUAN: Record<MaKetLuan, string> = { doi: MAU.bat, giu: MAU.mucNau, do_them: MAU.vang };

/** Một dòng chữ đã đặt chỗ. `y` là đường chân chữ. */
export interface DongChu {
  x: number;
  y: number;
  chu: string;
  co: number;
  mau: string;
  dam?: boolean;
}

/** Một viên kết luận (ĐỔI / GIỮ / ĐO THÊM) đã đặt chỗ. */
export interface VienKetLuan {
  x: number;
  y: number;
  rong: number;
  cao: number;
  chu: string;
  mau: string;
}

export interface BoCucChu {
  dong: DongChu[];
  vien: VienKetLuan[];
  /** toạ độ y dưới cùng của phần chữ */
  day: number;
}

interface CoChu {
  tieuDe: number;
  cau: number;
  phuDe: number;
  kl: number;
  /** số ký tự tối đa mỗi dòng cho tiêu đề, câu, phụ đề, câu kết luận */
  ktTieuDe: number;
  ktCau: number;
  ktPhuDe: number;
  ktKl: number;
}

const CO_NGANG: CoChu = { tieuDe: 26, cau: 19, phuDe: 16, kl: 15, ktTieuDe: 22, ktCau: 31, ktPhuDe: 36, ktKl: 24 };
const CO_DOC: CoChu = { tieuDe: 28, cau: 21, phuDe: 17, kl: 17, ktTieuDe: 40, ktCau: 54, ktPhuDe: 62, ktKl: 44 };

function khoi(chu: string, toiDa: number, co: number, x: number, y: number, mau: string, dam = false): { dong: DongChu[]; y: number } {
  const cao = Math.round(co * 1.38);
  const dong = ngatDong(chu, toiDa).map((c, i) => ({ x, y: y + co + i * cao, chu: c, co, mau, dam }));
  return { dong, y: y + dong.length * cao };
}

/** Đặt chữ của một bước bắt đầu từ (x, y): tiêu đề, câu, phụ đề, và ba kết luận ở bước 4. */
export function boCucChuBuoc(b: BuocCoChe, x: number, y: number, co: CoChu = CO_NGANG): BoCucChu {
  const dong: DongChu[] = [];
  const vien: VienKetLuan[] = [];
  let k = khoi(b.tieuDe, co.ktTieuDe, co.tieuDe, x, y, MAU.muc, true);
  dong.push(...k.dong);
  k = khoi(b.cau, co.ktCau, co.cau, x, k.y + 10, MAU.muc);
  dong.push(...k.dong);
  k = khoi(b.phuDe, co.ktPhuDe, co.phuDe, x, k.y + 8, MAU.mucNhat);
  dong.push(...k.dong);
  let day = k.y;
  if (b.ma === "so-sanh") {
    let yk = day + 14;
    const rong = Math.round(co.kl * 5.6);
    for (const kl of KET_LUAN_CO_CHE) {
      const cao = co.kl + 12;
      vien.push({ x, y: yk, rong, cao, chu: kl.chu, mau: MAU_KET_LUAN[kl.ma] });
      const c = khoi(kl.cau, co.ktKl, co.kl, x + rong + 10, yk + 1, MAU.mucNau);
      dong.push(...c.dong);
      yk = Math.max(yk + cao, c.y) + 8;
    }
    day = yk;
  }
  return { dong, vien, day };
}

/** Hình của một bước, đặt vào ô (x, y, rong, cao). */
function HinhTinh({ ma, x, y, rong, cao }: { ma: MaBuoc; x: number; y: number; rong: number; cao: number }) {
  const o = { x, y, width: rong, height: cao };
  if (ma === "tung-xu") {
    // lịch lùi xuống, chừa góc trên bên phải cho đồng xu (chồng mép một chút như nhãn dán)
    const xu = Math.round(cao * 0.34);
    const lui = Math.round(xu * 0.45);
    return (
      <g>
        <LichNiemPhong x={x} y={y + lui} width={rong - lui} height={cao - lui} />
        <MatXu mat="bat" x={x + rong - xu} y={y} width={xu} height={xu} />
      </g>
    );
  }
  if (ma === "khoi-bat") return <DienThoaiKhoi khoi="bat" {...o} />;
  if (ma === "khoi-tat") return <DienThoaiKhoi khoi="tat" mon="tui-tote" {...o} />;
  return <CanCan {...o} />;
}

function Chu({ d }: { d: DongChu }) {
  return (
    <text x={d.x} y={d.y} fontFamily={PHONG} fontSize={d.co} fontWeight={d.dam ? 700 : 400} fill={d.mau}>
      {d.chu}
    </text>
  );
}

function Vien({ v }: { v: VienKetLuan }) {
  return (
    <g>
      <rect x={v.x} y={v.y} width={v.rong} height={v.cao} rx={v.cao / 2} fill={v.mau} />
      <text x={v.x + v.rong / 2} y={v.y + v.cao / 2 + v.cao * 0.2} textAnchor="middle" fontFamily={PHONG} fontSize={Math.round(v.cao * 0.52)} fontWeight={700} fill="#ffffff">
        {v.chu}
      </text>
    </g>
  );
}

function SoTron({ cx, cy, so }: { cx: number; cy: number; so: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={20} fill={MAU.muc} />
      <text x={cx} y={cy + 7} textAnchor="middle" fontFamily={PHONG} fontSize={20} fontWeight={700} fill="#ffffff">
        {so}
      </text>
    </g>
  );
}

function ChipMinhHoa({ x, y, chu }: { x: number; y: number; chu: string }) {
  const rong = Math.round(chu.length * 10.5 + 28);
  return (
    <g>
      <rect x={x - rong} y={y} width={rong} height={32} rx={16} fill={MAU.giayB} stroke={MAU.vach} />
      <text x={x - rong / 2} y={y + 21.5} textAnchor="middle" fontFamily={PHONG} fontSize={15} fontWeight={700} letterSpacing="0.06em" fill={MAU.muc}>
        {chu}
      </text>
    </g>
  );
}

export interface BoCucCoCheSvg {
  rong: number;
  cao: number;
  the: { x: number; y: number; rong: number; cao: number; b: BuocCoChe; hinh: { x: number; y: number; rong: number; cao: number }; chu: BoCucChu }[];
  dau: DongChu[];
  chan: DongChu[];
  yChip: number;
}

/** Tính bố cục cho một hướng. Tách khỏi phần vẽ để test kiểm được chữ không tràn khỏi thẻ. */
export function boCucCoChe(huong: HuongCoChe): BoCucCoCheSvg {
  if (huong === "ngang") {
    const rong = 1600;
    const le = 60;
    const khe = 20;
    const rongThe = (rong - 2 * le - 3 * khe) / 4;
    const yThe = 160;
    const dau = [
      ...khoi(TIEU_DE_CO_CHE, 80, 44, le, 40, MAU.muc, true).dong,
      ...khoi(CAU_DAN_CO_CHE, 130, 21, le, 104, MAU.mucNau).dong,
    ];
    const the = BUOC_CO_CHE.map((b, i) => {
      const x = le + i * (rongThe + khe);
      const hinh = { x: x + 24, y: yThe + 52, rong: rongThe - 48, cao: 156 };
      const chu = boCucChuBuoc(b, x + 24, hinh.y + hinh.cao + 12, CO_NGANG);
      return { x, y: yThe, rong: rongThe, cao: 0, b, hinh, chu };
    });
    const day = Math.max(...the.map((t) => t.chu.day)) + 20;
    for (const t of the) t.cao = day - yThe;
    const chan = khoi(GHI_CHU_GHIM, 120, 16, le, day + 14, MAU.mucNau).dong;
    return { rong, cao: 900, the, dau, chan, yChip: 900 - 52 };
  }
  const rong = 1000;
  const le = 40;
  const dau = [
    ...khoi(TIEU_DE_CO_CHE, 44, 44, le, 36, MAU.muc, true).dong,
    ...khoi(CAU_DAN_CO_CHE, 76, 21, le, 104, MAU.mucNau).dong,
  ];
  let y = (dau.at(-1)?.y ?? 120) + 32;
  const the = BUOC_CO_CHE.map((b) => {
    const hinh = { x: le + 32, y: y + 24, rong: 200, cao: 188 };
    const chu = boCucChuBuoc(b, le + 264, y + 20, CO_DOC);
    const cao = Math.max(hinh.cao + 48, chu.day - y + 24);
    const t = { x: le, y, rong: rong - 2 * le, cao, b, hinh, chu };
    y += cao + 20;
    return t;
  });
  const chan = khoi(GHI_CHU_GHIM, 84, 17, le, y + 4, MAU.mucNau).dong;
  const yChan = (chan.at(-1)?.y ?? y) + 24;
  return { rong, cao: yChan + 48, the, dau, chan, yChip: yChan };
}

export interface CoCheSvgProps extends Omit<React.SVGProps<SVGSVGElement>, "children" | "viewBox" | "ref"> {
  huong?: HuongCoChe;
  /** chip nguồn, mặc định MINH HOẠ; null để ẩn */
  nhan?: string | null;
  /** nhãn đọc của cả hình */
  title?: string;
}

export function CoCheSvg({ huong = "ngang", nhan = "MINH HOẠ", title = TIEU_DE_CO_CHE, ...rest }: CoCheSvgProps) {
  const bc = boCucCoChe(huong);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${bc.rong} ${bc.cao}`} width={bc.rong} height={bc.cao} role="img" aria-label={title} data-co-che-svg={huong} {...rest}>
      <title>{title}</title>
      <rect width={bc.rong} height={bc.cao} fill={MAU.kem} />
      {bc.dau.map((d, i) => (
        <Chu key={`dau-${i}`} d={d} />
      ))}
      {bc.the.map((t) => (
        <g key={t.b.ma} data-buoc={t.b.so}>
          <rect x={t.x} y={t.y} width={t.rong} height={t.cao} rx={12} fill={MAU.giay} stroke={MAU.vach} strokeWidth={1.5} />
          <SoTron cx={t.x + 32} cy={t.y + 32} so={t.b.so} />
          <HinhTinh ma={t.b.ma} {...t.hinh} />
          {t.chu.dong.map((d, i) => (
            <Chu key={i} d={d} />
          ))}
          {t.chu.vien.map((v) => (
            <Vien key={v.chu} v={v} />
          ))}
        </g>
      ))}
      {bc.chan.map((d, i) => (
        <Chu key={`chan-${i}`} d={d} />
      ))}
      {nhan && <ChipMinhHoa x={bc.rong - 40} y={bc.yChip} chu={nhan} />}
    </svg>
  );
}

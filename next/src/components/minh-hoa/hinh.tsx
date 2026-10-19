import React from "react";
import { AoThun, BinhGiuNhiet, KepToc, TuiTote, type MaMon } from "./hang";
import { MAU_HINH, PHONG, PHONG_SO, nghieng } from "./mau";
import { LICH_MINH_HOA, type MatKhoi } from "./mat-xu";
import { Goc, NET, NET_MANH, NhanDan, chuNhat, socChuNhat, type HinhProps } from "./nen-ve";
import "./minh-hoa.css";

/**
 * Hình vẽ tay của giao diện 2.0 (D-021): SVG viết tay, màu cố định, đứng thẳng; phần trang trí nghiêng tối đa 2°.
 * Chữ trong hình là tiếng Việt; số trong hình là MINH HOẠ, không phải kết quả.
 */

/* ---------- lịch niêm phong ---------- */

/**
 * Tờ lịch 16 khối (B/T) có con dấu NIÊM PHONG và mã băm. `maBam` mặc định là chuỗi minh hoạ, không phải mã của phiên nào.
 */
export function LichNiemPhong({ lich = LICH_MINH_HOA, maBam = "9c1e…4b7a", ...p }: HinhProps & { lich?: readonly MatKhoi[]; maBam?: string }) {
  const cot = 4;
  const w = 34;
  const h = 24;
  const x0 = 34;
  const y0 = 56;
  return (
    <Goc viewBox="0 0 240 210" {...p}>
      <NhanDan d={chuNhat(18, 22, 204, 176, 10)}>
        {/* gáy lịch */}
        <path d="M18 44H222" {...NET} />
        <rect x="58" y="12" width="8" height="20" rx="4" fill={MAU_HINH.le} stroke={MAU_HINH.mucNau} strokeWidth={2} />
        <rect x="174" y="12" width="8" height="20" rx="4" fill={MAU_HINH.le} stroke={MAU_HINH.mucNau} strokeWidth={2} />
        <text x="34" y="39" fontFamily={PHONG} fontWeight={700} fontSize={12} letterSpacing="0.06em" fill={MAU_HINH.mucNau}>LỊCH {lich.length} KHỐI</text>
        {lich.map((m, i) => {
          const x = x0 + (i % cot) * (w + 4);
          const y = y0 + Math.floor(i / cot) * (h + 4);
          return (
            <g key={i}>
              {m === "bat" ? (
                <rect x={x} y={y} width={w} height={h} rx="4" fill={MAU_HINH.bat} />
              ) : (
                <g>
                  <rect x={x} y={y} width={w} height={h} rx="4" fill={MAU_HINH.tatNhat} />
                  <path d={socChuNhat(x + 1, y + 1, w - 2, h - 2, 6)} stroke={MAU_HINH.tat} strokeWidth={1.3} />
                  <rect x={x + w / 2 - 8} y={y + h / 2 - 8} width="16" height="16" rx="3" fill={MAU_HINH.le} />
                </g>
              )}
              <text x={x + w / 2} y={y + h / 2 + 4.5} textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={13} fill={m === "bat" ? "#ffffff" : MAU_HINH.muc}>{m === "bat" ? "B" : "T"}</text>
            </g>
          );
        })}
        <text x="34" y="186" fontFamily={PHONG_SO} fontSize={10.5} fill={MAU_HINH.mucNhat}>SHA-256 · {maBam}</text>
      </NhanDan>
      {/* con dấu niêm phong, nghiêng nhẹ */}
      <g transform={`rotate(${nghieng(-2)} 194 150)`}>
        <circle cx="194" cy="150" r="31" fill={MAU_HINH.le} stroke={MAU_HINH.vienCat} strokeWidth={1.5} />
        <circle cx="194" cy="150" r="27" fill={MAU_HINH.gach} stroke={MAU_HINH.mucNau} strokeWidth={2} />
        <circle cx="194" cy="150" r="22" fill="none" stroke={MAU_HINH.gachNhat} strokeWidth={1.2} strokeDasharray="3 2.5" />
        <text x="194" y="147" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={9.5} fill="#ffffff">NIÊM</text>
        <text x="194" y="159" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={9.5} fill="#ffffff">PHONG</text>
      </g>
    </Goc>
  );
}

/* ---------- điện thoại bấm link ---------- */

/**
 * Điện thoại đang live có thẻ ghim; ngón tay chạm nút "Xem ngay", vòng gợn lan ra và "+1" bay lên (một lượt nhấp).
 * Hình động chỉ chạy khi có minh-hoa.css và người dùng không chọn giảm chuyển động.
 */
export function DienThoaiBamLink({ mon = "ao-thun", ...p }: HinhProps & { mon?: MaMon }) {
  const Mon = HINH_MON[mon];
  return (
    <Goc viewBox="0 0 170 230" {...p} className={`mh-bam-link${p.className ? ` ${p.className}` : ""}`}>
      <NhanDan d={chuNhat(24, 8, 104, 206, 20)}>
        <rect x="34" y="26" width="84" height="172" rx="10" fill={MAU_HINH.kem} stroke={MAU_HINH.mucNau} strokeWidth={2} />
        <rect x="62" y="15" width="28" height="5" rx="2.5" fill={MAU_HINH.mucNau} />
        <g transform="translate(42 34)">
          <rect width="34" height="14" rx="7" fill={MAU_HINH.gach} />
          <text x="20" y="10.2" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={8} fill="#ffffff">LIVE</text>
          <circle cx="7" cy="7" r="2.4" fill="#ffffff" />
        </g>
        <path d="M44 120h40M44 130h28" {...NET_MANH} opacity={0.5} />
        {/* thẻ ghim thẳng */}
        <rect x="40" y="142" width="72" height="48" rx="6" fill={MAU_HINH.le} stroke={MAU_HINH.mucNau} strokeWidth={1.6} />
        <Mon x={43} y={146} width={22} height={22} />
        <path d="M70 152h34M70 160h22" {...NET_MANH} />
        <rect x="46" y="171" width="60" height="14" rx="7" fill={MAU_HINH.gach} className="mh-bam-nut" />
        <text x="76" y="181" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={8} fill="#ffffff">Xem ngay</text>
      </NhanDan>
      {/* vòng gợn và +1 */}
      <circle cx="88" cy="178" r="10" fill="none" stroke={MAU_HINH.luotNhap} strokeWidth={2} className="mh-gon" />
      <g className="mh-cong-mot">
        <rect x="114" y="132" width="30" height="18" rx="9" fill={MAU_HINH.luotNhap} stroke={MAU_HINH.le} strokeWidth={2} />
        <text x="129" y="145" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={11} fill="#ffffff">+1</text>
      </g>
      {/* ngón tay */}
      <g className="mh-ngon-tay">
        <path d="M92 180c-3-1-5 1-5 4l1 30c0 6 4 11 10 12l14 1c7 0 12-5 12-11l1-17c0-3-2-5-5-5s-5 2-5 5v-3c0-3-2-5-5-5s-5 2-5 5v-2c0-3-2-5-5-5s-5 2-5 5v-11c0-2-1-3-3-3z" fill={MAU_HINH.le} stroke={MAU_HINH.vienCat} strokeWidth={6} strokeLinejoin="round" />
        <path d="M92 180c-3-1-5 1-5 4l1 30c0 6 4 11 10 12l14 1c7 0 12-5 12-11l1-17c0-3-2-5-5-5s-5 2-5 5v-3c0-3-2-5-5-5s-5 2-5 5v-2c0-3-2-5-5-5s-5 2-5 5v-11c0-2-1-3-3-3z" fill={MAU_HINH.da} stroke={MAU_HINH.mucNau} strokeWidth={2} strokeLinejoin="round" />
      </g>
    </Goc>
  );
}

/* ---------- điện thoại trong một khối BẬT / TẮT ---------- */

/**
 * Điện thoại đang live trong một khối. BẬT: chip B xanh, thẻ món có tem GHIM (LiveLift vừa ghim). TẮT: chip T xám có
 * sọc, LiveLift để yên; thẻ món cũ mờ, viền nét đứt (món ghim từ trước có thể vẫn hiện, D-012).
 */
export function DienThoaiKhoi({ khoi, mon = "ao-thun", ...p }: HinhProps & { khoi: MatKhoi; mon?: MaMon }) {
  const Mon = HINH_MON[mon];
  const bat = khoi === "bat";
  return (
    <Goc viewBox="0 0 152 222" {...p} className={`mh-dien-thoai-khoi${p.className ? ` ${p.className}` : ""}`} data-khoi={khoi}>
      {/* thân máy lùi sang trái 12 để chừa chỗ cho chip khối bên ngoài màn hình (khách không thấy khối) */}
      <g transform="translate(-12 0)">
      <NhanDan d={chuNhat(24, 8, 104, 206, 20)}>
        <rect x="34" y="26" width="84" height="172" rx="10" fill={MAU_HINH.kem} stroke={MAU_HINH.mucNau} strokeWidth={2} />
        <rect x="62" y="15" width="28" height="5" rx="2.5" fill={MAU_HINH.mucNau} />
        <g transform="translate(42 34)">
          <rect width="34" height="14" rx="7" fill={MAU_HINH.gach} />
          <text x="20" y="10.2" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={8} fill="#ffffff">LIVE</text>
          <circle cx="7" cy="7" r="2.4" fill="#ffffff" />
        </g>
        <path d="M44 112h40M44 122h28" {...NET_MANH} opacity={0.5} />
        {bat ? (
          <g className="mh-the-ghim">
            <rect x="40" y="142" width="72" height="48" rx="6" fill={MAU_HINH.le} stroke={MAU_HINH.mucNau} strokeWidth={1.8} />
            <Mon x={43} y={148} width={30} height={30} />
            <path d="M78 156h28M78 166h18" {...NET_MANH} />
            {/* tem GHIM */}
            <rect x="40" y="128" width="40" height="15" rx="7.5" fill={MAU_HINH.bat} stroke={MAU_HINH.le} strokeWidth={1.5} />
            <text x="60" y="139" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={8.5} fill="#ffffff">GHIM</text>
          </g>
        ) : (
          <g opacity={0.6}>
            <rect x="40" y="142" width="72" height="48" rx="6" fill={MAU_HINH.giay} stroke={MAU_HINH.mucNhat} strokeWidth={1.4} strokeDasharray="4 3" />
            <Mon x={43} y={148} width={30} height={30} />
            <path d="M78 156h28M78 166h18" {...NET_MANH} stroke={MAU_HINH.mucNhat} />
          </g>
        )}
      </NhanDan>
      </g>
      {/* chip khối ngoài màn hình (chỉ người bán thấy lịch): B xanh, hoặc T xám có sọc */}
      {bat ? (
        <g data-chip-khoi="bat">
          <rect x="128" y="30" width="20" height="18" rx="4" fill={MAU_HINH.bat} stroke={MAU_HINH.le} strokeWidth={1.5} />
          <text x="138" y="43.5" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={12} fill="#ffffff">B</text>
        </g>
      ) : (
        <g data-chip-khoi="tat">
          <rect x="128" y="30" width="20" height="18" rx="4" fill={MAU_HINH.tatNhat} stroke={MAU_HINH.tat} strokeWidth={1} />
          <path d={socChuNhat(129, 31, 18, 16, 4)} stroke={MAU_HINH.tat} strokeWidth={1} />
          <rect x="133" y="34" width="10" height="11" rx="2" fill={MAU_HINH.le} />
          <text x="138" y="43.5" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={12} fill={MAU_HINH.muc}>T</text>
        </g>
      )}
    </Goc>
  );
}

/* ---------- cán cân ---------- */

/**
 * Cán cân so BẬT (trái) với TẮT (phải). `ben` chọn bên nặng hơn; mặc định "bang" (thăng bằng) để hình không gợi ý
 * kết quả nào. Đòn cân nghiêng tối đa 2°, vẽ bằng toạ độ.
 */
export function CanCan({ ben = "bang", ...p }: HinhProps & { ben?: "bat" | "tat" | "bang" }) {
  const lech = ben === "bang" ? 0 : (ben === "bat" ? 1 : -1) * Math.tan((nghieng(2) * Math.PI) / 180) * 80;
  const yT = 52 + lech; // đầu trái (BẬT)
  const yP = 52 - lech; // đầu phải (TẮT)
  const dia = (cx: number, y: number) => `M${cx - 36} ${y}h72q-6 22-36 22t-36-22z`;
  return (
    <Goc viewBox="0 0 240 200" {...p}>
      {/* chân và trụ */}
      <NhanDan d="M84 186h72l-10-18h-52z" than="kraft" />
      <path d="M120 168V56" stroke={MAU_HINH.mucNau} strokeWidth={6} strokeLinecap="round" />
      <path d="M120 168V56" stroke={MAU_HINH.kraftB} strokeWidth={2.5} strokeLinecap="round" />
      {/* đòn cân */}
      <path d={`M40 ${yT}L200 ${yP}`} stroke={MAU_HINH.mucNau} strokeWidth={6} strokeLinecap="round" />
      <path d={`M40 ${yT}L200 ${yP}`} stroke={MAU_HINH.kraftA} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx="120" cy="52" r="7" fill={MAU_HINH.gach} stroke={MAU_HINH.mucNau} strokeWidth={2} />
      {/* dây treo */}
      <path d={`M40 ${yT}L14 ${yT + 54}M40 ${yT}L66 ${yT + 54}M200 ${yP}L174 ${yP + 54}M200 ${yP}L226 ${yP + 54}`} {...NET_MANH} />
      {/* đĩa BẬT: ba khối xanh */}
      <path d={dia(40, yT + 54)} fill={MAU_HINH.batNhat} stroke={MAU_HINH.mucNau} strokeWidth={2} />
      {[0, 1, 2].map((i) => (
        <rect key={`b${i}`} x={22 + i * 12} y={yT + 40} width="11" height="14" rx="2" fill={MAU_HINH.bat} stroke={MAU_HINH.mucNau} strokeWidth={1.2} />
      ))}
      {/* đĩa TẮT: ba khối xám có sọc */}
      <path d={dia(200, yP + 54)} fill={MAU_HINH.tatNhat} stroke={MAU_HINH.mucNau} strokeWidth={2} />
      {[0, 1, 2].map((i) => (
        <g key={`t${i}`}>
          <rect x={182 + i * 12} y={yP + 40} width="11" height="14" rx="2" fill={MAU_HINH.tatNhat} stroke={MAU_HINH.mucNau} strokeWidth={1.2} />
          <path d={socChuNhat(183 + i * 12, yP + 41, 9, 12, 4)} stroke={MAU_HINH.tat} strokeWidth={1.1} />
        </g>
      ))}
      <text x="40" y={yT + 98} textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={15} fill={MAU_HINH.bat}>BẬT</text>
      <text x="200" y={yP + 98} textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={15} fill={MAU_HINH.muc}>TẮT</text>
    </Goc>
  );
}

/* ---------- giỏ hàng ---------- */

/** Giỏ hàng có túi tote và bình nước ló ra; `soMon` hiện trong huy hiệu đỏ gạch (bỏ trống thì không có huy hiệu). */
export function GioHang({ soMon, ...p }: HinhProps & { soMon?: number }) {
  return (
    <Goc viewBox="0 0 150 130" {...p}>
      <TuiTote x={40} y={4} width={44} height={44} />
      <BinhGiuNhiet x={70} y={2} width={40} height={40} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22H28L44 92H112L126 44H34" stroke={MAU_HINH.le} strokeWidth={14} />
        <path d="M8 22H28L44 92H112L126 44H34" stroke={MAU_HINH.mucNau} strokeWidth={6} />
      </g>
      <path d="M36 50H122L112 86H46Z" fill={MAU_HINH.kraftA} stroke={MAU_HINH.mucNau} strokeWidth={2} strokeLinejoin="round" />
      <path d="M58 50V86M78 50V86M98 50V86" {...NET_MANH} stroke={MAU_HINH.kraftB} />
      <circle cx="52" cy="110" r="9" fill={MAU_HINH.mucNau} stroke={MAU_HINH.le} strokeWidth={3} />
      <circle cx="104" cy="110" r="9" fill={MAU_HINH.mucNau} stroke={MAU_HINH.le} strokeWidth={3} />
      {soMon !== undefined && soMon > 0 && (
        <g>
          <circle cx="128" cy="24" r="16" fill={MAU_HINH.gach} stroke={MAU_HINH.le} strokeWidth={3} />
          <text x="128" y="29.5" textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={soMon > 9 ? 12 : 15} fill="#ffffff">{soMon > 99 ? "99+" : soMon}</text>
        </g>
      )}
    </Goc>
  );
}

/* ---------- người dẫn vẽ tay ---------- */

const HINH_MON: Record<MaMon, (p: HinhProps) => React.ReactElement> = {
  "ao-thun": AoThun,
  "tui-tote": TuiTote,
  "binh-giu-nhiet": BinhGiuNhiet,
  "kep-toc": KepToc,
};

/**
 * Người dẫn vẽ tay (không phải ảnh, không do AI tạo) đứng sau quầy hàng, khung 9:16. Dùng cho poster
 * (`?anh-poster=1`) và làm hình dự phòng khi chưa có video. `cam`: món người dẫn đang cầm.
 * Phần dưới khung để trống để lớp bình luận và thẻ ghim của điện thoại không che mặt.
 */
export function NguoiDanVeTay({ cam = "ao-thun", ...p }: HinhProps & { cam?: MaMon | null }) {
  const MonCam = cam ? HINH_MON[cam] : null;
  return (
    <Goc viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" {...p}>
      {/* tường và kệ */}
      <rect width="180" height="320" fill="#d9cdbb" />
      <rect y="210" width="180" height="110" fill="#c7b79d" />
      <path d="M0 38H180" stroke="#8d7c63" strokeWidth={2.5} />
      {/* bốn món trên kệ */}
      <AoThun x={6} y={6} width={34} height={34} />
      <TuiTote x={50} y={4} width={34} height={34} />
      <BinhGiuNhiet x={96} y={4} width={34} height={34} />
      <KepToc x={140} y={6} width={34} height={34} />
      {/* đèn vòng phía sau */}
      <circle cx="90" cy="118" r="54" fill="none" stroke="#f6efe2" strokeWidth={7} opacity={0.75} />
      <circle cx="90" cy="118" r="54" fill="none" stroke={MAU_HINH.mucNau} strokeWidth={1.2} opacity={0.5} />
      {/* tóc phía sau */}
      <path d="M62 112q-4-42 28-44q32 2 28 44q2 30 8 44h-72q6-14 8-44z" fill={MAU_HINH.toc} />
      {/* thân và cổ */}
      <path d="M78 140h24v14h-24z" fill={MAU_HINH.da} />
      <path d="M40 320V196q0-40 50-44q50 4 50 44v124z" fill="#f5efe4" stroke={MAU_HINH.mucNau} strokeWidth={1.6} />
      <path d="M76 154l14 14 14-14" fill="none" stroke={MAU_HINH.mucNau} strokeWidth={1.6} strokeLinejoin="round" />
      {/* mặt: vẽ đơn giản, không chân dung */}
      <ellipse cx="90" cy="116" rx="21" ry="25" fill={MAU_HINH.da} stroke={MAU_HINH.mucNau} strokeWidth={1.6} />
      <path d="M69 112q2-28 21-28q20 0 22 28q-8-14-22-16q-14 2-21 16z" fill={MAU_HINH.toc} />
      <circle cx="82" cy="117" r="2.2" fill={MAU_HINH.muc} />
      <circle cx="98" cy="117" r="2.2" fill={MAU_HINH.muc} />
      <path d="M84 129q6 5 12 0" fill="none" stroke={MAU_HINH.mucNau} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="77" cy="125" r="3.5" fill={MAU_HINH.gachNhat} />
      <circle cx="103" cy="125" r="3.5" fill={MAU_HINH.gachNhat} />
      {/* món đang cầm, hai tay đỡ */}
      {MonCam && (
        <g>
          <MonCam x={58} y={164} width={64} height={64} />
          <ellipse cx="60" cy="210" rx="8" ry="6" fill={MAU_HINH.da} stroke={MAU_HINH.mucNau} strokeWidth={1.4} />
          <ellipse cx="120" cy="210" rx="8" ry="6" fill={MAU_HINH.da} stroke={MAU_HINH.mucNau} strokeWidth={1.4} />
        </g>
      )}
      {/* mặt quầy */}
      <rect y="248" width="180" height="72" fill={MAU_HINH.kraftB} />
      <path d="M0 248H180" stroke={MAU_HINH.mucNau} strokeWidth={2} />
    </Goc>
  );
}

/* ---------- trạng thái trống ---------- */

/** Hình cho trạng thái trống: tấm thẻ trơn có viền nét đứt, băng kraft dán trên, chưa có gì để ghim. */
export function HinhTrong(p: HinhProps) {
  return (
    <Goc viewBox="0 0 160 120" {...p}>
      <NhanDan d={chuNhat(34, 16, 92, 92, 8)}>
        <rect x="46" y="28" width="68" height="68" rx="6" fill="none" stroke={MAU_HINH.mucNhat} strokeWidth={1.6} strokeDasharray="5 4" />
        <path d="M70 62h20M80 52v20" stroke={MAU_HINH.mucNhat} strokeWidth={2.2} strokeLinecap="round" />
      </NhanDan>
      <polygon points="58,6 102,6 100,10 102,14 100,18 102,22 58,22 60,18 58,14 60,10" fill={MAU_HINH.kraft} opacity={0.92} transform={`rotate(${nghieng(-2)} 80 14)`} />
    </Goc>
  );
}

/**
 * Trạng thái trống: hình + tiêu đề + một câu + chỗ cho nút (children). Khung đứng thẳng, nút trong đó không bị nghiêng.
 */
export function TrangThaiTrong({ tieuDe, moTa, the: The = "h2", children, className }: { tieuDe: string; moTa?: string; the?: "h2" | "h3" | "p"; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`mh-trong${className ? ` ${className}` : ""}`} data-minh-hoa="trang-thai-trong">
      <HinhTrong className="mh-trong-hinh" />
      <The className="mh-trong-tieu-de">{tieuDe}</The>
      {moTa && <p className="mh-trong-mo-ta">{moTa}</p>}
      {children && <div className="mh-trong-nut">{children}</div>}
    </div>
  );
}

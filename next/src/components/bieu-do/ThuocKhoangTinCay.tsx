"use client";

import { bangThuoc } from "@/lib/bieu-do/bang";
import { KET_LUAN, PHU_DE_KHOANG_TIN_CAY, THU_TU_VUNG, TY_LE_NHAP, TY_LE_NHAP_DAY_DU, vungCua, type VungKetLuan } from "@/lib/bieu-do/ket-luan";
import { daMoKhoa } from "@/lib/bieu-do/khoa";
import { moTaThuoc } from "@/lib/bieu-do/mo-ta";
import { soDau, soGon } from "@/lib/bieu-do/so";
import { mienDoiXung, thangTuyenTinh } from "@/lib/bieu-do/thang";
import { kep } from "@/lib/bieu-do/ve";
import { chuanHoaChu } from "@/lib/livelift-api/gop";
import type { BaoCao } from "@/lib/livelift-api/types";
import { KhungBieuDo, OKhoa, OTrong, useBeRong, type MucTieuDe } from "./dung-chung";

/**
 * Thước khoảng tin cậy: điểm ước lượng, khoảng tin cậy 95%, vạch 0, và ba vùng GIỮ / ĐO THÊM / ĐỔI có chữ và biểu
 * tượng (không chỉ dựa vào màu). Miền đối xứng quanh 0 để hai phía rộng bằng nhau.
 *
 * Khoá §7: khi `khoa` là true, không vẽ gì ngoài ô khoá (không số, không hình), kể cả khi lỡ có số.
 */

export interface ThuocKhoangTinCayProps {
  /** True trừ khi máy chủ nói rõ kết quả đã mở (`daMoKhoa`). */
  khoa: boolean;
  uocLuong?: number | null;
  thap?: number | null;
  cao?: number | null;
  /** Vì sao chưa có ước lượng (khi đã mở khoá nhưng thiếu số). */
  lyDo?: string | null;
  /** Nhãn nguồn của số. */
  nhan?: string | null;
  tieuDe?: string;
  /** Gọn: chỉ hiện câu của vùng đang chọn (thẻ kết luận). */
  gon?: boolean;
  muc?: MucTieuDe;
}

/** Props của thước từ một báo cáo đã qua khoá §7. */
export function thuocTuBaoCao(baoCao: BaoCao | null | undefined): Pick<ThuocKhoangTinCayProps, "khoa" | "uocLuong" | "thap" | "cao" | "lyDo"> {
  if (!daMoKhoa(baoCao)) return { khoa: true };
  const k = baoCao!.ket_qua_thi_nghiem!;
  if (!k.estimable || k.estimate == null || k.ci_low == null || k.ci_high == null) {
    // Lý do do máy chủ viết có thể có dấu gạch dài hay chữ tắt KTC: qua chuanHoaChu như rung.ts.
    return { khoa: false, lyDo: chuanHoaChu(k.message ?? "Chưa đủ khối bốc thăm để ước lượng.") };
  }
  return { khoa: false, uocLuong: k.estimate, thap: k.ci_low, cao: k.ci_high };
}

/** Biểu tượng của từng vùng (trang trí; chữ luôn đi kèm). */
export function BieuTuongVung({ vung, co = 20 }: { vung: VungKetLuan; co?: number }) {
  return (
    <svg width={co} height={co} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {vung === "doi" ? (
        <path d="M3 7h12M12 4l3 3-3 3M17 13H5M8 10l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : vung === "giu" ? (
        <path d="M10 3.5v13M6.5 6.5h7M4 12a6 6 0 0 0 12 0M10 3.5a1.5 1.5 0 1 0 0 0.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M2.5 13.5h15v-5h-15zM5.5 8.5v2.5M8.5 8.5v1.5M11.5 8.5v2.5M14.5 8.5v1.5M10 2.5v3.5M8.25 4.25h3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const CAO = 112;
const DEM = { trai: 16, phai: 16 };

export function ThuocKhoangTinCay({ khoa, uocLuong, thap, cao, lyDo, nhan, tieuDe = "Khoảng tin cậy của chênh lệch", gon = false, muc }: ThuocKhoangTinCayProps) {
  const [refVe, rong] = useBeRong<HTMLDivElement>();
  if (khoa) {
    return <OKhoa tieuDe={tieuDe} testId="bd-thuoc-khoa" />;
  }
  const coSo = uocLuong != null && thap != null && cao != null && Number.isFinite(uocLuong) && Number.isFinite(thap) && Number.isFinite(cao);
  const vung = coSo ? vungCua(thap, cao) : null;
  const phuDe = `${TY_LE_NHAP} khối BẬT trừ khối TẮT (${TY_LE_NHAP_DAY_DU}). Khoảng tin cậy 95%: ${PHU_DE_KHOANG_TIN_CAY}.`;

  if (!coSo || !vung) {
    return (
      <KhungBieuDo tieuDe={tieuDe} phuDe={phuDe} nhan={nhan} moTa={`${tieuDe}: chưa có ước lượng.`} muc={muc} testId="bd-thuoc">
        <OTrong>{lyDo ? `Chưa có ước lượng. ${chuanHoaChu(lyDo)}` : "Chưa có ước lượng."}</OTrong>
      </KhungBieuDo>
    );
  }

  const W = Math.max(280, rong);
  const mien = mienDoiXung([thap, cao, uocLuong], 2);
  const x = thangTuyenTinh([mien.min, mien.max], [DEM.trai, W - DEM.phai]);
  const x0 = x(0);
  const yTruc = 72;
  const yKhoang = 48;
  const xThap = x(thap);
  const xCao = x(cao);
  const xUoc = x(uocLuong);
  // Nhãn thước dài (canon nhan_thuoc); khung hẹp thì chỉ giữ chữ lớn để hai nhãn hai bên không chồng nhau.
  const nhanVung = (v: VungKetLuan): string => (W >= 440 ? KET_LUAN[v].nhanThuoc : KET_LUAN[v].chu);

  return (
    <KhungBieuDo
      tieuDe={tieuDe}
      phuDe={phuDe}
      nhan={nhan}
      moTa={moTaThuoc(uocLuong, thap, cao, vung)}
      bang={bangThuoc(uocLuong, thap, cao, vung)}
      muc={muc}
      testId="bd-thuoc"
      chuGiai={
        <>
          <p className="bd-thuoc-so">
            Chênh lệch <strong>{soDau(uocLuong)}</strong>, khoảng tin cậy 95% từ <strong>{soDau(thap)}</strong> đến <strong>{soDau(cao)}</strong>
          </p>
          <ul className={`bd-vung-ds${gon ? " is-gon" : ""}`} data-testid="bd-thuoc-vung">
            {THU_TU_VUNG.map((v) => (
              <li key={v} className="bd-vung" aria-current={v === vung ? "true" : undefined} data-vung={v}>
                <span className="bd-vung-chu">
                  <BieuTuongVung vung={v} />
                  {KET_LUAN[v].chu}
                </span>
                {!gon || v === vung ? <span className="bd-vung-cau">{KET_LUAN[v].cau}</span> : null}
              </li>
            ))}
          </ul>
        </>
      }
    >
      <div ref={refVe}>
        <svg className="bd-svg" width={W} height={CAO} viewBox={`0 0 ${W} ${CAO}`} aria-hidden="true" focusable="false" data-testid="bd-thuoc-ve">
          <rect x={DEM.trai} y={20} width={Math.max(0, x0 - DEM.trai)} height={yTruc - 20} fill="var(--bd-vung-giu)" />
          <rect x={x0} y={20} width={Math.max(0, W - DEM.phai - x0)} height={yTruc - 20} fill="var(--bd-vung-doi)" />
          <text x={DEM.trai + 6} y={14} className={vung === "giu" ? "bd-chu-dam" : undefined}>
            {nhanVung("giu")}
          </text>
          <text x={W - DEM.phai - 6} y={14} textAnchor="end" className={vung === "doi" ? "bd-chu-dam" : undefined}>
            {nhanVung("doi")}
          </text>

          <line x1={DEM.trai} x2={W - DEM.phai} y1={yTruc} y2={yTruc} className="bd-truc" />
          {mien.vach.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={yTruc} y2={yTruc + 4} className="bd-truc" />
              <text x={x(v)} y={yTruc + 16} textAnchor="middle" className={v === 0 ? "bd-chu-dam" : "bd-chu-nhat"}>
                {soGon(v, 2)}
              </text>
            </g>
          ))}
          <line x1={x0} x2={x0} y1={20} y2={yTruc + 6} className="bd-vach-0" data-testid="bd-vach-0" />
          <text x={x0} y={yTruc + 32} textAnchor="middle" className={vung === "do_them" ? "bd-chu-dam" : undefined}>
            {nhanVung("do_them")}
          </text>

          {/* khoảng tin cậy và điểm ước lượng: một chuỗi, màu mực */}
          <line x1={xThap} x2={xCao} y1={yKhoang} y2={yKhoang} stroke="var(--bd-chu)" strokeWidth={6} strokeLinecap="round" data-testid="bd-thuoc-khoang" />
          <line x1={xThap} x2={xThap} y1={yKhoang - 9} y2={yKhoang + 9} stroke="var(--bd-chu)" strokeWidth={2} strokeLinecap="round" />
          <line x1={xCao} x2={xCao} y1={yKhoang - 9} y2={yKhoang + 9} stroke="var(--bd-chu)" strokeWidth={2} strokeLinecap="round" />
          <circle cx={xUoc} cy={yKhoang} r={7} fill="var(--bd-chu)" stroke="var(--bd-nen)" strokeWidth={2} data-testid="bd-thuoc-diem" />
          <text x={kep(xUoc, DEM.trai + 24, W - DEM.phai - 24)} y={yKhoang - 14} textAnchor="middle" className="bd-chu-dam">
            {soDau(uocLuong)}
          </text>
        </svg>
      </div>
    </KhungBieuDo>
  );
}

"use client";

import { useId, useMemo } from "react";
import { BieuTuongKhoa, BieuTuongVung, ChamTheoKhoi, ThanhYDinh, ThuocKhoangTinCay, TuXemDenMua, thuocTuBaoCao } from "@/components/bieu-do";
import { useDongThoiGian } from "@/components/dien-thoai/hooks";
import { AppShell, NhanCongBo, NhanNguon, NutLienKet, Th, chuNhanNguon } from "@/components/nen";
import { PHU_DE_KHOANG_TIN_CAY } from "@/lib/bieu-do/ket-luan";
import { coNguonDon } from "@/lib/bieu-do/pheu";
import { useDuLieuPhien } from "@/lib/livelift-api/hooks";
import { CHO_CANON, TU, nhanVaPhuDe } from "@/lib/tu-ngu";
import {
  VUNG_THEO_MA,
  chiTietNguoiKiem,
  demYDinhTuBaoCao,
  dieuChuaBiet,
  dongPhien,
  ketLuanTuBaoCao,
  maNhanTuNguon,
  tomTatPhien,
  type KetLuanTongKet,
} from "./noi-dung";
import "./tong-ket.css";

/**
 * Màn tổng kết của một phiên (kế hoạch 3.1 mục 4): thẻ kết luận ĐỔI / GIỮ / ĐO THÊM kèm thước khoảng tin cậy, ba biểu
 * đồ, rồi tóm tắt, điều chưa biết, lời người dẫn đã chép, nút lên lịch phiên tiếp và chi tiết cho người kiểm.
 *
 * Khoá §7: kết luận, thước và chấm theo khối đều đọc `khoa` của `useDuLieuPhien` (true trừ khi máy chủ nói rõ đã mở).
 */
export function TongKet({ sessionId }: { sessionId: string }) {
  const d = useDuLieuPhien(sessionId, 5000);
  const { phien, baoCao } = d;
  const ma = useMemo(() => maNhanTuNguon(d.nguon, phien), [d.nguon, phien]);
  const chuNhan = chuNhanNguon(ma);
  const ketLuan = ketLuanTuBaoCao(baoCao);
  const tomTat = tomTatPhien(baoCao);
  const demYDinh = demYDinhTuBaoCao(baoCao);
  const coYDinh = (demYDinh != null && Object.keys(demYDinh).length > 0) || d.binhLuan.some((c) => c.intent);
  const chuaBiet = baoCao ? dieuChuaBiet(ma, baoCao, coYDinh) : [];
  const chiTiet = chiTietNguoiKiem({ phien, baoCao, khoi: d.khoi, ticks: d.ticks, don: d.don });
  const loiDan = useDongThoiGian(phien?.platform === "lab" ? undefined : null).filter((x) => x.loi && x.loi.trim());
  const dong = dongPhien(phien, baoCao);
  const tieuDePhien = phien?.title || "Phiên LiveLift";

  if (!phien) {
    return (
      <AppShell tieuDe="Tổng kết" hienTai="phien">
        <div className="tk" data-testid="experiment-recap">
          {d.loi ? (
            <p className="tk-loi" role="alert" data-vung-chinh="">
              {d.loi}
            </p>
          ) : (
            <p className="tk-cho" role="status" data-vung-chinh="">
              Đang tải tổng kết…
            </p>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      tieuDe="Tổng kết"
      phuDe={tieuDePhien}
      nhanNguon={ma}
      live={d.dangLive}
      hienTai="phien"
      hanhDong={
        <NutLienKet bien="vien" href={`/phien/${sessionId}`}>
          Về {TU.banThiNghiem.chu}
        </NutLienKet>
      }
    >
      <div className="tk" data-testid="experiment-recap">
        {d.loi ? (
          <p className="tk-loi" role="alert">
            {d.loi}
          </p>
        ) : null}

        <TheKetLuan ketLuan={ketLuan} ma={ma} dong={dong} baoCaoThuoc={thuocTuBaoCao(baoCao)} />

        <div className="tk-luoi" data-testid="tong-ket-bieu-do">
          <div className="tk-o">
            <ChamTheoKhoi khoa={d.khoa} khoiDo={d.khoiDo} nhan={chuNhan} tieuDe="Từng khối" dangTai={d.dangTai && !d.khoiDo} muc={2} />
          </div>
          <div className="tk-o">
            <TuXemDenMua
              ticks={d.ticks}
              don={d.don}
              coNguonDon={coNguonDon(phien)}
              tenDon={phien.platform === "lab" ? "Đơn (tiền ảo)" : "Đơn"}
              tieuDe={CHO_CANON.pheu}
              nhan={chuNhan}
              muc={2}
            />
          </div>
          <div className="tk-o">
            <ThanhYDinh dem={demYDinh ?? undefined} binhLuan={demYDinh ? undefined : d.binhLuan} tieuDe="Khách nói gì" nhan={chuNhan} muc={2} />
          </div>
        </div>

        <div className="tk-duoi">
          {tomTat.length > 0 ? (
            <Th tieuDe="Tóm tắt" phuDe="Ba câu do máy soạn từ chính các số ở trên" nhanNguon={ma} className="tk-the" data-testid="recap-summary">
              <ol className="tk-tom-tat">
                {tomTat.map((c, i) => (
                  <li key={i}>
                    {c.huyHieu ? <span className="tk-huy-hieu">{c.huyHieu}</span> : null}
                    <span>{c.text}</span>
                  </li>
                ))}
              </ol>
            </Th>
          ) : null}

          {chuaBiet.length > 0 ? (
            <Th tieuDe="Điều chưa biết" phuDe="Nói thẳng giới hạn của kết quả này" className="tk-the" data-testid="tong-ket-chua-biet">
              <ul className="tk-chua-biet">
                {chuaBiet.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Th>
          ) : null}

          {loiDan.length > 0 ? (
            <Th tieuDe="Lời người dẫn đã chép" className="tk-the tk-rong" data-testid="tong-ket-loi-dan" hanhDong={<NhanCongBo ma="MAY_CHEP_LOI" kieu="phang" />}>
              <ol className="tk-loi-dan">
                {loiDan.slice(0, 8).map((x) => (
                  <li key={`${x.tu_s}-${x.den_s}`}>
                    <span className="tk-loi-dan-gio">{phutGiay(x.tu_s)}</span>
                    <span>{x.loi}</span>
                  </li>
                ))}
              </ol>
            </Th>
          ) : null}

          <section className="tk-tiep tk-rong" aria-label="Việc tiếp theo">
            <p className="tk-tiep-cau">
              {ketLuan.loai === "khoa"
                ? "Kết quả sẽ mở khi phiên kết thúc. Trong lúc chờ, có thể lên lịch phiên tiếp."
                : ketLuan.loai === "ket_luan" && ketLuan.ma === "DO_THEM"
                  ? "Chạy thêm một phiên cùng cách đo, rồi đọc kết quả gộp."
                  : "Một phiên chưa đủ để chốt. Lên lịch phiên tiếp theo cùng cách đo."}
            </p>
            <NutLienKet bien="chinh" href="/phien" data-testid="tong-ket-len-lich">
              Lên lịch phiên tiếp
            </NutLienKet>
          </section>

          <details className="tk-chi-tiet tk-rong" data-testid="tong-ket-chi-tiet">
            <summary>{CHO_CANON.chiTietNguoiKiem}</summary>
            <dl className="tk-dl">
              {chiTiet.map((r) => (
                <div key={r.nhan} className="tk-dl-dong">
                  <dt>{r.nhan}</dt>
                  <dd title={r.day}>{r.giaTri}</dd>
                </div>
              ))}
            </dl>
            <p className="tk-chu-nho">
              {nhanVaPhuDe(TU.khoangTinCay).nhan}: {TU.khoangTinCay.phu_de ?? PHU_DE_KHOANG_TIN_CAY}.{" "}
              {nhanVaPhuDe(TU.kiemDinh).nhan}: {TU.kiemDinh.phu_de ?? "bốc thăm lại lịch nhiều lần để xem chênh lệch đo được có lớn bất thường không"}.
            </p>
          </details>
        </div>
      </div>
    </AppShell>
  );
}

function phutGiay(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Thẻ kết luận: phần sẽ lên ảnh slide (data-chup="ket-luan"). */
function TheKetLuan({
  ketLuan,
  ma,
  dong,
  baoCaoThuoc,
}: {
  ketLuan: KetLuanTongKet;
  ma: ReturnType<typeof maNhanTuNguon>;
  dong: string | null;
  baoCaoThuoc: ReturnType<typeof thuocTuBaoCao>;
}) {
  const idTieuDe = useId();
  const loai = ketLuan.loai === "ket_luan" ? ketLuan.ma.toLowerCase() : ketLuan.loai;
  // Thước: khi chưa có ước lượng thì một câu thường thay cho lý do kỹ thuật của máy chủ.
  const thuoc = ketLuan.loai === "ket_luan" && !ketLuan.coUocLuong ? { ...baoCaoThuoc, lyDo: "Cần thêm khối đo được để vẽ khoảng tin cậy." } : baoCaoThuoc;
  return (
    <section className="tk-ket-luan" data-chup="ket-luan" data-vung-chinh="" data-loai={loai} aria-labelledby={idTieuDe}>
      <div className="tk-kl-trai">
        <div className="tk-kl-dau">
          <span data-testid="source-badge">
            <NhanNguon ma={ma} />
          </span>
          {dong ? <span className="tk-kl-dong">{dong}</span> : null}
        </div>
        <h2 id={idTieuDe} className="tk-kl-hoi">
          Có nên đổi sang cách ghim của LiveLift?
        </h2>
        <div className="tk-kl-chu" data-testid="verdict" data-kind={loai} role="status">
          {ketLuan.loai === "ket_luan" ? (
            <>
              <span className="tk-kl-bieu-tuong" aria-hidden="true">
                <BieuTuongVung vung={VUNG_THEO_MA[ketLuan.ma]} co={32} />
              </span>
              <strong>{ketLuan.chu}</strong>
            </>
          ) : ketLuan.loai === "khoa" ? (
            <>
              <span className="tk-kl-bieu-tuong" aria-hidden="true">
                <BieuTuongKhoa co={32} />
              </span>
              <strong className="tk-kl-chu-vua">Đang khoá</strong>
            </>
          ) : (
            <strong className="tk-kl-chu-vua">Đang đọc báo cáo…</strong>
          )}
        </div>
        {ketLuan.loai === "ket_luan" ? <p className="tk-kl-cau">{ketLuan.cau}</p> : ketLuan.loai === "khoa" ? <p className="tk-kl-cau">{ketLuan.lyDo}</p> : null}
      </div>
      <div className="tk-kl-phai" data-testid="estimate-card">
        <ThuocKhoangTinCay {...thuoc} gon muc={3} />
      </div>
    </section>
  );
}

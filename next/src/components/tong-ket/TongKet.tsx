"use client";

import { useId, useMemo } from "react";
import { BieuTuongKhoa, BieuTuongVung, ChamTheoKhoi, ThanhYDinh, ThuocKhoangTinCay, TuXemDenMua, thuocTuBaoCao } from "@/components/bieu-do";
import { useDongThoiGian } from "@/components/dien-thoai/hooks";
import { AppShell, NhanCongBo, NhanNguon, NutLienKet, Th, chuNhanNguon } from "@/components/nen";
import { coNguonDon } from "@/lib/bieu-do/pheu";
import { useDuLieuPhien } from "@/lib/livelift-api/hooks";
import { LOI_THUONG, TU, nhanVaPhuDe, type MaNhanNguon } from "@/lib/tu-ngu";
import {
  VUNG_THEO_MA,
  chiTietNguoiKiem,
  demYDinhTuBaoCao,
  dieuChuaBiet,
  dongPhien,
  ketLuanTuBaoCao,
  maNhanTuNguon,
  tenPhienHienThi,
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
  // Lời chép là của video người dẫn AI dùng chung, không theo phiên: chỉ hiện khi bản ghi phiên khai rõ phòng phát
  // đúng video đó (soát đợt 2 mục 63). Lõi chưa trả trường này nên hiện tại mục này ẩn.
  const loiDan = useDongThoiGian(phatVideoNguoiDanAI(phien) ? undefined : null).filter((x) => x.loi && x.loi.trim());
  const dong = dongPhien(phien, baoCao, d.dangLive);
  const tieuDePhien = tenPhienHienThi(phien?.title);
  // Chưa đủ khối (hoặc phiên quan sát): chấm từng khối thôi, không vẽ trung bình BẬT/TẮT (soát đợt 2 mục 1, 52).
  const anTrungBinh = ketLuan.loai === "quan_sat" || (ketLuan.loai === "ket_luan" && !ketLuan.coUocLuong);

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

        <TheKetLuan ketLuan={ketLuan} ma={ma} dong={dong} dangLive={d.dangLive} baoCaoThuoc={thuocTuBaoCao(baoCao)} />

        <div className="tk-luoi" data-testid="tong-ket-bieu-do">
          <div className="tk-o">
            <ChamTheoKhoi
              khoa={d.khoa}
              khoiDo={d.khoiDo}
              nhan={chuNhan}
              tieuDe="Từng khối"
              dangTai={d.dangTai && !d.khoiDo}
              muc={2}
              anTrungBinh={anTrungBinh}
            />
          </div>
          <div className="tk-o">
            <TuXemDenMua
              ticks={d.ticks}
              don={d.don}
              coNguonDon={coNguonDon(phien)}
              tenDon={phien.platform === "lab" ? "Đơn (tiền ảo)" : "Đơn"}
              tieuDe={LOI_THUONG.pheu}
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
            <p className="tk-tiep-cau">{cauViecTiep(ketLuan)}</p>
            {/* Chưa có màn tạo phiên (/phien/moi): nút không hứa "lên lịch", chỉ đưa về danh sách (soát đợt 2 mục 19, 56). */}
            <NutLienKet bien="chinh" href="/phien" data-testid="tong-ket-len-lich">
              Về danh sách phiên
            </NutLienKet>
          </section>

          <details className="tk-chi-tiet tk-rong" data-testid="tong-ket-chi-tiet">
            <summary>{LOI_THUONG.chiTietNguoiKiem}</summary>
            <dl className="tk-dl">
              {chiTiet.map((r) => (
                <div key={r.nhan} className="tk-dl-dong">
                  <dt>{r.nhan}</dt>
                  <dd title={r.day}>{r.giaTri}</dd>
                </div>
              ))}
            </dl>
            <p className="tk-chu-nho">
              {[TU.khoangTinCay, TU.kiemDinh]
                .map((tu) => nhanVaPhuDe(tu))
                .filter((x) => x.phuDe)
                .map((x) => `${x.nhan}: ${x.phuDe}.`)
                .join(" ")}
            </p>
          </details>
        </div>
      </div>
    </AppShell>
  );
}

/** Câu của phần "Việc tiếp theo": không lặp câu kết luận, không hứa việc màn này chưa làm được. */
function cauViecTiep(ketLuan: KetLuanTongKet): string {
  if (ketLuan.loai === "khoa") return "Kết quả sẽ mở khi phiên kết thúc.";
  if (ketLuan.loai === "quan_sat") return "Lần sau chạy phiên có bốc thăm BẬT/TẮT để đo được tác dụng của ghim.";
  if (ketLuan.loai === "ket_luan" && !ketLuan.coUocLuong) return "Phiên tới chạy từ 90 phút trở lên để có đủ khối đo được.";
  if (ketLuan.loai === "ket_luan" && ketLuan.ma === "DO_THEM") return "Chạy thêm một phiên cùng cách đo, rồi đọc kết quả gộp.";
  return "Lặp lại cách đo này ở phiên tới để kết quả chắc hơn.";
}

/** Video người dẫn AI phát trong phòng của phiên, nếu bản ghi phiên khai (trường `phong_xem.video_url`). */
function phatVideoNguoiDanAI(phien: unknown): boolean {
  const url = (phien as { phong_xem?: { video_url?: unknown } } | null)?.phong_xem?.video_url;
  return typeof url === "string" && url.endsWith("/xem/nguoi-dan-ai.mp4");
}

/** Dòng nói rõ phiên đang live mà kết quả đã hiện (chỉ MÔ PHỎNG được hiện sớm, D-027). */
function cauDangLive(ma: readonly MaNhanNguon[]): string {
  return ma.includes("MO_PHONG")
    ? "Phiên đang live: đây là MÔ PHỎNG nên kết quả hiện sớm. Số còn đổi tới hết phiên."
    : "Phiên đang live: số còn đổi tới hết phiên.";
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
  dangLive,
  baoCaoThuoc,
}: {
  ketLuan: KetLuanTongKet;
  ma: ReturnType<typeof maNhanTuNguon>;
  dong: string | null;
  dangLive: boolean;
  baoCaoThuoc: ReturnType<typeof thuocTuBaoCao>;
}) {
  const idTieuDe = useId();
  const loai = ketLuan.loai === "ket_luan" ? ketLuan.ma.toLowerCase() : ketLuan.loai;
  // Thước: khi chưa có ước lượng thì một câu thường thay cho lý do kỹ thuật của máy chủ. Phiên quan sát: không khoá,
  // không số, chỉ nói vì sao không có thước.
  const thuoc =
    ketLuan.loai === "quan_sat"
      ? { khoa: false, uocLuong: null, thap: null, cao: null, lyDo: "Phiên quan sát không bốc thăm nên không có khoảng tin cậy." }
      : ketLuan.loai === "ket_luan" && !ketLuan.coUocLuong
        ? { ...baoCaoThuoc, lyDo: "Cần thêm khối đo được để vẽ khoảng tin cậy." }
        : baoCaoThuoc;
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
          ) : ketLuan.loai === "quan_sat" ? (
            <strong className="tk-kl-chu-vua">Không có kết luận</strong>
          ) : (
            <strong className="tk-kl-chu-vua">Đang đọc báo cáo…</strong>
          )}
        </div>
        {ketLuan.loai === "ket_luan" || ketLuan.loai === "quan_sat" ? (
          <p className="tk-kl-cau">{ketLuan.cau}</p>
        ) : ketLuan.loai === "khoa" ? (
          <p className="tk-kl-cau">{ketLuan.lyDo}</p>
        ) : null}
        {dangLive && ketLuan.loai === "ket_luan" ? (
          <p className="tk-kl-cau tk-kl-som" data-testid="tong-ket-dang-live">
            {cauDangLive(ma)}
          </p>
        ) : null}
      </div>
      <div className="tk-kl-phai" data-testid="estimate-card">
        <ThuocKhoangTinCay {...thuoc} gon anVung muc={3} />
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DaiKhoi, NganBinhLuan, TheBayGio, TheDoiDau } from "@/components/ban";
import {
  cheDoGhim,
  conLaiPhien,
  daiKhoiBan,
  maNhanNguon,
  quyenSoSanh,
  tenNguonNgan,
  trangThaiBayGio,
} from "@/components/ban/logic";
import { DuongNho, DuongThoiGian } from "@/components/bieu-do";
import { thuocTuBaoCao } from "@/components/bieu-do/ThuocKhoangTinCay";
import { CoChe } from "@/components/co-che";
import { DienThoaiLive, DUONG_VIDEO_NGUOI_DAN, useDongThoiGian } from "@/components/dien-thoai";
import { AppShell, Hop, NganKeo, NutBam, OSo } from "@/components/nen";
import {
  CAU_MO_SOM_MO_PHONG,
  chanUocLuongKhiKhoa,
  choHienTyLeNhapTheoThoiGian,
  daMoKhoa,
  duongNhoTyLeNhap,
  quyenToNenKhoi,
  theoCuaSo,
} from "@/lib/bieu-do";
import { api, useExperimentDesk } from "@/lib/livelift-api/client";
import { estimateState, fmtFixed, fmtNum, funnel, mmss, roomPulse, sourceLabel, verdict } from "@/lib/livelift-api/desk";
import { chuanHoaChu, loiTiengViet } from "@/lib/livelift-api/gop";
import { LOI_THUONG, TU, type MaKetLuan } from "@/lib/tu-ngu";
import "@/components/ban/ban.css";
import { tenPhienHienThi } from "@/components/tong-ket/noi-dung";

const MA_KL: Record<"doi" | "giu" | "do_them", MaKetLuan> = { doi: "DOI", giu: "GIU", do_them: "DO_THEM" };

/** Có tệp video người dẫn AI chưa (V1 chưa xuất thì dùng hình vẽ tay, không gắn nhãn NGƯỜI DẪN AI). */
function useCoVideoNguoiDan(): string | undefined {
  const [src, setSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    let huy = false;
    fetch(DUONG_VIDEO_NGUOI_DAN, { method: "HEAD", cache: "no-store" })
      .then((r) => {
        const loai = r.headers.get("content-type") ?? "";
        if (!huy && r.ok && loai.startsWith("video/")) setSrc(DUONG_VIDEO_NGUOI_DAN);
      })
      .catch(() => undefined);
    return () => {
      huy = true;
    };
  }, []);
  return src;
}

/** Màn thấp (laptop có thanh trình duyệt, 1280×633): biểu đồ thấp hơn để vùng chính lọt màn đầu. */
function useManThap(): boolean {
  const [thap, setThap] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px) and (max-height: 700px)");
    const doi = (): void => setThap(mq.matches);
    doi();
    mq.addEventListener?.("change", doi);
    return () => mq.removeEventListener?.("change", doi);
  }, []);
  return thap;
}

/**
 * Bàn thí nghiệm /phien/[id], đọc từ API thật: cùng một màn cho phiên mô phỏng, dàn dựng và thật.
 * Thanh trên · hàng 1 dải khối · hàng 2 (vùng chính) ô số, "Bây giờ", đường thời gian, điện thoại · hàng 3 hai câu
 * trả lời cho cùng một câu hỏi · ngăn phải bình luận. Khoá §7 (D-027): không so BẬT với TẮT cho tới khi máy chủ mở
 * khoá. Chỉ MÔ PHỎNG được mở sớm. Phiên có người bấm (THẬT, THỬ NỘI BỘ, DÀN DỰNG) còn khoá thì không hiện chuỗi Tỷ lệ
 * nhấp theo thời gian ở bất kỳ đâu trên bàn: chỉ người xem và tổng lượt nhấp hợp lệ cả phiên.
 */
export function ExperimentDesk({ sessionId }: { sessionId: string }) {
  const { data, refresh } = useExperimentDesk(sessionId);
  const [dangGhim, setDangGhim] = useState(false);
  const [thongBao, setThongBao] = useState<string | null>(null);
  const [moCoChe, setMoCoChe] = useState(false);
  const [moPhong, setMoPhong] = useState(false);
  const [moKetThuc, setMoKetThuc] = useState(false);
  const manThap = useManThap();
  const srcVideo = useCoVideoNguoiDan();
  const dongThoiGian = useDongThoiGian(srcVideo ? undefined : null);
  const { session, state, blocks, ticks, comments, orders, report } = data;

  const suyRa = useMemo(() => {
    if (!session) return null;
    const nhan = sourceLabel(session, report?.binh_luan_tong_hop ?? 0);
    const dangLive = session.status === "live";
    const moKhoa = daMoKhoa(report);
    const baoCao = report ? chanUocLuongKhiKhoa(report) : null;
    const quyen = quyenSoSanh(nhan, dangLive, !moKhoa, quyenToNenKhoi(nhan, dangLive, !moKhoa));
    // D-027: hai lớp cùng phải cho phép (hàm chung của lib/bieu-do và quyền của bàn); một lớp nói khoá là khoá.
    const khoaChuoi = quyen.khoaChuoi || !choHienTyLeNhapTheoThoiGian(nhan, dangLive, !moKhoa);
    const uoc = estimateState(baoCao);
    const v = verdict(uoc);
    const thuoc = thuocTuBaoCao(baoCao);
    return {
      nhan,
      ma: maNhanNguon(nhan),
      dangLive,
      quyen: { ...quyen, khoaChuoi, toNen: quyen.toNen && !khoaChuoi },
      thuoc: uoc.kind === "not_enough" && !thuoc.khoa ? { ...thuoc, lyDo: "Cần thêm khối đo được để vẽ khoảng tin cậy." } : thuoc,
      // Chưa đủ khối cũng là ĐO THÊM (canon), câu đi kèm là LOI_THUONG.chuaDuKhoi.
      ketLuan: v.kind === "cho" ? null : uoc.kind === "estimate" || uoc.kind === "not_enough" ? MA_KL[v.kind] : null,
      cauChuaDuKhoi: uoc.kind === "not_enough" ? LOI_THUONG.chuaDuKhoi : null,
      cheDo: cheDoGhim(session, report?.loai_phien),
      duongNguoiXem: theoCuaSo(ticks, session.start_ts, 300).map((w) => w.nguoiXem),
      // Khoá §7: null khi còn khoá và nguồn không được mở sớm (mọi nguồn có người bấm).
      duongTyLeNhap: khoaChuoi ? null : duongNhoTyLeNhap(ticks, session, { khoa: !moKhoa, toNen: { cho: quyen.toNen } }),
    };
  }, [session, report, ticks]);

  if (!session || !state || !suyRa) {
    return (
      <AppShell thuGon tieuDe="Bàn thí nghiệm" hienTai="phien">
        <div className="ban">
          {data.error ? (
            <p className="ban-loi" role="alert">
              {data.error}
            </p>
          ) : (
            <p className="ban-phu">Đang tải phiên…</p>
          )}
        </div>
      </AppShell>
    );
  }

  const { nhan, ma, dangLive, quyen } = suyRa;
  const bayGio = trangThaiBayGio(session, state, blocks);
  const dai = daiKhoiBan(blocks, state.elapsed_s);
  const f = funnel(ticks, orders);
  const nguoiXemNay = ticks.length ? ticks[ticks.length - 1].viewers : null;
  const topCard = state.cards[0];
  const monGhim = state.pinned_product ? { ten: state.pinned_product.name, gia: state.pinned_product.price } : null;
  const conLai = conLaiPhien(session, state.elapsed_s);
  const phongDanDung = session.platform === "lab";
  // Nhịp phòng cắt cửa sổ 5 phút, gần trùng ranh giới khối: khi khoá chỉ tính theo người xem (D-027).
  const pulse = roomPulse(ticks, { chiNguoiXem: quyen.khoaChuoi });

  const ghim = async (): Promise<void> => {
    setDangGhim(true);
    setThongBao(null);
    try {
      await api.pin(sessionId, topCard?.product_id);
      setThongBao("Đã ghim qua hệ thống, có ghi nhật ký ghim.");
      refresh();
    } catch (e) {
      setThongBao(loiTiengViet(e, "Không ghim được."));
    } finally {
      setDangGhim(false);
    }
  };

  const ketThuc = async (): Promise<void> => {
    try {
      await api.end(sessionId);
      setMoKetThuc(false);
      setThongBao("Đã kết thúc phiên. Kết quả sẽ mở khi báo cáo tính xong.");
      refresh();
    } catch (e) {
      setMoKetThuc(false);
      setThongBao(loiTiengViet(e, "Không kết thúc được phiên."));
    }
  };

  const hanhDong = (
    <div className="ban-hanh-dong">
      <NutBam bien="vien" onClick={() => setMoPhong(true)}>
        Phòng xem
      </NutBam>
      {dangLive ? (
        <NutBam bien="phu" onClick={() => setMoKetThuc(true)}>
          Kết thúc phiên
        </NutBam>
      ) : null}
    </div>
  );

  return (
    <AppShell
      thuGon
      dem="khong"
      hienTai="phien"
      tieuDe={tenPhienHienThi(session.title)}
      phuDe={`Bàn thí nghiệm · ${suyRa.cheDo} · đã chạy ${mmss(state.elapsed_s)}`}
      nhanNguon={ma}
      live={dangLive}
      hanhDong={hanhDong}
    >
      <div className="ban" data-testid="experiment-desk">
        {data.error ? (
          <p className="ban-loi" role="alert">
            {data.error}
          </p>
        ) : null}

        <div className="ban-chinh">
          <section className="ban-the ban-hang1" aria-label="Lịch khối">
            <DaiKhoi o={dai} />
            <button
              type="button"
              className="ban-hoi"
              onClick={() => setMoCoChe(true)}
              aria-label="Ghim được đo thế nào?"
              title="Ghim được đo thế nào?"
            >
              ?
            </button>
          </section>

          <section className="ban-hang2" data-vung-chinh="" aria-label="Phiên lúc này">
            <div className="ban-so">
              <OSo
                nhan="Người xem"
                giaTri={nguoiXemNay == null ? null : fmtNum(nguoiXemNay, 0)}
                phuDe="lúc này"
                duongNho={
                  suyRa.duongNguoiXem.length > 1 ? (
                    <DuongNho giaTri={suyRa.duongNguoiXem} ten="Người xem theo 5 phút" mau="nguoiXem" rong={120} cao={16} />
                  ) : undefined
                }
              />
              <OSo nhan="Lượt nhấp hợp lệ" giaTri={fmtNum(f.clicks, 0)} phuDe="cả phiên" />
              {quyen.khoaChuoi ? (
                <OSo tu={TU.tyLeNhap} giaTri={null} chuTrong="Khoá" phuDe="tới hết phiên, để không ai so khối giữa chừng" />
              ) : (
                <OSo
                  tu={TU.tyLeNhap}
                  nhan="Tỷ lệ nhấp cả phiên"
                  giaTri={f.clickRate == null ? null : fmtNum(f.clickRate, 2)}
                  duongNho={
                    suyRa.duongTyLeNhap && suyRa.duongTyLeNhap.length > 1 ? (
                      <DuongNho
                        giaTri={suyRa.duongTyLeNhap}
                        ten="Tỷ lệ nhấp, tính trên 2 phút gần nhất"
                        mau="luotNhap"
                        rong={120}
                        cao={16}
                      />
                    ) : undefined
                  }
                />
              )}
              <OSo
                nhan="Thời gian còn lại"
                giaTri={dangLive ? mmss(conLai) : session.status === "ended" ? "Đã xong" : null}
                phuDe={`phiên ${session.planned_duration_min} phút`}
              />
            </div>

            <div className="ban-bay-gio-o">
              <TheBayGio
                bayGio={bayGio}
                sessionId={sessionId}
                monGhim={monGhim}
                dangGhim={dangGhim}
                onGhim={() => void ghim()}
                thongBao={thongBao}
              />
            </div>

            <div className="ban-the ban-bieu-do" data-khoa-chuoi={quyen.khoaChuoi ? "" : undefined}>
              {quyen.khoaChuoi ? (
                // D-027: phiên có người bấm còn khoá thì không đưa chuỗi Tỷ lệ nhấp nào vào biểu đồ, kể cả bảng thay ảnh.
                <section className="ban-nguoi-xem" aria-labelledby="ban-h-nguoi-xem" data-testid="ban-nguoi-xem-khoa">
                  <h2 id="ban-h-nguoi-xem" className="ban-the__tieu-de">
                    Người xem
                  </h2>
                  {ticks.length > 1 ? (
                    <DuongNho giaTri={ticks.map((t) => t.viewers)} ten="Người xem" mau="nguoiXem" rong={480} cao={manThap ? 72 : 112} />
                  ) : (
                    <p className="ban-phu">Chưa có số người xem.</p>
                  )}
                  <p className="ban-phu" data-testid="bd-dong-to-nen">
                    {quyen.dong ?? "Tỷ lệ nhấp theo thời gian mở khi hết phiên."}
                  </p>
                </section>
              ) : (
                <DuongThoiGian
                  ticks={ticks}
                  batDauTs={session.start_ts}
                  khoi={blocks}
                  toNenKhoi={quyen.toNen}
                  nguon={nhan}
                  dangLive={dangLive}
                  // Nhánh này chỉ chạy khi D-027 cho hiện chuỗi Tỷ lệ nhấp (MÔ PHỎNG hoặc máy chủ đã mở khoá).
                  khoa={false}
                  // Câu mở sớm của MÔ PHỎNG đã có ở hàng 3: dưới biểu đồ để trống cho vùng chính lọt màn đầu.
                  ghiChu=""
                  thoiLuongS={session.planned_duration_min * 60}
                  cao={manThap ? 80 : 136}
                  muc={2}
                  tieuDe="Người xem và Tỷ lệ nhấp"
                />
              )}
            </div>

            <div className="ban-dien-thoai">
              <DienThoaiLive
                src={srcVideo}
                laNguoiDanAI={!!srcVideo}
                dongThoiGian={dongThoiGian}
                ghim={bayGio.ghimDienThoai}
                binhLuan={comments.slice(-2).map((c) => ({ id: c.comment_id, noiDung: c.text }))}
                soNguoiXem={nguoiXemNay ?? undefined}
                nhanNguon={ma}
                dangLive={dangLive}
                tim={false}
                khoaNut
                nhanAria="Màn khách thấy lúc này"
              />
            </div>
          </section>

          <TheDoiDau
            goiY={topCard ? { tieuDe: chuanHoaChu(topCard.headline), lyDo: chuanHoaChu(topCard.rationale) } : null}
            ghiChuGoiY={state.cards_note ? chuanHoaChu(state.cards_note) : null}
            hienKetQua={quyen.hienKetQua}
            thuoc={suyRa.thuoc}
            ketLuan={suyRa.ketLuan}
            cauKetLuan={suyRa.cauChuaDuKhoi}
            nhanNguon={ma}
            conLaiS={dangLive && !quyen.hienKetQua ? conLai : null}
            quanSat={report?.loai_phien === "quan_sat"}
            dongMoSom={
              quyen.hienKetQua && dangLive
                ? nhan.kind === "mo_phong"
                  ? `${CAU_MO_SOM_MO_PHONG} Số còn đổi tới hết phiên.`
                  : `Phiên ${tenNguonNgan(nhan)} đang live: số còn đổi tới hết phiên.`
                : null
            }
          />
        </div>

        <aside className="ban-phai" aria-label="Bình luận và liên kết">
          <NganBinhLuan binhLuan={comments} />
          <section className="ban-the ban-nhip" aria-labelledby="ban-h-nhip" data-testid="room-pulse">
            <h2 id="ban-h-nhip" className="ban-the__tieu-de">
              Nhịp phòng
            </h2>
            <p className="ban-phu">So 5 phút vừa qua với chính phiên này. Chỉ để theo dõi, chưa phải kết luận.</p>
            {pulse.last && pulse.viewersBand ? (
              <dl className="ban-nhip__ds">
                <div>
                  <dt>Người xem</dt>
                  <dd>{fmtNum(pulse.last.viewers, 0)}</dd>
                  <dd className="ban-phu ban-nhip__dai">
                    5 phút gần nhất · thường từ {fmtNum(pulse.viewersBand[0], 0)} đến {fmtNum(pulse.viewersBand[1], 0)}
                  </dd>
                </div>
                {!quyen.khoaChuoi && pulse.clickBand ? (
                  <div>
                    <dt>Tỷ lệ nhấp</dt>
                    <dd>{fmtFixed(pulse.last.clickRate, 2)}</dd>
                    <dd className="ban-phu ban-nhip__dai">
                      {TU.tyLeNhap.phu_de ?? "lượt nhấp hợp lệ / 1.000 giây·người xem"} · 5 phút gần nhất · thường từ{" "}
                      {fmtFixed(pulse.clickBand[0], 2)} đến {fmtFixed(pulse.clickBand[1], 2)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <p className={pulse.alert ? "ban-canh-bao" : "ban-phu"}>{pulse.note}</p>
          </section>
          <nav className="ban-the ban-lien-ket" aria-label="Liên kết của phiên">
            <Link href={`/phien/${sessionId}/tong-ket`}>Tổng kết phiên</Link>
            <Link href={`/phien/${sessionId}/nguoi-dan`}>Màn người dẫn (người dẫn không thấy lịch)</Link>
            <p className="ban-phu" data-testid="desk-updated">
              {data.updatedAt ? `Cập nhật ${new Date(data.updatedAt).toLocaleTimeString("vi-VN")}` : "Chưa cập nhật"}
            </p>
          </nav>
        </aside>
      </div>

      <NganKeo mo={moCoChe} onDong={() => setMoCoChe(false)} tieuDe="Ghim được đo thế nào">
        <CoChe bienThe="ngan" the="h3" tieuDe={null} />
      </NganKeo>

      <NganKeo mo={moPhong} onDong={() => setMoPhong(false)} tieuDe="Phòng xem" moTa="Khách vào bằng điện thoại, mua bằng tiền ảo.">
        {phongDanDung ? (
          <div className="ban-phong">
            <p>
              Phòng xem có địa chỉ <strong>/xem/&lt;mã phòng&gt;</strong>. Hôm nay mã phòng do nhóm gửi riêng; màn tạo phiên sẽ
              hiện mã và mã QR.
            </p>
            <p className="ban-phu">Phòng không lưu thông tin cá nhân. Khách rút lui lúc nào cũng được.</p>
          </div>
        ) : (
          <p>
            {nhan.kind === "mo_phong"
              ? "Phiên này không có phòng xem: người xem do máy mô phỏng."
              : "Phiên này không có phòng xem: khách xem trên nền tảng livestream."}
          </p>
        )}
      </NganKeo>

      <Hop
        mo={moKetThuc}
        onDong={() => setMoKetThuc(false)}
        tieuDe="Kết thúc phiên?"
        moTa="Lịch khối dừng lại, máy thôi ghim. Hết phiên mới mở kết quả so BẬT với TẮT."
        nutXacNhan="Kết thúc phiên"
        nguyHiem
        onXacNhan={ketThuc}
      />
    </AppShell>
  );
}

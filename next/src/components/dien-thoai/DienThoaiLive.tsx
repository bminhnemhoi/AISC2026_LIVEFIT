"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { HinhMon, Icons, NguoiDanVeTay, timMon, useGiamChuyenDong } from "@/components/minh-hoa";
import { NhanCongBo, NhanNguon, useDaGan, type MaNhan } from "@/components/nen";
import { NHAN_CONG_BO_THEO_MA } from "@/lib/tu-ngu";
import { dinhDangGia, dinhDangNguoiXem, monDangNoi, nguonVideo, type DoanDongThoiGian } from "./dong-thoi-gian";
import { useCheDoAnhPoster } from "./hooks";
import { maNhanNguonTu } from "./nhan";
import "@/components/minh-hoa/minh-hoa.css";
import "./dien-thoai.css";

/**
 * Khung điện thoại live đứng thẳng 9:16 (mục 4 và 6.7 kế hoạch 3.1), dùng chung cho phòng xem, bàn thí nghiệm,
 * landing và /minh-hoa. Bố cục mượn cách sắp của live trên điện thoại (không lấy logo hay màu của nền tảng nào):
 * LIVE, số người xem, tim bay lên, bình luận chạy, thẻ ghim thẳng có nút "Xem ngay" / "Mua (tiền ảo)", nút giỏ hàng.
 *
 * Nhãn công bố (D-015): huy hiệu "NGƯỜI DẪN AI · GIỌNG TỔNG HỢP" (NhanCongBo của nền) và thuộc tính
 * `data-nguoi-dan-ai` hiện khi và chỉ khi khung đang thật sự hiện nội dung do AI tạo, tức `laNguoiDanAI` và một trong
 * hai: video người dẫn (`src`) đang được nạp, hoặc ảnh tĩnh dự phòng `anhDuPhong` (ảnh chụp từ chính video AI). Đã
 * hiện thì hiện liên tục, cả lúc tạm dừng. Khi chỉ có người dẫn vẽ tay (chưa có tệp, video lỗi mà không có ảnh dự
 * phòng, chế độ poster `cheDoPoster` hoặc `?anh-poster=1`) thì không có huy hiệu AI, không có `data-nguoi-dan-ai`,
 * thay bằng chip MINH HOẠ (render3.py của poster từ chối khi còn thuộc tính này).
 *
 * `toanMan`: bỏ viền máy, phủ đầy khung cha (phòng xem trên điện thoại thật: cha cao 100dvh). Cha không có chiều cao
 * thì khung giữ tỷ lệ 9:16 theo bề ngang. Mọi lớp phủ giữ nguyên.
 *
 * Hợp đồng chụp: thẻ ghim mang `data-chup="the-ghim"` (tắt bằng `chupTheGhim={false}` khi trang có hai khung cùng
 * ghim); nút "Mua (tiền ảo)" mang `data-nut-chinh`.
 */

export interface GhimDienThoai {
  ten: string;
  /** giá MINH HOẠ, đồng; null thì không hiện giá */
  gia?: number | null;
}

export interface BinhLuanDienThoai {
  id?: string | number;
  /** tên hiển thị đã che (không phải tên thật); bỏ trống thì không hiện */
  ten?: string;
  noiDung: string;
}

export interface DienThoaiLiveProps {
  /** video người dẫn: đường mp4 (ví dụ /xem/nguoi-dan-ai.mp4) hoặc đường YouTube; bỏ trống thì dùng hình dự phòng */
  src?: string;
  /** món người dẫn đang nói theo giây của video (MÁY CHÉP LỜI) */
  dongThoiGian?: readonly DoanDongThoiGian[];
  /** món đang ghim; null hoặc bỏ trống thì không có thẻ ghim (khối TẮT) */
  ghim?: GhimDienThoai | null;
  binhLuan?: readonly BinhLuanDienThoai[];
  soNguoiXem?: number;
  /** video (và ảnh dự phòng) là người dẫn do AI tạo: khung đang hiện chúng thì luôn có nhãn công bố */
  laNguoiDanAI?: boolean;
  /**
   * Chip nguồn ở góc trên, theo mã canon: "DAN_DUNG", "MO_PHONG", ["DAN_DUNG", "THU_NOI_BO"]...
   * Chuỗi chữ cũ ("DÀN DỰNG") vẫn nhận nếu trùng chữ canon; chữ ngoài canon bị bỏ.
   */
  nhanNguon?: MaNhan | string;
  /** chế độ chụp poster: không video, người dẫn vẽ tay */
  cheDoPoster?: boolean;
  /** ảnh tĩnh dự phòng khi video lỗi (ảnh chụp từ chính video người dẫn) */
  anhDuPhong?: string;
  /** bình luận tự chạy vòng (landing, minh hoạ); mặc định false: hiện 4 bình luận mới nhất */
  binhLuanTuChay?: boolean;
  /** tim bay lên; mặc định true */
  tim?: boolean;
  /** tự phát khi mở (tắt tiếng); mặc định true, trừ khi người dùng chọn giảm chuyển động */
  tuPhat?: boolean;
  /** số món trong giỏ; bỏ trống thì khung tự đếm số lần bấm "Mua (tiền ảo)" */
  soTrongGio?: number;
  /** khoá nút trên thẻ ghim (ví dụ chưa đồng ý tham gia) */
  khoaNut?: boolean;
  onXemNgay?: (ghim: GhimDienThoai) => void;
  onMua?: (ghim: GhimDienThoai) => void;
  onGioHang?: () => void;
  /** nhãn đọc của cả khung */
  nhanAria?: string;
  className?: string;
  /** thuộc tính để script chụp cắt ảnh theo vùng (gắn lên cả khung) */
  "data-chup"?: string;
  /** bỏ viền máy, phủ đầy khung cha (phòng xem trên điện thoại thật); mặc định false */
  toanMan?: boolean;
  /** gắn data-chup="the-ghim" lên thẻ ghim; mặc định true, tắt khi trang có hai khung cùng ghim */
  chupTheGhim?: boolean;
  /** phần tử thêm ở lớp phủ trên, ngay dưới hàng LIVE (ví dụ nút "Rút lui") */
  thanhPhanTren?: React.ReactNode;
  /** phần tử thêm ở đáy lớp phủ, dưới thẻ ghim (nút riêng của trang) */
  thanhPhanDuoi?: React.ReactNode;
  /** như thanhPhanDuoi (đặt sau nó) */
  children?: React.ReactNode;
}

const SO_BINH_LUAN = 4;
const MAU_TIM = ["#e2574c", "#f0a35e", "#ffffff", "#e889a8"];
const GOC_YOUTUBE = "https://www.youtube-nocookie.com";

function guiYoutube(khung: HTMLIFrameElement | null, func: string): void {
  khung?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), GOC_YOUTUBE);
}

export function DienThoaiLive({
  src,
  dongThoiGian,
  ghim = null,
  binhLuan = [],
  soNguoiXem,
  laNguoiDanAI = false,
  nhanNguon,
  cheDoPoster = false,
  anhDuPhong,
  binhLuanTuChay = false,
  tim = true,
  tuPhat = true,
  soTrongGio,
  khoaNut = false,
  onXemNgay,
  onMua,
  onGioHang,
  nhanAria = "Khung live của người dẫn",
  className,
  "data-chup": dataChup,
  toanMan = false,
  chupTheGhim = true,
  thanhPhanTren,
  thanhPhanDuoi,
  children,
}: DienThoaiLiveProps) {
  const daGan = useDaGan();
  const posterUrl = useCheDoAnhPoster();
  const poster = cheDoPoster || posterUrl;
  const giam = useGiamChuyenDong();
  const nguon = useMemo(() => nguonVideo(src, daGan ? window.location.origin : undefined), [src, daGan]);

  const [loiCua, setLoiCua] = useState<string | null>(null);
  const loi = !!src && loiCua === src;
  const coMedia = daGan && !poster && !!nguon && !loi;

  // tạm dừng: người dùng chọn; chưa chọn thì theo mặc định (giảm chuyển động hoặc tuPhat=false thì đứng yên)
  const [chon, setChon] = useState<boolean | null>(null);
  const tamDung = chon ?? (giam || !tuPhat);
  const [coTieng, setCoTieng] = useState(false);
  const [giay, setGiay] = useState(0);
  const [ngoaiManHinh, setNgoaiManHinh] = useState(false);

  const khung = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);

  // dừng video khi khung ra khỏi màn hình (tiết kiệm dữ liệu, bớt chuyển động)
  useEffect(() => {
    const el = khung.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((ds) => setNgoaiManHinh(!ds.some((d) => d.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dungThat = tamDung || ngoaiManHinh;

  useEffect(() => {
    if (!coMedia) return;
    if (nguon?.kieu === "video") {
      const v = video.current;
      if (!v) return;
      v.muted = !coTieng;
      if (dungThat) v.pause();
      else {
        const p = v.play();
        // trình duyệt chặn tự phát: coi như đang dừng, người xem bấm "Phát video"
        if (p && typeof p.catch === "function") p.catch(() => setChon(true));
      }
    } else if (nguon?.kieu === "youtube") {
      guiYoutube(iframe.current, dungThat ? "pauseVideo" : "playVideo");
      guiYoutube(iframe.current, coTieng ? "unMute" : "mute");
    }
  }, [coMedia, nguon, dungThat, coTieng]);

  // YouTube: nghe giây hiện tại qua tin nhắn của trình phát (enablejsapi=1) để biết người dẫn đang nói món nào
  useEffect(() => {
    if (!coMedia || nguon?.kieu !== "youtube") return;
    const nghe = (e: MessageEvent) => {
      if (e.origin !== GOC_YOUTUBE || e.source !== iframe.current?.contentWindow) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const t = d?.info?.currentTime;
        if (typeof t === "number" && Number.isFinite(t)) setGiay(t);
      } catch {
        /* tin nhắn không phải JSON của trình phát */
      }
    };
    window.addEventListener("message", nghe);
    return () => window.removeEventListener("message", nghe);
  }, [coMedia, nguon]);

  // tim bay lên: mỗi 0,9 giây một tim khi đang phát; giảm chuyển động thì không có tim bay
  const [tims, setTims] = useState<{ id: number; lech: number; mau: string }[]>([]);
  useEffect(() => {
    if (!tim || giam || dungThat || !daGan) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      const ma = Date.now() + n;
      setTims((ds) => [...ds.slice(-7), { id: ma, lech: (n * 7) % 24, mau: MAU_TIM[n % MAU_TIM.length] }]);
      window.setTimeout(() => setTims((ds) => ds.filter((t) => t.id !== ma)), 2600);
    }, 900);
    return () => window.clearInterval(id);
  }, [tim, giam, dungThat, daGan]);
  const timHien = tim && !giam && !dungThat ? tims : [];

  // bình luận chạy vòng (landing): dừng theo nút tạm dừng
  const [vong, setVong] = useState(0);
  const chayVong = binhLuanTuChay && binhLuan.length > SO_BINH_LUAN;
  useEffect(() => {
    if (!chayVong || dungThat) return;
    const id = window.setInterval(() => setVong((v) => v + 1), 2600);
    return () => window.clearInterval(id);
  }, [chayVong, dungThat]);
  const blHien = useMemo(() => {
    if (!chayVong) return binhLuan.slice(-SO_BINH_LUAN);
    const n = binhLuan.length;
    return Array.from({ length: SO_BINH_LUAN }, (_, i) => binhLuan[(vong + i) % n]);
  }, [binhLuan, chayVong, vong]);

  // giỏ hàng và "+1" sau khi bấm
  const [gioNoiBo, setGioNoiBo] = useState(0);
  const gio = soTrongGio ?? gioNoiBo;
  const [nhay, setNhay] = useState<number | null>(null);
  useEffect(() => {
    if (nhay === null) return;
    const id = window.setTimeout(() => setNhay(null), 900);
    return () => window.clearTimeout(id);
  }, [nhay]);

  const mon = coMedia ? monDangNoi(dongThoiGian, giay) : null;
  // ảnh tĩnh dự phòng: lúc chưa gắn (máy chủ), khi video lỗi hay khi không có src
  const hienAnh = !poster && !coMedia && !!anhDuPhong;
  const veTay = !coMedia && !hienAnh;
  // chỉ công bố người dẫn AI khi khung thật sự đang hiện video hay ảnh của người dẫn AI
  const ai = laNguoiDanAI && !poster && (coMedia || hienAnh);
  const monVe = timMon(ghim?.ten)?.ma ?? "ao-thun";
  const lop = ["dt", poster && "is-poster", toanMan && "is-toan-man", className].filter(Boolean).join(" ");
  const maNguon = maNhanNguonTu(nhanNguon);
  const themMinhHoa = veTay && !maNguon.includes("MINH_HOA");
  const coDuoiThem = thanhPhanDuoi != null || children != null;

  let media: React.ReactNode;
  if (coMedia && nguon?.kieu === "video") {
    media = (
      <video
        ref={video}
        className="dt-video"
        src={nguon.src}
        muted
        playsInline
        loop
        autoPlay={!dungThat}
        preload="metadata"
        poster={anhDuPhong}
        aria-label="Video người dẫn"
        onError={() => setLoiCua(src ?? null)}
        onTimeUpdate={(e) => setGiay(e.currentTarget.currentTime)}
      />
    );
  } else if (coMedia && nguon?.kieu === "youtube") {
    media = (
      <iframe
        ref={iframe}
        className="dt-video"
        src={nguon.src}
        title="Video người dẫn"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), GOC_YOUTUBE)}
      />
    );
  } else if (hienAnh) {
    // ảnh nền trang trí (alt rỗng); khung đã có nhãn đọc
    media = <img className="dt-video" src={anhDuPhong} alt="" />;
  } else {
    media = <NguoiDanVeTay className="dt-video dt-ve-tay" cam={monVe} />;
  }

  return (
    <div
      ref={khung}
      className={lop}
      role="region"
      aria-label={nhanAria}
      data-testid="dien-thoai-live"
      data-nguoi-dan-ai={ai ? "" : undefined}
      data-che-do={poster ? "poster" : coMedia ? (nguon?.kieu ?? "ve") : "du-phong"}
      data-toan-man={toanMan ? "" : undefined}
      data-chup={dataChup}
    >
      <div className="dt-man">
        <div className="dt-media">{media}</div>

        <div className="dt-dau">
          <div className="dt-tren">
            <span className="dt-live">
              <span className="dt-live-cham" aria-hidden="true" />
              LIVE
            </span>
            {soNguoiXem !== undefined && (
              <span className="dt-xem" aria-label={`${dinhDangNguoiXem(soNguoiXem)} người xem`}>
                <Icons.IconEye size={14} />
                <span aria-hidden="true">{dinhDangNguoiXem(soNguoiXem)}</span>
              </span>
            )}
            {(maNguon.length > 0 || themMinhHoa) && (
              <span className="dt-nhan">
                {maNguon.length > 0 && <NhanNguon ma={maNguon} tinh className="dt-nguon" />}
                {themMinhHoa && <NhanNguon ma="MINH_HOA" tinh className="dt-chip-minh-hoa" />}
              </span>
            )}
          </div>
          {ai && <NhanCongBo ma="NGUOI_DAN_AI" kieu="noi" className="dt-ai" />}
          {thanhPhanTren != null && <div className="dt-them-tren">{thanhPhanTren}</div>}
        </div>

        <div className="dt-tim" aria-hidden="true">
          {timHien.map((t) => (
            <span key={t.id} className="dt-tim-bay" style={{ right: `${t.lech}px`, color: t.mau }}>
              <Icons.IconTim size={22} />
            </span>
          ))}
        </div>

        <div className="dt-duoi">
          <div className="dt-giua">
            <div className="dt-trai">
              {mon && (
                <p className="dt-noi-ve">
                  <span className="dt-noi-ve-chu">
                    Người dẫn đang nói về: <b>{mon}</b>
                  </span>
                  <span className="dt-chip-chep" data-nhan-cong-bo="MAY_CHEP_LOI">{NHAN_CONG_BO_THEO_MA.MAY_CHEP_LOI.hien_thi}</span>
                </p>
              )}
              {blHien.length > 0 && (
                <ul className="dt-bl" aria-label="Bình luận">
                  {blHien.map((b, i) => (
                    <li key={`${b.id ?? i}-${chayVong ? vong + i : i}`} className="dt-bl-dong">
                      {b.ten && <b className="dt-bl-ten">{b.ten}</b>} {b.noiDung}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="dt-ray">
              {coMedia && (
                <>
                  <button type="button" className="dt-nut-tron" onClick={() => setChon(!dungThat)} aria-label={dungThat ? "Phát video" : "Tạm dừng video"}>
                    {dungThat ? <Icons.IconPlay size={22} /> : <Icons.IconPause size={22} />}
                  </button>
                  <button type="button" className="dt-nut-tron" onClick={() => setCoTieng((c) => !c)} aria-label={coTieng ? "Tắt tiếng" : "Bật tiếng"}>
                    {coTieng ? <Icons.IconBatTieng size={22} /> : <Icons.IconTatTieng size={22} />}
                  </button>
                </>
              )}
              <button type="button" className="dt-nut-tron dt-gio" onClick={() => onGioHang?.()} aria-label={`Giỏ hàng, ${gio} món`}>
                <Icons.IconGioHang size={22} />
                {gio > 0 && (
                  <span className="dt-gio-so" aria-hidden="true">
                    {gio > 99 ? "99+" : gio}
                  </span>
                )}
              </button>
            </div>
          </div>

          {ghim && (
            <div className="dt-ghim" data-testid="dien-thoai-ghim" data-chup={chupTheGhim ? "the-ghim" : undefined}>
              <div className="dt-ghim-mon">
                <span className="dt-ghim-anh" aria-hidden="true">
                  <HinhMon ten={ghim.ten} />
                </span>
                <span className="dt-ghim-chu">
                  <span className="dt-ghim-co">Đang ghim</span>
                  <b className="dt-ghim-ten">{ghim.ten}</b>
                  {ghim.gia != null && <span className="dt-ghim-gia">{dinhDangGia(ghim.gia)}</span>}
                </span>
              </div>
              <div className="dt-ghim-nut">
                <button
                  type="button"
                  className="dt-nut"
                  disabled={khoaNut}
                  onClick={() => {
                    setNhay(Date.now());
                    onXemNgay?.(ghim);
                  }}
                >
                  Xem ngay
                </button>
                <button
                  type="button"
                  className="dt-nut dt-nut-chinh"
                  data-nut-chinh=""
                  disabled={khoaNut}
                  onClick={() => {
                    if (soTrongGio === undefined) setGioNoiBo((n) => n + 1);
                    onMua?.(ghim);
                  }}
                >
                  Mua (tiền ảo)
                </button>
                {nhay !== null && (
                  <span key={nhay} className="dt-cong-mot" aria-hidden="true">
                    +1
                  </span>
                )}
              </div>
            </div>
          )}
          {coDuoiThem && (
            <div className="dt-them-duoi">
              {thanhPhanDuoi}
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

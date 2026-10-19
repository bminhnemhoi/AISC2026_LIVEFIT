"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { BieuTuongVung } from "@/components/bieu-do";
import { TrangThaiTrong } from "@/components/minh-hoa";
import { AppShell, Chip, NhanNguon, NutBam, NutLienKet, OSo, type ToneChip } from "@/components/nen";
import { daMoKhoa, vungCua, type VungKetLuan } from "@/lib/bieu-do";
import { api } from "@/lib/livelift-api/client";
import { sourceLabel } from "@/lib/livelift-api/desk";
import type { BaoCao, Session } from "@/lib/livelift-api/types";
import { loiTiengViet } from "@/lib/livelift-api/gop";
import { KET_LUAN_THEO_MA, LOI_THUONG, NHAN_NGUON_THEO_MA, TU, type MaKetLuan, type MaNhanNguon } from "@/lib/tu-ngu";
import "./phien-list.css";
import { tenPhienHienThi } from "@/components/tong-ket/noi-dung";

/**
 * Trang /phien: mọi phiên trên máy chủ LiveLift, kèm nhãn nguồn (THẬT / THỬ NỘI BỘ / DÀN DỰNG / MÔ PHỎNG) để một
 * phiên mẫu không bao giờ trông như kết quả thật. Kết luận ĐỔI / GIỮ / ĐO THÊM chỉ hiện khi máy chủ trả khoa=false;
 * phiên nào không phải MÔ PHỎNG mà đang live (THẬT, THỬ NỘI BỘ, DÀN DỰNG) thì luôn khoá ở đây, kể cả khi máy chủ lỡ
 * mở (khoá §7, lớp thứ hai, D-027). Lịch BẬT/TẮT của phiên còn khoá cũng không được tải về trình duyệt.
 */

const NHOM: Array<{ status: string; title: string }> = [
  { status: "live", title: "Đang live" },
  { status: "planned", title: "Đã lên lịch" },
  { status: "ended", title: "Đã xong" },
];

/**
 * Nhóm phiên theo trạng thái, mới nhất trước. `hangXong` (tuỳ chọn) xếp nhóm "Đã xong" theo kết luận trước rồi mới
 * tới giờ, để phiên ĐỔI không bị các phiên ĐO THÊM đẩy xuống dưới.
 */
export function groupSessions(
  sessions: Session[],
  hangXong?: (s: Session) => number,
): Array<{ title: string; status: string; items: Session[] }> {
  const byStart = (a: Session, b: Session): number => (b.start_ts ?? "").localeCompare(a.start_ts ?? "");
  const theoHang = (a: Session, b: Session): number => (hangXong ? hangXong(a) - hangXong(b) : 0) || byStart(a, b);
  return NHOM.map(g => ({
    title: g.title,
    status: g.status,
    items: sessions.filter(s => s.status === g.status).sort(g.status === "ended" ? theoHang : byStart),
  })).filter(g => g.items.length > 0);
}

/** Phiên đang live mà không phải MÔ PHỎNG: còn khoá §7 (D-027), không hiện kết luận, không tải lịch. */
export function conKhoaKhiLive(s: Pick<Session, "platform" | "is_demo" | "dry_run" | "status">): boolean {
  return s.status === "live" && maNhanPhien(s) !== "MO_PHONG";
}

/** Được tải lịch (để đếm khối) không: chỉ MÔ PHỎNG, hoặc phiên đã xong. Phiên còn khoá thì không tải lịch BẬT/TẮT. */
export function duocTaiLich(s: Pick<Session, "platform" | "is_demo" | "dry_run" | "status">): boolean {
  return s.status === "ended" || s.status === "cancelled" || maNhanPhien(s) === "MO_PHONG";
}

/** Mã nhãn nguồn canon của một phiên. Phiên tập dượt trên nền tảng thật (CHẠY THỬ) tính là THỬ NỘI BỘ. */
export function maNhanPhien(s: Pick<Session, "platform" | "is_demo" | "dry_run">): MaNhanNguon {
  const n = sourceLabel(s);
  switch (n.kind) {
    case "that":
      return "THAT";
    case "mo_phong":
      return "MO_PHONG";
    case "chay_thu":
      return "THU_NOI_BO";
    default:
      return n.text.includes("THỬ NỘI BỘ") ? "THU_NOI_BO" : "DAN_DUNG";
  }
}

const THU_TU_NHAN: readonly MaNhanNguon[] = ["THAT", "THU_NOI_BO", "DAN_DUNG", "MO_PHONG"];
/** Ô luôn hiện, kể cả khi bằng 0 (THẬT 0 là sự thật cần nói ra). DÀN DỰNG chỉ hiện khi có phiên. */
const LUON_HIEN: ReadonlySet<MaNhanNguon> = new Set<MaNhanNguon>(["THAT", "THU_NOI_BO", "MO_PHONG"]);

/** Tên lời thường của từng ô đếm. */
export const TEN_O_NHAN: Readonly<Partial<Record<MaNhanNguon, string>>> = {
  THAT: "Người bán thật",
  THU_NOI_BO: "Nhóm tự thử",
  DAN_DUNG: "Phòng xem có khách",
  MO_PHONG: "Do máy sinh",
};

export interface DemNhan {
  ma: MaNhanNguon;
  tong: number;
  live: number;
  xong: number;
}

/** Đếm phiên theo từng nhãn nguồn, tách riêng, không cộng gộp giữa các nhãn. */
export function demTheoNhan(sessions: readonly Session[]): DemNhan[] {
  const dem = new Map<MaNhanNguon, DemNhan>(THU_TU_NHAN.map(ma => [ma, { ma, tong: 0, live: 0, xong: 0 }]));
  for (const s of sessions) {
    const d = dem.get(maNhanPhien(s));
    if (!d) continue;
    d.tong += 1;
    if (s.status === "live") d.live += 1;
    if (s.status === "ended") d.xong += 1;
  }
  return THU_TU_NHAN.map(ma => dem.get(ma)!).filter(d => LUON_HIEN.has(d.ma) || d.tong > 0);
}

export type KetLuanHang =
  | { loai: "chua_phat" }
  | { loai: "dang_tai" }
  | { loai: "khoa" }
  | { loai: "quan_sat" }
  | { loai: "mo"; ma: MaKetLuan; thieuKhoi: boolean; somVi: string | null };

const MA_THEO_VUNG: Record<VungKetLuan, MaKetLuan> = { doi: "DOI", giu: "GIU", do_them: "DO_THEM" };
const VUNG_THEO_MA: Record<MaKetLuan, VungKetLuan> = { DOI: "doi", GIU: "giu", DO_THEM: "do_them" };

/**
 * Ô kết luận của một hàng. `baoCao` undefined: chưa tải; null: tải lỗi (coi là khoá).
 * Chỉ mở khi máy chủ nói rõ khoa=false; phiên đang live mà không phải MÔ PHỎNG thì khoá bất kể máy chủ.
 */
export function ketLuanPhien(s: Session, baoCao: BaoCao | null | undefined): KetLuanHang {
  if (s.status === "planned") return { loai: "chua_phat" };
  const ma = maNhanPhien(s);
  const dangLive = s.status === "live";
  if (conKhoaKhiLive(s)) return { loai: "khoa" };
  if (baoCao === undefined) return { loai: "dang_tai" };
  if (baoCao?.loai_phien === "quan_sat") return { loai: "quan_sat" };
  if (!baoCao || !daMoKhoa(baoCao)) return { loai: "khoa" };
  const k = baoCao.ket_qua_thi_nghiem!;
  const vung = k.estimable && k.ci_low != null && k.ci_high != null ? vungCua(k.ci_low, k.ci_high) : null;
  return {
    loai: "mo",
    ma: vung ? MA_THEO_VUNG[vung] : "DO_THEM",
    thieuKhoi: vung === null,
    somVi: dangLive ? NHAN_NGUON_THEO_MA[ma].hien_thi : null,
  };
}

/** "90 phút · 16 khối" (số khối đọc từ lịch đã niêm phong; chưa có lịch thì chỉ ghi phút). */
export function thoiLuongVaKhoi(phut: number, soKhoi: number | null | undefined): string {
  const p = `${phut.toLocaleString("vi-VN")} phút`;
  return soKhoi ? `${p} · ${soKhoi} khối` : p;
}

/** Sắc chung của ba kết luận (cùng bộ màu với trang giới thiệu): ĐỔI xanh BẬT, GIỮ mực, ĐO THÊM vàng. */
export const TONE_KET_LUAN: Readonly<Record<MaKetLuan, ToneChip>> = { DOI: "bat", GIU: "trung", DO_THEM: "vang" };

/** Câu rê chuột của chip kết luận. Thiếu khối thì không có khoảng tin cậy, nên dùng câu ĐO THÊM khi chưa đủ khối. */
export function cauChipKetLuan(ma: MaKetLuan, thieuKhoi: boolean): string {
  return thieuKhoi ? LOI_THUONG.chuaDuKhoi : KET_LUAN_THEO_MA[ma].cau;
}

/** Thứ tự trong nhóm "Đã xong": ĐỔI, GIỮ, ĐO THÊM, rồi phiên chưa có kết luận. */
export function hangKetLuan(kl: KetLuanHang): number {
  if (kl.loai !== "mo") return 3;
  return kl.ma === "DOI" ? 0 : kl.ma === "GIU" ? 1 : 2;
}

function when(ts: string | null | undefined): string {
  if (!ts) return "Chưa phát";
  const d = new Date(ts);
  const hai = (n: number): string => String(n).padStart(2, "0");
  return `${hai(d.getHours())}:${hai(d.getMinutes())} · ${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
}

interface ChiTiet {
  baoCao?: BaoCao | null;
  soKhoi?: number | null;
}

/** Báo cáo của phiên đang live được tải lại sau chừng này; phiên đã xong chỉ tải một lần (và khi đổi trạng thái). */
const LAI_BAO_CAO_MS = 25_000;

function IconKhoa() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function OKetLuan({ kl, dangLive }: { kl: KetLuanHang; dangLive: boolean }) {
  switch (kl.loai) {
    case "mo": {
      const k = KET_LUAN_THEO_MA[kl.ma];
      return (
        <div className="pl-kl" data-ket-luan={kl.ma}>
          <Chip
            tone={TONE_KET_LUAN[kl.ma]}
            bieuTuong={<BieuTuongVung vung={VUNG_THEO_MA[kl.ma]} co={16} />}
            title={cauChipKetLuan(kl.ma, kl.thieuKhoi)}
          >
            {k.chu}
          </Chip>
          {kl.thieuKhoi ? <span className="pl-phu">Chưa đủ khối để so BẬT với TẮT</span> : null}
          {kl.somVi ? <span className="pl-phu">Hiện sớm vì {kl.somVi}</span> : null}
        </div>
      );
    }
    case "khoa":
      return (
        <p className="pl-kl pl-kl--khoa" data-ket-luan="khoa">
          <IconKhoa />
          {dangLive ? "Đang khoá tới hết phiên" : "Chưa mở khoá"}
        </p>
      );
    case "quan_sat":
      return <p className="pl-kl pl-phu">Không bốc thăm, không có kết luận</p>;
    case "chua_phat":
      return <p className="pl-kl pl-phu">Chưa phát</p>;
    default:
      return <p className="pl-kl pl-phu">Đang tải</p>;
  }
}

function TrangThaiPhien({ status }: { status: string }) {
  if (status === "live") {
    return (
      <span className="nen-live" data-live="1">
        <span className="nen-live__cham" aria-hidden="true" />
        ĐANG LIVE
      </span>
    );
  }
  return <Chip tone="trung">{status === "ended" ? "Đã xong" : status === "planned" ? "Đã lên lịch" : "Đã huỷ"}</Chip>;
}

function HangPhien({ s, ct }: { s: Session; ct: ChiTiet | undefined }) {
  const ma = maNhanPhien(s);
  const kl = ketLuanPhien(s, ct?.baoCao);
  const dangLive = s.status === "live";
  return (
    <li className="pl-hang" data-trang-thai={s.status} data-nhan={ma}>
      <div className="pl-o pl-o--ten">
        <p className="pl-ten">{s.title ? tenPhienHienThi(s.title) : "Phiên không tên"}</p>
        <div className="pl-ten__phu">
          <NhanNguon ma={ma} />
          <span className="pl-gio">{when(s.start_ts)}</span>
        </div>
      </div>
      <div className="pl-o pl-o--tt">
        <span className="pl-o__nhan">Trạng thái</span>
        <div className="pl-o__gia-tri">
          <TrangThaiPhien status={s.status} />
          <span className="pl-phu">{thoiLuongVaKhoi(s.planned_duration_min, ct?.soKhoi)}</span>
        </div>
      </div>
      <div className="pl-o pl-o--kl">
        <span className="pl-o__nhan">Kết luận</span>
        <div className="pl-o__gia-tri">
          <OKetLuan kl={kl} dangLive={dangLive} />
        </div>
      </div>
      <div className="pl-o pl-o--nut">
        <NutLienKet href={`/phien/${s.session_id}`} bien="phu" cao={44}>
          Mở bàn thí nghiệm
        </NutLienKet>
        {s.status === "ended" ? (
          <NutLienKet href={`/phien/${s.session_id}/tong-ket`} bien="vien" cao={44}>
            Xem tổng kết
          </NutLienKet>
        ) : (
          <NutLienKet href={`/phien/${s.session_id}/nguoi-dan`} bien="vien" cao={44}>
            Màn người dẫn
          </NutLienKet>
        )}
      </div>
    </li>
  );
}

/** Chỗ chừa cho dòng "Cuộn để xem thêm …" dưới khung cuộn. */
const CAO_DONG_NHAC = 36;

/**
 * Chiều cao khung cuộn, cắt đúng ở mép dưới một hàng (không cắt đôi nút). `day` là mép dưới của từng hàng tính từ
 * đỉnh khung; lấy mép lớn nhất còn vừa, không vừa hàng nào thì giữ chiều cao thô.
 */
export function caoTheoHang(caoTho: number, day: readonly number[]): number {
  const vua = day.filter(d => d <= caoTho);
  return vua.length > 0 ? Math.ceil(Math.max(...vua)) + 1 : caoTho;
}

/**
 * Trên màn rộng, danh sách tự cuộn bên trong để cả khối nằm gọn trong màn đầu. Trả số phiên còn nằm dưới mép khung
 * (để hiện dòng nhắc cuộn và dải mờ).
 */
function useCaoToiDa(ref: RefObject<HTMLElement | null>, san: boolean): number {
  const [conDuoi, setConDuoi] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !san) return;
    const dem = (): void => {
      const day = el.getBoundingClientRect().bottom;
      const hang = el.querySelectorAll<HTMLElement>(".pl-hang:not(.pl-hang--dau)");
      let n = 0;
      hang.forEach(h => {
        if (h.getBoundingClientRect().bottom > day + 2) n += 1;
      });
      setConDuoi(n);
    };
    const tinh = (): void => {
      if (window.innerWidth < 1024) {
        el.style.removeProperty("--pl-cao-toi-da");
        setConDuoi(0);
        return;
      }
      const hop = el.getBoundingClientRect();
      const tren = hop.top + window.scrollY;
      const caoTho = Math.max(280, Math.floor(window.innerHeight - tren - 16 - CAO_DONG_NHAC));
      const goc = hop.top - el.scrollTop;
      const day = Array.from(el.querySelectorAll<HTMLElement>(".pl-hang:not(.pl-hang--dau)")).map(
        h => h.getBoundingClientRect().bottom - goc,
      );
      el.style.setProperty("--pl-cao-toi-da", `${caoTheoHang(caoTho, day)}px`);
      dem();
    };
    tinh();
    window.addEventListener("resize", tinh);
    el.addEventListener("scroll", dem, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(tinh);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("resize", tinh);
      el.removeEventListener("scroll", dem);
      ro?.disconnect();
    };
  }, [ref, san]);
  return conDuoi;
}

export function PhienList() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [chiTiet, setChiTiet] = useState<Record<string, ChiTiet>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const daLayBaoCao = useRef(new Map<string, { t: number; status: string }>());
  const daLayLich = useRef(new Set<string>());
  const refDs = useRef<HTMLElement | null>(null);

  const load = useCallback(() => {
    api
      .sessions()
      .then(s => {
        setSessions(s);
        setError(null);
      })
      .catch((e: unknown) => setError(loiTiengViet(e, "Máy chủ chưa trả lời.")));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // Số khối (lịch đã niêm phong, tải một lần) và kết luận (báo cáo đã qua khoá §7 của máy chủ).
  useEffect(() => {
    if (!sessions) return;
    const gan = (id: string, them: ChiTiet): void => setChiTiet(prev => ({ ...prev, [id]: { ...prev[id], ...them } }));
    const bay = Date.now();
    for (const s of sessions) {
      const id = s.session_id;
      if (!daLayLich.current.has(id) && duocTaiLich(s)) {
        daLayLich.current.add(id);
        api.schedule(id).then(
          b => gan(id, { soKhoi: b.length }),
          () => gan(id, { soKhoi: null }),
        );
      }
      if (s.status === "planned") continue;
      const truoc = daLayBaoCao.current.get(id);
      const can = !truoc || truoc.status !== s.status || (s.status === "live" && bay - truoc.t > LAI_BAO_CAO_MS);
      if (!can) continue;
      daLayBaoCao.current.set(id, { t: bay, status: s.status });
      api.baoCao(id).then(
        bc => gan(id, { baoCao: bc }),
        () => gan(id, { baoCao: null }),
      );
    }
  }, [sessions]);

  const seed = async (kind: "demo" | "vang"): Promise<void> => {
    setBusy(true);
    try {
      await (kind === "demo" ? api.seedDemo() : api.seedVang());
      load();
    } catch (e) {
      setError(loiTiengViet(e, "Không tạo được dữ liệu mẫu."));
    } finally {
      setBusy(false);
    }
  };

  const coPhien = !!sessions && sessions.length > 0;
  const conDuoi = useCaoToiDa(refDs, coPhien);
  const groups = groupSessions(sessions ?? [], s => hangKetLuan(ketLuanPhien(s, chiTiet[s.session_id]?.baoCao)));
  const dem = demTheoNhan(sessions ?? []);

  const nutMau = (
    <>
      <NutBam bien="vien" cao={44} disabled={busy} onClick={() => void seed("vang")}>
        Tạo bộ phiên mẫu
      </NutBam>
      <NutBam bien="vien" cao={44} disabled={busy} onClick={() => void seed("demo")}>
        Tạo phiên mẫu đang phát
      </NutBam>
    </>
  );

  return (
    <AppShell hienTai="phien" tieuDe={TU.danhSachPhien.chu} phuDe={LOI_THUONG.danhSachPhienPhuDe}>
      <div className="pl" data-testid="phien-list">
        {error ? (
          <div className="pl-loi" role="alert">
            <p>Không tải được danh sách phiên. {error}</p>
            <NutBam bien="vien" cao={44} onClick={load}>
              Thử lại
            </NutBam>
          </div>
        ) : null}

        {sessions === null && !error ? <p className="pl-cho">Đang tải danh sách phiên</p> : null}

        {coPhien ? (
          <section className="pl-dem" aria-label="Số phiên theo nhãn nguồn">
            {dem.map(d => (
              <OSo
                key={d.ma}
                className="pl-oso"
                nhan={TEN_O_NHAN[d.ma] ?? NHAN_NGUON_THEO_MA[d.ma].hien_thi}
                nhanNguon={d.ma}
                giaTri={d.tong.toLocaleString("vi-VN")}
                donVi="phiên"
                phuDe={`${d.live} đang live · ${d.xong} đã xong`}
              />
            ))}
          </section>
        ) : null}

        {sessions && sessions.length === 0 ? (
          <TrangThaiTrong
            tieuDe="Chưa có phiên nào"
            moTa="Tạo bộ phiên mẫu để xem thử cách LiveLift đo hiệu quả ghim. Phiên mẫu luôn mang nhãn MÔ PHỎNG."
          >
            {nutMau}
          </TrangThaiTrong>
        ) : null}

        {coPhien ? (
          <div className="pl-ds-boc" data-con-them={conDuoi > 0 ? "" : undefined}>
          <section ref={refDs} className="pl-ds" data-chup="danh-sach" data-vung-chinh="" aria-label="Danh sách phiên">
            <ul className="pl-luoi">
              <li className="pl-hang pl-hang--dau" aria-hidden="true">
                <span>Phiên</span>
                <span>Trạng thái</span>
                <span>Kết luận</span>
                <span />
              </li>
              {groups.map(g => (
                <li key={g.status} className="pl-nhom" data-nhom={g.status}>
                  <h2 className="pl-nhom__ten">
                    {g.title}
                    <span className="pl-nhom__so">{g.items.length}</span>
                  </h2>
                  <ul className="pl-luoi pl-luoi--con">
                    {g.items.map(s => (
                      <HangPhien key={s.session_id} s={s} ct={chiTiet[s.session_id]} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
          {conDuoi > 0 ? (
            <p className="pl-ds__nhac" aria-live="polite">
              Cuộn để xem thêm {conDuoi.toLocaleString("vi-VN")} phiên
            </p>
          ) : null}
          </div>
        ) : null}

        {coPhien ? (
          <section className="pl-mau" data-an-khi-chup="" aria-labelledby="pl-mau-tieu-de">
            <div className="pl-mau__chu">
              <h2 id="pl-mau-tieu-de" className="pl-mau__tieu-de">
                Dữ liệu mẫu
              </h2>
              <p className="pl-phu">Tạo thêm phiên MÔ PHỎNG để xem thử. Tạo phiên live ngay trên trang này: sắp có.</p>
            </div>
            <div className="pl-mau__nut">{nutMau}</div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

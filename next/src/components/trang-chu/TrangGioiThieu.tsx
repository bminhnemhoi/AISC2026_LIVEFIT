// Trang giới thiệu /gioi-thieu (U8, kế hoạch bản 3.1 mục 4). Trang tĩnh: không gọi máy chủ, không QR phòng xem.
// Thành phần máy chủ; các phần động (điện thoại, đồng xu, CoChe, số đếm, hiện dần) là đảo nhỏ phía trình duyệt.
import React from "react";
import { CoChe } from "@/components/co-che";
import { DienThoaiLive } from "@/components/dien-thoai";
import { Brand, DaiDongXu, DienThoaiBamLink } from "@/components/minh-hoa";
import { Chip, NhanNguon, NutLienKet } from "@/components/nen";
import { KET_LUAN } from "@/lib/tu-ngu";
import { DemSo } from "./DemSo";
import { XuatHien } from "./XuatHien";
import { HinhBan, HinhBocTham, HinhDoanCu, HinhVanDe } from "./hinh-trang-chu";
import {
  BA_MAN,
  CAU_DINH_VI,
  CAU_HOI_LON,
  DIEU_HUONG_TRANG,
  DOI,
  DONG_NHO_HERO,
  GHI_CHU_MO_PHONG,
  ID_CACH_DO,
  KET_QUA_MO_PHONG,
  MA_NGUON,
  NUT_CHINH,
  NUT_PHU,
  SO_SANH,
  SU_THAT,
  TIEU_DE_DAI_KHOI,
  VAN_DE,
} from "./noi-dung";
import "./trang-chu.css";

/** Món ghim trên điện thoại ở hero (bộ hàng D-025, giá MINH HOẠ). */
const GHIM_HERO = { ten: "Áo thun cotton basic", gia: 129000 };
const BINH_LUAN_HERO = [
  { id: 1, ten: "Lan", noiDung: "Áo còn cỡ M không ạ?" },
  { id: 2, ten: "Tú", noiDung: "Vải này mặc có mát không ạ?" },
  { id: 3, ten: "Hà", noiDung: "Lấy em 2 cái màu kem nha" },
];

function TieuDeMuc({ id, nho, children }: { id: string; nho?: string; children: React.ReactNode }) {
  return (
    <div className="tc-dau-muc">
      {nho && <p className="tc-nho">{nho}</p>}
      <h2 id={id} className="tc-h2">
        {children}
      </h2>
    </div>
  );
}

export function TrangGioiThieu(): React.ReactElement {
  return (
    <div className="tc">
      <header className="tc-dau">
        <div className="tc-dau-trong">
          <a className="tc-logo" href="#main-content" aria-label="LiveLift, về đầu trang">
            <span className="tc-logo-dau" aria-hidden="true">
              <Brand.PushPin />
            </span>
            LiveLift
          </a>
          <nav className="tc-nav" aria-label="Các phần của trang">
            {DIEU_HUONG_TRANG.map((m) => (
              <a key={m.href} href={m.href}>
                {m.chu}
              </a>
            ))}
          </nav>
          <NutLienKet href={NUT_CHINH.href} bien="vien" className="tc-dau-nut">
            Vào bản demo
          </NutLienKet>
        </div>
      </header>

      <main id="main-content" className="tc-main" data-testid="home-flow">
        {/* ---------- hero ---------- */}
        <section className="tc-hero" aria-labelledby="tc-h1" data-chup="hero" data-vung-chinh data-co-nhan>
          <div className="tc-hero-chu">
            <p className="tc-nho">{DONG_NHO_HERO}</p>
            <h1 id="tc-h1" className="tc-h1">
              {CAU_HOI_LON}
            </h1>
            <p className="tc-dinh-vi">{CAU_DINH_VI}</p>
            <div className="tc-nut-hang">
              <NutLienKet href={NUT_CHINH.href} bien="chinh">
                {NUT_CHINH.chu}
              </NutLienKet>
              <NutLienKet href={NUT_PHU.href} bien="vien" cao={48}>
                {NUT_PHU.chu}
              </NutLienKet>
            </div>
            <div className="tc-dai" data-chup="dai-khoi">
              <p className="tc-dai-tieu-de">{TIEU_DE_DAI_KHOI}</p>
              <DaiDongXu />
            </div>
          </div>
          <div className="tc-hero-dt">
            <DienThoaiLive
              cheDoPoster
              ghim={GHIM_HERO}
              binhLuan={BINH_LUAN_HERO}
              soNguoiXem={128}
              nhanNguon="MINH HOẠ"
              tim={false}
              tuPhat={false}
              nhanAria="Khung live minh hoạ: người dẫn vẽ tay, đang ghim áo thun"
            />
          </div>
        </section>

        {/* ---------- vấn đề ---------- */}
        <XuatHien className="tc-muc tc-van-de" data-co-nhan>
          <section aria-labelledby="van-de">
            <TieuDeMuc id="van-de" nho="Vì sao cần đo">
              {VAN_DE.tieuDe}
            </TieuDeMuc>
            <div className="tc-van-de-luoi">
              <div className="tc-the tc-van-de-hinh">
                <HinhVanDe />
                <div className="tc-chan-the">
                  <NhanNguon ma="MINH_HOA" />
                </div>
              </div>
              <div className="tc-van-de-chu">
                {VAN_DE.cau.map((c, i) => (
                  <p key={c} className={i === 1 ? "tc-cau-nhan" : undefined}>
                    {c}
                  </p>
                ))}
              </div>
            </div>
          </section>
        </XuatHien>

        {/* ---------- cách đo ---------- */}
        <XuatHien className="tc-muc tc-cach-do" id={ID_CACH_DO} data-co-nhan>
          <CoChe bienThe="trang" />
        </XuatHien>

        {/* ---------- đặt cạnh nhau ---------- */}
        <XuatHien className="tc-muc" data-co-nhan>
          <section aria-labelledby="so-sanh">
            <TieuDeMuc id="so-sanh">{SO_SANH.tieuDe}</TieuDeMuc>
            <div className="tc-hai-the">
              <article className="tc-the tc-so-sanh is-cu" aria-labelledby="so-sanh-cu">
                <div className="tc-the-dau">
                  <h3 id="so-sanh-cu" className="tc-h3">
                    {SO_SANH.trai.ten}
                  </h3>
                  <Chip tone="vang">{SO_SANH.trai.chip}</Chip>
                </div>
                <HinhDoanCu />
                <ul className="tc-ds">
                  {SO_SANH.trai.y.map((y) => (
                    <li key={y}>{y}</li>
                  ))}
                </ul>
              </article>
              <article className="tc-the tc-so-sanh is-moi" aria-labelledby="so-sanh-moi">
                <div className="tc-the-dau">
                  <h3 id="so-sanh-moi" className="tc-h3">
                    {SO_SANH.phai.ten}
                  </h3>
                  <Chip tone="bat">{SO_SANH.phai.chip}</Chip>
                </div>
                <HinhBocTham />
                <ul className="tc-ds">
                  {SO_SANH.phai.y.map((y) => (
                    <li key={y}>{y}</li>
                  ))}
                </ul>
              </article>
            </div>
            <div className="tc-chan-muc">
              <NhanNguon ma="MINH_HOA" />
            </div>
          </section>
        </XuatHien>

        {/* ---------- kết quả mô phỏng ---------- */}
        <XuatHien className="tc-muc" data-co-nhan>
          <section aria-labelledby="ket-qua">
            <TieuDeMuc id="ket-qua" nho="Kết quả trên mô phỏng">
              Phép đo có đáng tin không?
            </TieuDeMuc>
            <ul className="tc-ket-qua">
              {KET_QUA_MO_PHONG.map((k) => (
                <li key={k.id} className="tc-the tc-o-so" data-so-id={k.id}>
                  <div className="tc-o-so-dau">
                    <h3 className="tc-o-so-ten">{k.ten}</h3>
                    <NhanNguon ma={k.maNhan} canh="phai" />
                  </div>
                  <p className="tc-o-so-so">
                    <DemSo chu={k.hienThi} />
                  </p>
                  <p className="tc-o-so-y">{k.yNghia}</p>
                  <p className="tc-o-so-dk">{k.dieuKien}</p>
                </li>
              ))}
            </ul>
            <p className="tc-ghi-chu">{GHI_CHU_MO_PHONG}</p>
          </section>
        </XuatHien>

        {/* ---------- ba màn ---------- */}
        <XuatHien className="tc-muc" data-co-nhan>
          <section aria-labelledby="ba-man">
            <TieuDeMuc id="ba-man" nho="Người bán và người xem">
              Ba màn trong bản demo
            </TieuDeMuc>
            <ul className="tc-ba-man">
              {BA_MAN.map((m) => (
                <li key={m.ma} className="tc-the tc-man">
                  <div className="tc-man-hinh" aria-hidden="true">
                    {m.ma === "ban" && <HinhBan />}
                    {m.ma === "phong" && <DienThoaiBamLink className="tc-man-dt" />}
                    {m.ma === "tong-ket" && (
                      <div className="tc-man-kl">
                        {KET_LUAN.map((k) => (
                          <span key={k.id} className={`tc-kl tc-kl-${k.id.toLowerCase()}`}>
                            {k.chu}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <h3 className="tc-h3">{m.ten}</h3>
                  <p className="tc-man-cau">{m.cau}</p>
                  <NutLienKet href={m.lienKet.href} bien="phu" className="tc-man-nut">
                    {m.lienKet.chu}
                  </NutLienKet>
                </li>
              ))}
            </ul>
            <div className="tc-chan-muc">
              <NhanNguon ma="MINH_HOA" />
            </div>
          </section>
        </XuatHien>

        {/* ---------- sự thật hôm nay ---------- */}
        <XuatHien className="tc-muc" data-co-nhan>
          <section className="tc-the tc-su-that" aria-labelledby="su-that" data-testid="truth-panel">
            <TieuDeMuc id="su-that" nho="Nói thẳng">
              Sự thật hôm nay
            </TieuDeMuc>
            <ul className="tc-su-that-ds">
              {SU_THAT.map((s) => (
                <li key={s.chu} className="tc-su-that-o">
                  {s.so !== undefined && <span className="tc-su-that-so">{s.so}</span>}
                  <span className="tc-su-that-chu">{s.chu}</span>
                  <NhanNguon ma={s.maNhan} />
                </li>
              ))}
            </ul>
          </section>
        </XuatHien>

        {/* ---------- lời mời cuối ---------- */}
        <section className="tc-muc tc-cuoi" aria-labelledby="tc-cuoi">
          <h2 id="tc-cuoi" className="tc-h2">
            Xem một phiên mô phỏng chạy ngay trên máy
          </h2>
          <NutLienKet href={NUT_CHINH.href} bien="chinh">
            {NUT_CHINH.chu}
          </NutLienKet>
        </section>
      </main>

      <footer className="tc-chan" data-co-nhan="ma">
        <p>{DOI}</p>
        <a href={MA_NGUON.href} target="_blank" rel="noopener noreferrer">
          {MA_NGUON.chu}
        </a>
      </footer>
    </div>
  );
}

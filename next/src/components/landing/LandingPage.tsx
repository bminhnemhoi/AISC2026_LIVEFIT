"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CardHoodie, CardTote, HostPhone, InkArrow, PushPin, RingLight } from "../livedesk/brand";
import { LogoMark, WordmarkText } from "../livedesk/LogoMark";
import "../livedesk/calm.css";
import { SignalAtlas } from "./SignalAtlas";
import "./landing.css";

const story = [
  { title: "Cả phòng đang nói. Bạn cần nghe đúng điều.", text: "Hỏi giá, hỏi size, muốn chốt đơn. Khi bình luận chạy liên tục, điều khó nhất là nhận ra khách đang quan tâm sản phẩm nào.", note: "Từ bình luận tiếng Việt", label: "Đọc tín hiệu" },
  { title: "Một gợi ý rõ ràng. Có lý do đi kèm.", text: "LiveLift gom tín hiệu bình luận và giỏ hàng để đề xuất sản phẩm nên ghim. Bạn nhìn thấy nguồn, cỡ mẫu và độ tin cậy trước khi quyết định.", note: "Người vận hành giữ quyền quyết định", label: "Chọn hành động" },
  { title: "Kết thúc phiên. Bắt đầu hiểu điều gì hiệu quả.", text: "Ghi lại thao tác, xem lại diễn biến và đọc bằng chứng. Với phiên thí nghiệm, so sánh các khoảng BẬT/TẮT để đánh giá tác động của chiến lược ghim.", note: "Chưa đủ dữ liệu thì chưa kết luận", label: "Học từ bằng chứng" },
];

const faqs = [
  ["LiveLift dành cho ai?", "Nhà bán và đội vận hành livestream muốn có cơ sở khi chọn sản phẩm để ghim. Người trợ live theo dõi tín hiệu và gợi ý; người dẫn có màn hình riêng để tập trung vào buổi phát."],
  ["Tôi có thể thử ngay những gì?", "Bạn có thể mở bản demo LiveDesk, kết nối SIMULATED Live, dùng bộ sản phẩm mẫu hoặc nhập CSV, chạy một phiên và xem tổng kết. Demo chạy trong trình duyệt với nền tảng và người xem mô phỏng."],
  ["LiveLift đã kết nối TikTok Shop để tự ghim chưa?", "Bản demo trên trang này dùng SIMULATED Live. Đăng nhập TikTok không đồng nghĩa với quyền điều khiển LIVE hay TikTok Shop. Việc ghim trên nền tảng thật còn phụ thuộc API, quyền truy cập và xác nhận của nền tảng."],
  ["Gợi ý ghim có chứng minh doanh thu sẽ tăng không?", "Không. Gợi ý là hỗ trợ vận hành dựa trên tín hiệu đang có. Để đánh giá tác động cần một phiên thí nghiệm hợp lệ và đủ dữ liệu. Chỉ số chính của lõi thí nghiệm là lượt nhấp hợp lệ trên thời gian xem; đơn hàng là chỉ số phụ."],
  ["Nếu kết quả chưa rõ thì sao?", "LiveLift hiển thị mức độ bất định và có thể từ chối trả kết luận khi thiếu điều kiện. Chưa phát hiện tác động không đồng nghĩa với không có tác động. Bạn có cơ sở để quyết định giữ, đổi hay đo thêm."],
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <i className={diagonal ? "ri-arrow-right-up-line" : "ri-arrow-right-line"} aria-hidden="true" />;
}

function Preview() {
  const [view, setView] = useState(0);
  const labels = ["Gợi ý ghim", "Bằng chứng", "Nhật ký phiên"];
  return (
    <div className="lp-preview">
      <div className="lp-windowbar"><span><span className="lp-status-dot" /> LiveDesk</span><span className="lp-sim">Phiên minh họa · SIMULATED</span><span className="lp-window-time">00:24:08</span></div>
      <div className="lp-preview-body">
        <aside className="lp-product-list"><p>Sản phẩm trong phiên</p><div className="lp-product-selected"><CardHoodie /><span>Áo hoodie<br /><small>Đang được quan tâm</small></span><i className="ri-pushpin-2-line" aria-hidden="true" /></div><div><CardTote /><span>Túi tote<br /><small>Sẵn sàng trong giỏ</small></span></div><div className="lp-mini-note"><i className="ri-information-line" aria-hidden="true" /> Mọi tín hiệu bên phải đều là dữ liệu minh họa.</div></aside>
        <div className="lp-preview-main">
          <div className="lp-view-switch" role="group" aria-label="Khám phá bản xem trước">{labels.map((label, i) => <button key={label} type="button" aria-pressed={view === i} onClick={() => setView(i)}>{label}</button>)}</div>
          <div className="lp-preview-content" key={view} aria-live="polite">
            {view === 0 ? <><p className="lp-preview-eyebrow">Gợi ý hiện tại · Chưa thực hiện</p><h3>Cân nhắc ghim áo hoodie.</h3><p>Khách đang hỏi giá và size áo hoodie. Đây là sản phẩm đáng đưa trở lại tâm điểm.</p><div className="lp-signal-row"><span><b>29</b> tín hiệu minh họa</span><span><b>2 phút</b> gần nhất</span><span><b>Trung bình</b> độ tin cậy</span></div><Link href="/start" className="btn btn-primary btn-md">Thử thao tác trong demo <Arrow /></Link></> : view === 1 ? <><p className="lp-preview-eyebrow">Điều gì đứng sau gợi ý?</p><h3>Thấy cả lý do lẫn giới hạn.</h3><p>Cỡ mẫu, khoảng thời gian, nguồn quyết định và độ tin cậy luôn đi cùng gợi ý.</p><dl className="lp-evidence-list"><div><dt>Nguồn</dt><dd>Luật gợi ý · Dữ liệu mô phỏng</dd></div><div><dt>Tín hiệu</dt><dd>Hỏi giá, hỏi size sản phẩm</dd></div><div><dt>Giới hạn</dt><dd>Chưa phải bằng chứng nhân quả</dd></div></dl></> : <><p className="lp-preview-eyebrow">Một phiên có thể nhìn lại</p><h3>Mỗi thao tác đều có dấu vết.</h3><ol className="lp-activity"><li><time>00:22</time><span>Ghi nhận tín hiệu hỏi size áo hoodie</span></li><li><time>00:23</time><span>Đề xuất ghim · Chờ người vận hành</span></li><li><time>00:24</time><span>Bạn quyết định bước tiếp theo</span></li></ol><p className="lp-small">Nhật ký này minh họa cách sản phẩm tổ chức một phiên.</p></>}
          </div>
        </div>
      </div>
      <div className="lp-preview-footer"><span><i className="ri-shield-check-line" aria-hidden="true" /> Gợi ý có nguồn. Thao tác có người quyết định.</span><span>Minh họa giao diện</span></div>
    </div>
  );
}

function ScrollStory() {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const visibility = new Map<Element, number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0));
      const visible = [...visibility].sort((a, b) => b[1] - a[1])[0];
      if (visible?.[1] > 0) setActive(Number((visible[0] as HTMLElement).dataset.scene));
    }, { rootMargin: "-25% 0px -30% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] });
    root.current?.querySelectorAll("[data-scene]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="lp-story" ref={root}>
      <div className={`lp-story-visual lp-scene-${active}`} aria-hidden="true">
        <div className="lp-scene-top"><span className="lp-status-dot" /> Một phiên, nhiều điều để hiểu <span>0{active + 1} / 03</span></div>
        <div className="lp-morph-object"><CardHoodie /></div>
        <div className="lp-morph-chat"><span>Áo này còn size M không?</span><span>Cho mình xin giá hoodie</span><span>Màu này xinh quá shop ơi</span><span>Có túi tote không ạ?</span></div>
        <div className="lp-morph-suggestion"><PushPin /><span>Gợi ý tiếp theo</span><strong>Áo hoodie</strong><p>29 tín hiệu · Tin cậy trung bình</p><span className="lp-morph-tag">Bạn quyết định ghim</span></div>
        <div className="lp-morph-result"><span>Đọc bằng chứng</span><strong>Đo rồi mới biết.</strong><p>So sánh BẬT / TẮT<br />Khoảng tin cậy 95%</p></div>
        <svg className="lp-morph-chart" viewBox="0 0 440 130" fill="none"><path className="lp-chart-grid" d="M0 35H440 M0 75H440 M0 115H440" /><path className="lp-morph-line" /></svg>
        <div className="lp-scene-bottom"><span>{story[active].label}</span><span className="lp-sim">Dữ liệu minh họa</span></div>
      </div>
      <div className="lp-story-copy">{story.map((scene, i) => <article key={scene.title} data-scene={i}><span className="lp-step-index">0{i + 1}</span><h3>{scene.title}</h3><p>{scene.text}</p><span className="lp-scene-note"><i className="ri-check-line" aria-hidden="true" />{scene.note}</span></article>)}</div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="ld lp" lang="vi" data-theme="light">
      <div className="lp-scroll-progress" aria-hidden="true" />
      <header className="lp-header">
        <Link href="/" className="wordmark" aria-label="LiveLift — Trang giới thiệu"><LogoMark /><WordmarkText /></Link>
        <nav className="lp-desktop-nav" aria-label="Điều hướng giới thiệu"><a href="#trai-nghiem">Sản phẩm</a><a href="#cach-hoat-dong">Cách hoạt động</a><a href="#bang-chung">Bằng chứng</a></nav>
        <Link href="/home" className="lp-header-cta">Mở LiveLift <Arrow diagonal /></Link>
        <details className="lp-mobile-menu"><summary aria-label="Mở điều hướng"><i className="ri-menu-line" aria-hidden="true" /></summary><nav aria-label="Điều hướng di động" onClick={(event) => { if (event.target instanceof HTMLAnchorElement) event.currentTarget.closest("details")?.removeAttribute("open"); }}><a href="#trai-nghiem">Sản phẩm</a><a href="#cach-hoat-dong">Cách hoạt động</a><a href="#bang-chung">Bằng chứng</a><a href="#cau-hoi">Câu hỏi thường gặp</a></nav></details>
      </header>
      <main id="main-content">
        <section className="lp-hero lp-container" aria-labelledby="lp-title">
          <div className="lp-hero-copy"><p className="lp-intro"><span className="lp-status-dot" /> Trợ lý cho người đứng sau buổi live</p><h1 id="lp-title">Mỗi lần ghim.<br />Một quyết định<br />có cơ sở.</h1><p className="lp-lede">Bình luận thành tín hiệu. Tín hiệu thành gợi ý.<br className="lp-wide-break" /> LiveLift giúp bạn biết nên ghim gì, vì sao —<br className="lp-wide-break" /> và sau phiên, điều gì thật sự hiệu quả.</p><div className="lp-actions"><Link href="/start" className="btn btn-primary btn-lg">Trải nghiệm bản demo <Arrow diagonal /></Link><a href="#trai-nghiem" className="lp-text-link"><span className="lp-play"><i className="ri-play-mini-fill" aria-hidden="true" /></span>Khám phá LiveLift</a></div><p className="lp-fine">Thử ngay trong trình duyệt · Người xem và nền tảng mô phỏng</p></div>
          <div className="lp-hero-art" aria-label="Minh họa bàn trợ lý LiveLift: bình luận được gom thành gợi ý ghim áo hoodie">
            <div className="lp-art-orbit" /><div className="lp-art-orbit lp-orbit-two" /><span className="lp-art-cross lp-cross-one">+</span><span className="lp-art-cross lp-cross-two">+</span><span className="lp-art-caption">Một buổi live. Thêm một góc nhìn.</span>
            <RingLight className="lp-art-light" /><HostPhone className="lp-art-phone" />
            <div className="lp-art-chat"><span className="lp-status-dot" /><span>“Áo này còn size M không?”</span></div>
            <div className="lp-art-recommend"><span className="lp-paper-tape" /><div className="lp-art-recommend-top"><span>Gợi ý tiếp theo</span><span className="lp-sim">Minh họa</span></div><div className="lp-art-product"><CardHoodie /><div><strong>Đưa hoodie<br />vào tâm điểm.</strong><p>Khách đang hỏi giá & size</p></div></div><div className="lp-art-recommend-bottom"><span><i className="ri-pushpin-2-line" aria-hidden="true" /> Bạn quyết định</span><span>Có lý do đi kèm</span></div></div>
            <InkArrow className="lp-art-arrow" /><span className="lp-art-handnote">Đúng tín hiệu.<br />Rõ lý do.</span><div className="lp-art-ruler" aria-hidden="true" />
          </div>
          <div className="lp-hero-bottom"><span>Dành cho nhà bán, người trợ live<br />và đội vận hành livestream.</span><a href="#cau-chuyen">Cuộn để nhìn rõ hơn <i className="ri-arrow-down-line" aria-hidden="true" /></a><span className="lp-hero-edition">LiveLift / AISC 2026</span></div>
        </section>
        <section className="lp-problem" id="cau-chuyen" aria-labelledby="problem-title"><div className="lp-container lp-problem-grid"><p className="lp-section-label">Bạn đang live.<br />Mọi thứ đang chạy.</p><div><h2 id="problem-title">Bình luận trôi rất nhanh.<br />Quyết định cần đi đúng hướng.</h2><p>Giữa hàng trăm lời hỏi, một giỏ sản phẩm và áp lực giữ nhịp phòng, bạn vẫn phải chọn: ghim món nào tiếp theo? LiveLift tạo thêm một góc nhìn để bạn quyết định bằng tín hiệu đang có.</p></div><div className="lp-problem-stamp"><i className="ri-focus-3-line" aria-hidden="true" /><span>Giữ nhịp live.<br />Hiểu nhịp khách.</span></div></div><div className="lp-container"><SignalAtlas /></div></section>
        <section className="lp-container lp-section" id="cach-hoat-dong" aria-labelledby="story-title"><div className="lp-section-heading"><p className="lp-section-label">Từ hỗn độn đến rõ ràng</p><h2 id="story-title">Một người trợ lý.<br />Theo trọn nhịp phiên live.</h2><p>Đọc điều khách cần. Đưa ra gợi ý có cơ sở.<br />Giữ lại bài học cho phiên tiếp theo.</p></div><ScrollStory /></section>
        <section className="lp-demo-section" id="trai-nghiem" aria-labelledby="preview-title"><div className="lp-container"><div className="lp-demo-heading"><div><p className="lp-section-label">Đặt mình vào ghế người trợ live</p><h2 id="preview-title">Ít phải đoán hơn.<br />Thấy rõ điều cần làm.</h2></div><p>Một gợi ý ở trung tâm, bằng chứng ngay bên cạnh.<br />Chọn từng mục bên dưới để khám phá.</p></div><Preview /><div className="lp-demo-caption"><span>Bản xem trước tương tác · Số liệu chỉ để minh họa</span><Link href="/start">Vào bản demo đầy đủ <Arrow /></Link></div></div></section>
        <section className="lp-container lp-section lp-method lp-method-technical" id="bang-chung" aria-labelledby="method-title"><div className="lp-method-copy"><p className="lp-section-label">Gợi ý là khởi đầu. Bằng chứng là bước tiếp.</p><h2 id="method-title">Lượt bấm tăng.<br />Có thật là nhờ<br />lần ghim đó?</h2><p>Có thể do ghim sản phẩm. Cũng có thể đúng lúc phòng đông hơn. Chỉ nhìn một biểu đồ đi lên thì chưa đủ để biết.</p><p>LiveLift có lõi thí nghiệm <strong>switchback</strong>: chia thời gian thành các khối BẬT/TẮT, bốc thăm lịch trước phiên rồi so sánh kết quả sau phiên.</p><Link href="/phien" className="lp-text-link">Khám phá không gian thí nghiệm <Arrow /></Link></div><div className="lp-method-sheet"><span className="lp-paper-tape" /><div className="lp-sheet-heading"><span>Một lịch thử nghiệm minh họa</span><i className="ri-flask-line" aria-hidden="true" /></div><h3>Cùng một phòng.<br />Luân phiên theo thời gian.</h3><div className="lp-switchback" aria-label="Ví dụ 12 khối thời gian luân phiên BẬT và TẮT">{[true, false, false, true, false, true, true, false, true, false, false, true].map((on, i) => <span key={i} className={on ? "is-on" : "is-off"}><span>{on ? "BẬT" : "TẮT"}</span><small>{String(i + 1).padStart(2, "0")}</small></span>)}</div><div className="lp-sheet-legend"><span><i /> Áp dụng chiến lược ghim</span><span><i /> Vận hành như thường lệ</span></div><dl><div><dt>Trước phiên</dt><dd>Khóa lịch thử nghiệm</dd></div><div><dt>Trong phiên</dt><dd>Ghi lượt nhấp hợp lệ và thời gian xem</dd></div><div><dt>Sau phiên</dt><dd>Ước lượng tác động + khoảng tin cậy 95%</dd></div></dl><p className="lp-small">Thiết kế thí nghiệm chỉ có ý nghĩa khi đáp ứng đủ điều kiện đo. Không phải mọi phiên đều cho phép kết luận.</p></div></section>
        <section className="lp-belief lp-belief-technical" aria-labelledby="belief-title"><div className="lp-container"><div className="lp-belief-top"><span className="lp-section-label">Sự rõ ràng cũng là một tính năng.</span><svg className="lp-belief-glyph" viewBox="0 0 110 100" fill="none" aria-hidden="true"><circle cx="55" cy="50" r="34" fill="var(--signal)" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="55" cy="50" rx="52" ry="15" transform="rotate(-28 55 50)" stroke="currentColor" strokeWidth="1.5" /><path d="M55 16C33 37 33 63 55 84C77 63 77 37 55 16ZM21 50H89" stroke="currentColor" strokeWidth="1.2" /></svg></div><h2 id="belief-title">Một trợ lý tốt<br />cũng biết nói<br /><span>“chưa đủ cơ sở”.</span></h2><div className="lp-belief-bottom"><p>Gợi ý có nguồn. Độ tin cậy có giới hạn.<br />Kết quả có thể chưa rõ. Quyết định vẫn là của bạn.</p><div><span>Thử nghiệm minh bạch</span><span>Không hứa hẹn tăng doanh thu</span><span>Không biến mô phỏng thành kết quả thật</span></div></div></div></section>
        <section className="lp-container lp-section lp-workflow" aria-labelledby="workflow-title"><div className="lp-section-heading"><p className="lp-section-label">Từ trước giờ phát đến sau khi tắt máy</p><h2 id="workflow-title">Không chỉ hỗ trợ một lần ghim.<br />Một vòng làm việc hoàn chỉnh.</h2></div><div className="lp-workflow-grid"><article><span className="lp-workflow-time">Trước phiên</span><div className="lp-workflow-art"><CardHoodie /><CardTote /></div><h3>Chuẩn bị cho chủ động.</h3><p>Kết nối SIMULATED Live, nhập sản phẩm bằng CSV hoặc dùng bộ mẫu. Giá thiếu được hiển thị là thiếu, để bạn kiểm tra trước khi chạy.</p><Link href="/start">Mở phần chuẩn bị <Arrow diagonal /></Link></article><article><span className="lp-workflow-time">Đang lên sóng</span><div className="lp-workflow-art lp-workflow-live"><RingLight /><span><i className="lp-status-dot" /> Đọc tín hiệu<br /><i className="ri-pushpin-2-line" aria-hidden="true" /> Cân nhắc ghim</span></div><h3>Tập trung vào nhịp live.</h3><p>Gợi ý, tín hiệu và sản phẩm nằm trong cùng một bàn làm việc. Bạn xem lý do, cân nhắc rồi thực hiện thao tác.</p><Link href="/home">Khám phá LiveDesk <Arrow diagonal /></Link></article><article><span className="lp-workflow-time">Sau phiên</span><div className="lp-workflow-art lp-workflow-recap"><svg viewBox="0 0 220 100" aria-hidden="true"><path d="M10 85H210 M10 50H210 M10 15H210" className="lp-chart-grid" /><path d="M15 75L45 65L75 70L105 35L135 45L165 25L200 18" className="lp-recap-line" /><circle cx="105" cy="35" r="5" /></svg></div><h3>Mang bài học đi tiếp.</h3><p>Xem lại thao tác, diễn biến và tổng kết. Với phiên đủ điều kiện, đọc tác động cùng khoảng tin cậy trước khi chọn chiến lược tiếp theo.</p><Link href="/phien">Mở không gian thí nghiệm <Arrow diagonal /></Link></article></div></section>
        <section className="lp-status-section"><div className="lp-container lp-project-status"><div><p className="lp-section-label">Một sản phẩm đang được xây bằng kiểm chứng</p><h2>Thử được hôm nay.<br />Minh bạch về chặng đường phía trước.</h2></div><div className="lp-project-facts"><div><span className="lp-fact-icon"><i className="ri-play-circle-line" aria-hidden="true" /></span><div><h3>Vòng demo đã chạy được</h3><p>Chuẩn bị → vận hành → tổng kết, với dữ liệu mô phỏng được gắn nhãn rõ ràng.</p></div></div><div><span className="lp-fact-icon"><i className="ri-flask-line" aria-hidden="true" /></span><div><h3>Lõi thí nghiệm có mô phỏng và hiệu chuẩn</h3><p>Thiết kế switchback, đo lượt nhấp và ước lượng tác động nằm trong chính dự án.</p></div></div><div><span className="lp-fact-icon"><i className="ri-route-line" aria-hidden="true" /></span><div><h3>Tiếp tục hướng tới phiên thật</h3><p>Chưa có thí nghiệm ngẫu nhiên thật hay bằng chứng tăng doanh thu ngoài thực tế. Tích hợp nền tảng cần được xác thực tiếp.</p></div></div></div></div></section>
        <section className="lp-container lp-section lp-faq" id="cau-hoi" aria-labelledby="faq-title"><div><p className="lp-section-label">Hiểu rõ trước khi bắt đầu</p><h2 id="faq-title">Có thể bạn<br />đang muốn hỏi.</h2><p>Một vài điều nên biết về sản phẩm,<br />bản demo và giới hạn hiện tại.</p></div><div className="lp-faq-list">{faqs.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
        <section className="lp-final"><div className="lp-container"><p>Cùng một buổi live. Một cách nhìn rõ hơn.</p><h2>Phiên tiếp theo,<br />ghim có cơ sở.</h2><Link href="/start" className="btn btn-primary btn-lg">Bắt đầu với bản demo <Arrow diagonal /></Link><span className="lp-final-note">Không cần kết nối nền tảng thật để trải nghiệm.</span><PushPin className="lp-final-pin" /></div></section>
      </main>
      <footer className="lp-footer lp-container"><div className="lp-footer-top"><Link href="/" className="wordmark" aria-label="LiveLift — Về đầu trang"><LogoMark /><WordmarkText /></Link><p>Trợ lý cho từng quyết định.<br />Bằng chứng cho từng bước tiếp.</p><nav aria-label="Thông tin"><Link href="/home">Mở sản phẩm</Link><Link href="/privacy">Quyền riêng tư</Link><Link href="/terms">Điều khoản</Link></nav></div><div className="lp-footer-word" aria-hidden="true"><WordmarkText /><span className="lp-footer-arrow">↗</span></div><div className="lp-footer-bottom"><span>LiveLift · Dự án AISC 2026</span><span>Được xây để hiểu, đo và học từ mỗi phiên live.</span><a href="#lp-title">Về đầu trang <i className="ri-arrow-up-line" aria-hidden="true" /></a></div></footer>
    </div>
  );
}

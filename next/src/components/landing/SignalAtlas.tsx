/** A visual explanation of the product's three stages; every diagram is illustrative. */
export function SignalAtlas() {
  return (
    <div className="lp-atlas" aria-label="Sơ đồ minh họa: đọc tín hiệu, gợi ý hành động và đo tác động">
      <div className="lp-atlas-title"><span><i aria-hidden="true" /> LiveLift / Bản đồ một quyết định</span><span>Minh họa nguyên lý · Không phải số liệu phiên</span></div>
      <div className="lp-atlas-grid">
        <article className="lp-atlas-input">
          <div className="lp-atlas-meta"><span>Đầu vào / 01</span><span>+</span></div>
          <h3>Đọc<br />tín hiệu.</h3>
          <svg className="lp-atlas-glyph" viewBox="0 0 220 180" fill="none" aria-hidden="true">
            <path className="lp-glyph-outline" fill="var(--signal-soft)" d="M39 111C15 105 17 76 38 69C28 45 53 25 73 37C82 13 114 14 125 36C148 20 175 39 171 62C198 60 210 91 190 108C202 134 175 152 154 140C137 163 105 153 100 136L68 151L71 132C57 135 43 127 39 111Z" />
            <path className="lp-glyph-outline" d="M54 78H137M54 94H161M54 110H110" />
            <circle cx="177" cy="30" r="4" className="lp-svg-ink" /><path className="lp-diagram-guide" d="M15 18H40M27 6V30M180 161H205M193 149V173" />
          </svg>
          <p>Khách đang hỏi điều gì?</p>
          <div className="lp-atlas-intents"><span><i /> Hỏi giá</span><span><i /> Hỏi size</span><span><i /> Chốt đơn</span></div>
          <div className="lp-atlas-barcode" aria-hidden="true" />
          <div className="lp-atlas-foot"><span>Bình luận tiếng Việt</span><span>Ý định →</span></div>
        </article>
        <article className="lp-atlas-action">
          <div className="lp-atlas-meta"><span>Hành động / 02</span><span>+</span></div>
          <h3>Gợi ý<br />có lý do.</h3>
          <svg className="lp-atlas-glyph" viewBox="0 0 220 180" fill="none" aria-hidden="true">
            <g transform="rotate(18 110 90)"><path className="lp-glyph-outline" fill="var(--surface-3)" d="M81 26C81 17 139 17 139 26V48L130 53V82L153 99V112H67V99L90 82V53L81 48V26Z" /><ellipse className="lp-glyph-outline" cx="110" cy="26" rx="29" ry="8" fill="var(--signal)" /><path className="lp-glyph-outline" d="M110 112V159M86 55H134M73 100H146" /></g>
            <path className="lp-diagram-guide" d="M35 39L67 39M35 39V136H65M166 129H200M183 112V146" /><circle cx="35" cy="39" r="3" className="lp-svg-ink" />
          </svg>
          <p>Nên đưa sản phẩm nào lên?</p>
          <div className="lp-atlas-dotfield" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <i key={i} className={i % 7 === 0 || i % 9 === 0 ? "is-filled" : ""} />)}</div>
          <div className="lp-atlas-foot"><span>Nguồn + cỡ mẫu + độ tin cậy</span><span>Bạn quyết định ↗</span></div>
        </article>
        <article className="lp-atlas-measure">
          <div className="lp-atlas-meta"><span>Bằng chứng / 03</span><span>+</span></div>
          <h3>Đo rồi<br />mới biết.</h3>
          <svg className="lp-atlas-glyph" viewBox="0 0 220 180" fill="none" aria-hidden="true">
            <path className="lp-glyph-outline" fill="var(--surface-2)" d="M110 15L124 38L149 27L152 54L181 57L169 82L193 98L167 113L176 140L148 140L140 166L117 150L96 169L85 142L58 148L60 121L33 113L51 91L34 69L61 62L62 35L88 43L110 15Z" />
            <circle className="lp-glyph-outline" cx="113" cy="94" r="31" fill="var(--paper)" /><path className="lp-glyph-outline" d="M92 109L106 95L117 101L135 79M125 79H135V90" />
            <path className="lp-diagram-guide" d="M18 151H43M30 139V163M182 24H207M195 12V36" />
          </svg>
          <p>Thao tác có tạo ra khác biệt?</p>
          <div className="lp-atlas-interval" aria-hidden="true"><span>TẮT</span><div><i /><i /><i /><i /><i /><i /><i /></div><span>BẬT</span></div>
          <div className="lp-atlas-foot"><span>Thử nghiệm + khoảng tin cậy</span><span>Tác động ?</span></div>
        </article>
      </div>
      <div className="lp-atlas-bottom"><span>◎ Tín hiệu → Hành động → Bằng chứng</span><span>Một vòng học từ mỗi phiên live.</span></div>
    </div>
  );
}

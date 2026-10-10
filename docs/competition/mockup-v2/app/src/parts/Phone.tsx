// A small preview of the host's phone on the SIMULATED platform. It mirrors the pinned product.
// Deliberately generic: no platform logo, colours or layout copied from any real app. The video
// frame is a drawn mock (a host at a clothes rack), not a photo.

import { fmtClock, fmtNum, fmtPrice } from "../format";
import { activeOutage, pinAt, productById, visibleComments, viewersNow, type World } from "../engine";
import { IconEye } from "../icons";
import { SimTag } from "../ui";

/** A flat, drawn studio frame in warm tones: clothes rack, the host holding up a garment. */
function VideoFrame() {
  return (
    <svg class="phone-video" viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pv-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d9cdbb" />
          <stop offset="0.58" stop-color="#b9a98f" />
          <stop offset="1" stop-color="#8d7c63" />
        </linearGradient>
      </defs>
      <rect width="180" height="320" fill="url(#pv-wall)" />
      <line x1="6" y1="40" x2="174" y2="40" stroke="#6f6252" stroke-width="2" />
      {[
        [10, "#8a9a7b"],
        [52, "#c08a6a"],
        [94, "#7d8aa5"],
        [136, "#b8a06a"],
      ].map(([x, c]) => (
        <g key={x as number}>
          <path d={`M${(x as number) + 16} 40 v4`} stroke="#6f6252" stroke-width="1.5" />
          <rect x={x as number} y={44} width={34} height={52} fill={c as string} />
        </g>
      ))}
      <ellipse cx="90" cy="120" rx="20" ry="24" fill="#e8cdb4" />
      <path d="M71 112 q0 -28 19 -28 q20 0 19 28 q-4 -12 -19 -12 q-15 0 -19 12 z" fill="#4a3a2e" />
      <path d="M46 320 v-120 q0 -46 44 -52 q44 6 44 52 v120 z" fill="#f5efe4" />
      <path d="M62 186 l16 -12 h24 l16 12 l-7 11 l-7 -4 v40 h-28 v-40 l-7 4 z" fill="#9e3b2b" opacity="0.92" />
      <ellipse cx="64" cy="192" rx="7" ry="6" fill="#e8cdb4" />
      <ellipse cx="116" cy="192" rx="7" ry="6" fill="#e8cdb4" />
    </svg>
  );
}

export function Phone({ world, sending }: { world: World; sending: string | null }) {
  const pin = pinAt(world.actions, world.t);
  const product = pin ? productById(pin.product) : null;
  const blind = !!activeOutage(world);
  const viewers = viewersNow(world);
  const recent = visibleComments(world).slice(-2);
  return (
    <figure class="phone-wrap">
      <figcaption class="phone-caption">
        <span>Điện thoại người dẫn</span>
        <SimTag>SIMULATED</SimTag>
      </figcaption>
      <div class="phone" role="img" aria-label={product ? `Xem trước: đang ghim ${product.name}` : "Xem trước: chưa ghim sản phẩm nào"}>
        <div class="phone-screen">
          <VideoFrame />
          <div class="phone-top">
            <span class="phone-live">LIVE</span>
            <span class="phone-viewers">
              <IconEye size={12} />
              {viewers === null ? "?" : fmtNum(viewers)}
            </span>
            <span class="phone-time">{fmtClock(world.t)}</span>
          </div>
          <div class="phone-spacer" />
          <ul class="phone-chat" aria-hidden="true">
            {recent.map((c) => (
              <li key={c.id}>
                <b>{c.handle}</b> {c.text}
              </li>
            ))}
          </ul>
          <div class={`phone-pin${product ? " is-on" : ""}`} key={product?.id ?? "none"}>
            {product ? (
              <>
                <span class="phone-thumb">{product.initials}</span>
                <span class="phone-pin-text">
                  <span class="phone-pin-flag">Đang ghim</span>
                  <b>{product.name}</b>
                  <span class="phone-price">{fmtPrice(product.price) ?? "Giá chưa nhập"}</span>
                </span>
                <span class="phone-cta">Xem</span>
              </>
            ) : (
              <span class="phone-pin-empty">{sending ? "Đang gửi lệnh ghim…" : "Chưa ghim sản phẩm"}</span>
            )}
          </div>
          {blind && (
            <div class="phone-blind">
              <span>LiveLift không thấy màn hình này lúc này</span>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

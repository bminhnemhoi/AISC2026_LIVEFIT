// Live Desk: one dominant answer, a product list with one-tap pin, one chart, the comment
// stream with intent counters, and a SIMULATED host-phone preview. Nothing else competes.

import { INTENT_LABEL, PRODUCTS, type Intent, type ProductId } from "../data";
import {
  CONFIDENCE_LABEL,
  FLASH_MIN_CART,
  FLASH_MIN_STOCK,
  MIN_MENTIONS,
  activeOutage,
  flashAt,
  intentCounts,
  pinAt,
  productById,
  signalsAt,
  suggestionAt,
  visibleComments,
  type Signals,
  type World,
} from "../engine";
import { fmtClock, fmtDuration, fmtPrice } from "../format";
import {
  IconBag,
  IconBolt,
  IconChat,
  IconPin,
  IconRuler,
  IconShield,
  IconSignal,
  IconTag,
  IconUnpin,
} from "../icons";
import { LiveChart } from "../parts/Chart";
import { Phone } from "../parts/Phone";
import { PlatformBanner } from "../parts/Chrome";
import { dismissFlash, dismissPin, pin, runFlash, setState, unpin, useStore, worldOf } from "../store";
import { Button, Meter, Num, Skeleton, SimTag, useFlip } from "../ui";
import { JBadge } from "../parts/Journey";

const INTENT_ICON: Record<Intent, (p: { size?: number }) => preact.JSX.Element> = {
  price: IconTag,
  size: IconRuler,
  order: IconBag,
  other: IconChat,
};

// ---------- products ----------

function ProductList({ world, suggested }: { world: World; suggested: ProductId | null }) {
  const sending = useStore((s) => s.sending);
  const ended = useStore((s) => s.ended);
  const current = pinAt(world.actions, world.t);
  const manual = !!activeOutage(world);
  const ordered = [...PRODUCTS].sort((a, b) => (a.id === current?.product ? -1 : b.id === current?.product ? 1 : 0));
  const flip = useFlip(ordered.map((p) => p.id));
  return (
    <section class="panel products" aria-labelledby="products-h">
      <div class="panel-head">
        <h2 id="products-h">
          Sản phẩm <span class="count num">{PRODUCTS.length}</span>
        </h2>
        <span class="panel-note">Ghim, bỏ ghim tự do</span>
      </div>
      <ul class="product-list" ref={flip as preact.RefObject<HTMLUListElement>}>
        {ordered.map((p) => {
          const pinned = current?.product === p.id;
          const isSending = sending === p.id;
          return (
            <li key={p.id} data-flip={p.id} class={`product${pinned ? " is-pinned" : ""}`}>
              <span class="thumb" aria-hidden="true">
                {p.initials}
              </span>
              <div class="product-body">
                {pinned && (
                  <p class="pin-state">
                    <span class="pin-word">ĐANG GHIM</span>
                    {current?.evidence === "operator" ? <span class="by-hand">bạn ghi tay</span> : <SimTag quiet>SIMULATED</SimTag>}
                  </p>
                )}
                {!pinned && isSending && <p class="pin-state is-sending">Đang gửi lệnh ghim…</p>}
                {!pinned && !isSending && suggested === p.id && <p class="pin-state is-suggested">Trợ lý gợi ý, chưa ghim</p>}
                <p class="product-name">{p.name}</p>
                <p class="product-meta">
                  {p.price === null && p.stock === null ? (
                    <span class="missing">Giá, tồn kho chưa nhập</span>
                  ) : (
                    <>
                      {p.price === null ? <span class="missing">Giá chưa nhập</span> : <span class="num">{fmtPrice(p.price)}</span>}
                      <span class="dot-sep" aria-hidden="true" />
                      {p.stock === null ? <span class="missing">Tồn kho chưa nhập</span> : <span>còn <span class="num">{p.stock}</span></span>}
                    </>
                  )}
                </p>
              </div>
              {pinned ? (
                <Button size="sm" variant="secondary" icon={<IconUnpin size={18} />} disabled={ended || !!sending} onClick={() => unpin(p.id)} aria-label={`Bỏ ghim ${p.name}`}>
                  Bỏ ghim
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={manual ? "secondary" : "ink"}
                  icon={<IconPin size={18} />}
                  disabled={ended || !!sending}
                  onClick={() => pin(p.id, "list")}
                  aria-label={manual ? `Ghi tay: đã ghim ${p.name} trên điện thoại` : `Ghim ${p.name}`}
                >
                  {manual ? "Ghi tay" : "Ghim"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- the answer ----------

function Reasons({ s }: { s: Signals }) {
  const p = productById(s.product);
  return (
    <dl class="reasons">
      <div>
        <dt>bình luận hỏi giá</dt>
        <dd>
          <Num value={s.byIntent.price} />
        </dd>
      </div>
      <div>
        <dt>
          lượt thêm giỏ <span class="was">2 phút trước: {s.cartBefore}</span>
        </dt>
        <dd>
          <Num value={s.cartNow} />
        </dd>
      </div>
      <div>
        <dt>còn trong kho</dt>
        <dd>{p.stock === null ? <span class="missing-big">Chưa nhập</span> : <Num value={p.stock} />}</dd>
      </div>
    </dl>
  );
}

function ConfidenceLine({ s, level }: { s: Signals; level: "low" | "medium" | "high" }) {
  return (
    <p class="confidence">
      <JBadge n={4} />
      <Meter level={level} />
      <span>
        <b>Độ tin cậy {CONFIDENCE_LABEL[level]}</b>, dựa trên <span class="num">{s.mentions}</span> bình luận
        <span class="conf-tail"> nhắc tới sản phẩm trong 2 phút</span>
      </span>
    </p>
  );
}

function Answer({ world }: { world: World }) {
  const mode = useStore((s) => s.mode);
  const loading = useStore((s) => s.deskLoading);
  const ended = useStore((s) => s.ended);
  const sending = useStore((s) => s.sending);
  const sug = suggestionAt(world);
  const current = pinAt(world.actions, world.t);

  if (loading) {
    return (
      <section class="panel answer" aria-busy="true" aria-label="Trợ lý đang chuẩn bị">
        <Skeleton w={220} h={14} />
        <Skeleton w="70%" h={40} r={10} />
        <div class="reasons-skel">
          <Skeleton h={56} r={10} />
          <Skeleton h={56} r={10} />
          <Skeleton h={56} r={10} />
        </div>
        <Skeleton w={260} h={44} r={14} />
      </section>
    );
  }

  let body: preact.JSX.Element;
  let key = sug.kind;
  if (mode === "observe") {
    const top = [...signalsAt(world)].sort((a, b) => b.mentions - a.mentions)[0];
    key = "waiting";
    body = top && top.mentions > 0 ? (
      <>
        <h2 class="answer-title">
          2 phút qua: {productById(top.product).name} được nhắc nhiều nhất
        </h2>
        <p class="answer-lede">Chế độ Quan sát chỉ mô tả điều đã xảy ra. Trợ lý không gợi ý.</p>
        <Reasons s={top} />
        <p class="confidence">
          Cỡ mẫu: <span class="num">{top.mentions}</span> bình luận nhắc tới sản phẩm trong 2 phút. Đây là mô tả, không phải gợi ý.
        </p>
      </>
    ) : (
      <>
        <h2 class="answer-title">2 phút qua: chưa có sản phẩm nào được nhắc</h2>
        <p class="answer-lede">Chế độ Quan sát chỉ mô tả điều đã xảy ra. Trợ lý không gợi ý.</p>
      </>
    );
  } else if (sug.kind === "paused") {
    body = (
      <>
        <h2 class="answer-title">Trợ lý tạm dừng</h2>
        <p class="answer-lede">
          Không có dữ liệu mới từ nền tảng, nên trợ lý không gợi ý gì. Bạn vẫn ghim trên điện thoại như bình thường; LiveLift ghi lại khi bạn bấm “Ghi tay”.
        </p>
      </>
    );
  } else if (sug.kind === "waiting") {
    body = (
      <>
        <h2 class="answer-title">Chưa đủ tín hiệu để gợi ý</h2>
        <p class="answer-lede">
          Trợ lý cần ít nhất {MIN_MENTIONS} bình luận nhắc tới cùng một sản phẩm trong 2 phút. Hiện nhiều nhất: <span class="num">{sug.best}</span>.
        </p>
        <div class="progress" role="img" aria-label={`${sug.best} trên ${MIN_MENTIONS} bình luận`}>
          {Array.from({ length: MIN_MENTIONS }, (_, i) => (
            <i key={i} class={i < sug.best ? "on" : ""} />
          ))}
        </div>
      </>
    );
  } else if (sug.kind === "pin") {
    const p = productById(sug.product);
    const low = sug.confidence === "low";
    body = (
      <>
        <h2 class="answer-title" data-journey="5">
          <JBadge n={5} />
          Nên ghim tiếp: <span class="answer-product">{p.name}</span>
        </h2>
        <p class="answer-lede">
          {low
            ? `Mới có ${sug.signals.mentions} bình luận nhắc tới sản phẩm này. Tín hiệu cho thấy người xem bắt đầu quan tâm; cân nhắc trước khi ghim.`
            : "Tín hiệu 2 phút qua cho thấy người xem đang hỏi nhiều về sản phẩm này."}
        </p>
        <div class="why" data-journey="4">
          <Reasons s={sug.signals} />
          <ConfidenceLine s={sug.signals} level={sug.confidence} />
        </div>
        <div class="answer-actions">
          <Button
            size="lg"
            variant={low ? "secondary" : "primary"}
            icon={<IconPin />}
            disabled={ended || !!sending}
            onClick={() => pin(sug.product, "suggestion")}
          >
            {sending === sug.product ? "Đang gửi lệnh ghim…" : `Ghim ${p.name}`}
          </Button>
          <Button size="lg" variant="quiet" disabled={ended} onClick={() => dismissPin(sug.product)}>
            Bỏ qua
          </Button>
          <p class="decide">Bạn quyết định. Trợ lý không tự ghim.</p>
        </div>
      </>
    );
    key = `pin-${sug.product}` as typeof key;
  } else {
    const p = productById(sug.product);
    body = (
      <>
        <h2 class="answer-title" data-journey="5">
          <JBadge n={5} />
          Giữ ghim <span class="answer-product">{p.name}</span>
        </h2>
        <p class="answer-lede">
          Chưa sản phẩm nào được hỏi nhiều hơn trong 2 phút qua.
          {current && (
            <>
              {" "}
              Đang ghim từ {fmtClock(current.since)}, {current.source === "suggestion" ? "theo gợi ý" : "do bạn tự chọn"}.
            </>
          )}
        </p>
        <div class="why" data-journey="4">
          <Reasons s={sug.signals} />
          <ConfidenceLine s={sug.signals} level={sug.confidence} />
        </div>
      </>
    );
    key = `keep-${sug.product}` as typeof key;
  }

  const primaryTaken = mode === "suggest" && sug.kind === "pin" && sug.confidence !== "low";
  return (
    <section class="panel answer" aria-labelledby="answer-h">
      <p class="answer-kicker" id="answer-h">
        <IconSignal size={18} />
        {mode === "observe" ? "Quan sát, 2 phút gần nhất" : "Trợ lý đọc 2 phút gần nhất"}
        <SimTag quiet>dữ liệu SIMULATED</SimTag>
      </p>
      <div class="answer-body" key={key} aria-live="polite" aria-atomic="true">
        {body}
      </div>
      <Flash world={world} primaryTaken={primaryTaken} observe={mode === "observe"} />
    </section>
  );
}

function Flash({ world, primaryTaken, observe }: { world: World; primaryTaken: boolean; observe: boolean }) {
  const ended = useStore((s) => s.ended);
  const f = flashAt(world);
  if (observe) {
    return (
      <div class="flash">
        <IconBolt size={18} />
        <p>Flash sale: chế độ Quan sát không gợi ý.</p>
      </div>
    );
  }
  if (f.kind === "ready") {
    const p = productById(f.product);
    return (
      <div class="flash is-ready" aria-live="polite">
        <div class="flash-main">
          <p class="flash-title">
            <IconBolt size={20} />
            Nên chạy flash sale trong 1 phút
          </p>
          <p class="flash-why">
            Cho {p.name}: <b class="num">{f.cartNow}</b> lượt thêm giỏ trong 2 phút, trước đó <span class="num">{f.cartBefore}</span>;{" "}
            <b class="num">{f.orders}</b> bình luận chốt đơn; còn <span class="num">{f.stock}</span>. Đang ghim {fmtDuration(f.pinnedFor)}.
          </p>
        </div>
        <div class="flash-actions">
          <Button variant={primaryTaken ? "secondary" : "primary"} disabled={ended} onClick={() => runFlash(f.product)}>
            Chạy flash sale
          </Button>
          <Button variant="quiet" disabled={ended} onClick={() => dismissFlash(f.product)}>
            Bỏ qua
          </Button>
        </div>
      </div>
    );
  }
  let text: preact.JSX.Element;
  switch (f.kind) {
    case "no-pin":
      text = <>Flash sale: cần một sản phẩm đang ghim.</>;
      break;
    case "paused":
      text = <>Flash sale: tạm dừng, không có dữ liệu mới.</>;
      break;
    case "running":
      text = (
        <>
          Flash sale đang chạy trên <SimTag quiet>SIMULATED Shopee Live</SimTag>, còn {fmtClock(Math.max(0, f.endsAt - world.t))}.
        </>
      );
      break;
    case "dismissed":
      text = <>Flash sale: bạn đã bỏ qua. Trợ lý không nhắc lại cho lần ghim này.</>;
      break;
    default: {
      const p = productById(f.product);
      const why =
        f.reason === "stock"
          ? p.stock === null
            ? `tồn kho ${p.name} chưa nhập`
            : `${p.name} chỉ còn ${p.stock}, cần từ ${FLASH_MIN_STOCK}`
          : f.reason === "young"
            ? "sản phẩm vừa được ghim, chờ ít nhất 1 phút"
            : f.reason === "falling"
              ? "lượt thêm giỏ không tăng so với 2 phút trước"
              : `cần từ ${FLASH_MIN_CART} lượt thêm giỏ trong 2 phút cho sản phẩm đang ghim`;
      text = (
        <>
          <b>Flash sale: chưa đủ tín hiệu.</b> {why[0].toUpperCase() + why.slice(1)}.
          {f.reason === "cart" && (
            <span class="mini-progress" role="img" aria-label={`Hiện ${f.cartNow} trên ${FLASH_MIN_CART}`}>
              <span style={{ transform: `scaleX(${Math.min(1, f.cartNow / FLASH_MIN_CART)})` }} />
            </span>
          )}
          {f.reason === "cart" && <span class="num flash-count">{f.cartNow}/{FLASH_MIN_CART}</span>}
        </>
      );
    }
  }
  return (
    <div class="flash">
      <IconBolt size={18} />
      <p>{text}</p>
    </div>
  );
}

// ---------- comments ----------

function Comments({ world }: { world: World }) {
  const filter = useStore((s) => s.filter);
  const counts = intentCounts(world);
  const all = visibleComments(world);
  const shown = all.filter((c) => !filter || c.intent === filter).slice(-30).reverse();
  const masked = all.filter((c) => c.masked).length;
  const blind = activeOutage(world);
  return (
    <section class="panel comments" aria-labelledby="comments-h" data-journey="1">
      <div class="panel-head">
        <h2 id="comments-h">
          <JBadge n={1} />
          Bình luận
        </h2>
        <SimTag quiet>SIMULATED</SimTag>
      </div>
      <div class="intents" data-journey="3">
        <p class="intents-label">
          <JBadge n={3} />Ý định trong 2 phút
        </p>
        <div class="intent-grid" role="group" aria-label="Ý định trong 2 phút qua; bấm một ô để lọc bình luận">
          {(Object.keys(INTENT_LABEL) as Intent[]).map((k) => {
            const Icon = INTENT_ICON[k];
            return (
              <button
                key={k}
                type="button"
                class="intent"
                aria-pressed={filter === k}
                onClick={() => setState({ filter: filter === k ? null : k })}
              >
                <span class="intent-name">
                  <Icon size={16} />
                  {INTENT_LABEL[k]}
                </span>
                <span class="intent-count">
                  <Num value={counts[k]} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <ol class="stream" tabIndex={0} aria-label={filter ? `Bình luận: ${INTENT_LABEL[filter]}` : "Bình luận mới nhất trước"}>
        {blind && (
          <li class="stream-note" key="blind">
            Không nhận bình luận từ {fmtClock(blind.from)}: LiveLift đã ngừng gọi nền tảng.
          </li>
        )}
        {shown.map((c) => {
          return (
            <li key={c.id} class="cmt">
              <p class="cmt-head">
                <span class="cmt-handle">{c.handle}</span>
                <span class={`chip intent-chip is-${c.intent}`}>{INTENT_LABEL[c.intent].toLowerCase()}</span>
                {c.masked && (
                  <span class="chip masked-chip">
                    <IconShield size={14} />
                    đã che
                  </span>
                )}
                <span class="cmt-time num">{fmtClock(c.t)}</span>
              </p>
              <p class="cmt-text">{c.text}</p>
            </li>
          );
        })}
        {shown.length === 0 && !blind && <li class="stream-note">Chưa có bình luận{filter ? " thuộc loại này" : ""}.</li>}
      </ol>
      <p class="privacy" data-journey="2">
        <JBadge n={2} />
        <IconShield size={16} />
        <span>
          Số điện thoại được che trước khi hiển thị và trước khi lưu.{" "}
          {masked ? (
            <>
              Đã che <b class="num">{masked}</b> bình luận.
            </>
          ) : (
            "Chưa có bình luận nào cần che."
          )}
        </span>
      </p>
    </section>
  );
}

// ---------- chart ----------

function ChartPanel({ world }: { world: World }) {
  const loading = useStore((s) => s.deskLoading);
  return (
    <section class="panel chart-panel" aria-labelledby="chart-h">
      <div class="panel-head">
        <h2 id="chart-h">Người xem và thêm giỏ</h2>
        <SimTag quiet>SIMULATED</SimTag>
      </div>
      {loading ? (
        <div class="chart">
          <Skeleton h={10_000} r={10} />
        </div>
      ) : (
        <LiveChart world={world} />
      )}
      <p class="chart-note">Vạch dọc là lúc bạn ghim. Chúng cho biết khi nào, không chứng minh vì sao số thay đổi.</p>
    </section>
  );
}

// ---------- screen ----------

export function LiveDesk() {
  const s = useStore((x) => x);
  const world = worldOf(s);
  const sug = suggestionAt(world);
  const suggested = s.mode === "suggest" && sug.kind === "pin" ? sug.product : null;
  if (!s.started) {
    return (
      <main class="screen desk-empty" id="main">
        <div class="empty">
          <h1>Chưa bắt đầu live</h1>
          <p>Kết nối, nhập sản phẩm rồi bấm Bắt đầu live ở màn Chuẩn bị.</p>
          <Button variant="primary" onClick={() => setState({ screen: "setup" })}>
            Về Chuẩn bị
          </Button>
        </div>
      </main>
    );
  }
  return (
    <main class="screen desk" id="main">
      <h1 class="sr-only">Live Desk</h1>
      <PlatformBanner />
      {s.ended && (
        <div class="ended-note">
          Buổi live đã kết thúc lúc {fmtClock(s.t)}. Màn này chỉ để xem lại; mọi nút đã khoá.
        </div>
      )}
      <div class="desk-grid">
        <div class="col col-left">
          <ProductList world={world} suggested={suggested} />
          <Phone world={world} sending={s.sending} />
        </div>
        <div class="col col-center">
          <Answer world={world} />
          <ChartPanel world={world} />
        </div>
        <div class="col col-right">
          <Comments world={world} />
        </div>
      </div>
    </main>
  );
}

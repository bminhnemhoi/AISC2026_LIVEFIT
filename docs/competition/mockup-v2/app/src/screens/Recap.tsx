// Tổng kết: a few big numbers, the timeline with pinned products as bands, what the assistant
// suggested and what the operator did, comments by intent, and what we still do not know.

import { INTENT_LABEL, type Intent } from "../data";
import { productById, recapOf, type Outcome } from "../engine";
import { fmtClock, fmtDuration, fmtNum } from "../format";
import { IconQuestion, IconShield } from "../icons";
import { LiveChart } from "../parts/Chart";
import { useStore, worldOf } from "../store";
import { reset } from "../story";
import { Button, SampleTag, SimTag } from "../ui";

const OUTCOME: Record<Outcome, { label: string; cls: string }> = {
  accepted: { label: "Nhận", cls: "is-accepted" },
  dismissed: { label: "Bỏ qua", cls: "is-dismissed" },
  self: { label: "Tự làm", cls: "is-self" },
  expired: { label: "Không phản hồi", cls: "is-expired" },
  open: { label: "Còn mở khi kết thúc", cls: "is-expired" },
};

export function Recap() {
  const s = useStore((x) => x);
  const world = worldOf(s);
  if (!s.ended) {
    return (
      <main class="screen desk-empty" id="main">
        <div class="empty">
          <h1>Chưa có tổng kết</h1>
          <p>Tổng kết xuất hiện khi bạn kết thúc buổi live.</p>
        </div>
      </main>
    );
  }
  const r = recapOf(world, s.t);
  const intents = Object.keys(INTENT_LABEL) as Intent[];
  const maxIntent = Math.max(1, ...intents.map((k) => r.byIntent[k]));
  const firstPin = r.bands[0];
  const gaps = world.outages.filter((o) => o.to !== null);
  return (
    <main class="screen recap" id="main">
      <div class="recap-head">
        <div>
          <h1>Tổng kết buổi live</h1>
          <p class="recap-meta">
            Buổi live mẫu, dài {fmtDuration(r.end)} <SampleTag /> <SimTag quiet>SIMULATED Shopee Live</SimTag>
          </p>
        </div>
        <Button variant="primary" onClick={reset}>
          Chuẩn bị buổi mới
        </Button>
      </div>

      <dl class="kpis">
        <div>
          <dt>Người xem cao nhất</dt>
          <dd class="num">{fmtNum(r.peakViewers)}</dd>
        </div>
        <div>
          <dt>Bình luận</dt>
          <dd class="num">{fmtNum(r.comments)}</dd>
        </div>
        <div>
          <dt>Lượt thêm giỏ</dt>
          <dd class="num">{fmtNum(r.cart)}</dd>
        </div>
        <div>
          <dt>Lần ghim</dt>
          <dd class="num">{fmtNum(r.pins)}</dd>
        </div>
        <div class="kpi-unknown">
          <dt>Đơn hàng</dt>
          <dd>Chưa biết</dd>
          <dd class="kpi-note">Thêm giỏ không phải mua. Bản mô phỏng không trả số đơn.</dd>
        </div>
      </dl>

      <div class="recap-row">
        <section class="panel recap-chart" aria-labelledby="timeline-h">
          <div class="panel-head">
            <h2 id="timeline-h">Diễn biến buổi live</h2>
            <p class="panel-note">Nền màu là sản phẩm đang ghim. Sọc chéo là khoảng không có dữ liệu.</p>
          </div>
          <LiveChart world={world} variant="recap" />
        </section>
        <section class="unknowns" aria-labelledby="unknown-h">
          <h2 id="unknown-h">
            <IconQuestion />
            Điều chưa biết
          </h2>
          <ul>
            {firstPin && (
              <li>
                <b>Ghim {productById(firstPin.product).name} có làm tăng thêm giỏ không?</b> Chưa biết. Thêm giỏ tăng sau khi ghim, nhưng người xem
                cũng tăng cùng lúc. Muốn biết cần chế độ Thí nghiệm (phiên từ 90 phút).
              </li>
            )}
            <li>
              <b>Số đơn hàng thật.</b> Chưa biết: thêm giỏ không phải mua, và bản mô phỏng không trả số đơn.
            </li>
            {gaps.map((g) => (
              <li key={g.from}>
                <b>
                  {fmtClock(g.from)} đến {fmtClock(g.to as number)}
                </b>
                : không có dữ liệu vì nền tảng báo hết hạn quyền truy cập. Khoảng này để trống, không tính là 0.
              </li>
            ))}
            <li>
              <b>Túi vải tote</b>: giá và tồn kho chưa nhập.
            </li>
          </ul>
        </section>
      </div>

      <div class="recap-grid">
        <section class="panel decisions" aria-labelledby="decisions-h">
          <div class="panel-head">
            <h2 id="decisions-h">Gợi ý của trợ lý và bạn đã làm gì</h2>
          </div>
          <table class="dtable">
            <thead>
              <tr>
                <th scope="col">Lúc</th>
                <th scope="col">Việc</th>
                <th scope="col">Lý do trợ lý đưa ra</th>
                <th scope="col">Bạn</th>
              </tr>
            </thead>
            <tbody>
              {r.log.map((row, i) => (
                <tr key={i}>
                  <td class="num">{fmtClock(row.t)}</td>
                  <td>
                    {row.what}
                    {row.outcome !== "self" && <span class="row-kind">Gợi ý</span>}
                  </td>
                  <td class="muted">{row.why ?? "Không có gợi ý; bạn tự quyết"}</td>
                  <td>
                    <span class={`outcome ${OUTCOME[row.outcome].cls}`}>{OUTCOME[row.outcome].label}</span>
                    {row.outcomeAt !== null && row.outcome !== "self" && <span class="outcome-at num">{fmtClock(row.outcomeAt)}</span>}
                  </td>
                </tr>
              ))}
              {r.log.length === 0 && (
                <tr>
                  <td colSpan={4} class="muted">
                    Không có gợi ý nào và bạn chưa ghim sản phẩm nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section class="panel intents-recap" aria-labelledby="intents-h">
          <div class="panel-head">
            <h2 id="intents-h">Bình luận theo ý định</h2>
          </div>
          <ul class="hbars">
            {intents.map((k) => (
              <li key={k}>
                <span class="hbar-label">{INTENT_LABEL[k]}</span>
                <span class="hbar-track" aria-hidden="true">
                  <span class="hbar" style={{ transform: `scaleX(${r.byIntent[k] / maxIntent})` }} />
                </span>
                <span class="hbar-n num">{r.byIntent[k]}</span>
              </li>
            ))}
          </ul>
          <p class="privacy">
            <IconShield size={16} />
            <span>
              <b class="num">{r.masked}</b> bình luận có số điện thoại, đã che trước khi lưu.
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}

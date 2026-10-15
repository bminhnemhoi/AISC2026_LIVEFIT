"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useExperimentDesk } from "@/lib/livelift-api/client";
import { blockStrip, estimateState, fmtNum, funnel, mmss, sourceLabel } from "@/lib/livelift-api/desk";
import { EstimateCard, SourceBadge } from "./parts";
import "../livedesk/calm.css";
import "./phien.css";

const ARM_TEXT = { ON: "BẬT", OFF: "TẮT" } as const;

/** Operator desk in Experiment mode, read from the real API — the same screen for simulated, staged and real sessions. */
export function ExperimentDesk({ sessionId }: { sessionId: string }) {
  const { data, refresh } = useExperimentDesk(sessionId);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const { session, state, blocks, ticks, comments, orders, report } = data;

  if (!session || !state) {
    return (
      <div className="ld ph">
        <div className="ph-wrap">
          {data.error ? <div className="ph-err" role="alert">{data.error}</div> : <p className="ph-muted">Đang tải phiên…</p>}
        </div>
      </div>
    );
  }

  const label = sourceLabel(session, report?.binh_luan_tong_hop ?? 0);
  const strip = blockStrip(blocks, state.elapsed_s);
  const f = funnel(ticks, orders);
  const est = estimateState(report);
  const cb = state.current_block;
  const arm = cb && !cb.is_washout && cb.assignment ? cb.assignment : null;
  const viewersNow = ticks.length ? ticks[ticks.length - 1].viewers : 0;
  const topCard = state.cards[0];
  const canPin = session.status === "live" && arm === "ON" && session.platform !== "lab";

  const pin = async (productId?: string): Promise<void> => {
    setBusy(true);
    setActionMsg(null);
    try {
      await api.pin(sessionId, productId);
      setActionMsg("Đã ghim qua hệ thống, có ghi nhật ký phơi nhiễm.");
      refresh();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Không ghim được.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ld ph" data-testid="experiment-desk">
      <div className="ph-wrap">
        <header className="ph-top">
          <div>
            <h1 className="ph-title">{session.title || "Phiên LiveLift"}</h1>
            <p className="ph-sub">
              Chế độ Thí nghiệm · {session.status === "live" ? "đang phát" : session.status === "ended" ? "đã kết thúc" : "chưa phát"} · đã chạy {mmss(state.elapsed_s)}
            </p>
          </div>
          <SourceBadge label={label} />
        </header>

        {data.error && <div className="ph-err" role="alert">{data.error}</div>}

        <div className="ph-grid">
          <main>
            <section className="ph-card" aria-labelledby="h-strip">
              <h2 id="h-strip">Lịch bốc thăm (chỉ người vận hành thấy)</h2>
              <div className="ph-strip" role="img" aria-label={`Lịch ${strip.length} khối, khối BẬT màu xanh, khối TẮT màu xám`}>
                {strip.map(b => (
                  <span key={b.index} data-arm={b.arm} data-state={b.state} style={{ width: `${b.widthPct}%` }} title={`Khối ${b.index + 1}: ${b.arm === "WASH" ? "trôi" : ARM_TEXT[b.arm]}`} />
                ))}
              </div>
              <div className="ph-legend">
                <span><i style={{ background: "var(--on)" }} />BẬT: hệ thống ghim theo gợi ý</span>
                <span><i style={{ background: "var(--off-soft)", border: "1px solid var(--line-strong)" }} />TẮT: không can thiệp</span>
                <span><i style={{ outline: "2px solid var(--ink)", outlineOffset: "-2px" }} />khối hiện tại</span>
              </div>
            </section>

            <section className="ph-card ph-paper" aria-labelledby="h-now">
              <h2 id="h-now">Bây giờ</h2>
              {cb ? (
                <div className="ph-clock">
                  <span className="ph-clock-num" aria-label="thời gian còn lại của khối">{mmss(cb.seconds_remaining)}</span>
                  {arm ? <span className="ph-arm" data-arm={arm}>Khối {cb.index + 1} · {ARM_TEXT[arm]}</span> : <span className="ph-arm">Khoảng trôi</span>}
                </div>
              ) : (
                <p className="ph-muted">Ngoài khung khối thí nghiệm.</p>
              )}
              <p style={{ marginTop: 12 }}>
                Đang ghim: <strong>{state.pinned_product ? `${state.pinned_product.name}` : "chưa có"}</strong>
              </p>
              {canPin && (
                <div className="xem-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="ph-btn ph-btn-primary" disabled={busy} onClick={() => void pin(topCard?.product_id)}>
                    Ghim theo gợi ý
                  </button>
                </div>
              )}
              {session.platform === "lab" && <p className="ph-small">Phòng dàn dựng: autopilot ghim trong khối BẬT, không ghim tay.</p>}
              {actionMsg && <p className="ph-small" role="status">{actionMsg}</p>}
            </section>

            <section className="ph-card" aria-labelledby="h-funnel">
              <h2 id="h-funnel">Phễu đo được</h2>
              <div className="ph-kpis">
                <div><div className="ph-kpi-num">{fmtNum(viewersNow, 0)}</div><div className="ph-kpi-label">người xem lúc này</div></div>
                <div><div className="ph-kpi-num">{fmtNum(f.viewerMinutes, 0)}</div><div className="ph-kpi-label">phút·người xem</div></div>
                <div><div className="ph-kpi-num">{f.clicks}</div><div className="ph-kpi-label">click hợp lệ</div></div>
                <div><div className="ph-kpi-num">{f.orders}</div><div className="ph-kpi-label">đơn{session.platform === "lab" ? " (tiền ảo)" : ""}</div></div>
              </div>
              <p className="ph-small" style={{ marginTop: 12 }}>
                Click / 1.000 giây·người xem: <strong>{f.clickRate == null ? "chưa đủ dữ liệu" : fmtNum(f.clickRate, 3)}</strong>
                {" · "}Đơn / click (CTOR): <strong>{f.ctor == null ? "chưa có" : `${fmtNum(f.ctor * 100, 1)}%`}</strong>
              </p>
            </section>

            <section className="ph-two" aria-label="So sánh hai loại gợi ý">
              <div className="ph-card">
                <h2>Ước lượng hiệu ứng ghim (bốc thăm)</h2>
                <EstimateCard state={est} />
              </div>
              <div className="ph-card">
                <h2>Gợi ý kiểu nền tảng (tương quan)</h2>
                {topCard ? (
                  <>
                    <p style={{ margin: 0 }}><strong>{topCard.headline}</strong></p>
                    <p className="ph-muted">{topCard.rationale}</p>
                  </>
                ) : (
                  <p className="ph-muted">{state.cards_note ?? "Chưa có gợi ý."}</p>
                )}
                <p className="ph-small">Giống "estimated GMV" của TikTok: dựa trên tương quan, chưa kiểm chứng nhân quả.</p>
              </div>
            </section>
          </main>

          <aside>
            <section className="ph-card" aria-labelledby="h-feed">
              <h2 id="h-feed">Bình luận (đã che thông tin cá nhân)</h2>
              {comments.length === 0 ? (
                <p className="ph-muted">Chưa có bình luận.</p>
              ) : (
                <ul className="ph-feed">
                  {[...comments].reverse().slice(0, 40).map(c => (
                    <li key={c.comment_id}>
                      {c.intent && <span className="ph-intent">{c.intent}</span>}
                      {c.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="ph-card">
              <h2>Liên kết</h2>
              <p style={{ margin: 0 }}><Link href={`/phien/${sessionId}/tong-ket`}>Tổng kết phiên</Link></p>
              <p style={{ margin: 0 }}><Link href={`/phien/${sessionId}/nguoi-dan`}>Màn người dẫn (bị làm mù)</Link></p>
              <p className="ph-small">Cập nhật {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("vi-VN") : "—"}</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

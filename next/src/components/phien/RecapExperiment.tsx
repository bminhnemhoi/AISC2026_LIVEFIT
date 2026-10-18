"use client";

import Link from "next/link";
import { useExperimentDesk } from "@/lib/livelift-api/client";
import { estimateState, fmtNum, funnel, sourceLabel, summaryLines } from "@/lib/livelift-api/desk";
import { EstimateCard, SourceBadge, VerdictBanner } from "./parts";
import "../livedesk/calm.css";
import "./phien.css";

/** Recap of one session: the experiment result exactly as /sessions/{id}/bao-cao gives it, plus the funnel. */
export function RecapExperiment({ sessionId }: { sessionId: string }) {
  const { data } = useExperimentDesk(sessionId, 5000);
  const { session, report, ticks, orders } = data;
  if (!session) {
    return (
      <div className="ld ph"><div className="ph-wrap">{data.error ? <div className="ph-err" role="alert">{data.error}</div> : <p className="ph-muted">Đang tải…</p>}</div></div>
    );
  }
  const label = sourceLabel(session, report?.binh_luan_tong_hop ?? 0);
  const f = funnel(ticks, orders);
  return (
    <div className="ld ph" data-testid="experiment-recap">
      <div className="ph-wrap">
        <header className="ph-top">
          <div>
            <h1 className="ph-title">Tổng kết · {session.title || "Phiên LiveLift"}</h1>
            <p className="ph-sub">{report?.nhan ?? "Đang đọc báo cáo…"}</p>
          </div>
          <SourceBadge label={label} />
        </header>
        <div className="ph-grid">
          <main>
            <section className="ph-card ph-paper">
              <h2>Hiệu ứng của việc ghim (ước lượng bằng bốc thăm)</h2>
              <VerdictBanner state={estimateState(report)} />
              <EstimateCard state={estimateState(report)} />
            </section>
            {summaryLines(report).length > 0 && (
              <section className="ph-card" data-testid="recap-summary">
                <h2>Tóm tắt</h2>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {summaryLines(report).map((c, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      {c.badge && <span className="ph-intent">{c.badge}</span>}
                      {c.text}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </main>
          <aside>
            <section className="ph-card">
              <h2>Phễu cả phiên</h2>
              <table className="ph-table">
                <tbody>
                  <tr><th>Phút·người xem</th><td>{fmtNum(f.viewerMinutes, 0)}</td></tr>
                  <tr><th>Lượt nhấp hợp lệ</th><td>{f.clicks}</td></tr>
                  <tr><th>Lượt nhấp / 1.000 giây·người xem</th><td>{f.clickRate == null ? "chưa có" : fmtNum(f.clickRate, 3)}</td></tr>
                  <tr><th>Đơn{session.platform === "lab" ? " (tiền ảo)" : ""}</th><td>{f.orders}</td></tr>
                  <tr><th>Bình luận</th><td>{report?.tong_quan.tong_binh_luan ?? "chưa có"}</td></tr>
                </tbody>
              </table>
            </section>
            <section className="ph-card">
              <p style={{ margin: 0 }}><Link href={`/phien/${sessionId}`}>Quay lại bàn thí nghiệm</Link></p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

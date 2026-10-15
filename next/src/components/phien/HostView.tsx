"use client";

import { useHostView } from "@/lib/livelift-api/client";
import { mmss } from "@/lib/livelift-api/desk";
import "../livedesk/calm.css";
import "./phien.css";

/**
 * The host's screen. BLINDED by construction: it is built only from `GET /sessions/{id}/state?role=host`, which carries
 * the pinned product and the elapsed time — never the block, the arm or the schedule (rule L6).
 */
export function HostView({ sessionId }: { sessionId: string }) {
  const { state, error } = useHostView(sessionId);
  return (
    <div className="ld ph" data-testid="host-view">
      <div className="ph-wrap" style={{ maxWidth: 720 }}>
        <p className="ph-small">Màn hình người dẫn · không hiện lịch thí nghiệm</p>
        {error && <div className="ph-err" role="alert">{error}</div>}
        <section className="ph-card ph-paper" style={{ marginTop: 16 }}>
          <h2>Đang ghim</h2>
          <p className="ph-clock-num" style={{ fontSize: "var(--fs-40)" }}>{state?.pinned_product ?? "Chưa ghim sản phẩm nào"}</p>
          {state?.price != null && <p className="ph-muted">{state.price.toLocaleString("vi-VN")} đ{state.stock != null ? ` · còn ${state.stock}` : ""}</p>}
        </section>
        <p className="ph-muted">Đã phát {mmss(state?.elapsed_s ?? 0)}</p>
      </div>
    </div>
  );
}

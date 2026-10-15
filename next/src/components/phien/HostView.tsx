"use client";

import { useEffect, useState } from "react";
import { api, useHostView } from "@/lib/livelift-api/client";
import { mmss, sourceLabel, type SourceLabel } from "@/lib/livelift-api/desk";
import { SourceBadge } from "./parts";
import "../livedesk/calm.css";
import "./phien.css";

/**
 * The host's screen. BLINDED by construction: the live part is built only from `GET /sessions/{id}/state?role=host`,
 * which carries the pinned product and the elapsed time — never the block, the arm or the schedule (rule L6). The
 * session record is read once for the data-source label only (platform/demo flags say nothing about the arm).
 */
export function HostView({ sessionId }: { sessionId: string }) {
  const { state, error } = useHostView(sessionId);
  const [label, setLabel] = useState<SourceLabel | null>(null);
  useEffect(() => {
    api
      .session(sessionId)
      .then(s => setLabel(sourceLabel(s)))
      .catch(() => setLabel(null));
  }, [sessionId]);
  return (
    <div className="ld ph" data-testid="host-view">
      <div className="ph-wrap" style={{ maxWidth: 720 }}>
        <div className="ph-top">
          <p className="ph-small" style={{ margin: 0 }}>Màn hình người dẫn · không hiện lịch thí nghiệm</p>
          {label && <SourceBadge label={label} />}
        </div>
        {error && <div className="ph-err" role="alert">{error}</div>}
        <section className="ph-card ph-paper">
          <h2>Đang ghim</h2>
          <p className="ph-clock-num" style={{ fontSize: "var(--fs-40)" }}>{state?.pinned_product ?? "Chưa ghim sản phẩm nào"}</p>
          {state?.price != null && <p className="ph-muted">{state.price.toLocaleString("vi-VN")} đ{state.stock != null ? ` · còn ${state.stock}` : ""}</p>}
        </section>
        <p className="ph-muted" style={{ marginTop: "var(--s-12)" }}>Đã phát {mmss(state?.elapsed_s ?? 0)}</p>
      </div>
    </div>
  );
}

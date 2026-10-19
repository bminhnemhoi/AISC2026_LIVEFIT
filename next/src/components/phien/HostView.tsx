"use client";

import { useEffect, useState } from "react";
import { cauHoiMoiNhat, maNhanNguon } from "@/components/ban/logic";
import { NhanNguon } from "@/components/nen";
import { api, useHostView } from "@/lib/livelift-api/client";
import { mmss, sourceLabel, type SourceLabel } from "@/lib/livelift-api/desk";
import { useHoiDinhKy } from "@/lib/livelift-api/hooks";
import type { Comment } from "@/lib/livelift-api/types";
import { CHO_CANON } from "@/lib/tu-ngu";
import "@/components/ban/ban.css";

/**
 * Màn người dẫn, kiểu máy nhắc chữ. LÀM MÙ MỘT PHẦN theo cách dựng: phần live chỉ đọc từ
 * `GET /sessions/{id}/state?role=host` (món đang ghim, giá, thời gian đã phát), không bao giờ có khối, nhánh hay lịch
 * (luật L6). Bản ghi phiên đọc một lần để lấy nhãn nguồn (platform/demo không nói gì về nhánh). Bình luận chỉ dùng để
 * lấy 3 câu hỏi mới nhất của khách; bình luận không mang thông tin khối.
 */
export function HostView({ sessionId }: { sessionId: string }) {
  const { state, error } = useHostView(sessionId);
  const [nhan, setNhan] = useState<SourceLabel | null>(null);
  const binhLuan = useHoiDinhKy<Comment[]>(sessionId, () => api.comments(sessionId), {
    chuKyMs: 3000,
    loiMacDinh: "Không đọc được bình luận.",
  });
  useEffect(() => {
    api
      .session(sessionId)
      .then((s) => setNhan(sourceLabel(s)))
      .catch(() => setNhan(null));
  }, [sessionId]);
  const cauHoi = cauHoiMoiNhat(binhLuan.duLieu ?? [], 3);
  const mon = state?.pinned_product ?? null;

  return (
    <div className="ban-nd" data-testid="host-view" data-vung-chinh="" data-chup="nguoi-dan">
      <header className="ban-nd__tren">
        <p className="ban-nd__nho">Màn người dẫn · {CHO_CANON.lamMuMotPhan}</p>
        {nhan ? <NhanNguon ma={maNhanNguon(nhan)} canh="phai" /> : null}
      </header>

      {error ? (
        <p className="ban-loi" role="alert">
          {error}
        </p>
      ) : null}

      <main id="main-content" tabIndex={-1} className="ban-nd__giua" aria-live="polite">
        <section aria-labelledby="nd-h-mon">
          <h1 id="nd-h-mon" className="ban-nd__nhan">
            {mon ? "Đang ghim" : "Lúc này"}
          </h1>
          <p className="ban-nd__mon" data-testid="nguoi-dan-mon">
            {mon ?? "Giới thiệu tự do"}
          </p>
          {mon && state?.price != null ? (
            <p className="ban-nd__gia">
              {state.price.toLocaleString("vi-VN")} đ{state.stock != null ? ` · còn ${state.stock.toLocaleString("vi-VN")}` : ""}
            </p>
          ) : null}
        </section>
        <section aria-labelledby="nd-h-hoi">
          <h2 id="nd-h-hoi" className="ban-nd__nhan">
            Khách đang hỏi
          </h2>
          {cauHoi.length === 0 ? (
            <p className="ban-nd__nho">Chưa có câu hỏi mới.</p>
          ) : (
            <ul className="ban-nd__cau-hoi">
              {cauHoi.map((c) => (
                <li key={c.comment_id}>{c.text}</li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <p className="ban-nd__duoi">Đã phát {mmss(state?.elapsed_s ?? 0)}</p>
    </div>
  );
}

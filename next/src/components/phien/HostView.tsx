"use client";

import { useEffect, useState } from "react";
import { cauHoiMoiNhat, docChoDaChe, maNhanNguon } from "@/components/ban/logic";
import { NhanNguon } from "@/components/nen";
import { api, useHostView } from "@/lib/livelift-api/client";
import { mmss, sourceLabel, type SourceLabel } from "@/lib/livelift-api/desk";
import { useHoiDinhKy } from "@/lib/livelift-api/hooks";
import type { Comment } from "@/lib/livelift-api/types";
import { LOI_THUONG } from "@/lib/tu-ngu";
import "@/components/ban/ban.css";

/**
 * Màn người dẫn, kiểu máy nhắc chữ. LÀM MÙ MỘT PHẦN theo cách dựng: phần live chỉ đọc từ
 * `GET /sessions/{id}/state?role=host` (món đang ghim, giá, thời gian đã phát), không có khối, nhánh hay lịch (luật L6).
 * Nhãn nguồn lấy từ DANH SÁCH phiên (`GET /sessions`, không kèm lịch), không gọi `GET /sessions/{id}` vì bản ghi đó
 * có cả lịch BẬT/TẮT đã niêm phong. Khối "Khách đang hỏi": 3 câu hỏi mới nhất từ bình luận của khách, đã lọc trùng.
 * Lưu ý còn mở: `GET /sessions/{id}/comments` vẫn trả block_id của từng bình luận (cần lõi làm endpoint riêng).
 */
export function HostView({ sessionId }: { sessionId: string }) {
  const { state, error } = useHostView(sessionId);
  const [nhan, setNhan] = useState<SourceLabel | null>(null);
  const binhLuan = useHoiDinhKy<Comment[]>(sessionId, () => api.comments(sessionId), {
    chuKyMs: 3000,
    loiMacDinh: "Không đọc được bình luận.",
  });
  useEffect(() => {
    let huy = false;
    api
      .sessions()
      .then((ds) => {
        const s = ds.find((x) => x.session_id === sessionId);
        if (!huy) setNhan(s ? sourceLabel(s) : null);
      })
      .catch(() => {
        if (!huy) setNhan(null);
      });
    return () => {
      huy = true;
    };
  }, [sessionId]);
  const cauHoi = cauHoiMoiNhat(binhLuan.duLieu ?? [], 3);
  const mon = state?.pinned_product ?? null;

  return (
    <div className="ban-nd" data-testid="host-view" data-vung-chinh="" data-chup="nguoi-dan">
      <header className="ban-nd__tren">
        <p className="ban-nd__nho">Màn người dẫn · {LOI_THUONG.lamMuMotPhan}</p>
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
              {state.price.toLocaleString("vi-VN")} đ
              {state.stock != null ? ` · còn ${state.stock.toLocaleString("vi-VN")} trong kho` : ""}
            </p>
          ) : null}
        </section>
        <section aria-labelledby="nd-h-hoi">
          <h2 id="nd-h-hoi" className="ban-nd__nhan">
            Khách đang hỏi
          </h2>
          <p className="ban-nd__nho" data-testid="nguoi-dan-nguon-hoi">
            Lấy từ bình luận của khách: 3 câu hỏi mới nhất, câu trùng chỉ giữ một.
          </p>
          {cauHoi.length === 0 ? (
            <p className="ban-nd__nho">Chưa có câu hỏi mới.</p>
          ) : (
            <ul className="ban-nd__cau-hoi" data-testid="nguoi-dan-cau-hoi">
              {cauHoi.map((c) => (
                <li key={c.comment_id}>{docChoDaChe(c.text)}</li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <p className="ban-nd__duoi">Đã phát {mmss(state?.elapsed_s ?? 0)}</p>
    </div>
  );
}

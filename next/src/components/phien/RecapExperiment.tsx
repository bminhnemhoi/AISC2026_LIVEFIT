"use client";

import { TongKet } from "@/components/tong-ket/TongKet";

/**
 * Tổng kết một phiên. Giữ tên cũ cho mọi chỗ đang nhập; màn thật nằm ở `components/tong-ket` (giao diện 2.0, U5):
 * thẻ kết luận ĐỔI / GIỮ / ĐO THÊM, ba biểu đồ, tóm tắt, điều chưa biết và chi tiết cho người kiểm.
 * Các data-testid cũ (experiment-recap, verdict, estimate-card, source-badge, recap-summary) vẫn còn ở màn mới.
 */
export function RecapExperiment({ sessionId }: { sessionId: string }) {
  return <TongKet sessionId={sessionId} />;
}

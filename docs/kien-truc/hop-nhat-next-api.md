# Hợp đồng nối: Live Desk (`next/`) và lõi Python

*Viết 15/10/2026 cho nhánh `vong2/hop-nhat`. Tài liệu này mô tả đúng mã hiện có; đổi mã thì sửa tài liệu trong cùng commit.*

## 1. Một sản phẩm, ba nguồn, một đường ống

```
 LiveRoomSim (mô phỏng) ─────┐
 Phòng xem dàn dựng (/xem) ───┼─► FastAPI + kho (PostgreSQL / bộ nhớ có ảnh chụp)
 Live thật (API nền tảng) ────┘        │ lịch bốc thăm (outer/inner) · bộ ước lượng (RI, KTC)
                                       ▼
        next/ — /phien (danh sách) · /phien/{id} (bàn thí nghiệm, người vận hành)
                /phien/{id}/nguoi-dan (người dẫn, làm mù một phần) · /phien/{id}/tong-ket
                /xem/{mã} (người xem trên điện thoại, công khai)
```

- **Lõi Python là nguồn sự thật duy nhất** cho lịch, sự kiện, ước lượng. `next/` không tính nhân quả; mọi số trên bàn thí nghiệm truy được về một hàm thuần trong `next/src/lib/livelift-api/desk.ts` và một trường API.
- Live Desk minh hoạ của Tiến (`/`, `/desk/*`, chạy trong trình duyệt) vẫn còn, có nhãn SIMULATED, và trang chủ dẫn sang `/phien` cho chế độ Thí nghiệm.

## 2. Ba đường mạng

| Đường | Ai dùng | Token | Cơ chế |
|---|---|---|---|
| `/api/ll/*` → FastAPI | bàn thí nghiệm, người dẫn, danh sách | **token người vận hành, chỉ ở máy chủ Next** (`LIVELIFT_API_TOKEN`) | proxy `next/src/app/api/ll/[...path]/route.ts`, chỉ chuyển cặp (phương thức, đường) có trong `allowlist.ts`; lọc query (`role`, `env`, `gieo_lai`); chặn `..`, `//`, `%2f`, `%5c`; quá thời 15 giây |
| `/xem-api/*` → FastAPI | người xem ẩn danh | không | rewrite cùng gốc trong `next.config.mjs` khi chạy máy; sau đường hầm thì Caddy (`docker/Caddyfile.tunnel`) chuyển thẳng tới API |
| `/xem/*`, `/_next/*` | trang phòng xem | không | Next |

Đường hầm công khai (Cloudflare Tunnel → Caddy `:8088`) **chỉ mở** `/xem-api/*`, `/r/*`, `/xem/*`, `/_next/*`; mọi đường khác trả 404 (cổng G2, 15/10/2026: 11 đường thử). Caddy giữ kết nối rảnh tới API tối đa 4 giây vì uvicorn đóng sau 5 giây; chạy uvicorn kèm `--timeout-keep-alive 75`.

## 3. Endpoint `next/` dùng

| Màn hình | Gọi | Ghi chú |
|---|---|---|
| `/phien` | `GET sessions` · `POST demo/seed` (1 phiên đã xong + 1 phiên đang phát, 90 phút) · `POST demo/seed-vang` | phiên mẫu mang `is_demo` |
| `/phien/{id}` | `GET sessions/{id}`, `/schedule`, `/state`, `/ticks`, `/comments`, `/orders`, `/bao-cao` (mỗi lần thăm thứ 5) · `POST /actions/execute` (ghim, có ghi exposure) · `POST /end` | thăm mỗi 2 giây |
| `/phien/{id}/nguoi-dan` | `GET sessions/{id}/state?role=host` | chỉ `elapsed_s`, `pinned_product`, `price`, `stock` |
| `/phien/{id}/tong-ket` | `GET sessions/{id}/bao-cao` | ước lượng, KTC 95%, p, số khối |
| `/xem/{mã}` | `GET xem-api/{mã}/trang-thai` · `POST xem-api/{mã}/su-kien` | công khai, có trần tần suất theo địa chỉ và theo người xem |

## 4. Quy tắc làm mù (không được phá)

1. **Chỉ người vận hành thấy khối.** `role=host` và `/xem-api/*/trang-thai` không có trường nào về nhánh, khối, lịch hay xác suất gán (`tests/test_api_xem.py`: phản hồi ở khối BẬT và TẮT chỉ khác `pinned` và `server_time_ms`).
2. **Người dẫn bị làm mù một phần:** vẫn thấy sản phẩm đang ghim; ở chế độ tự ghim lệnh ghim chỉ đến trong khối BẬT.
3. **Người xem thấy thẻ ghim chỉ trong khối nó được đặt** (`pinned_in_block`), nên hết khối BẬT là thẻ biến mất.
4. Phiên `lab` chỉ ghim sản phẩm của phòng (`phong_xem.products`), kể cả khi danh mục dùng chung (`actions.py`).

## 5. Nhãn nguồn dữ liệu (luôn hiện)

`sourceLabel()` trong `desk.ts`, theo thứ tự ưu tiên:

| Điều kiện | Nhãn |
|---|---|
| `platform == "lab"` | **DÀN DỰNG** — người thật ẩn danh, tiền ảo |
| `is_demo` hoặc `platform` là `sim` / `replay` | **MÔ PHỎNG** |
| `dry_run` hoặc có bình luận tổng hợp | **CHẠY THỬ** — bị loại khỏi kết quả gộp |
| còn lại | **THẬT** |

## 6. Phòng xem: dữ liệu và quyền

- Đồng ý trước mọi sự kiện (máy chủ trả 403 nếu chưa); phiên bản lời đồng ý ghi theo phòng.
- Lưu `sha256("lab:{phiên}:{mã người xem}")[:32]`, không lưu mã gốc, không lưu IP; bình luận đi qua bộ lọc PII như bình luận thật.
- Rút lui xoá mọi click, bình luận, đơn tiền ảo và nhật ký của người đó, tính lại số người xem các mốc liên quan. Từ 19/10/2026 rút lui được ở mọi trạng thái phòng (chưa mở, đang mở, đã đóng, cả khi đã tắt) vì quyền rút lui sống lâu hơn buổi phát. Loại sự kiện khác vẫn cần phòng đang mở: phòng chưa mở hoặc đã đóng trả 409, phòng đã tắt trả 404. Rút lui lặp lại trả 200 `duplicate`, không xoá hay ghi thêm; thao tác khác của người đã rút lui nhận 410 khi phòng còn mở. Rút lui vẫn cần đã đồng ý (403) và chịu trần tần suất.
- Phòng đã tắt chỉ trả lời người từng tham gia (còn dòng `dong_y` hoặc `rut_lui`). Người chưa từng tham gia gửi rút lui vào phòng tắt nhận đúng 404 của mã không tồn tại, xét trước trần tần suất theo người xem (trần theo địa chỉ vẫn áp), để 403 hay 429 không lộ rằng mã từng có (`routes/xem.py::su_kien`, `_tung_tham_gia`).
- Phòng đã tắt thì `/xem-api/<mã>/trang-thai` trả 404 (trang `/xem/<mã>` vẫn 200): trang hiện "Phòng không tồn tại hoặc đã tắt." và chỉ còn nút rút lui tối giản cho máy còn giữ mã ngẫu nhiên (chỉ đọc mã cũ, không tạo mã mới). Rút lui hỏi xác nhận ngay trong trang, không dùng `window.confirm` (`XemRoom.tsx`). Vẫn đóng buổi bằng `/end`, không tắt phòng, để trang còn đầy đủ (`tests/test_api_xem.py`).
- Sự kiện idempotent theo `event_id`; trình duyệt gửi lại cùng `event_id` khi rớt kết nối hoặc gặp 5xx, không gửi lại 4xx (`postEvent`).
- Mức người xem theo mốc 30 giây = số người xem khác nhau còn nhịp tim trong mốc.

## 7. Thuật ngữ chung (giao diện, slide, poster)

| Dùng | Không dùng | Vì sao |
|---|---|---|
| Cỡ mẫu | Độ tin cậy | "độ tin cậy" dễ đọc thành xác suất đúng |
| Lượt nhấp hợp lệ trên 1.000 giây-người-xem | CTR | CTR của TikTok là nhấp / lượt xem |
| Gợi ý kiểu nền tảng (tương quan) | Gợi ý AI | nói rõ bản chất tương quan |
| Làm mù một phần | Làm mù | người dẫn vẫn thấy sản phẩm đang ghim |
| Phòng dàn dựng | Phiên thật | tiền ảo, mẫu tự nguyện |

## 8. Thiết kế tối thiểu để kiểm định được

Với ràng buộc gán hiện tại (≥ 2 khối mỗi nhánh mỗi giai đoạn, cân bằng chuyển tiếp), số chuỗi gán khả dĩ mỗi phiên là 2 (40 phút), 4 (60 phút), hàng nghìn từ 90 phút (khối 5 phút); khối 10 phút cần 180 phút. Vì vậy `/demo/seed` mặc định 90 phút và phòng xem chạy 180 phút mỗi tối (sổ sự cố 15/10/2026; `livelift.sim.liveroom_grid.design_richness`).

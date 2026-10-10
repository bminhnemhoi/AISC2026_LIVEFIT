# Mockup LiveLift (bản nháp 1, 09/10/2026)

Ba màn cho vòng 2 AISC'26. Đây là bản thiết kế tĩnh, **chưa phải giao diện đang chạy**. Dữ liệu trong ảnh là mô phỏng.

| Ảnh | Màn | Câu hỏi duy nhất màn đó trả lời |
|---|---|---|
| `prepare.png` | Chuẩn bị | Sản phẩm đã sẵn sàng để bắt đầu live chưa? |
| `desk.png` | Live Desk | Bây giờ nên ghim gì? |
| `recap.png` | Tổng kết | Buổi live vừa rồi diễn ra thế nào, và điều gì chưa biết? |

Nguyên tắc: mỗi màn một câu hỏi; câu trả lời to nhất; ghim và bỏ ghim luôn một chạm; gợi ý luôn kèm lý do, cỡ mẫu và độ tin cậy; mọi dữ liệu mô phỏng gắn nhãn SIMULATED; thiếu số liệu hiện "Chưa nhập", không phải 0.

Chạy lại: `node` + Playwright chụp `mockup.html?s=prepare|desk|recap` ở 1440×900, tỉ lệ 2.

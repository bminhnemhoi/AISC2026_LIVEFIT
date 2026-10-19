# Tài liệu LiveLift: đọc gì cho Vòng 2

*Lập 19/10/2026. Thư mục `docs/` có hơn 100 tệp viết qua nhiều đợt; phần lớn là ghi chép có ngày. Trang này chỉ ra tệp nào phản ánh định vị và bộ số hiện hành.*

Câu định vị: LiveLift giúp người bán livestream tự đo xem việc ghim một sản phẩm có thật sự làm khách bấm mua nhiều hơn, bằng cách bốc thăm bật/tắt theo từng khối 5 phút thay vì đoán theo tương quan.

## Đọc trước (theo thứ tự)

| # | Tệp | Để làm gì |
|---|---|---|
| 1 | [`canon/`](canon/README.md) | Nguồn chuẩn: số (`so.yaml`), thuật ngữ và từ cấm, câu định vị, mốc thời gian, văn liệu đã kiểm |
| 2 | [`competition/FACT-SHEET.md`](competition/FACT-SHEET.md) | Mọi con số kèm lệnh sinh lại. Số mới vào đây trước rồi mới đi nơi khác |
| 3 | [`research/2026-10-15-tong-quan-nghien-cuu-va-thi-truong.md`](research/2026-10-15-tong-quan-nghien-cuu-va-thi-truong.md) | Tổng quan 15/10: văn liệu, thị trường Việt Nam, Trung Quốc, Đông Nam Á, đối thủ, nguồn có URL |
| 4 | [`benchmarks/liveroom-kiem-dinh.md`](benchmarks/liveroom-kiem-dinh.md) | Kiểm định phương pháp trên LiveRoomSim (MÔ PHỎNG): báo nhầm 4,3%, lực 95% với +30%, dư âm −46% → −35% |
| 5 | [`HUONG-DAN-PHONG-XEM.md`](HUONG-DAN-PHONG-XEM.md) | Mở phòng xem (DÀN DỰNG) cho buổi thử nội bộ và cho người ngoài nhóm từ Vòng 3 |
| 6 | [`kien-truc/hop-nhat-next-api.md`](kien-truc/hop-nhat-next-api.md) | Hợp đồng nối giữa mặt tiền `next/` (cổng 3130) và lõi FastAPI: ba nguồn dữ liệu, một đường ống, các route `/phien`, `/xem` |

## Tham khảo khi cần

| Tệp | Nội dung |
|---|---|
| [`competition/AISC26-THE-LE.md`](competition/AISC26-THE-LE.md) | Thể lệ AISC'26 chép 09/10/2026 (bốn vòng, hạn nộp) |
| [`../PREREGISTRATION.md`](../PREREGISTRATION.md) | Kế hoạch phân tích đăng ký trước: chỉ số chính, bỏ đầu khối, quy tắc dừng |
| [`incident-log.md`](incident-log.md) | Sổ sự cố, mỗi hàng có nguyên nhân gốc (số hàng là số "sự cố" được trích) |
| [`HUONG-DAN-TEST.md`](HUONG-DAN-TEST.md) | Cách chạy test |
| [`benchmarks/`](benchmarks/) | Các phép đo có lệnh sinh lại; số hiện hành vẫn lấy từ FACT-SHEET |

## LƯU TRỮ: không phản ánh định vị hiện tại

Các thư mục dưới đây giữ lại để truy vết. Không trích số, câu định vị hay tên tính năng từ đây sang deck, poster hay giao diện.

| Thư mục | Vì sao lưu trữ |
|---|---|
| [`research/codex-gap-study/`](research/codex-gap-study/) | Nghiên cứu 05/10/2026 (tiếng Anh) đề xuất chuyển sang "bàn điều phối chương trình live", bỏ trọng tâm đo nhân quả. Nhóm không theo hướng này |
| [`tiktok/`](tiktok/) | Tích hợp TikTok Login Kit (V1) và kế hoạch "Live Intelligence" (V7). Ghi chép kỹ thuật, không phải định vị; quyền đọc số liệu Shop chưa được cấp |
| [`competition/sang-tao-tre-2026/`](competition/sang-tao-tre-2026/) | Hồ sơ cuộc thi khác (Sáng tạo trẻ Quốc gia về AI 2026, nộp 30/09/2026). Là bản chụp có ngày, test khoá không cho sửa. FACT-SHEET vẫn trỏ vào `hinh/du-lieu/` và `03-NLP-NANG-CAP.md` để lấy lệnh sinh số |

Các tệp ghi chép có ngày khác trong `research/` (08–09/2026) cũng là lưu trữ; bản 15/10 ở mục trên thay chúng.

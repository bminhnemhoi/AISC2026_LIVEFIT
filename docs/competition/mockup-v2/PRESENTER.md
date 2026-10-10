# Hướng dẫn trình bày mockup LiveLift (vòng 2 AISC'26, 22/10/2026)

Mockup chạy hoàn toàn trong một trang, không cần mạng, không cần máy chủ. Mọi con số là **dữ liệu mẫu**; nền tảng là **SIMULATED Shopee Live**, không có gì được gửi tới Shopee.

## 1. Cách mở

1. Chép cả thư mục `dist/` vào máy trình chiếu (và một USB dự phòng).
2. Mở `dist/index.html` bằng Chrome hoặc Edge (bấm đúp là được). Hoặc chạy `npx serve dist` rồi mở địa chỉ nó in ra.
3. Bấm **F11** để toàn màn hình, rồi **P** để vào chế độ trình chiếu: ẩn thanh dưới, ẩn “Đã lưu”, và **chữ to hơn** (chữ thường từ 16 px, nhãn nhỏ từ 14 px) để đọc được từ cuối hội trường.
4. Bấm **R** để chắc chắn đang ở bước 0. Màn hình chuẩn để chiếu là 1920×1080; 1440×900 và 1280×720 cũng hiển thị đủ.

Kiểm tra trước giờ báo cáo: bấm `→` vài lần, rồi `R` để quay về. Nếu chữ tiếng Việt có dấu hiển thị đúng (so với `screens/00-font-render-test.png`: “Nên ghim tiếp: Quần cargo, ếệạữ ởầ”) và nút đỏ gạch “Kết nối SIMULATED Shopee Live” hiện ra, máy đã sẵn sàng.

Giao diện (từ 09/10): **Calm Studio** do nhóm chọn. Nền kem, chữ nâu mực, nút chính đỏ gạch, góc vuông. Sản phẩm đang ghim là tấm thẻ giấy nghiêng có băng dính; SIMULATED là con dấu viền tím nghiêng. Chỉ ba thứ nghiêng: thẻ đang ghim, con dấu, điện thoại người dẫn.

## 2. Phím tắt

| Phím | Việc |
|---|---|
| `→` / `←` | Bước tiếp / bước trước của kịch bản (luôn chạy, kể cả khi có hộp thoại). Khi Hành trình dữ liệu đang mở, `→` đi qua từng bước 1 đến 6 trước |
| `Space` | Tự chạy kịch bản hoặc dừng |
| `R` | Về đầu (bước 0) |
| `1` `2` `3` | Chuẩn bị / Live Desk / Tổng kết |
| `J` | Bật, tắt Hành trình dữ liệu |
| `↑` `↓` | Khi Hành trình dữ liệu đang mở: chọn bước 1 đến 6 (khung đỏ hiện trên đúng chỗ) |
| `T` | Giao diện sáng (nền kem) hoặc tối (nâu mực ấm, cho người live buổi tối). Máy chiếu: để sáng |
| `P` | Chế độ trình chiếu: ẩn thanh dưới và đồng hồ |
| `?` | Hiện danh sách phím |
| `Esc` | Đóng lớp đang mở |

Thanh dưới (khi không ở chế độ P) có nút ‹ › và “Tự chạy”, số bước hiện tại, đồng hồ mô phỏng (chạy, 15×, 60×, +1 phút), “Về dữ liệu này”, và nút đổi giao diện.

## 3. Kịch bản 90 giây, từng nhịp

Mỗi dòng là một lần bấm `→`. Cột “Nói” là câu gợi ý; nói tự nhiên, đừng đọc.

| Bước | Trên màn hình | Nói |
|---|---|---|
| 0 | Chuẩn bị, chưa có sản phẩm | “Đây là LiveLift: bàn trợ lý cho người bán hàng qua livestream. Bắt đầu từ con số 0.” |
| 1 | Kết nối SIMULATED | “Một chạm để kết nối. Ở đây là nền tảng mô phỏng, ghi rõ chữ SIMULATED; chúng em không gửi gì tới Shopee.” |
| 2 | Dán CSV | “Người bán dán danh sách sản phẩm: tên, giá, tồn kho.” |
| 3 | Từng dòng được nạp; Túi vải tote “Chưa nhập” | “Túi vải tote chưa có giá. LiveLift ghi ‘Chưa nhập’, không bao giờ coi là 0. Thiếu dữ liệu khác với bằng không.” |
| 4 | Live Desk mở, 120 người xem | “Bắt đầu live. Một màn hình, một câu trả lời lớn ở giữa.” |
| 5 | Bình luận đầu tiên; gợi ý độ tin cậy **thấp** | “Bình luận đổ về. Trợ lý đã thấy Áo hoodie được hỏi, nhưng mới 4 bình luận, nên nó nói thẳng: độ tin cậy thấp.” |
| 6 | Độ tin cậy **trung bình**: 7 hỏi giá, thêm giỏ 8 so với 3, còn 24 | “Hai phút sau: 12 bình luận, 7 người hỏi giá, thêm giỏ từ 3 lên 8, còn 24 cái. Gợi ý luôn kèm lý do, cỡ mẫu và độ tin cậy. Độ tin cậy chỉ tính từ cỡ mẫu, không có phần trăm tự đặt.” |
| 7 | Ghim: hoodie lên đầu “ĐANG GHIM”, vạch trên biểu đồ, điện thoại đổi | “Người vận hành quyết định, một chạm. Sản phẩm lên đầu danh sách, biểu đồ đánh dấu lúc ghim, và điện thoại người dẫn hiển thị sản phẩm.” |
| 8 | Flash sale “chưa đủ tín hiệu, 6/10” | “Trợ lý cũng canh flash sale. Chưa đủ tín hiệu thì nó nói chưa đủ, và nói thiếu bao nhiêu.” |
| 9 | “Nên chạy flash sale trong 1 phút” | “Đủ rồi: 12 lượt thêm giỏ, trước đó 7, 4 người chốt đơn.” |
| 10 | Bỏ qua | “Người vận hành có quyền bỏ qua. Gợi ý không phải mệnh lệnh.” |
| 11 | Banner “Hết hạn quyền truy cập” | “Khi nền tảng báo lỗi, LiveLift nói một lần, ngừng gọi, và để người vận hành tiếp tục bằng tay. Số người xem thành ‘chưa rõ’, không phải 0.” |
| 12 | Kết nối lại | “Kết nối lại, dữ liệu chạy tiếp. Khoảng mất dữ liệu được đánh sọc, không bị lấp bằng số 0.” |
| 13 | Tự đổi ghim sang Quần cargo; hai vạch | “Ghim, bỏ ghim luôn tự do. Lần này người vận hành tự chọn, không theo gợi ý.” |
| 14 | Hộp “Kết thúc buổi live lúc 29:40?” | “Kết thúc live.” |
| 15 | Tổng kết + “Điều chưa biết” | “Tổng kết ghi lại gợi ý nào được nhận, bỏ qua, tự làm. Và quan trọng nhất: điều chưa biết. Ghim hoodie có làm tăng thêm giỏ không? Chưa biết; quan sát không phải nhân quả. Số đơn thật: chưa biết.” |
| 16 | Hành trình dữ liệu: bảng sáu bước bên phải, sáu số nhỏ trên Live Desk | “Đây là sáu việc của đề tài Data Driven Business, đặt đúng chỗ trên sản phẩm.” |
| 16 + `→` ×6 | Mỗi lần `→` sáng một bước, khung đỏ bao đúng chỗ đó | 1 “Thu thập: bình luận, người xem đổ về.” 2 “Làm sạch: số điện thoại bị che.” 3 “Phân tích: đếm ý định trong 2 phút.” 4 “Khai thác insight: ba con số làm lý do.” 5 “Đề xuất: nên ghim gì.” 6 “Đánh giá: tổng kết, kể cả điều chưa biết.” |

Nhịp tự chạy (`Space`) mất khoảng 95 giây. Nếu cần nhanh hơn, bấm `→` thay vì chờ.

**Nếu giám khảo hỏi “cái gì là thật?”**: mở “Về dữ liệu này” ở thanh dưới (đang ở chế độ trình chiếu thì bấm `P` để hiện lại thanh dưới). Ở đó ghi rõ cái gì là mô phỏng, luật của trợ lý, và rằng “Đã lưu” là ý đồ thiết kế cho bản có cơ sở dữ liệu (vòng chung kết). Cũng từ đó có thể mở thẳng từng trạng thái: độ tin cậy thấp, đang tải, hết hạn quyền truy cập, thí nghiệm bị khoá, xác nhận kết thúc.

**Nếu bị hỏi về chế độ Thí nghiệm**: bấm “Thí nghiệm” trên thanh trên. Nó bị khoá, với lý do: cần phiên từ 90 phút và đủ người xem. Chúng em không giả vờ đã chạy thí nghiệm.

## 4. Kế hoạch B

1. **Máy trình chiếu không mở được trang**: mở `dist/index.html` trên laptop của nhóm, nối HDMI. Trang không cần mạng.
2. **Không có laptop nào chạy được**: dùng ảnh trong **`screens/presenter/`** (2560×1440, chụp ở chế độ trình chiếu, chữ to, không có thanh dưới; đây là bộ nên đưa vào slide). `screens/` có cùng các trạng thái kèm thanh điều khiển. Thứ tự chiếu: `01-setup-empty`, `01-setup-products`, `02-live-desk-low-confidence`, `02-live-desk-suggestion`, `02-live-desk-pinned`, `02-live-desk-flash-ready`, `02-live-desk-platform-condition`, `02-live-desk-two-pins`, `03-recap`, `04-data-journey`, `04-data-journey-stage-4`. Chèn sẵn các ảnh này vào cuối file slide nộp ngày 19/10.
3. **Chữ hiển thị sai dấu**: font đã nhúng sẵn trong trang; nếu vẫn sai, trình duyệt quá cũ. Đổi sang Chrome hoặc Edge bản mới, hoặc dùng ảnh.
4. **Lỡ bấm lung tung**: `R` về đầu, hoặc gõ số bước trong địa chỉ: `index.html?beat=6` mở thẳng bước 6.

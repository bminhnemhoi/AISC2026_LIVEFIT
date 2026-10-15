# Hướng dẫn mở phòng xem dàn dựng

Phòng xem dàn dựng là cách đội có dữ liệu **người thật** khi chưa có người bán đối tác. Một video người dẫn quay sẵn được phát lặp lại trên trang `/xem/<mã>`. Thẻ sản phẩm được ghim theo **lịch bốc thăm** (khối 5 phút), do autopilot thực hiện qua đúng đường mã của phiên thật. Người tham gia ẩn danh vào bằng điện thoại, xem, bấm, thêm giỏ, "mua" bằng tiền ảo và bình luận. Toàn bộ dữ liệu đi vào cùng bảng và cùng bộ ước lượng như phiên thật; chỉ khác ở `platform = 'lab'`.

**Cách gọi đúng khi trình bày:** "thử giao thức có người thật trong phòng dàn dựng". Đây **không phải** bằng chứng hiệu ứng trên thị trường thật. Các giới hạn phải nói rõ:
- Người tham gia tự nguyện, phần lớn là sinh viên.
- Giao dịch bằng tiền ảo.
- Có thể có hiệu ứng chiều lòng.
- Một số người có thể ngồi cùng phòng với nhau.

## 1. Thiết kế thí nghiệm của phòng

- **Khối BẬT:** autopilot ghim một sản phẩm. Lựa chọn tầng trong được ghi nhật ký như phiên thật.
- **Khối TẮT:** không có thẻ ghim. Phòng không có người dẫn thật, nên cũng không có "cách thường lệ" để làm đối chứng. Thẻ ghim chỉ hiện trong khối mà nó được đặt.
- Phép so sánh vì vậy trả lời đúng câu hỏi: **ghim sản phẩm có làm người xem bấm và mua nhiều hơn không**.
- **Phơi nhiễm:** trang gửi nhịp tim mỗi 15 giây. Mỗi mốc 30 giây đếm số người xem khác nhau có thao tác trong mốc đó. Kết quả chính vẫn là click hợp lệ trên 1.000 giây·người xem.
- **Làm mù:** trang trạng thái không bao giờ trả về nhánh, chỉ số khối, lịch hay mã thiết kế (`tests/test_api_xem.py::test_responses_in_on_and_off_blocks_differ_only_by_the_pinned_card`).

## 2. Chuẩn bị (làm trước một ngày)

1. Quay video người dẫn dài 6–8 phút, giới thiệu đúng các sản phẩm trong danh sách. Tải video lên nơi có đường dẫn công khai (YouTube không công khai, hoặc tệp mp4).
2. Ghi danh sách sản phẩm vào `ops/phong-xem/san-pham.json`. Mỗi dòng có `product_id`, `name`, `cost`, `price`, `stock`. Nên có 4–6 sản phẩm.
3. Cài `cloudflared`: `winget install --id Cloudflare.cloudflared`.
4. Chốt lời đồng ý (mẫu ở mục 6) và ngày xoá dữ liệu.
5. Gửi thư mời tuyển người theo `D:\AISC2026\AISC26_Vong2\tuyen-nguoi\THU-TUYEN-NGUOI-PHONG-XEM.md`.

## 3. Mở phòng (mỗi buổi tối, khoảng 15 phút)

Nên chạy phòng trên **một API riêng** cho gọn dữ liệu. Autopilot của phiên `lab` chỉ chọn ứng viên ghim trong `products` của phòng (kể cả khi danh mục dùng chung), nên không có rủi ro ghim nhầm sản phẩm ngoài phòng (`tests/test_api_xem.py::test_lab_pins_only_room_products_even_with_a_shared_catalog`).

```powershell
# 1) API: kho bộ nhớ có ảnh chụp, autopilot bật, đặt token
$env:STORE_BACKEND = "memory"
$env:STORE_SNAPSHOT_PATH = "data\phong-xem\snapshot.json"
$env:LIVELIFT_AUTOPILOT = "1"
$env:INGEST_TOKEN = "<một chuỗi dài ngẫu nhiên>"
.venv\Scripts\python -m uvicorn livelift.api.main:app --port 8000 --timeout-keep-alive 75
# --timeout-keep-alive 75: uvicorn mặc định đóng kết nối rảnh sau 5 s; proxy giữ
# lâu hơn sẽ thỉnh thoảng gặp ECONNRESET (lỗi 502 phía người xem). Caddyfile.tunnel
# cũng đặt keepalive 4s cho chắc.

# 2) Next (cửa sổ khác)
cd next; $env:LIVELIFT_API_BASE = "http://127.0.0.1:8000"; npm run dev

# 3) Tạo phòng và bắt đầu phát (cửa sổ khác, cùng INGEST_TOKEN)
.venv\Scripts\python scripts\mo_phong_xem.py --san-pham ops\phong-xem\san-pham.json --phut 180 --video <đường dẫn video> --bat-dau

# 4) Cổng vào chỉ mở phòng xem
docker run --rm --name livelift-caddy-xem -p 8088:8088 -v "${PWD}\docker\Caddyfile.tunnel:/etc/caddy/Caddyfile:ro" caddy:2

# 5) Đường hầm công khai
cloudflared tunnel --url http://localhost:8088
```

Lệnh thứ 5 in ra một địa chỉ dạng `https://<tên>.trycloudflare.com`. Đường dẫn gửi người tham gia là `<địa chỉ đó>/xem/<mã phòng>`, dùng mã do lệnh thứ 3 in ra. Tạo mã QR từ đường dẫn này.

**Kiểm tra trước khi mời người:** mở `<địa chỉ>/sessions` phải ra 404. Mở `<địa chỉ>/xem/<mã>` trên điện thoại phải thấy trang đồng ý.

## 4. Trong buổi

- Mở bàn trợ live trên máy (`http://localhost:3130`) để theo dõi số người, click và khối. Đường này **không** đi qua đường hầm.
- Không ghim tay. Autopilot làm việc đó trong khối BẬT, và ghim tay sẽ làm sai thiết kế.
- Nếu có sự cố, ghi giờ và mô tả vào `ops/templates/nhat-ky-phien.md`.

## 5. Đóng phòng

```powershell
# Kết thúc phiên (người xem thấy "đã đóng")
curl.exe -X POST -H "Authorization: Bearer $env:INGEST_TOKEN" http://127.0.0.1:8000/sessions/<phiên>/end
```

Tắt `cloudflared` và Caddy ngay sau đó. Báo cáo của phiên xem tại `http://localhost:3130/phien/<phiên>/tong-ket`.

## 6. Mẫu lời đồng ý (hiện trước khi vào phòng)

> **Bạn đang vào một phòng live dàn dựng phục vụ nghiên cứu sinh viên.**
>
> - Đây không phải buổi bán hàng thật. Mọi giao dịch dùng tiền ảo.
> - Chúng tôi ghi lại các thao tác của bạn trong phòng (xem, bấm, thêm giỏ, "mua", bình luận) cùng một mã ngẫu nhiên do máy bạn tạo. Chúng tôi **không** thu tên, số điện thoại, email hay địa chỉ IP. Bình luận được tự động che thông tin cá nhân trước khi lưu.
> - Cách sản phẩm hiển thị trong phòng có thể thay đổi theo thời gian. Đây là một phần của nghiên cứu.
> - Bạn có thể bấm "Rút lui" bất cứ lúc nào. Khi đó toàn bộ dữ liệu của bạn bị xoá khỏi hệ thống.
> - Dữ liệu chỉ dùng cho đề tài LiveLift (AISC'26) và bị xoá chậm nhất ngày 31/12/2026.
> - Việc tham gia không liên quan đến điểm số hay đánh giá học tập nào.
> - Căn cứ: Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15.

## 7. Bảo vệ dữ liệu và quyền rút lui

- Máy chủ chỉ lưu `sha256(lab:<phiên>:<mã người xem>)`, không lưu mã gốc và không lưu địa chỉ IP.
- Bình luận đi qua bộ lọc PII như bình luận thật. Chỉ văn bản đã lọc được lưu.
- Khi người xem bấm "Rút lui", hệ thống xoá mọi click, bình luận, đơn tiền ảo và nhật ký của người đó, rồi tính lại số người xem của các mốc liên quan. Sau đó mọi thao tác mới từ người đó bị từ chối.
- Mã nguồn công khai theo AGPL-3.0. Đường dẫn mã nguồn nằm ở chân trang phòng xem (`source_code_url`).

## 8. Giới hạn đã biết

- Kho bộ nhớ có ảnh chụp chạy trong một tiến trình. Nếu cần độ bền cao hơn, dùng Postgres với migration 0010.
- Đường hầm nhanh của Cloudflare không có cam kết hoạt động liên tục. Đổi địa chỉ thì phải gửi lại đường dẫn.
- Wi-Fi của trường có thể dồn nhiều người vào cùng một địa chỉ. Trần theo địa chỉ mặc định là 600 lượt/phút (`PHONG_XEM_RATE_LIMIT_PER_MIN`); trần cho mỗi người xem là 40 lượt/phút.

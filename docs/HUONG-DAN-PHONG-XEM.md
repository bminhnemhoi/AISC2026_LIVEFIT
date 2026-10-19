# Hướng dẫn mở phòng xem dàn dựng

Phòng xem dàn dựng là cách đội có dữ liệu **người thật** khi chưa có người bán đối tác. Một video người dẫn quay sẵn được phát lặp lại trên trang `/xem/<mã>`. Thẻ sản phẩm được ghim theo **lịch bốc thăm** (khối 5 phút), do autopilot thực hiện qua đúng đường mã của phiên thật. Người tham gia ẩn danh vào bằng điện thoại, xem, bấm, thêm giỏ, "mua" bằng tiền ảo và bình luận. Toàn bộ dữ liệu đi vào cùng bảng và cùng bộ ước lượng như phiên thật; chỉ khác ở `platform = 'lab'`.

**Cách gọi đúng khi trình bày:** "thử giao thức có người thật trong phòng dàn dựng". Đây **không phải** bằng chứng hiệu ứng trên thị trường thật. Các giới hạn phải nói rõ:
- Người tham gia tự nguyện, phần lớn là sinh viên.
- Giao dịch bằng tiền ảo.
- Có thể có hiệu ứng chiều lòng.
- Một số người có thể ngồi cùng phòng với nhau.

Buổi thử nội bộ tối 20/10: làm theo mục 3 với thay đổi ở mục 9.

## 1. Thiết kế thí nghiệm của phòng

- **Khối BẬT:** autopilot ghim một sản phẩm. Lựa chọn tầng trong được ghi nhật ký như phiên thật.
- **Khối TẮT:** không có thẻ ghim. Phòng không có người dẫn thật, nên cũng không có "cách thường lệ" để làm đối chứng. Thẻ ghim chỉ hiện trong khối mà nó được đặt.
- Phép so sánh vì vậy trả lời đúng câu hỏi: **ghim sản phẩm có làm người xem bấm và mua nhiều hơn không**.
- **Phơi nhiễm:** trang gửi nhịp tim mỗi 15 giây. Mỗi mốc 30 giây đếm số người xem khác nhau có thao tác trong mốc đó. Kết quả chính vẫn là click hợp lệ trên 1.000 giây·người xem.
- **Làm mù:** trang trạng thái không bao giờ trả về nhánh, chỉ số khối, lịch hay mã thiết kế (`tests/test_api_xem.py::test_responses_in_on_and_off_blocks_differ_only_by_the_pinned_card`).

## 2. Chuẩn bị (làm trước một ngày)

1. Quay video người dẫn dài 6–8 phút, giới thiệu đúng các sản phẩm trong danh sách. Đặt video ở chỗ phòng phát được: YouTube không công khai, link mp4 `https://`, hoặc tệp mp4 dưới `next/public/xem/` (mục 9).
2. Ghi danh sách sản phẩm vào `ops/phong-xem/san-pham.json`. Mỗi dòng có `product_id`, `name`, `cost`, `price`, `stock`. Nên có 4–6 sản phẩm.
3. Cài `cloudflared`: `winget install --id Cloudflare.cloudflared`.
4. Chốt lời đồng ý (mẫu ở mục 6) và ngày xoá dữ liệu.
5. Gửi thư mời tuyển người theo `D:\AISC2026\AISC26_Vong2\tuyen-nguoi\THU-TUYEN-NGUOI-PHONG-XEM.md`.

## 3. Mở phòng (mỗi buổi tối, khoảng 15 phút)

Nên chạy phòng trên **một API riêng** cho gọn dữ liệu. Autopilot của phiên `lab` chỉ chọn ứng viên ghim trong `products` của phòng (kể cả khi danh mục dùng chung), nên không có rủi ro ghim nhầm sản phẩm ngoài phòng (`tests/test_api_xem.py::test_lab_pins_only_room_products_even_with_a_shared_catalog`).

**Thứ tự bắt buộc: API → Caddy → cloudflared → Next → tạo phòng.** Next phải biết địa chỉ đường hầm trước khi chạy: `next.config.mjs` đưa tên máy trong `LIVELIFT_APP_ORIGIN` vào `allowedDevOrigins`. Thiếu biến này thì `next dev` chặn `/_next/hmr` gọi từ đường hầm, điện thoại đứng mãi ở "Đang mở phòng…" dù `curl` vẫn ra 200.

Mỗi lệnh chạy trong một cửa sổ PowerShell riêng, mở tại thư mục `livelift`.

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

# 2) Cổng vào chỉ mở phòng xem (Docker Desktop đang chạy)
docker run --rm --name livelift-caddy-xem -p 127.0.0.1:8088:8088 -v "${PWD}\docker\Caddyfile.tunnel:/etc/caddy/Caddyfile:ro" caddy:2

# 3) Đường hầm công khai: chép địa chỉ https://<tên>.trycloudflare.com mà lệnh in ra
cloudflared tunnel --url http://127.0.0.1:8088

# 4) Next, chỉ chạy SAU khi có địa chỉ ở lệnh 3 (đúng nguồn https, không có / ở cuối)
cd next
$env:LIVELIFT_API_BASE = "http://127.0.0.1:8000"
$env:LIVELIFT_APP_ORIGIN = "https://<tên>.trycloudflare.com"
npm run dev

# 5) Tạo phòng và bắt đầu phát (cùng INGEST_TOKEN với lệnh 1)
$env:INGEST_TOKEN = "<cùng chuỗi ở lệnh 1>"
.venv\Scripts\python scripts\mo_phong_xem.py --san-pham ops\phong-xem\san-pham.json --phut 180 --video <đường dẫn video> --bat-dau
```

- `LIVELIFT_APP_ORIGIN` sai dạng (có `/` cuối, `http://`, có đường dẫn) thì Next dừng ngay với lỗi "LIVELIFT_APP_ORIGIN must be an exact HTTPS origin."
- Đường hầm đổi địa chỉ (chạy lại `cloudflared`, rớt mạng) thì đặt lại `LIVELIFT_APP_ORIGIN` trong cửa sổ lệnh 4, khởi động lại Next (Ctrl+C rồi `npm run dev`) và gửi lại đường dẫn mới.
- Lệnh 5 in mã phòng. Đường dẫn gửi người tham gia là `https://<tên>.trycloudflare.com/xem/<mã phòng>`. Tạo mã QR từ đường dẫn này và chỉ gửi sau khi lệnh 5 chạy xong: mở sớm thì trang báo "Phòng không tồn tại hoặc đã tắt.", máy còn mã từ lần thử trước còn thấy nút rút lui, dễ rối.

**Chặn cổng 3130 khỏi mạng chung.** `npm run dev` nghe mọi giao diện mạng (`next dev` mặc định 0.0.0.0). Trên Wi-Fi chung, máy cùng mạng gọi thẳng được `http://<IP máy>:3130/api/ll/...`: đọc toàn bộ bàn thí nghiệm, và ghi bằng token nếu Next có `LIVELIFT_API_TOKEN`. Chọn một cách:

- Chặn `node.exe` ở Windows Firewall (PowerShell quyền quản trị):
  ```powershell
  Get-NetConnectionProfile   # Wi-Fi phải báo NetworkCategory : Public
  New-NetFirewallRule -DisplayName "LiveLift chan node Public" -Direction Inbound -Program (Get-Command node).Source -Profile Public -Action Block
  Get-NetFirewallRule -DisplayName "LiveLift chan node Public" | Format-List DisplayName, Enabled, Profile, Action
  # Xong buổi thì gỡ:
  Remove-NetFirewallRule -DisplayName "LiveLift chan node Public"
  ```
  Wi-Fi ở `Private` thì luật `-Profile Public` không có tác dụng: chuyển Wi-Fi sang Public (`Set-NetConnectionProfile -InterfaceAlias "<tên Wi-Fi>" -NetworkCategory Public`) hoặc tạo luật với `-Profile Any`.
- Hoặc thay `npm run dev` ở lệnh 4 bằng `npx next dev -p 3130 -H 127.0.0.1` (vẫn đặt `LIVELIFT_APP_ORIGIN`). Caddy trong Docker gọi Next qua `host.docker.internal:3130`, có thể không tới được Next chỉ nghe 127.0.0.1.

Chọn cách nào cũng chạy lại toàn bộ phần kiểm dưới đây. Lấy IP Wi-Fi bằng `(Get-NetIPAddress -InterfaceAlias "Wi-Fi" -AddressFamily IPv4).IPAddress` (không dùng dòng `Network:` của Next, máy có thể có card ảo). Đối chứng: trước khi chặn, điện thoại cùng Wi-Fi mở được `http://<IP Wi-Fi>:3130/phien`; sau khi chặn thì không tải được. Curl qua Caddy ra `503` thì gỡ luật hoặc bỏ `-H`, dùng cách kia. Cả hai cách đều ra `503` thì chạy `npm run dev` không chặn, trên điểm phát Wi-Fi riêng của nhóm, không dùng Wi-Fi chung.

Không dùng `npm start` cho phòng xem: bản production (`next start`) đòi bộ biến V3 (`LIVELIFT_ROOM_ID`, `LIVELIFT_WORKSPACE_ID`, `LIVELIFT_DB_PATH`, `LIVELIFT_APP_ORIGIN`) mà hướng dẫn này không đặt.

**Kiểm tra trước khi mời người** (thay `<mã>` bằng mã phòng):

- `curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:8088/xem/<mã>` ra `200` (Caddy tới Next). Dòng này ra 200 với mọi mã, nên kiểm thêm dòng dưới.
- `curl.exe -s -w "\n%{http_code}\n" http://127.0.0.1:8088/xem-api/<mã>/trang-thai` ra JSON của phòng rồi `200` (Caddy tới API, phòng đang bật). Ra `404` là sai mã hoặc phòng chưa bật.
- `curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:8088/sessions` ra `404`; mở `https://<tên>.trycloudflare.com/sessions` cũng ra 404.
- Mở `https://<tên>.trycloudflare.com/xem/<mã>` trên một Android và một iPhone: trang phải qua "Đang mở phòng…" tới màn đồng ý, video chạy. Cửa sổ Next không được in "Blocked cross-origin request to Next.js dev resource …" (thường là `/_next/hmr`). Có dòng đó thì `LIVELIFT_APP_ORIGIN` sai hoặc đường hầm đã đổi địa chỉ: sửa biến, khởi động lại Next, mở lại trang.

## 4. Trong buổi

- Mở bàn thí nghiệm trên máy (`http://localhost:3130`) để theo dõi số người, click và khối. Đường này **không** đi qua đường hầm.
- Không ghim tay. Autopilot làm việc đó trong khối BẬT, và ghim tay sẽ làm sai thiết kế.
- Nếu có sự cố, ghi giờ và mô tả vào `ops/templates/nhat-ky-phien.md`.

## 5. Đóng phòng

```powershell
# Kết thúc phiên (người xem thấy "đã đóng")
curl.exe -X POST -H "Authorization: Bearer $env:INGEST_TOKEN" http://127.0.0.1:8000/sessions/<phiên>/end
```

Đóng bằng `/end`, không tắt phòng. Sau `/end` trang vẫn hiện như thường với dòng "Phòng đã đóng" và nút "Rút lui khỏi nghiên cứu". Phòng đã tắt (`enabled: false`) thì `/xem-api/<mã>/trang-thai` trả 404: trang chỉ còn nút rút lui tối giản cho máy còn giữ mã (mục 7). Tắt `cloudflared` và Caddy sau vài phút, khi không còn ai cần rút lui. Báo cáo của phiên xem tại `http://localhost:3130/phien/<phiên>/tong-ket`.

Đếm số người, số khối và lượt nhấp từ ảnh chụp kho (không cần token, không đọc PII), rồi ghi dòng cho slide 8:

```powershell
.venv\Scripts\python scripts\so_phong_xem.py --anh-chup data\phong-xem\snapshot.json --tu-ngay 2026-10-18 `
    --json data\phong-xem\so-phong.json --ra-slide ..\AISC26_Vong2\so-phong-dan-dung.txt `
    --ra-thu-noi-bo data\phong-xem\so-thu-noi-bo.txt
```

- Phiên thử nội bộ đếm riêng, nhãn DÀN DỰNG · THỬ NỘI BỘ, không cộng vào dòng slide. Dòng của nó ra `so-thu-noi-bo.txt`; không trỏ `--ra-thu-noi-bo` vào `so-phong-dan-dung.txt`.
- `--tu-ngay` bỏ các buổi chạy thử trước 18/10.
- `--den 2026-10-19T21:00+07:00` cắt số tại giờ nộp slide.
- "Lượt người" là lượt tham gia theo phiên: mã băm có muối là mã phiên, nên một người dự hai tối được đếm hai lần.
- Chưa có khối nào chạy xong thì script không ghi gì. Khi đó slide dựng bản dự phòng bằng `dung_slide.py --du-phong-phong`.

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
- Khi người xem bấm "Rút lui", trang hỏi lại ngay trong trang ("Xác nhận rút lui" / "Huỷ"), không dùng hộp thoại của trình duyệt (trình duyệt trong Zalo, Messenger có thể bỏ qua hộp đó). Sau khi xác nhận, hệ thống xoá mọi click, bình luận, đơn tiền ảo và nhật ký của người đó, rồi tính lại số người xem của các mốc liên quan. Sau đó mọi thao tác mới từ người đó bị từ chối. Mã ngẫu nhiên lưu trên máy cũng được xoá.
- Rút lui được ở mọi trạng thái phòng (chưa mở, đang mở, đã đóng, cả khi đã tắt). Rút lui lặp lại (bấm lại, máy gửi lại sau lỗi mạng) trả 200 `duplicate`, không xoá hay ghi thêm.
- Phòng đã tắt: trang hiện "Phòng không tồn tại hoặc đã tắt." kèm nút tối giản "Rút lui và xoá dữ liệu của tôi" nếu máy còn giữ mã. Người chưa từng tham gia gửi rút lui vào phòng tắt nhận 404 như mã sai (trang báo không có gì để xoá), nên người lạ không biết mã từng tồn tại.
- Mã nguồn công khai theo AGPL-3.0. Đường dẫn mã nguồn nằm ở chân trang phòng xem (`source_code_url`).

## 8. Giới hạn đã biết

- Kho bộ nhớ có ảnh chụp chạy trong một tiến trình. Nếu cần độ bền cao hơn, dùng Postgres với migration 0010.
- Đường hầm nhanh của Cloudflare không có cam kết hoạt động liên tục. Đổi địa chỉ thì phải khởi động lại Next với `LIVELIFT_APP_ORIGIN` mới (mục 3) và gửi lại đường dẫn.
- Wi-Fi của trường có thể dồn nhiều người vào cùng một địa chỉ. Trần theo địa chỉ mặc định là 600 lượt/phút (`PHONG_XEM_RATE_LIMIT_PER_MIN`); trần cho mỗi người xem là 40 lượt/phút.

## 9. Buổi thử nội bộ 20/10

Tối 20/10 nhóm tự vào phòng bằng điện thoại thật để thử quy trình trước demo 22/10. Phiên mang `dry_run=True`: bị loại khỏi kết quả gộp (tiền đăng ký §8.2), bàn thí nghiệm hiện nhãn "DÀN DỰNG · THỬ NỘI BỘ". Làm đúng mục 3: cùng thứ tự API → Caddy → cloudflared → Next (có `LIVELIFT_APP_ORIGIN`), cùng lệnh 1 đến 4 và cách chặn cổng 3130. Chỉ thay lệnh 5:

```powershell
# 5) Tạo phiên thử nội bộ và phát (cùng INGEST_TOKEN với lệnh 1)
$env:INGEST_TOKEN = "<cùng chuỗi ở lệnh 1>"
.venv\Scripts\python scripts\mo_phong_xem.py --thu-noi-bo --san-pham ops\phong-xem\san-pham.json --video /xem/nguoi-dan.mp4 --bat-dau
```

- Cờ khác: `--phut` mặc định 180 (không đặt dưới 90, lịch bốc thăm sẽ quá ít chuỗi), `--api` mặc định `http://127.0.0.1:8000`. Bỏ `--san-pham` thì phòng dùng 4 món mẫu `LAB-1` đến `LAB-4`. Bỏ `--tieu-de` thì tiêu đề là "Thử nội bộ · Phòng xem LiveLift".
- **`dry_run` chỉ ghi được lúc tạo phiên**, sau đó không bật thêm được. Lệnh đúng in khung "PHIÊN THỬ NỘI BỘ: dry_run=True". Không thấy khung (quên cờ) thì huỷ phiên rồi tạo lại **trước khi phát**: `curl.exe -X POST -H "Authorization: Bearer $env:INGEST_TOKEN" http://127.0.0.1:8000/sessions/<phiên>/cancel`. Phiên đã phát thì không huỷ được (409), chỉ còn `/end`. Có `--bat-dau` thì phiên phát ngay, nên muốn chắc thì chạy lệnh không `--bat-dau`, đọc khung, rồi mới gọi `/sessions/<phiên>/start` bằng `curl.exe` như trên.
- **Kết thúc bằng `/end`** (mục 5), không tắt phòng (`enabled: false` ở `/sessions/<phiên>/phong-xem`). Sau `/end` trang hiện "Phòng đã đóng" và nút "Rút lui khỏi nghiên cứu" vẫn dùng được. Phòng đã tắt thì trang chỉ còn nút rút lui tối giản cho máy còn giữ mã; người chưa từng tham gia gửi rút lui vào phòng tắt nhận 404 như mã sai. Rút lui lặp lại (bấm lại, máy gửi lại sau lỗi mạng) trả 200 `duplicate`, không xoá hay ghi thêm.
- **Đếm sau buổi:** lệnh ở mục 5 kèm `--ra-thu-noi-bo data\phong-xem\so-thu-noi-bo.txt`. Phiên thử nội bộ đếm riêng, nhãn DÀN DỰNG · THỬ NỘI BỘ, không cộng vào dòng slide.

**Kiểm trước 20:00**

- [ ] Phần "Kiểm tra trước khi mời người" ở mục 3 qua hết, sau khi đã chặn cổng 3130: hai dòng `curl.exe` tới `:8088/xem/<mã>` và `:8088/xem-api/<mã>/trang-thai` ra `200` (dòng sau ra JSON), `:8088/sessions` ra `404`; trên một Android và một iPhone trang qua "Đang mở phòng…" tới màn đồng ý, video chạy; cửa sổ Next không in "Blocked cross-origin request … /_next/hmr".
- [ ] Từ một điện thoại cùng Wi-Fi, `http://<IP Wi-Fi>:3130/phien` không tải được (dùng điểm phát riêng thì bỏ qua dòng này).
- [ ] Máy dùng để thử rút lui chưa vào phòng xem nào khác: rút lui xoá mã người xem dùng chung trên máy.
- [ ] Một máy thử bấm "Rút lui khỏi nghiên cứu": trang hỏi lại ngay trong trang, bấm "Xác nhận rút lui", thấy "Bạn đã rút lui". Không có hộp thoại của trình duyệt.
- [ ] Video người dẫn, chọn một:
  - tệp mp4 đặt **dưới `next/public/xem/`** (ví dụ `next/public/xem/nguoi-dan.mp4`, truyền `--video /xem/nguoi-dan.mp4`). Caddy chỉ mở `/xem`, `/_next`, `/xem-api`, `/r`, nên mp4 ở chỗ khác trong `next/public` ra 404 qua đường hầm. Kiểm `curl.exe -sI http://127.0.0.1:8088/xem/nguoi-dan.mp4` thấy `200` và `Content-Type: video/mp4`. Không commit tệp mp4.
  - link mp4 `https://` hoặc link YouTube: trang tự đổi sang `www.youtube-nocookie.com`, khung duy nhất CSP cho phép. Link `http://` bị CSP chặn.

**Sau buổi:** `/end`, chờ vài phút rồi tắt `cloudflared` và Caddy, chạy lệnh đếm ở mục 5, gỡ luật tường lửa bằng `Remove-NetFirewallRule -DisplayName "LiveLift chan node Public"` (PowerShell quyền quản trị). Đã chuyển Wi-Fi sang Public thì đặt lại `-NetworkCategory Private` nếu cần.

# LiveLift (repo AISC2026_LIVEFIT)

Đội AISC26-0039, TDTU, track Data Driven Business, AISC'26. Tệp này tự đủ: đọc xong là làm được việc trong repo mà không cần tài liệu ngoài.

**Câu định vị (dùng nguyên văn):** LiveLift giúp người bán livestream tự đo xem việc ghim một sản phẩm có thật sự làm khách bấm mua nhiều hơn, bằng cách bốc thăm bật/tắt theo từng khối 5 phút thay vì đoán theo tương quan.

## Bản đồ

| Thư mục | Vai trò |
|---|---|
| `src/livelift/` | Lõi Python + FastAPI. **Nguồn sự thật duy nhất** cho lịch bốc thăm, sự kiện, ước lượng, KTC. Giao diện không tự tính nhân quả |
| `next/` | **Mặt tiền** (Next 16, cổng **3130**). Bàn thí nghiệm `/phien/{id}`, màn người dẫn `/phien/{id}/nguoi-dan`, tổng kết `/phien/{id}/tong-ket`, phòng xem `/xem/{mã}`. Gọi lõi qua proxy `next/src/app/api/ll/[...path]/route.ts`, chỉ các cặp trong `next/src/lib/livelift-api/allowlist.ts`; token người vận hành chỉ nằm ở máy chủ Next |
| `web/` | **Di sản** (Next 14, cổng 3000). Không demo, không thêm tính năng |
| `docs/canon/` | Nguồn chuẩn: số (`so.yaml`), thuật ngữ và từ cấm, câu định vị, mốc, văn liệu |
| `docs/competition/FACT-SHEET.md` | Mọi con số kèm lệnh sinh lại |
| `docs/README.md` | Đọc gì cho Vòng 2; thư mục nào là lưu trữ |
| `docs/incident-log.md` | Sổ sự cố. Sửa lỗi thì thêm một hàng có nguyên nhân gốc |

Kiến trúc chi tiết: `docs/kien-truc/hop-nhat-next-api.md`.

## Chạy

```powershell
# API (cổng 8000), kho bộ nhớ nếu không có PostgreSQL
.venv\Scripts\python -m uvicorn livelift.api.main:app --host 127.0.0.1 --port 8000

# Mặt tiền next/ (cổng 3130); LIVELIFT_API_BASE mặc định http://127.0.0.1:8000, token đặt ở LIVELIFT_API_TOKEN
cd next; npm run dev
```

Mở `http://localhost:3130/phien`, bấm gieo dữ liệu mẫu (phiên mẫu mang `is_demo`, nhãn MÔ PHỎNG). Phòng xem dàn dựng: `docs/HUONG-DAN-PHONG-XEM.md` và `scripts/mo_phong_xem.py`.

## Test (chạy trước mỗi lần đề nghị merge)

```powershell
# Python, bộ nhanh
.venv\Scripts\python -m pytest -m "not slow" -o addopts="--strict-markers" -q -p no:warnings
# Lint Python
.venv\Scripts\python -m ruff check src tests scripts
.venv\Scripts\python -m ruff format --check src tests scripts
# next/
cd next; npx tsc --noEmit; npm run lint; npx vitest run
```

- Trên Windows, chạy vitest theo thư mục: `npx vitest run src/lib/livelift-api src/components`. Bộ server V3 (`src/lib/server/**`) chỉ xanh trên Linux; chạy đủ bộ trong container `node:22-alpine`.
- Cổng chậm (mô phỏng, thống kê): `pytest -m "slow and not browser"`. Đổi phần thống kê thì phải chạy.
- Test số công bố: `tests/test_so_cong_bo.py`, `tests/test_web_dong_bo_so.py`. Đỏ thì sửa tài liệu cho khớp nguồn, **không nới test**.

## Luật số và nhãn

- Mọi con số công khai mang nhãn: THẬT · DÀN DỰNG · THỬ NỘI BỘ · MÔ PHỎNG · GIẢ THUYẾT · THỨ CẤP · NHÃN AI · QUAN SÁT · MINH HOẠ · MÀN MẪU.
- Nhãn công bố (không phải nhãn nguồn của số): "NGƯỜI DẪN AI · GIỌNG TỔNG HỢP" luôn hiện cạnh video người dẫn do AI tạo; "MÁY CHÉP LỜI" cho lời chép bằng faster-whisper; "DÀN DỰNG · CHƯA XÁC MINH" cho phiên do giám khảo hoặc tài khoản chưa xác minh tạo (D-015, D-022, D-023 trong D:\AISC2026\QUYET-DINH.md).
- Số lấy từ `docs/canon/so.yaml`. Số mới vào `FACT-SHEET.md` trước (kèm lệnh sinh lại), rồi `so.yaml`, rồi mới ra nơi khác.
- Hôm nay có 0 phiên với người bán thật và 0 phỏng vấn. Không viết khác đi cho đến khi có.
- Số tiêu đề: báo nhầm 4,3% (MÔ PHỎNG; A/A 3,50% chỉ ở chú thích); lực 95% với tác động +30%, khối 5 phút; dư âm −46% → −35%; NLP 0,370 → 0,572 cùng thang 6 lớp (NHÃN AI); phiên 90 phút = 16 khối.
- Không dùng: "2,5 triệu phiên", ">50.000 nhà bán", "4,5%", "0,271", "tăng doanh số", "Mall/Preferred", "không bao giờ tự ghim", "estimated GMV", "đầu tiên", dấu gạch dài trong chữ công khai. Danh sách đầy đủ và thuật ngữ chuẩn: `docs/canon/thuat-ngu.yaml`.
- Thuật ngữ: "bàn thí nghiệm" (không "bàn trợ live"), "phòng xem", tổng kết ĐỔI / GIỮ / ĐO THÊM, "Live Desk minh hoạ", "kiểm định ngẫu nhiên hoá", "MÔ PHỎNG" trên bản tiếng Việt. Chính tả: khoá, hoá, xoá, minh hoạ.
- Đội khác chỉ gọi bằng mã đội (ví dụ AISC26-0027), không nêu tên người.

## Luật làm việc

- Làm trên nhánh riêng, mở PR. **Push theo D-020** (test xanh + người duyệt độc lập + quét bí mật, PR nháp, không push main, không --force). **Không merge**: Tiến duyệt mã, Minh merge.
- Commit: tiếng Việt không dấu, dòng cuối:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Không đụng container Docker của dự án khác trên máy.
- Chỉ dùng API chính thức của nền tảng, không cào. Token không ra trình duyệt. Phòng xem không lưu thông tin cá nhân (chỉ mã băm người xem).
- Sửa chuỗi trong tệp UTF-8 bằng Python (kiểm số lần khớp) hoặc công cụ Edit; không dùng PowerShell `Set-Content`/`Get-Content` cho tệp UTF-8.
- Script in tiếng Việt phải gọi `livelift.console.configure()` đầu `main()` (console Windows cp1252, sự cố 27/08).

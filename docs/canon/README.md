# docs/canon: nguồn chuẩn của LiveLift

Thư mục này là chỗ chốt số, chữ và ngày cho mọi thứ đội đưa ra ngoài: deck, poster, kịch bản, hỏi đáp, README, chữ trên giao diện `next/`. Thấy lệch giữa tệp này và một tài liệu khác thì tài liệu kia sai.

| Tệp | Nội dung |
|---|---|
| `so.yaml` | 31 mục (30 con số và một câu trích). Mỗi mục có giá trị, cách viết, nhãn, tệp và khoá nguồn, câu được nói, mẫu bị cấm, ngày đo |
| `thuat-ngu.yaml` | Thuật ngữ chuẩn và biến thể cấm, nhãn nguồn, từ cấm, chính tả |
| `dinh-vi.yaml` | Câu định vị (dùng nguyên văn) và 3 thông điệp |
| `moc.yaml` | Mốc AISC'26: 22/10 thi, 25/10 poster, 01–10/11 bình chọn, chung kết khoảng 20/11 đến đầu 12/2026 |
| `van-lieu.yaml` | Bài báo đã kiểm và con số được phép trích |

## Thứ tự sửa

1. Đo hoặc kiểm nguồn, ghi vào `docs/competition/FACT-SHEET.md` kèm lệnh sinh lại.
2. Cập nhật `so.yaml` (giá trị, `ngay_do`, `nguon_khoa`).
3. Rồi mới sửa deck, poster, README, giao diện.

Không sửa theo chiều ngược lại. Số chưa có trong FACT-SHEET thì chưa được xuất hiện ở đâu.

## Nhãn

Mỗi con số công khai mang một nhãn: THẬT · DÀN DỰNG · THỬ NỘI BỘ · MÔ PHỎNG · GIẢ THUYẾT · THỨ CẤP · NHÃN AI · QUAN SÁT · MINH HOẠ · MÀN MẪU. Nghĩa của từng nhãn ở `thuat-ngu.yaml`, mục `nhan_nguon`.

## Đọc bằng mã

```python
import yaml
from pathlib import Path

so = {s["id"]: s for s in yaml.safe_load(Path("docs/canon/so.yaml").read_text("utf-8"))["so"]}
print(so["bao_nham_tb"]["hien_thi"], so["bao_nham_tb"]["nhan"])  # 4,3% MÔ PHỎNG
```

Trường `cam` là biểu thức chính quy (Python `re`, không phân biệt hoa thường) của cách nói bị cấm, dành cho bộ kiểm đồng bộ.

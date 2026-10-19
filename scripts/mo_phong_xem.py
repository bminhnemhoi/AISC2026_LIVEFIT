"""Mở một phòng xem dàn dựng trong một lệnh (15/10/2026).

Tạo sản phẩm của phòng, một phiên ``platform='lab'`` chế độ ``auto``, bốc lịch
gán, bật phòng xem, và (tuỳ chọn) bắt đầu phát. In ra mã công khai và đường dẫn
để dán sau địa chỉ của đường hầm.

    .venv\\Scripts\\python scripts\\mo_phong_xem.py --san-pham ops\\phong-xem\\san-pham.json ^
        --phut 180 --video https://.../video.mp4 --bat-dau

Token: lấy từ biến môi trường INGEST_TOKEN (giống bộ thu). Không in token ra màn
hình. Xem docs/HUONG-DAN-PHONG-XEM.md.

``--thu-noi-bo`` (19/10/2026, buổi thử 20/10 của nhóm): tạo phiên với
``dry_run=True``. Cờ này khai báo lúc tạo phiên, trước khi bốc lịch, và bất biến
sau đó (``store._SESSION_WRITE_ONCE``), nên phiên bị loại khỏi kết quả gộp theo
tiền đăng ký §8.2 (``reports._in_analysis_sample``) và bàn thí nghiệm hiện nhãn
"DÀN DỰNG · THỬ NỘI BỘ". Không có cờ thì yêu cầu gửi đi giữ nguyên như cũ.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx

from livelift.console import configure

#: Hàng mẫu của phòng xem khi không truyền ``--san-pham``. Tên khác bộ ``DEMO_PRODUCTS`` của
#: ``/demo/seed`` để danh mục dùng chung không có hai món trùng tên. Giá chỉ để minh hoạ, đặt
#: theo mức bán lẻ thường gặp, không lấy từ dữ liệu sàn; người xem mua bằng tiền ảo.
SAN_PHAM_MAC_DINH: list[dict[str, Any]] = [
    {
        "product_id": "LAB-1",
        "name": "Áo thun cotton basic",
        "cost": 45000,
        "price": 129000,
        "stock": 100,
    },
    {
        "product_id": "LAB-2",
        "name": "Túi tote canvas",
        "cost": 30000,
        "price": 89000,
        "stock": 100,
    },
    {
        "product_id": "LAB-3",
        "name": "Bình giữ nhiệt inox 750ml",
        "cost": 60000,
        "price": 159000,
        "stock": 100,
    },
    {
        "product_id": "LAB-4",
        "name": "Set 3 kẹp tóc càng cua",
        "cost": 12000,
        "price": 39000,
        "stock": 100,
    },
]


#: Tiêu đề khi không truyền ``--tieu-de``. Phiên thử nội bộ mang tiêu đề riêng để
#: danh sách phiên và màn người xem không lẫn nó với một buổi phòng xem có người ngoài.
TIEU_DE_MAC_DINH = "Phòng xem LiveLift"
TIEU_DE_THU_NOI_BO = "Thử nội bộ · Phòng xem LiveLift"


def _goi(client: httpx.Client, method: str, path: str, **kw: Any) -> dict[str, Any]:
    r = client.request(method, path, **kw)
    if r.status_code >= 400:
        sys.exit(f"Lỗi {r.status_code} khi gọi {method} {path}: {r.text[:300]}")
    return r.json()


def than_tao_phien(tieu_de: str, phut: int, thu_noi_bo: bool) -> dict[str, Any]:
    """Thân ``POST /sessions``. Không có cờ thì giống hệt trước 19/10 (không gửi ``dry_run``)."""
    than: dict[str, Any] = {
        "platform": "lab",
        "title": tieu_de,
        "mode": "auto",
        "planned_duration_min": phut,
    }
    if thu_noi_bo:
        # Khai báo ở đây hoặc không bao giờ: máy chủ không có đường nào bật cờ này sau khi tạo.
        than["dry_run"] = True
    return than


def main(argv: list[str] | None = None) -> int:
    configure()
    ap = argparse.ArgumentParser(description="Mở phòng xem dàn dựng (LiveLift)")
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--san-pham", type=Path, help="tệp JSON danh sách sản phẩm của phòng")
    ap.add_argument("--phut", type=int, default=180, help="thời lượng phiên (phút)")
    ap.add_argument(
        "--tieu-de",
        default=None,
        help=f'mặc định "{TIEU_DE_MAC_DINH}", hoặc "{TIEU_DE_THU_NOI_BO}" khi có --thu-noi-bo',
    )
    ap.add_argument("--dong-y", default="2026-10-15", help="phiên bản lời đồng ý")
    ap.add_argument("--video", default=None, help="đường dẫn video người dẫn (mp4/YouTube embed)")
    ap.add_argument("--bat-dau", action="store_true", help="bắt đầu phát ngay")
    ap.add_argument(
        "--thu-noi-bo",
        action="store_true",
        help="phiên thử nội bộ của nhóm: tạo với dry_run=True, không vào kết quả gộp",
    )
    args = ap.parse_args(argv)
    tieu_de = args.tieu_de
    if tieu_de is None:
        tieu_de = TIEU_DE_THU_NOI_BO if args.thu_noi_bo else TIEU_DE_MAC_DINH

    san_pham = (
        json.loads(args.san_pham.read_text(encoding="utf-8"))
        if args.san_pham
        else SAN_PHAM_MAC_DINH
    )
    token = os.environ.get("INGEST_TOKEN", "")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with httpx.Client(base_url=args.api, headers=headers, timeout=30) as c:
        for p in san_pham:
            _goi(c, "POST", "/products", json=p)
        phien = _goi(
            c,
            "POST",
            "/sessions",
            json=than_tao_phien(tieu_de, args.phut, args.thu_noi_bo),
        )
        sid = phien["session_id"]
        if args.thu_noi_bo and phien.get("dry_run") is not True:
            # API cũ (trước migration 0008) bỏ qua trường lạ mà không báo lỗi: phiên vừa tạo
            # sẽ được TÍNH như phiên thật. Huỷ nó khi còn ở trạng thái planned (chưa bốc lịch,
            # chưa có số nào) rồi dừng, thay vì mở phòng trên một phiên mang nhãn sai.
            c.post(f"/sessions/{sid}/cancel")
            sys.exit(
                f"Lỗi: máy chủ không lưu dry_run cho phiên {sid} (đã yêu cầu huỷ phiên). "
                "Không mở phòng thử nội bộ trên API này."
            )
        _goi(c, "POST", f"/sessions/{sid}/schedule", json={})
        phong = _goi(
            c,
            "POST",
            f"/sessions/{sid}/phong-xem",
            json={
                "consent_version": args.dong_y,
                "products": [p["product_id"] for p in san_pham],
                "video_url": args.video,
                "title": tieu_de,
            },
        )
        if args.bat_dau:
            _goi(c, "POST", f"/sessions/{sid}/start")
    if args.thu_noi_bo:
        print("=" * 64)
        print("PHIÊN THỬ NỘI BỘ: dry_run=True, máy chủ đã lưu (không sửa được sau này).")
        print("Không vào số THẬT: bị loại khỏi kết quả gộp (tiền đăng ký §8.2).")
        print('Bàn thí nghiệm hiện nhãn "DÀN DỰNG · THỬ NỘI BỘ".')
        print(f"Tiêu đề: {tieu_de}")
        print("=" * 64)
    print(f"Phiên: {sid}")
    print(f"Mã phòng: {phong['code']}")
    print(f"Đường dẫn cho người xem: <địa chỉ đường hầm>{phong['public_path']}")
    for w in phong.get("warnings", []):
        print(f"CẢNH BÁO: {w}")
    if not args.bat_dau:
        print(f"Chưa phát. Khi sẵn sàng: POST {args.api}/sessions/{sid}/start")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

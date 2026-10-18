"""Mở một phòng xem dàn dựng trong một lệnh (15/10/2026).

Tạo sản phẩm của phòng, một phiên ``platform='lab'`` chế độ ``auto``, bốc lịch
gán, bật phòng xem, và (tuỳ chọn) bắt đầu phát. In ra mã công khai và đường dẫn
để dán sau địa chỉ của đường hầm.

    .venv\\Scripts\\python scripts\\mo_phong_xem.py --san-pham ops\\phong-xem\\san-pham.json ^
        --phut 180 --video https://.../video.mp4 --bat-dau

Token: lấy từ biến môi trường INGEST_TOKEN (giống bộ thu). Không in token ra màn
hình. Xem docs/HUONG-DAN-PHONG-XEM.md.
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


def _goi(client: httpx.Client, method: str, path: str, **kw: Any) -> dict[str, Any]:
    r = client.request(method, path, **kw)
    if r.status_code >= 400:
        sys.exit(f"Lỗi {r.status_code} khi gọi {method} {path}: {r.text[:300]}")
    return r.json()


def main(argv: list[str] | None = None) -> int:
    configure()
    ap = argparse.ArgumentParser(description="Mở phòng xem dàn dựng (LiveLift)")
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--san-pham", type=Path, help="tệp JSON danh sách sản phẩm của phòng")
    ap.add_argument("--phut", type=int, default=180, help="thời lượng phiên (phút)")
    ap.add_argument("--tieu-de", default="Phòng xem LiveLift")
    ap.add_argument("--dong-y", default="2026-10-15", help="phiên bản lời đồng ý")
    ap.add_argument("--video", default=None, help="đường dẫn video người dẫn (mp4/YouTube embed)")
    ap.add_argument("--bat-dau", action="store_true", help="bắt đầu phát ngay")
    args = ap.parse_args(argv)

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
            json={
                "platform": "lab",
                "title": args.tieu_de,
                "mode": "auto",
                "planned_duration_min": args.phut,
            },
        )
        sid = phien["session_id"]
        _goi(c, "POST", f"/sessions/{sid}/schedule", json={})
        phong = _goi(
            c,
            "POST",
            f"/sessions/{sid}/phong-xem",
            json={
                "consent_version": args.dong_y,
                "products": [p["product_id"] for p in san_pham],
                "video_url": args.video,
                "title": args.tieu_de,
            },
        )
        if args.bat_dau:
            _goi(c, "POST", f"/sessions/{sid}/start")
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

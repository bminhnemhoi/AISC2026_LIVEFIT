"""Ứng viên ghim: MỘT định nghĩa dùng chung cho thẻ trên bàn vận hành và lệnh ghim.

Trước 15/10/2026 hai nơi tự dựng danh sách: ``/actions/execute`` lọc theo sản phẩm
của phòng dàn dựng còn ``/state`` thì không, nên bàn vận hành có thể mời ghim một
sản phẩm mà lệnh ghim sẽ từ chối. Giờ cả hai gọi :func:`xep_hang_ung_vien`.

Ngưỡng tồn kho học từ các đội dự báo tồn kho ở Vòng 2 (AISC26-0015, AISC26-0058:
tồn kho an toàn và điểm đặt hàng lại). Ở đây "thời gian chờ" là MỘT khối: một sản
phẩm chỉ được ghim khi còn đủ hàng cho nhu cầu dự kiến của cả khối nhân hệ số an
toàn. Ghim một món sắp hết hàng gây hết hàng giữa khối BẬT — người xem bấm mà không
mua được, và sự cố tồn kho lan sang khối sau thành dư âm (Chen, Bai, Zheng, Si,
EC 2026; tổng quan nghiên cứu 15/10 §2.2). Lọc này là một phần của CHÍNH SÁCH ở
khối BẬT, không đụng tới cơ chế gán, nên không ảnh hưởng tính hợp lệ của kiểm định.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

from livelift.api.cards import MAX_CARDS, build_candidates
from livelift.core.assigner import Candidate

MIN_TON_KHO_GHIM = 3
"""Sàn của ngưỡng: dưới mức này không ghim, kể cả khi phiên chưa có đơn nào."""

HE_SO_AN_TOAN = 2.0
"""Nhu cầu dự kiến trong một khối được nhân đôi: đơn trong phiên live dồn cục."""

PHUT_KHOI_MAC_DINH = 5.0


def nguong_ton_kho(so_luong_da_ban: float, phut_da_phat: float, phut_khoi: float) -> int:
    """Điểm đặt lại cho một khối: ``max(sàn, ⌈hệ số × tốc độ bán × độ dài khối⌉)``.

    Tốc độ bán là số lượng đã bán trong phiên chia số phút đã phát. Chưa phát hoặc
    chưa bán thì chỉ còn sàn.
    """
    if phut_da_phat <= 0 or so_luong_da_ban <= 0:
        return MIN_TON_KHO_GHIM
    toc_do = so_luong_da_ban / phut_da_phat
    return max(MIN_TON_KHO_GHIM, math.ceil(HE_SO_AN_TOAN * toc_do * max(phut_khoi, 0.0)))


def _da_ban_theo_san_pham(don: list[dict[str, Any]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for o in don:
        pid = o.get("product_id")
        if pid:
            out[pid] = out.get(pid, 0.0) + float(o.get("qty") or 0)
    return out


def san_pham_cua_phien(store: Any, session: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Danh mục có thể ghim của phiên. Phòng dàn dựng: CHỈ sản phẩm của phòng."""
    products = store.list_products()
    room_products = (session.get("phong_xem") or {}).get("products")
    if session.get("platform") == "lab" and room_products:
        allowed = set(room_products)
        products = [p for p in products if p["product_id"] in allowed]
    return products


def xep_hang_ung_vien(
    store: Any,
    session: Mapping[str, Any],
    elapsed_s: float,
    phut_khoi: float | None = None,
    top_k: int = MAX_CARDS,
) -> tuple[list[dict[str, Any]], list[Candidate], dict[str, int]]:
    """(danh mục, xếp hạng ứng viên, ngưỡng tồn kho theo sản phẩm) cho một phiên.

    ``top_k`` lớn hơn :data:`MAX_CARDS` khi người gọi cần cả bảng xếp hạng (để giải
    thích vì sao một sản phẩm không được ghim); thẻ và xác suất tầng trong vẫn tính
    trên ``MAX_CARDS`` ứng viên đầu.
    """
    sid = session["session_id"]
    products = san_pham_cua_phien(store, session)
    recent_clicks: dict[str, int] = {}
    for c in store.list_clicks(sid):
        pid = c.get("product_id")
        if pid:
            recent_clicks[pid] = recent_clicks.get(pid, 0) + 1
    da_ban = _da_ban_theo_san_pham(store.list_orders(sid))
    phut = PHUT_KHOI_MAC_DINH if phut_khoi is None else phut_khoi
    nguong = {
        p["product_id"]: nguong_ton_kho(da_ban.get(p["product_id"], 0.0), elapsed_s / 60.0, phut)
        for p in products
    }
    ranked = build_candidates(
        products, recent_clicks, store.list_ticks(sid), top_k=max(top_k, 1), min_stock=nguong
    )
    return products, ranked, nguong


def phut_cua_khoi(block: Mapping[str, Any] | None) -> float | None:
    if block is None:
        return None
    return max(0.0, (float(block["end_offset_s"]) - float(block["start_offset_s"])) / 60.0)


__all__ = [
    "HE_SO_AN_TOAN",
    "MIN_TON_KHO_GHIM",
    "nguong_ton_kho",
    "phut_cua_khoi",
    "san_pham_cua_phien",
    "xep_hang_ung_vien",
]

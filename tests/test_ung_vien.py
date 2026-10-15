"""Ứng viên ghim: ngưỡng tồn kho an toàn cho một khối (học từ các đội tồn kho Vòng 2)."""

from __future__ import annotations

from livelift.api.cards import build_candidates
from livelift.api.ung_vien import HE_SO_AN_TOAN, MIN_TON_KHO_GHIM, nguong_ton_kho


def _sp(pid: str, stock: int) -> dict:
    return {"product_id": pid, "name": pid, "stock": stock}


def test_nguong_chi_con_san_khi_chua_ban_hoac_chua_phat():
    assert nguong_ton_kho(0, 30.0, 5.0) == MIN_TON_KHO_GHIM
    assert nguong_ton_kho(4, 0.0, 5.0) == MIN_TON_KHO_GHIM


def test_nguong_la_nhu_cau_mot_khoi_nhan_he_so_an_toan():
    # 12 sản phẩm trong 30 phút = 0,4/phút; khối 5 phút → 2 → × 2,0 → 4
    assert nguong_ton_kho(12, 30.0, 5.0) == max(MIN_TON_KHO_GHIM, round(HE_SO_AN_TOAN * 0.4 * 5))
    # bán nhanh: 60 trong 20 phút = 3/phút → khối 5 phút cần 15 → × 2 → 30
    assert nguong_ton_kho(60, 20.0, 5.0) == 30


def test_san_pham_duoi_nguong_khong_len_the():
    products = [_sp("NHIEU", 50), _sp("SAP-HET", 2), _sp("HET", 0)]
    nguong = {"NHIEU": 3, "SAP-HET": 3, "HET": 3}
    ids = {c.product_id for c in build_candidates(products, {}, None, top_k=10, min_stock=nguong)}
    assert ids == {"NHIEU"}


def test_khong_truyen_nguong_thi_giu_luat_cu_con_hang_la_du():
    products = [_sp("A", 1), _sp("B", 0)]
    ids = {c.product_id for c in build_candidates(products, {}, None, top_k=10)}
    assert ids == {"A"}

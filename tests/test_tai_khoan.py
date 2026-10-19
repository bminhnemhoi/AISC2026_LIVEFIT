"""Tài khoản ở lõi (D-017, N1): /auth/*, /quan-tri/*, băm mật khẩu, hạn mức, gieo.

Chạy trên kho bộ nhớ qua TestClient. Phần PostgreSQL (migration 0011 up → down →
up, kho tài khoản trên SQL thật) nằm ở ``tests/test_tai_khoan_db.py`` (mark ``db``).
"""

from __future__ import annotations

import re
import secrets
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from livelift.api import tai_khoan as tk
from livelift.api.auth import MUC_TOKEN, liet_ke_route_ghi
from livelift.api.main import create_app
from livelift.api.store import InMemoryStore
from livelift.config import get_settings
from livelift.dbops import tai_khoan as dbtk
from livelift.dbops.migrate import load_migrations

GOC = Path(__file__).resolve().parent.parent
TOKEN_LOI = "token-loi-kiem-thu-tai-khoan-rat-dai"
H = {"Authorization": f"Bearer {TOKEN_LOI}"}
# Mật khẩu kiểm thử sinh lúc chạy: không có mật khẩu nào viết cứng, kể cả trong test.
MK_QT = secrets.token_urlsafe(16)
MK_ND = "mat-khau-" + secrets.token_hex(4)

ROUTE_TAI_KHOAN: list[tuple[str, str]] = [
    ("POST", "/auth/dang-ky"),
    ("POST", "/auth/dang-nhap"),
    ("POST", "/auth/dang-xuat"),
    ("GET", "/auth/toi"),
    ("GET", "/quan-tri/tai-khoan"),
    ("POST", "/quan-tri/tai-khoan"),
    ("GET", "/quan-tri/du-lieu"),
]


def _xoa_dem() -> None:
    get_settings.cache_clear()
    tk.cau_hinh_tai_khoan.cache_clear()


@pytest.fixture
def moi_truong(monkeypatch):
    """Token lõi bật, cờ tài khoản bật, quản trị gieo từ biến môi trường, giám khảo không."""
    monkeypatch.setenv("INGEST_TOKEN", TOKEN_LOI)
    monkeypatch.setenv("LIVELIFT_AUTH", "1")
    monkeypatch.setenv("LIVELIFT_MK_QUAN_TRI", MK_QT)
    monkeypatch.setenv("LIVELIFT_MK_GIAM_KHAO", "")
    _xoa_dem()
    yield monkeypatch
    _xoa_dem()


@pytest.fixture
def client(moi_truong):
    app = create_app(store=InMemoryStore())
    with TestClient(app) as c:
        yield c


def _dang_ky(c: TestClient, ten: str, mk: str = MK_ND, **kw) -> dict:
    r = c.post("/auth/dang-ky", json={"ten_dang_nhap": ten, "mat_khau": mk}, headers=H, **kw)
    assert r.status_code == 201, r.text
    return r.json()


def _dang_nhap(c: TestClient, ten: str, mk: str, headers: dict | None = None):
    return c.post(
        "/auth/dang-nhap",
        json={"ten_dang_nhap": ten, "mat_khau": mk},
        headers={**H, **(headers or {})},
    )


def _hk(token: str) -> dict:
    return {**H, tk.HEADER_TAI_KHOAN: token}


def _token_quan_tri(c: TestClient) -> str:
    r = _dang_nhap(c, dbtk.TEN_QUAN_TRI, MK_QT)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------------------------------------------------------------------
# Luồng chính
# ---------------------------------------------------------------------------


def test_dang_ky_dang_nhap_toi_dang_xuat_token_cu_het_hieu_luc(client):
    dk = _dang_ky(client, "Shop.Hoa ")  # chữ hoa + khoảng trắng: chuẩn hoá về "shop.hoa"
    assert dk["tai_khoan"]["ten_dang_nhap"] == "shop.hoa"

    r = _dang_nhap(client, "shop.hoa", MK_ND)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    assert len(token) == 43
    assert r.json()["han_giay"] > 0

    toi = client.get("/auth/toi", headers=_hk(token))
    assert toi.status_code == 200, toi.text
    assert toi.json()["tai_khoan"]["ten_dang_nhap"] == "shop.hoa"

    out = client.post("/auth/dang-xuat", headers=_hk(token))
    assert out.status_code == 200
    assert out.json() == {"da_dang_xuat": True}

    sau = client.get("/auth/toi", headers=_hk(token))
    assert sau.status_code == 401
    assert "đăng nhập" in sau.json()["detail"]
    # Đăng xuất lần nữa: không lỗi, chỉ báo không có gì để thu hồi.
    assert client.post("/auth/dang-xuat", headers=_hk(token)).json() == {"da_dang_xuat": False}
    # Token của lần đăng ký (một phiên khác) vẫn sống: đăng xuất chỉ thu hồi đúng token đó.
    assert client.get("/auth/toi", headers=_hk(dk["token"])).status_code == 200


def test_tai_khoan_moi_la_nguoi_ban_chua_xac_minh_che_do_demo(client):
    tai_khoan = _dang_ky(client, "nguoi-ban-moi")["tai_khoan"]
    assert tai_khoan["vai"] == "nguoi-ban"
    assert tai_khoan["da_xac_minh"] is False
    assert tai_khoan["che_do"] == "demo"
    assert tai_khoan["nhan"] == "DÀN DỰNG · CHƯA XÁC MINH"


def test_token_sai_dinh_dang_hay_la_deu_401(client):
    for t in ("", "abc", "x" * 43, "!" * 43):
        assert client.get("/auth/toi", headers=_hk(t)).status_code == 401
    assert client.get("/auth/toi", headers=H).status_code == 401


def test_ten_trung_409_va_quy_tac_ten_mat_khau_422(client):
    _dang_ky(client, "ten-trung")
    r = client.post(
        "/auth/dang-ky", json={"ten_dang_nhap": "TEN-TRUNG", "mat_khau": MK_ND}, headers=H
    )
    assert r.status_code == 409
    assert "đã có người dùng" in r.json()["detail"]

    for ten in ("ab", "a" * 33, "có-dấu", "co khoang", "co@cham"):
        r = client.post("/auth/dang-ky", json={"ten_dang_nhap": ten, "mat_khau": MK_ND}, headers=H)
        assert r.status_code == 422, ten
        assert "Tên đăng nhập" in r.json()["detail"]
    r = client.post(
        "/auth/dang-ky", json={"ten_dang_nhap": "ngan-qua", "mat_khau": "123456789"}, headers=H
    )
    assert r.status_code == 422
    assert "10 ký tự" in r.json()["detail"]
    r = client.post(
        "/auth/dang-ky", json={"ten_dang_nhap": "dai-qua", "mat_khau": "x" * 300}, headers=H
    )
    assert r.status_code == 422


def test_phan_hoi_khong_bao_gio_co_chuoi_bam(client):
    tok = _token_quan_tri(client)
    _dang_ky(client, "khong-lo-bam")
    for r in (
        client.get("/auth/toi", headers=_hk(tok)),
        client.get("/quan-tri/tai-khoan", headers=_hk(tok)),
        client.get("/quan-tri/du-lieu", headers=_hk(tok)),
        _dang_nhap(client, "khong-lo-bam", MK_ND),
    ):
        assert r.status_code == 200, r.text
        assert "scrypt$" not in r.text
        assert "mat_khau" not in r.text
        assert MK_ND not in r.text
        assert MK_QT not in r.text


# ---------------------------------------------------------------------------
# Hạn mức: theo tên và theo địa chỉ, lần sai thứ 6 ⇒ 429
# ---------------------------------------------------------------------------


def test_sai_mat_khau_6_lan_thi_429_ke_ca_khi_lan_6_dung(client):
    _dang_ky(client, "bi-do-mat-khau")
    ma = [_dang_nhap(client, "bi-do-mat-khau", "sai-mat-khau-roi").status_code for _ in range(5)]
    assert ma == [401] * 5
    lan6 = _dang_nhap(client, "bi-do-mat-khau", MK_ND)  # đúng mật khẩu vẫn bị chặn
    assert lan6.status_code == 429
    assert lan6.headers["Retry-After"].isdigit()
    assert "sai quá nhiều lần" in lan6.json()["detail"]


@pytest.fixture
def client_sau_proxy(moi_truong):
    """Kết nối đến từ 127.0.0.1 (proxy tin cậy) ⇒ X-Forwarded-For được đọc."""
    app = create_app(store=InMemoryStore())
    with TestClient(app, client=("127.0.0.1", 50000)) as c:
        yield c


def test_han_muc_theo_ten_dang_nhap_du_doi_dia_chi(client_sau_proxy):
    c = client_sau_proxy
    _dang_ky(c, "doi-ip-van-chan")
    ma = [
        _dang_nhap(c, "doi-ip-van-chan", "sai", {"X-Forwarded-For": f"203.0.113.{i}"}).status_code
        for i in range(6)
    ]
    assert ma == [401] * 5 + [429]


def test_han_muc_theo_dia_chi_du_doi_ten(client_sau_proxy, moi_truong):
    # Ngưỡng theo địa chỉ tách khỏi ngưỡng theo tên (mặc định 20 so với 5): một
    # người gõ nhầm không khoá cả mạng. Hạ xuống 7 cho test chạy nhanh.
    assert tk.CauHinhTaiKhoan.model_fields["livelift_tk_sai_toi_da_ip"].default == 20
    moi_truong.setenv("LIVELIFT_TK_SAI_TOI_DA_IP", "7")
    _xoa_dem()
    c = client_sau_proxy
    xff = {"X-Forwarded-For": "198.51.100.7"}
    ma = [_dang_nhap(c, f"ten-thu-{i}", "sai", xff).status_code for i in range(8)]
    assert ma == [401] * 7 + [429]
    # Địa chỉ khác, tên khác: không bị vạ lây.
    assert (
        _dang_nhap(c, "ten-khac-han", "sai", {"X-Forwarded-For": "198.51.100.8"}).status_code == 401
    )


def test_dang_nhap_dung_xoa_dem_sai_theo_ten(client):
    _dang_ky(client, "go-nham")
    for _ in range(4):
        assert _dang_nhap(client, "go-nham", "sai").status_code == 401
    assert _dang_nhap(client, "go-nham", MK_ND).status_code == 200
    # Đếm theo tên về 0; đếm theo địa chỉ vẫn giữ 4 lần sai ⇒ lần sai kế tiếp còn 401.
    assert _dang_nhap(client, "go-nham", "sai").status_code == 401


def test_dang_ky_co_tran_theo_dia_chi(moi_truong):
    moi_truong.setenv("LIVELIFT_TK_DANG_KY_MOI_GIO", "2")
    _xoa_dem()
    with TestClient(create_app(store=InMemoryStore())) as c:
        _dang_ky(c, "dk-mot")
        _dang_ky(c, "dk-hai")
        r = c.post("/auth/dang-ky", json={"ten_dang_nhap": "dk-ba", "mat_khau": MK_ND}, headers=H)
        assert r.status_code == 429
        assert r.headers["Retry-After"].isdigit()


# ---------------------------------------------------------------------------
# Quyền: chi-xem, nguoi-ban ⇒ 403 · không đăng nhập ⇒ 401 · không token lõi ⇒ 401
# ---------------------------------------------------------------------------


def test_vai_chi_xem_goi_quan_tri_403(client):
    qt = _token_quan_tri(client)
    id_xem = _dang_ky(client, "chi-xem-thoi")["tai_khoan"]["id"]
    r = client.post(
        "/quan-tri/tai-khoan", json={"tai_khoan_id": id_xem, "vai": "chi-xem"}, headers=_hk(qt)
    )
    assert r.status_code == 200, r.text
    assert r.json()["thay_doi"] == ["doi_vai"]
    assert r.json()["tai_khoan"]["che_do"] == "chi-xem"

    tok = _dang_nhap(client, "chi-xem-thoi", MK_ND).json()["token"]
    assert client.get("/auth/toi", headers=_hk(tok)).json()["tai_khoan"]["vai"] == "chi-xem"
    for method, duong, body in (
        ("GET", "/quan-tri/tai-khoan", None),
        ("GET", "/quan-tri/du-lieu", None),
        ("POST", "/quan-tri/tai-khoan", {"tai_khoan_id": id_xem, "vai": "quan-tri"}),
    ):
        r = client.request(method, duong, json=body, headers=_hk(tok))
        assert r.status_code == 403, (duong, r.text)
        assert "quản trị" in r.json()["detail"]


def test_nguoi_ban_goi_quan_tri_403_khong_dang_nhap_401(client):
    tok = _dang_ky(client, "nguoi-ban-to-mo")["token"]
    assert client.get("/quan-tri/tai-khoan", headers=_hk(tok)).status_code == 403
    assert client.get("/quan-tri/du-lieu", headers=H).status_code == 401
    assert client.get("/quan-tri/tai-khoan", headers=_hk("x" * 43)).status_code == 401


@pytest.mark.parametrize(("method", "duong"), ROUTE_TAI_KHOAN)
def test_khong_token_loi_thi_401(method, duong, client):
    """Trình duyệt (không có token lõi) không gọi thẳng được đường nào, kể cả GET."""
    qt = _token_quan_tri(client)
    body = {"ten_dang_nhap": "ai-do", "mat_khau": MK_ND} if method == "POST" else None
    for headers in (
        {tk.HEADER_TAI_KHOAN: qt},
        {"Authorization": "Bearer sai", tk.HEADER_TAI_KHOAN: qt},
    ):
        r = client.request(method, duong, json=body, headers=headers)
        assert r.status_code == 401, (method, duong, r.status_code)
        assert "token" in r.json()["detail"].lower()
        assert TOKEN_LOI not in r.text


def test_token_loi_rong_thi_mo_nhu_cong_ghi(monkeypatch):
    """INGEST_TOKEN rỗng (phát triển cục bộ) ⇒ không cổng nào, đúng quy ước của auth.py."""
    monkeypatch.delenv("INGEST_TOKEN", raising=False)
    monkeypatch.setenv("LIVELIFT_AUTH", "1")
    monkeypatch.setenv("LIVELIFT_MK_QUAN_TRI", "")
    monkeypatch.setenv("LIVELIFT_MK_GIAM_KHAO", "")
    _xoa_dem()
    try:
        with TestClient(create_app(store=InMemoryStore())) as c:
            r = c.post("/auth/dang-ky", json={"ten_dang_nhap": "dev-local", "mat_khau": MK_ND})
            assert r.status_code == 201
            assert (
                c.get("/auth/toi", headers={tk.HEADER_TAI_KHOAN: r.json()["token"]}).status_code
                == 200
            )
    finally:
        _xoa_dem()


# ---------------------------------------------------------------------------
# Cờ LIVELIFT_AUTH=0 ⇒ 404 ở mọi đường, có hay không có token
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(("method", "duong"), ROUTE_TAI_KHOAN)
def test_livelift_auth_0_thi_404(method, duong, moi_truong):
    moi_truong.setenv("LIVELIFT_AUTH", "0")
    _xoa_dem()
    with TestClient(create_app(store=InMemoryStore())) as c:
        body = {"ten_dang_nhap": "ai-do", "mat_khau": MK_ND} if method == "POST" else None
        for headers in ({}, H):
            r = c.request(method, duong, json=body, headers=headers)
            assert r.status_code == 404, (method, duong, headers, r.status_code)
        # Phần còn lại của API không bị ảnh hưởng.
        assert c.get("/health").status_code == 200


def test_bat_lai_auth_khong_can_dung_lai_app(moi_truong):
    """Cờ đọc lúc khớp đường (cấu hình có bộ đệm, khởi động lại thì đổi được)."""
    app = create_app(store=InMemoryStore())
    with TestClient(app) as c:
        moi_truong.setenv("LIVELIFT_AUTH", "0")
        _xoa_dem()
        assert c.get("/auth/toi", headers=H).status_code == 404
        moi_truong.setenv("LIVELIFT_AUTH", "1")
        _xoa_dem()
        assert c.get("/auth/toi", headers=H).status_code == 401


# ---------------------------------------------------------------------------
# Quét bảng định tuyến
# ---------------------------------------------------------------------------


def test_moi_route_ghi_tai_khoan_mang_muc_token_va_khong_route_ghi_nao_quen():
    app = create_app(store=InMemoryStore())
    ghi = liet_ke_route_ghi(app)
    quen = [r["path"] for r in ghi if r["muc"] is None]
    assert quen == [], f"route ghi chưa khai báo mức bảo vệ: {quen}"
    cua_tk = {
        (m, r["path"]): r["muc"]
        for r in ghi
        for m in r["methods"]
        if r["path"].startswith(("/auth/", "/quan-tri/"))
    }
    assert cua_tk == {
        ("POST", "/auth/dang-ky"): MUC_TOKEN,
        ("POST", "/auth/dang-nhap"): MUC_TOKEN,
        ("POST", "/auth/dang-xuat"): MUC_TOKEN,
        ("POST", "/quan-tri/tai-khoan"): MUC_TOKEN,
    }


def test_route_tai_khoan_trong_ung_dung_dung_danh_sach():
    """Thêm route vào /auth hay /quan-tri mà không thêm vào ROUTE_TAI_KHOAN ⇒ đỏ,
    để test 401/404 ở trên luôn phủ hết."""
    from fastapi.routing import APIRoute

    from livelift.api.auth import _moi_route

    app = create_app(store=InMemoryStore())
    co = {
        (m, r.path)
        for r in _moi_route(app)
        if isinstance(r, APIRoute) and r.path.startswith(("/auth/", "/quan-tri/"))
        for m in r.methods
    }
    assert co == set(ROUTE_TAI_KHOAN)


# ---------------------------------------------------------------------------
# Quản trị: xác minh, khoá, tự khoá, nhật ký
# ---------------------------------------------------------------------------


def test_xac_minh_chuyen_che_do_that(client):
    qt = _token_quan_tri(client)
    dk = _dang_ky(client, "se-duoc-xac-minh")
    r = client.post(
        "/quan-tri/tai-khoan",
        json={"tai_khoan_id": dk["tai_khoan"]["id"], "da_xac_minh": True},
        headers=_hk(qt),
    )
    assert r.status_code == 200
    assert r.json()["thay_doi"] == ["xac_minh"]
    toi = client.get("/auth/toi", headers=_hk(dk["token"])).json()["tai_khoan"]
    assert toi["che_do"] == "that"
    assert toi["nhan"] is None


def test_khoa_tai_khoan_thu_hoi_moi_token_va_chan_dang_nhap(client):
    qt = _token_quan_tri(client)
    dk = _dang_ky(client, "se-bi-khoa")
    tid = dk["tai_khoan"]["id"]
    r = client.post(
        "/quan-tri/tai-khoan", json={"tai_khoan_id": tid, "khoa": True}, headers=_hk(qt)
    )
    assert r.status_code == 200
    assert r.json()["tai_khoan"]["khoa"] is True
    assert client.get("/auth/toi", headers=_hk(dk["token"])).status_code == 401
    bi_khoa = _dang_nhap(client, "se-bi-khoa", MK_ND)
    assert bi_khoa.status_code == 403
    assert "bị khoá" in bi_khoa.json()["detail"]
    # Mở khoá: đăng nhập lại được, token cũ thì đã bị thu hồi hẳn.
    client.post("/quan-tri/tai-khoan", json={"tai_khoan_id": tid, "khoa": False}, headers=_hk(qt))
    assert _dang_nhap(client, "se-bi-khoa", MK_ND).status_code == 200
    assert client.get("/auth/toi", headers=_hk(dk["token"])).status_code == 401

    nhat_ky = client.app.state.kho_tai_khoan.liet_ke_nhat_ky()
    viec = [n["viec"] for n in nhat_ky if n["doi_tuong"] == tid]
    assert viec == ["mo_khoa", "khoa"]  # mới nhất trước
    assert all(n["ai"] for n in nhat_ky if n["doi_tuong"] == tid)


def test_quan_tri_khong_tu_khoa_khong_tu_ha_vai(client):
    qt = _token_quan_tri(client)
    toi_id = client.get("/auth/toi", headers=_hk(qt)).json()["tai_khoan"]["id"]
    for body in ({"khoa": True}, {"vai": "nguoi-ban"}, {"vai": "chi-xem"}):
        r = client.post(
            "/quan-tri/tai-khoan", json={"tai_khoan_id": toi_id, **body}, headers=_hk(qt)
        )
        assert r.status_code == 409, body
    assert client.get("/auth/toi", headers=_hk(qt)).json()["tai_khoan"]["vai"] == "quan-tri"


def test_sua_tai_khoan_loi_ro_rang(client):
    qt = _token_quan_tri(client)
    r = client.post("/quan-tri/tai-khoan", json={"tai_khoan_id": "khong-co"}, headers=_hk(qt))
    assert r.status_code == 422
    r = client.post(
        "/quan-tri/tai-khoan", json={"tai_khoan_id": "khong-co", "khoa": True}, headers=_hk(qt)
    )
    assert r.status_code == 404
    r = client.post(
        "/quan-tri/tai-khoan", json={"tai_khoan_id": "x", "vai": "giam-doc"}, headers=_hk(qt)
    )
    assert r.status_code == 422


def test_danh_sach_tai_khoan_cho_quan_tri(client):
    qt = _token_quan_tri(client)
    _dang_ky(client, "trong-danh-sach")
    ds = client.get("/quan-tri/tai-khoan", headers=_hk(qt)).json()["tai_khoan"]
    ten = {t["ten_dang_nhap"]: t for t in ds}
    assert set(ten) == {"quan-tri", "trong-danh-sach"}
    assert ten["quan-tri"]["vai"] == "quan-tri"
    assert ten["quan-tri"]["da_xac_minh"] is True
    assert ten["trong-danh-sach"]["dang_nhap_con_han"] == 1


# ---------------------------------------------------------------------------
# /quan-tri/du-lieu: THẬT và demo tách riêng
# ---------------------------------------------------------------------------


def test_du_lieu_tach_that_va_demo_theo_bang(client):
    qt = _token_quan_tri(client)
    # Phiên THẬT (is_demo=false): tạo bằng token lõi, thêm một bình luận.
    sid = client.post(
        "/sessions", json={"platform": "youtube", "planned_duration_min": 30}, headers=H
    ).json()["session_id"]
    assert (
        client.post(
            f"/sessions/{sid}/comments", json={"text": "giá sao shop"}, headers=H
        ).status_code
        == 200
    )
    # Phiên demo do máy sinh.
    assert (
        client.post("/demo/seed", json={"n_sessions": 1, "duration_min": 30}, headers=H).status_code
        == 200
    )

    r = client.get("/quan-tri/du-lieu", headers=_hk(qt))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["kho"]["backend"] == "memory"
    assert d["kho"]["ben_vung"] is False
    assert d["kho_tai_khoan"]["backend"] == "memory"
    assert d["migration"]["trong_ma"] == max(m.version for m in load_migrations())
    assert d["migration"]["da_ap"] is None
    assert d["bang"]["live_session"]["that"] == 1
    assert d["bang"]["live_session"]["demo"] >= 1
    assert d["bang"]["comment_event"]["that"] == 1
    assert d["bang"]["comment_event"]["demo"] >= 1
    assert d["bang"]["session_tick"]["demo"] > 0
    assert set(dbtk.BANG_THEO_PHIEN) <= set(d["bang"])
    assert "is_demo=false" in d["ghi_chu_that"]
    assert d["tai_khoan"]["theo_vai"]["quan-tri"] == 1
    assert d["tai_khoan"]["dang_nhap_con_han"] >= 1
    assert "sao_luu" in d


# ---------------------------------------------------------------------------
# Băm mật khẩu và token
# ---------------------------------------------------------------------------


def test_bam_mat_khau_dung_dinh_dang_muoi_ngau_nhien():
    mk = "mat-khau-" + secrets.token_hex(6)
    a, b = tk.bam_mat_khau(mk), tk.bam_mat_khau(mk)
    assert a != b  # muối khác nhau
    assert re.fullmatch(r"scrypt\$n=32768,r=8,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+", a)
    assert tk.kiem_mat_khau(mk, a)
    assert tk.kiem_mat_khau(mk, b)
    assert not tk.kiem_mat_khau(mk + "x", a)
    assert not tk.kiem_mat_khau(mk, "")
    assert not tk.kiem_mat_khau(mk, "scrypt$n=3,r=8,p=1$AAAA$AAAA")  # tham số vô lý
    assert not tk.kiem_mat_khau(mk, "scrypt$n=32768,r=8,p=1$!!!$AAAA")
    assert not tk.kiem_mat_khau(mk, "bcrypt$abc")


def test_mat_khau_chuan_hoa_nfc():
    dung_san = "mật-khẩu-đủ-dài"  # dạng dựng sẵn (NFC)
    to_hop = __import__("unicodedata").normalize("NFD", dung_san)
    assert dung_san != to_hop
    assert tk.kiem_mat_khau(to_hop, tk.bam_mat_khau(dung_san))


def test_toi_da_hai_phep_bam_cung_luc(monkeypatch):
    dang_chay = 0
    cao_nhat = 0
    khoa = threading.Lock()
    that = tk.hashlib.scrypt

    def scrypt_cham(*a, **kw):
        nonlocal dang_chay, cao_nhat
        with khoa:
            dang_chay += 1
            cao_nhat = max(cao_nhat, dang_chay)
        time.sleep(0.05)
        try:
            return that(*a, **kw)
        finally:
            with khoa:
                dang_chay -= 1

    monkeypatch.setattr(tk.hashlib, "scrypt", scrypt_cham)
    luong = [threading.Thread(target=tk.bam_mat_khau, args=("mat-khau-luong",)) for _ in range(6)]
    for t in luong:
        t.start()
    for t in luong:
        t.join()
    assert cao_nhat == tk.SO_PHEP_BAM_TOI_DA == 2


def test_kho_chi_luu_sha256_cua_token(client):
    dk = _dang_ky(client, "token-bam")
    kho = client.app.state.kho_tai_khoan
    assert dk["token"] not in repr(kho.__dict__)
    assert kho.tra_dang_nhap(tk.bam_token(dk["token"])) is not None
    assert re.fullmatch(r"[0-9a-f]{64}", tk.bam_token(dk["token"]))


def test_nhat_ky_chan_khoa_pii():
    kho = dbtk.KhoTaiKhoanBoNho()
    for cam in ("email", "so_dien_thoai", "ip", "mat_khau", "token"):
        with pytest.raises(dbtk.ChiTietCoPiiError):
            kho.ghi_nhat_ky(
                ai=None, viec="x", doi_tuong=None, chi_tiet={cam: "?"}, luc=tk.gio_hien_tai()
            )
    # Cùng danh sách với CHECK của migration 0011.
    up = next(m for m in load_migrations() if m.version == 11).up_sql
    for khoa in dbtk.KHOA_CAM_TRONG_NHAT_KY:
        assert f"'{khoa}'" in up, khoa


# ---------------------------------------------------------------------------
# Gieo tài khoản quản trị và giám khảo
# ---------------------------------------------------------------------------


def test_gieo_tu_bien_moi_truong_khong_in_mat_khau(moi_truong):
    mk_gk = secrets.token_urlsafe(12)
    moi_truong.setenv("LIVELIFT_MK_GIAM_KHAO", mk_gk)
    _xoa_dem()
    kho = dbtk.KhoTaiKhoanBoNho()
    in_ra: list[str] = []
    kq = dbtk.gieo_tai_khoan_mac_dinh(kho, in_ra=in_ra.append)
    assert sorted(kq["tao_moi"]) == ["giam-khao", "quan-tri"]
    assert kq["nguon_mat_khau"] == {
        "quan-tri": "LIVELIFT_MK_QUAN_TRI",
        "giam-khao": "LIVELIFT_MK_GIAM_KHAO",
    }
    assert in_ra == []
    assert MK_QT not in repr(kq)
    assert mk_gk not in repr(kq)
    gk = kho.tim_theo_ten("giam-khao")
    assert gk["vai"] == "nguoi-ban"
    assert gk["da_xac_minh"] is False
    assert tk.kiem_mat_khau(mk_gk, gk["mat_khau_bam"])
    assert kho.tim_theo_ten("quan-tri")["vai"] == "quan-tri"


def test_gieo_sinh_ngau_nhien_in_dung_mot_lan(moi_truong):
    moi_truong.setenv("LIVELIFT_MK_QUAN_TRI", "")
    _xoa_dem()
    kho = dbtk.KhoTaiKhoanBoNho()
    in_ra: list[str] = []
    kq1 = dbtk.gieo_tai_khoan_mac_dinh(kho, in_ra=in_ra.append)
    assert sorted(kq1["tao_moi"]) == ["giam-khao", "quan-tri"]
    assert len(in_ra) == 2
    mk = {ten: in_ra[i].rsplit(" ", 1)[-1] for i, ten in enumerate(kq1["tao_moi"])}
    for ten, m in mk.items():
        assert len(m) >= 20
        assert tk.kiem_mat_khau(m, kho.tim_theo_ten(ten)["mat_khau_bam"])
        assert m not in repr(kq1)
    kq2 = dbtk.gieo_tai_khoan_mac_dinh(kho, in_ra=in_ra.append)
    assert kq2["tao_moi"] == []
    assert sorted(kq2["da_co"]) == ["giam-khao", "quan-tri"]
    assert len(in_ra) == 2  # không in lại, không đổi mật khẩu
    assert len(kho.liet_ke()) == 2


def test_api_tu_gieo_chi_khi_co_mat_khau_cau_hinh(client):
    """Kho bộ nhớ: quản trị (có biến) được tạo; giám khảo (biến rỗng) bị bỏ qua, không sinh."""
    _token_quan_tri(client)
    kho = client.app.state.kho_tai_khoan
    assert kho.tim_theo_ten("quan-tri") is not None
    assert kho.tim_theo_ten("giam-khao") is None


def test_ham_gieo_cho_scripts_gieo_demo_db_dung_hop_dong():
    """scripts/gieo_demo_db.py tìm ``gieo_tai_khoan_demo(database_url)`` trong dbops."""
    import inspect

    ts = inspect.signature(dbtk.gieo_tai_khoan_demo).parameters
    bat_buoc = [p for p in ts.values() if p.default is inspect.Parameter.empty]
    assert [p.name for p in bat_buoc] == ["database_url"]


_TEP_QUET = [
    GOC / "src" / "livelift" / "api" / "tai_khoan.py",
    GOC / "src" / "livelift" / "api" / "routes" / "tai_khoan.py",
    GOC / "src" / "livelift" / "dbops" / "tai_khoan.py",
    GOC / "src" / "livelift" / "migrations" / "0011_tai_khoan.up.sql",
    GOC / "scripts" / "gieo_demo_db.py",
]

_MAU_MAT_KHAU_CUNG = [
    # gán chuỗi khác rỗng cho một tên có "mat_khau"/"mk"/"password"
    re.compile(r"(?i)\b\w*(mat_khau|password|passwd|\bmk_\w+)\w*\s*[:=]\s*[\"'][^\"'\s]{4,}[\"']"),
    # biến môi trường mật khẩu gieo kèm giá trị
    re.compile(r"LIVELIFT_MK_\w+\s*=\s*[^\s\"'#]{4,}"),
    re.compile(r"SecretStr\(\s*[\"'][^\"']+[\"']\s*\)"),
    # chuỗi băm scrypt dán sẵn
    re.compile(r"scrypt\$n=\d+,r=\d+,p=\d+\$[A-Za-z0-9+/=]{8,}\$"),
]


def test_ma_nguon_khong_co_mat_khau_viet_cung():
    for tep in _TEP_QUET:
        if not tep.exists():
            continue
        for so, dong in enumerate(tep.read_text(encoding="utf-8").splitlines(), 1):
            for mau in _MAU_MAT_KHAU_CUNG:
                assert not mau.search(dong), (
                    f"{tep.name}:{so}: nghi mật khẩu viết cứng: {dong.strip()}"
                )


def test_mau_quet_bat_duoc_mat_khau_viet_cung():
    """Đối chứng: nếu mẫu quét hỏng thì test ở trên xanh vĩnh viễn."""
    for xau in (
        'mat_khau = "abc123456"',
        "mk_quan_tri='Admin@2026'",
        "LIVELIFT_MK_QUAN_TRI=matkhau123",
        'livelift_mk_quan_tri: SecretStr = SecretStr("abc12345")',
    ):
        assert any(m.search(xau) for m in _MAU_MAT_KHAU_CUNG), xau


# ---------------------------------------------------------------------------
# Migration 0011 (tĩnh; chạy thật trên PostgreSQL ở test_tai_khoan_db.py)
# ---------------------------------------------------------------------------


def test_migration_0011_khong_co_email_so_dien_thoai_va_down_dao_nguoc():
    m = next(m for m in load_migrations() if m.version == 11)
    assert m.name == "tai_khoan"
    up = m.up_sql.lower()
    for bang in ("tai_khoan", "dang_nhap", "nhat_ky_quan_tri"):
        assert f"create table {bang} (" in up
    assert "owner_id uuid" in up
    # Không cột email hay số điện thoại (chỉ được nhắc trong chú thích và trong CHECK chặn PII).
    cot = [
        dong.split()[0]
        for dong in up.splitlines()
        if dong.startswith("    ")
        and dong.strip()
        and not dong.strip().startswith(("--", "'", "check"))
    ]
    for cam in ("email", "so_dien_thoai", "sdt", "phone", "token", "mat_khau"):
        assert cam not in cot, cam
    assert "token_bam" in cot
    assert "mat_khau_bam" in cot

    down = [d.strip() for d in m.down_sql.splitlines() if d.strip() and not d.startswith("--")]
    thu_tu = [d for d in down if d.startswith(("DROP TABLE", "ALTER TABLE"))]
    assert thu_tu == [
        "ALTER TABLE live_session DROP COLUMN IF EXISTS owner_id;",
        "DROP TABLE IF EXISTS nhat_ky_quan_tri;",
        "DROP TABLE IF EXISTS dang_nhap;",
        "DROP TABLE IF EXISTS tai_khoan;",
    ]


# ---------------------------------------------------------------------------
# Duyệt đợt 3b (19/10): song song, máy demo, proxy tin cậy, tên dành riêng,
# 422 không lộ mật khẩu, trần RAM scrypt, gieo không in, dọn đăng nhập cũ
# ---------------------------------------------------------------------------


def test_dang_nhap_song_song_khong_vuot_han_muc(client, monkeypatch):
    """30 lần đoán sai bắn CÙNG LÚC vào một tên: đúng 5 phép băm sai lọt qua.

    Phép băm giả chậm 0,3 giây để mọi luồng chắc chắn đã qua cổng trước khi lần
    sai đầu tiên kịp xong; bản cũ (hỏi rồi mới ghi) để lọt cả 30.
    """
    _dang_ky(client, "bi-ban-song-song")
    so_lan_bam = 0
    khoa = threading.Lock()

    def kiem_cham(mk, chuoi_bam):
        nonlocal so_lan_bam
        with khoa:
            so_lan_bam += 1
        time.sleep(0.3)
        return False

    monkeypatch.setattr(tk, "kiem_mat_khau", kiem_cham)
    rao = threading.Barrier(30)
    ma: list[int] = []

    def ban():
        rao.wait()
        r = _dang_nhap(client, "bi-ban-song-song", "doan-mo-" + secrets.token_hex(3))
        with khoa:
            ma.append(r.status_code)

    luong = [threading.Thread(target=ban) for _ in range(30)]
    for t in luong:
        t.start()
    for t in luong:
        t.join(timeout=30)
    assert so_lan_bam == 5
    assert sorted(ma) == [401] * 5 + [429] * 25


def test_giu_cho_nguyen_tu_va_tra_cho():
    dem = tk.DemLanSai()
    k_ten, k_ip = ("ten", "a"), ("ip", "198.51.100.1")
    giu = [dem.giu_cho([(k_ten, 2), (k_ip, 3)], 900.0, now=float(i)) for i in range(3)]
    assert [c for c, _ in giu] == [0, 0, 0 + 900 - 2]  # tên hết lượt ở lần thứ ba
    dem.tra_cho([k_ten, k_ip], giu[1][1])  # lần thứ hai hoá ra đúng mật khẩu
    assert dem.giu_cho([(k_ten, 2), (k_ip, 3)], 900.0, now=3.0)[0] == 0
    assert dem.giu_cho([(k_ten, 2), (k_ip, 3)], 900.0, now=4.0)[0] > 0
    # Ngưỡng 0 = không đếm khoá đó.
    assert dem.giu_cho([(("ten", "b"), 0)], 900.0, now=5.0) == (0, 5.0)
    assert ("ten", "b") not in dem._lich


def test_may_demo_khong_xff_chi_khoa_theo_ten(moi_truong):
    """Next cùng máy, không ghi X-Forwarded-For: không khoá chung cả máy."""
    moi_truong.setenv("LIVELIFT_TK_SAI_TOI_DA_IP", "2")
    _xoa_dem()
    with TestClient(create_app(store=InMemoryStore()), client=("127.0.0.1", 50000)) as c:
        _dang_ky(c, "chu-may-demo")
        for i in range(4):
            assert _dang_nhap(c, f"go-nham-{i}", "sai").status_code == 401
        # Trình duyệt mở ngay trên máy demo: Next ghi loopback, vẫn không khoá chung.
        for xff in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
            r = _dang_nhap(c, "go-nham-x", "sai", {"X-Forwarded-For": xff})
            assert r.status_code == 401, xff
        assert _dang_nhap(c, "chu-may-demo", MK_ND).status_code == 200
        # Khoá theo tên vẫn còn: tên bị đoán 5 lần thì lần thứ 6 bị 429.
        ma = [_dang_nhap(c, "chu-may-demo", "sai").status_code for _ in range(6)]
        assert ma == [401] * 5 + [429]
        # Next có ghi X-Forwarded-For thì đếm theo địa chỉ của trình duyệt.
        xff = {"X-Forwarded-For": "198.51.100.9"}
        ma = [_dang_nhap(c, f"tu-xa-{i}", "sai", xff).status_code for i in range(3)]
        assert ma == [401, 401, 429]


def test_proxy_tin_cay_cua_duong_tai_khoan_chi_la_loopback():
    for dc in ("127.0.0.1", "127.0.0.2", "::1", "::ffff:127.0.0.1"):
        assert tk.la_proxy_tai_khoan(dc), dc
    for dc in ("192.168.1.50", "10.0.0.9", "172.18.0.3", "fc00::1", "testclient", ""):
        assert not tk.la_proxy_tai_khoan(dc), dc


def test_may_lan_khong_tu_chon_duoc_dia_chi(moi_truong):
    """192.168.x tin được ở TRUSTED_PROXY_CIDRS chung, nhưng KHÔNG ở đường tài khoản."""
    moi_truong.setenv("LIVELIFT_TK_SAI_TOI_DA_IP", "3")
    _xoa_dem()
    with TestClient(create_app(store=InMemoryStore()), client=("192.168.1.50", 50000)) as c:
        ma = [
            _dang_nhap(c, f"lan-{i}", "sai", {"X-Forwarded-For": f"203.0.113.{i}"}).status_code
            for i in range(4)
        ]
        assert ma == [401, 401, 401, 429]
    with TestClient(create_app(store=InMemoryStore()), client=("127.0.0.1", 50000)) as c:
        # Next NỐI địa chỉ trình duyệt vào header trình duyệt tự gửi: phần bên trái
        # đổi liên tục cũng không thoát, vì lõi chỉ đọc chặng bên phải nhất.
        ma = [
            _dang_nhap(
                c, f"noi-{i}", "sai", {"X-Forwarded-For": f"6.6.6.{i}, 192.168.1.50"}
            ).status_code
            for i in range(4)
        ]
        assert ma == [401, 401, 401, 429]


def test_ten_danh_rieng_khong_dang_ky_duoc(client):
    for ten in ("quan-tri", "giam-khao", "Quan-Tri2", "admin", "admin-shop", "livelift.vn", "root"):
        r = client.post("/auth/dang-ky", json={"ten_dang_nhap": ten, "mat_khau": MK_ND}, headers=H)
        assert r.status_code == 409, ten
        assert "dành riêng" in r.json()["detail"]
    # Không phải tiền tố: vẫn đăng ký được.
    assert _dang_ky(client, "shop-admin")["tai_khoan"]["vai"] == "nguoi-ban"


def test_gieo_khong_nhan_tai_khoan_trung_ten_do_nguoi_khac_tao(moi_truong):
    kho = dbtk.KhoTaiKhoanBoNho()
    mk_ke_chiem = "mat-khau-" + secrets.token_hex(4)
    kho.tao_tai_khoan(  # như bản cũ: ai đó đăng ký "quan-tri" trước lệnh gieo
        ten_dang_nhap=dbtk.TEN_QUAN_TRI,
        mat_khau_bam=tk.bam_mat_khau(mk_ke_chiem),
        vai="nguoi-ban",
        da_xac_minh=False,
        tao_luc=tk.gio_hien_tai(),
    )
    with pytest.raises(dbtk.TaiKhoanDanhRiengBiChiemError) as loi:
        dbtk.gieo_tai_khoan_mac_dinh(kho)
    assert loi.value.xung_dot == [dbtk.TEN_QUAN_TRI]
    assert "quan-tri" in str(loi.value)
    assert MK_QT not in str(loi.value)
    assert loi.value.ket["da_co"] == []
    assert kho.tim_theo_ten(dbtk.TEN_QUAN_TRI)["vai"] == "nguoi-ban"  # không bị nâng quyền

    # API tự gieo: không nhận, không nổ, không thử lại mỗi yêu cầu; quản trị vẫn đóng.
    app = create_app(store=InMemoryStore())
    app.state.kho_tai_khoan = kho
    with TestClient(app) as c:
        assert _dang_nhap(c, dbtk.TEN_QUAN_TRI, MK_QT).status_code == 401
        tok = _dang_nhap(c, dbtk.TEN_QUAN_TRI, mk_ke_chiem).json()["token"]
        assert c.get("/quan-tri/du-lieu", headers=_hk(tok)).status_code == 403
        assert app.state.kho_tai_khoan_da_gieo is True


def test_loi_422_khong_tra_lai_mat_khau(client):
    bi_mat = "bi-mat-" + secrets.token_hex(8)
    for duong, than in (
        ("/auth/dang-nhap", {"mat_khau": bi_mat}),
        ("/auth/dang-ky", {"mat_khau": bi_mat}),
        ("/auth/dang-nhap", {"ten_dang_nhap": "ai-do", "mat_khau": bi_mat * 200}),
    ):
        r = client.post(duong, json=than, headers=H)
        assert r.status_code == 422, r.text
        assert bi_mat not in r.text
        for loi in r.json()["detail"]:
            assert set(loi) <= {"type", "loc", "msg"}
            assert loi["loc"][0] == "body"
    # Lỗi nghiệp vụ (chuỗi tiếng Việt) giữ nguyên.
    r = client.post("/auth/dang-ky", json={"ten_dang_nhap": "ab", "mat_khau": MK_ND}, headers=H)
    assert r.status_code == 422
    assert "Tên đăng nhập" in r.json()["detail"]


def test_kiem_mat_khau_tran_bo_nho_64_mib(monkeypatch):
    assert tk.bo_nho_scrypt(tk.SCRYPT_N, tk.SCRYPT_R, tk.SCRYPT_P) <= tk.TRAN_BO_NHO_BAM
    assert tk.TRAN_BO_NHO_BAM == 64 * 1024 * 1024

    def khong_duoc_goi(*a, **kw):
        raise AssertionError("không được băm với tham số quá trần RAM")

    monkeypatch.setattr(tk.hashlib, "scrypt", khong_duoc_goi)
    for n, r, p in ((2**16, 8, 1), (2**17, 16, 1), (2**20, 32, 1), (2**14, 8, 64)):
        chuoi = f"scrypt$n={n},r={r},p={p}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA=="
        assert not tk.kiem_mat_khau("bat-ky", chuoi), (n, r, p)


def test_gieo_cho_script_khong_in_khong_sinh_mat_khau(moi_truong, monkeypatch, capsys):
    moi_truong.setenv("LIVELIFT_MK_QUAN_TRI", "")
    _xoa_dem()
    kho = dbtk.KhoTaiKhoanBoNho()
    monkeypatch.setattr(dbtk.KhoTaiKhoanPostgres, "tu_url", classmethod(lambda cls, url: kho))
    kq = dbtk.gieo_tai_khoan_demo("postgresql://khong-dung")
    assert kq["tao_moi"] == []
    assert sorted(kq["bo_qua"]) == ["giam-khao", "quan-tri"]
    ra = capsys.readouterr()
    assert ra.out == ""
    assert ra.err == ""
    assert kho.liet_ke() == []

    # Lệnh gieo không cờ: chỉ nhắc cách đặt mật khẩu, không sinh, không in mật khẩu.
    assert dbtk.main(["gieo", "--database-url", "postgresql://khong-dung"]) == 0
    ra = capsys.readouterr()
    assert "--in-mat-khau" in ra.out
    assert kho.liet_ke() == []

    # Có cờ: sinh và in MỘT lần, ra stderr; stdout không có mật khẩu nào.
    assert dbtk.main(["gieo", "--database-url", "postgresql://khong-dung", "--in-mat-khau"]) == 0
    ra = capsys.readouterr()
    dong = [d for d in ra.err.splitlines() if "Mật khẩu sinh ngẫu nhiên" in d]
    assert len(dong) == 2
    for d in dong:
        mk = d.rsplit(" ", 1)[-1]
        assert mk not in ra.out
        ten = d.split("'")[1]
        assert tk.kiem_mat_khau(mk, kho.tim_theo_ten(ten)["mat_khau_bam"])


def test_dang_nhap_don_dong_dang_nhap_cu(client):
    dk = _dang_ky(client, "don-dong-cu")
    kho = client.app.state.kho_tai_khoan
    tid = dk["tai_khoan"]["id"]
    bay_gio = tk.gio_hien_tai()
    cu = bay_gio - tk.GIU_DANG_NHAP_CU * 40
    t_cu = tk.bam_token(tk.sinh_token())
    kho.tao_dang_nhap(tai_khoan_id=tid, token_bam=t_cu, tao_luc=cu, het_han=cu + (bay_gio - cu) / 2)
    assert kho.tra_dang_nhap(t_cu) is not None
    assert _dang_nhap(client, "don-dong-cu", MK_ND).status_code == 200
    assert kho.tra_dang_nhap(t_cu) is None
    # Token còn hạn (của lần đăng ký) không bị đụng.
    assert client.get("/auth/toi", headers=_hk(dk["token"])).status_code == 200


def test_tat_auth_thi_route_bien_khoi_openapi(moi_truong):
    with TestClient(create_app(store=InMemoryStore())) as c:
        assert "/auth/dang-nhap" in c.get("/openapi.json").json()["paths"]
    moi_truong.setenv("LIVELIFT_AUTH", "0")
    _xoa_dem()
    with TestClient(create_app(store=InMemoryStore())) as c:
        duong = c.get("/openapi.json").json()["paths"]
        assert not [d for d in duong if d.startswith(("/auth/", "/quan-tri/"))]

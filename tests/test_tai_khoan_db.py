"""Tài khoản trên PostgreSQL thật (mark ``db``): migration 0011 up → down → up, kho SQL, API.

An toàn dữ liệu: mọi thứ chạy trong một SCHEMA TẠM tên ngẫu nhiên (``search_path``
trỏ vào nó trước ``public``), gỡ sạch khi xong. Bảng trong ``public`` (dữ liệu
thật, volume thật) không bị đọc hay ghi; ``migrate_down`` chỉ chạy trong schema
tạm. Vì thế test không cần chốt chặn volume thử như
``tests/test_bat_postgres.py::test_migrate_len_xuong_len_tren_postgres_that``.

Cần ``DATABASE_URL`` trỏ một PostgreSQL đã cài timescaledb (đã ``migrate up`` một
lần là đủ). Thiếu thì SKIP kèm lý do. Test không tự cài extension.
"""

from __future__ import annotations

import os
import secrets
from datetime import timedelta

import pytest

from livelift.api import tai_khoan as tk
from livelift.config import get_settings
from livelift.dbops import tai_khoan as dbtk
from livelift.dbops.migrate import applied_versions, load_migrations, migrate_down, migrate_up

pytestmark = pytest.mark.db

TOKEN_LOI = "token-loi-kiem-thu-tai-khoan-db"
H = {"Authorization": f"Bearer {TOKEN_LOI}"}


@pytest.fixture(scope="module")
def schema_tam():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("cần DATABASE_URL (PostgreSQL)")
    psycopg = pytest.importorskip("psycopg")
    from psycopg import sql
    from psycopg.conninfo import make_conninfo

    try:
        quan_ly = psycopg.connect(url, connect_timeout=3, autocommit=True)
    except psycopg.OperationalError as exc:
        pytest.skip(f"không kết nối được PostgreSQL: {type(exc).__name__}")
    ten = f"ll_thu_tk_{secrets.token_hex(4)}"
    with quan_ly:
        co_ts = quan_ly.execute(
            "SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'"
        ).fetchone()
        if not co_ts:
            pytest.skip("CSDL chưa có timescaledb; chạy livelift-migrate up một lần trước")
        quan_ly.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(ten)))
    conninfo = make_conninfo(url, options=f"-c search_path={ten},public")
    try:
        yield conninfo, ten
    finally:
        # Gỡ bằng migrate_down trước để timescaledb tự dọn hypertable, rồi xoá schema.
        try:
            with psycopg.connect(conninfo, connect_timeout=3) as c:
                da_ap = applied_versions(c)
                if da_ap:
                    migrate_down(c, load_migrations(), steps=len(da_ap))
        finally:
            with psycopg.connect(url, connect_timeout=3, autocommit=True) as quan_ly:
                quan_ly.execute(
                    sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(ten))
                )


def _bang_trong_schema(conn, ten: str) -> set[str]:
    rows = conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = %s", (ten,)
    ).fetchall()
    return {r[0] for r in rows}


def _cot(conn, ten: str, bang: str) -> set[str]:
    rows = conn.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = %s AND table_name = %s",
        (ten, bang),
    ).fetchall()
    return {r[0] for r in rows}


def test_migration_0011_len_xuong_len(schema_tam):
    import psycopg

    conninfo, ten = schema_tam
    migrations = load_migrations()
    tat_ca = [m.version for m in migrations]
    with psycopg.connect(conninfo, connect_timeout=3) as conn:
        migrate_up(conn, migrations)
        assert applied_versions(conn) == tat_ca
        bang = _bang_trong_schema(conn, ten)
        assert {"tai_khoan", "dang_nhap", "nhat_ky_quan_tri", "live_session"} <= bang
        assert "owner_id" in _cot(conn, ten, "live_session")
        for b in ("tai_khoan", "dang_nhap", "nhat_ky_quan_tri"):
            cot = _cot(conn, ten, b)
            assert not cot & {"email", "so_dien_thoai", "sdt", "phone", "token", "mat_khau"}, b

        assert migrate_down(conn, migrations, steps=1) == [11]
        bang = _bang_trong_schema(conn, ten)
        assert not bang & {"tai_khoan", "dang_nhap", "nhat_ky_quan_tri"}
        assert "live_session" in bang
        assert "owner_id" not in _cot(conn, ten, "live_session")

        assert migrate_up(conn, migrations) == [11]
        assert applied_versions(conn) == tat_ca


@pytest.fixture
def kho_pg(schema_tam):
    import psycopg

    conninfo, _ = schema_tam
    with psycopg.connect(conninfo, connect_timeout=3) as conn:
        migrate_up(conn, load_migrations())
        conn.execute("TRUNCATE nhat_ky_quan_tri, dang_nhap, tai_khoan CASCADE")
    return dbtk.KhoTaiKhoanPostgres.tu_url(conninfo)


def test_kho_postgres_hop_dong(kho_pg, schema_tam):
    import psycopg

    kho = kho_pg
    bay_gio = tk.gio_hien_tai()
    bam = tk.bam_mat_khau("mat-khau-" + secrets.token_hex(4))
    a = kho.tao_tai_khoan(
        ten_dang_nhap="pg-mot",
        mat_khau_bam=bam,
        vai="nguoi-ban",
        da_xac_minh=False,
        tao_luc=bay_gio,
    )
    assert isinstance(a["id"], str)
    assert a["khoa"] is False
    with pytest.raises(dbtk.TenDaTonTaiError):
        kho.tao_tai_khoan(
            ten_dang_nhap="pg-mot",
            mat_khau_bam=bam,
            vai="nguoi-ban",
            da_xac_minh=False,
            tao_luc=bay_gio,
        )
    assert kho.tim_theo_ten("pg-mot")["id"] == a["id"]
    assert kho.tim_theo_id(a["id"])["ten_dang_nhap"] == "pg-mot"
    assert kho.tim_theo_id("khong-phai-uuid") is None
    assert kho.cap_nhat(a["id"], {"vai": "chi-xem", "da_xac_minh": True})["vai"] == "chi-xem"
    with pytest.raises(ValueError):
        kho.cap_nhat(a["id"], {"ten_dang_nhap": "doi-ten"})

    t1, t2 = tk.bam_token(tk.sinh_token()), tk.bam_token(tk.sinh_token())
    for t in (t1, t2):
        kho.tao_dang_nhap(
            tai_khoan_id=a["id"], token_bam=t, tao_luc=bay_gio, het_han=bay_gio + timedelta(hours=1)
        )
    kq = kho.tra_dang_nhap(t1)
    assert kq["tai_khoan"]["id"] == a["id"]
    assert kq["dang_nhap"]["thu_hoi"] is None
    assert kho.dem_dang_nhap_con_han(bay_gio) == {a["id"]: 2}
    assert kho.thu_hoi(t1, bay_gio) is True
    assert kho.thu_hoi(t1, bay_gio) is False
    assert kho.thu_hoi_cua_tai_khoan(a["id"], bay_gio) == 1
    assert kho.dem_dang_nhap_con_han(bay_gio) == {}

    # Dọn dòng đăng nhập đã chết: hết hạn lâu rồi, hoặc thu hồi lâu rồi.
    cu = bay_gio - timedelta(days=40)
    t_het_han, t_con_song = tk.bam_token(tk.sinh_token()), tk.bam_token(tk.sinh_token())
    kho.tao_dang_nhap(
        tai_khoan_id=a["id"], token_bam=t_het_han, tao_luc=cu, het_han=cu + timedelta(hours=1)
    )
    kho.tao_dang_nhap(
        tai_khoan_id=a["id"],
        token_bam=t_con_song,
        tao_luc=bay_gio,
        het_han=bay_gio + timedelta(hours=1),
    )
    # t1, t2 vừa bị thu hồi (mốc bay_gio): chưa quá hạn giữ nên còn nguyên.
    assert kho.don_dang_nhap(bay_gio - timedelta(days=1)) == 1
    assert kho.tra_dang_nhap(t_het_han) is None
    assert kho.tra_dang_nhap(t_con_song) is not None
    assert kho.tra_dang_nhap(t1) is not None
    assert kho.don_dang_nhap(bay_gio + timedelta(seconds=1)) == 2  # t1, t2 đã thu hồi
    assert kho.tra_dang_nhap(t_con_song) is not None

    kho.ghi_nhat_ky(
        ai=a["id"], viec="doi_vai", doi_tuong=a["id"], chi_tiet={"vai_moi": "chi-xem"}, luc=bay_gio
    )
    assert kho.dem_nhat_ky() == 1
    assert kho.liet_ke_nhat_ky()[0]["chi_tiet"] == {"vai_moi": "chi-xem"}
    assert kho.co_nhat_ky("doi_vai", a["id"]) is True
    assert kho.co_nhat_ky(dbtk.VIEC_GIEO, "pg-mot") is False
    with pytest.raises(dbtk.ChiTietCoPiiError):
        kho.ghi_nhat_ky(ai=None, viec="x", doi_tuong=None, chi_tiet={"email": "?"}, luc=bay_gio)

    # Cơ sở dữ liệu tự chặn, kể cả khi ai đó đi vòng qua tầng ứng dụng.
    conninfo, _ = schema_tam
    with psycopg.connect(conninfo, connect_timeout=3) as conn:
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                "INSERT INTO nhat_ky_quan_tri (viec, chi_tiet) "
                "VALUES ('x', '{\"ip\": \"1.2.3.4\"}')"
            )
        conn.rollback()
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                "INSERT INTO tai_khoan (ten_dang_nhap, mat_khau_bam) VALUES ('Có Dấu', %s)", (bam,)
            )
        conn.rollback()
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                "INSERT INTO tai_khoan (ten_dang_nhap, mat_khau_bam) VALUES ('mk-tho', 'abc')"
            )
        conn.rollback()

    tk_bang = kho.thong_ke_bang()
    assert set(dbtk.BANG_THEO_PHIEN) | {"live_session", "product"} <= set(tk_bang["bang"])
    assert tk_bang["migration"]["moi_nhat"]["version"] == max(m.version for m in load_migrations())


def test_gieo_tren_postgres_khong_nhan_ten_bi_chiem(kho_pg, monkeypatch):
    """Tên dành riêng bị chiếm từ trước (bản cũ chưa chặn đăng ký) ⇒ gieo báo lỗi rõ."""
    monkeypatch.setenv("LIVELIFT_MK_QUAN_TRI", secrets.token_urlsafe(16))
    monkeypatch.setenv("LIVELIFT_MK_GIAM_KHAO", "")
    tk.cau_hinh_tai_khoan.cache_clear()
    try:
        kho_pg.tao_tai_khoan(
            ten_dang_nhap=dbtk.TEN_GIAM_KHAO,
            mat_khau_bam=tk.bam_mat_khau("mat-khau-" + secrets.token_hex(4)),
            vai="nguoi-ban",
            da_xac_minh=False,
            tao_luc=tk.gio_hien_tai(),
        )
        with pytest.raises(dbtk.TaiKhoanDanhRiengBiChiemError) as loi:
            dbtk.gieo_tai_khoan_mac_dinh(kho_pg)
        assert loi.value.xung_dot == [dbtk.TEN_GIAM_KHAO]
        assert loi.value.ket["tao_moi"] == [dbtk.TEN_QUAN_TRI]
        # Chạy lại: quản trị do gieo tạo là "đã có", giám khảo vẫn bị báo.
        with pytest.raises(dbtk.TaiKhoanDanhRiengBiChiemError) as loi2:
            dbtk.gieo_tai_khoan_mac_dinh(kho_pg)
        assert loi2.value.ket["da_co"] == [dbtk.TEN_QUAN_TRI]
    finally:
        tk.cau_hinh_tai_khoan.cache_clear()


def test_api_tren_postgres(schema_tam, kho_pg, monkeypatch):
    from fastapi.testclient import TestClient

    from livelift.api.main import create_app
    from livelift.api.store import PostgresStore

    conninfo, _ = schema_tam
    mk_qt = secrets.token_urlsafe(16)
    mk_nd = "mat-khau-" + secrets.token_hex(4)
    monkeypatch.setenv("INGEST_TOKEN", TOKEN_LOI)
    monkeypatch.setenv("LIVELIFT_AUTH", "1")
    monkeypatch.setenv("LIVELIFT_MK_QUAN_TRI", mk_qt)
    monkeypatch.setenv("LIVELIFT_MK_GIAM_KHAO", "")
    get_settings.cache_clear()
    tk.cau_hinh_tai_khoan.cache_clear()
    store = PostgresStore(conninfo)
    try:
        with TestClient(create_app(store=store)) as c:
            dk = c.post(
                "/auth/dang-ky", json={"ten_dang_nhap": "pg-api", "mat_khau": mk_nd}, headers=H
            )
            assert dk.status_code == 201, dk.text
            r = c.post(
                "/auth/dang-nhap", json={"ten_dang_nhap": "pg-api", "mat_khau": mk_nd}, headers=H
            )
            assert r.status_code == 200, r.text
            tok = r.json()["token"]
            hk = {**H, tk.HEADER_TAI_KHOAN: tok}
            assert c.get("/auth/toi", headers=hk).json()["tai_khoan"]["che_do"] == "demo"
            assert c.post("/auth/dang-xuat", headers=hk).json() == {"da_dang_xuat": True}
            assert c.get("/auth/toi", headers=hk).status_code == 401

            qt = c.post(
                "/auth/dang-nhap", json={"ten_dang_nhap": "quan-tri", "mat_khau": mk_qt}, headers=H
            )
            assert qt.status_code == 200, qt.text
            hq = {**H, tk.HEADER_TAI_KHOAN: qt.json()["token"]}
            d = c.get("/quan-tri/du-lieu", headers=hq).json()
            assert d["kho"]["backend"] == "postgres"
            assert d["kho_tai_khoan"]["backend"] == "postgres"
            assert d["migration"]["con_thieu"] == []
            assert 11 in d["migration"]["da_ap"]
            assert d["tai_khoan"]["theo_vai"]["quan-tri"] == 1
            assert "scrypt$" not in c.get("/quan-tri/tai-khoan", headers=hq).text
    finally:
        store.close()
        get_settings.cache_clear()
        tk.cau_hinh_tai_khoan.cache_clear()

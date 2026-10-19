"""``scripts/gieo_demo_db.py``: gieo bộ dữ liệu demo, chạy lại KHÔNG sinh bản trùng.

Bấm gieo lại trước buổi demo là thao tác bình thường (bài học 14/09: hai lần gieo bộ
vàng thì màn kết quả có 12 dòng trùng tên). Test chạy script thật trên API thật
(``create_app`` + kho bộ nhớ, qua ``TestClient``) và giữ các luật:

1. gieo hai lần: số phiên, số hàng, mã phòng y nguyên; lần hai mọi bước là ĐÃ CÓ;
2. mất tệp trạng thái thì vẫn nhận lại phòng cũ (không tạo phiên lab mới);
3. phòng đã huỷ hoặc kết thúc thì tạo phòng mới (phòng cũ không mở lại được);
4. phòng là phiên ``lab`` khai báo ``dry_run=True`` lúc tạo, không phải phiên mẫu;
   máy chủ gắn ``is_demo`` (gửi không token) thì script huỷ phiên và báo LỖI;
5. bộ hàng D-025 đồng nhất giữa ``routes/demo.py``, ``mo_phong_xem.py`` và Live Desk;
6. hàm gieo tài khoản của N1: chưa có thì BỎ QUA có lý do, có thì được gọi.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from livelift.api.main import create_app
from livelift.api.routes.demo import DEMO_PRODUCTS
from livelift.api.store import InMemoryStore
from livelift.config import get_settings

GOC = Path(__file__).resolve().parents[1]


def _nap(ten: str):
    spec = importlib.util.spec_from_file_location(ten, GOC / "scripts" / f"{ten}.py")
    assert spec is not None
    assert spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def gd():
    try:
        yield _nap("gieo_demo_db")
    finally:
        sys.modules.pop("gieo_demo_db", None)


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("LIVELIFT_AUTOPILOT", "0")
    monkeypatch.delenv("INGEST_TOKEN", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def khong_n1(monkeypatch, gd):
    """Giả lập máy chưa có gói tài khoản N1, kể cả khi nhánh đã ghép (test không phụ thuộc N1)."""
    monkeypatch.setattr(gd, "_tim_ham_tai_khoan", lambda: None)


@pytest.fixture
def api(env, khong_n1):
    store = InMemoryStore()
    with TestClient(create_app(store=store)) as client:
        yield client, store


def _gieo(gd, client, tep: Path, **kw):
    bang, data = gd.gieo(client, nguon="api:thu", tep_trang_thai=tep, video=None, **kw)
    if data.get("phong"):
        gd.ghi_trang_thai(tep, data)
    return {ten: kq for ten, kq, _ in bang}, data


def _dem(store) -> dict[str, int]:
    ss = store.list_sessions()
    return {
        "phien": len(ss),
        "lab": sum(1 for s in ss if s["platform"] == "lab"),
        "hang": len(store.list_products()),
    }


def test_gieo_hai_lan_khong_sinh_ban_trung(gd, api, tmp_path):
    client, store = api
    tep = tmp_path / "gieo-demo.json"
    kq1, data1 = _gieo(gd, client, tep)
    assert kq1["Bộ hàng D-025"] == gd.TAO_MOI
    assert kq1["Bộ phiên mẫu (demo vàng)"] == gd.TAO_MOI
    assert kq1["Phiên đang phát mẫu"] == gd.TAO_MOI
    assert kq1["Phòng xem dry_run"] == gd.TAO_MOI
    assert kq1["Tài khoản quản trị, giám khảo"] == gd.BO_QUA
    truoc = _dem(store)

    kq2, data2 = _gieo(gd, client, tep)
    assert _dem(store) == truoc
    for ten, kq in kq2.items():
        if ten != "Tài khoản quản trị, giám khảo":
            assert kq == gd.DA_CO, (ten, kq)
    assert data2["phong"]["code"] == data1["phong"]["code"]
    assert data2["phong"]["session_id"] == data1["phong"]["session_id"]
    assert data2["phien_dang_phat"] == data1["phien_dang_phat"]

    # đủ thứ đã hứa
    assert truoc["lab"] == 1
    ss = store.list_sessions()
    assert sum(1 for s in ss if str(s["title"]).startswith("Demo vàng · ")) == 6
    assert sum(1 for s in ss if s.get("is_demo") and s["status"] == "live") == 1
    assert {p["product_id"] for p in store.list_products()} == {"LAB-1", "LAB-2", "LAB-3", "LAB-4"}


def test_phong_la_lab_dry_run_khong_phai_phien_mau(gd, api, tmp_path):
    client, store = api
    _, data = _gieo(gd, client, tmp_path / "t.json")
    s = store.get_session(data["phong"]["session_id"])
    assert s["platform"] == "lab"
    assert s["dry_run"] is True
    assert s["is_demo"] is False
    assert s["mode"] == "auto"
    assert s["title"] == gd.TIEU_DE_PHONG
    assert s["phong_xem"]["enabled"] is True
    assert s["phong_xem"]["products"] == ["LAB-1", "LAB-2", "LAB-3", "LAB-4"]
    assert store.get_blocks(s["session_id"]), "phòng phải có lịch bốc thăm sẵn"
    r = client.get(f"/xem-api/{data['phong']['code']}/trang-thai")
    assert r.status_code == 200
    assert r.json()["room"]["status"] == "chua_mo"


def test_mat_tep_trang_thai_van_nhan_lai_phong_cu(gd, api, tmp_path):
    client, store = api
    tep = tmp_path / "t.json"
    _, data1 = _gieo(gd, client, tep)
    tep.unlink()
    truoc = _dem(store)
    kq, data2 = _gieo(gd, client, tep)
    assert kq["Phòng xem dry_run"] == gd.DA_CO
    assert data2["phong"]["code"] == data1["phong"]["code"]
    assert _dem(store) == truoc


def test_tep_trang_thai_cua_kho_khac_khong_duoc_tin(gd, api, tmp_path):
    client, store = api
    tep = tmp_path / "t.json"
    tep.write_text(
        json.dumps({"nguon": "api:may-khac", "phong": {"session_id": "x", "code": "khongco"}}),
        encoding="utf-8",
    )
    kq, data = _gieo(gd, client, tep)
    assert kq["Phòng xem dry_run"] == gd.TAO_MOI
    assert data["phong"]["code"] != "khongco"


def test_phong_da_huy_thi_tao_phong_moi(gd, api, tmp_path):
    client, store = api
    tep = tmp_path / "t.json"
    _, data1 = _gieo(gd, client, tep)
    assert client.post(f"/sessions/{data1['phong']['session_id']}/cancel").status_code == 200
    kq, data2 = _gieo(gd, client, tep)
    assert kq["Phòng xem dry_run"] == gd.TAO_MOI
    assert data2["phong"]["session_id"] != data1["phong"]["session_id"]
    assert data2["phong"]["code"] != data1["phong"]["code"]
    con_mo = [
        s
        for s in store.list_sessions()
        if s["platform"] == "lab" and s["status"] in ("planned", "scheduled", "live")
    ]
    assert len(con_mo) == 1


def test_bat_dau_mo_phong_va_chay_lai_khong_khoi_dong_lai(gd, api, tmp_path):
    client, store = api
    tep = tmp_path / "t.json"
    _, data = _gieo(gd, client, tep, bat_dau=True)
    sid = data["phong"]["session_id"]
    assert data["phong"]["status"] == "live"
    start_ts = store.get_session(sid)["start_ts"]
    _, data2 = _gieo(gd, client, tep, bat_dau=True)
    assert data2["phong"]["status"] == "live"
    assert store.get_session(sid)["start_ts"] == start_ts
    assert (
        client.get(f"/xem-api/{data['phong']['code']}/trang-thai").json()["room"]["status"]
        == "dang_mo"
    )


def test_khong_token_tren_api_co_khoa_thi_bao_loi_va_khong_de_phong_mau(
    gd, monkeypatch, khong_n1, tmp_path
):
    monkeypatch.setenv("LIVELIFT_AUTOPILOT", "0")
    monkeypatch.setenv("INGEST_TOKEN", "bi-mat-thu")
    get_settings.cache_clear()
    try:
        store = InMemoryStore()
        with TestClient(create_app(store=store)) as client:
            kq, data = _gieo(gd, client, tmp_path / "t.json")
        assert kq["Phòng xem dry_run"] == gd.LOI
        assert "phong" not in data
        con_mo = [
            s
            for s in store.list_sessions()
            if s["platform"] == "lab" and s["status"] in ("planned", "scheduled", "live")
        ]
        assert con_mo == []
    finally:
        get_settings.cache_clear()


def test_tep_trang_thai_khong_chua_bi_mat(gd, api, tmp_path):
    client, _ = api
    tep = tmp_path / "t.json"
    _gieo(gd, client, tep)
    text = tep.read_text(encoding="utf-8").lower()
    for cam in ("token", "password", "mat_khau", "database_url", "postgresql://"):
        assert cam not in text


# ---------------------------------------------------------------------------
# Bộ hàng D-025 đồng nhất ba nơi
# ---------------------------------------------------------------------------


def test_bo_hang_d025_dong_nhat_demo_mo_phong_xem_live_desk():
    mpx = _nap("mo_phong_xem")
    try:
        assert DEMO_PRODUCTS == mpx.SAN_PHAM_MAC_DINH
    finally:
        sys.modules.pop("mo_phong_xem", None)
    tsx = (GOC / "next" / "src" / "components" / "minh-hoa" / "hang.tsx").read_text(
        encoding="utf-8"
    )
    trong_tsx = {
        m.group(1): (m.group(2), int(m.group(3)))
        for m in re.finditer(r'productId: "([^"]+)", ten: "([^"]+)", gia: (\d+)', tsx)
    }
    assert trong_tsx == {p["product_id"]: (p["name"], p["price"]) for p in DEMO_PRODUCTS}
    assert [p["name"] for p in DEMO_PRODUCTS] == [
        "Áo thun cotton basic",
        "Túi tote canvas",
        "Bình giữ nhiệt inox 750ml",
        "Set 3 kẹp tóc càng cua",
    ]


# ---------------------------------------------------------------------------
# Tài khoản (N1)
# ---------------------------------------------------------------------------


def test_tai_khoan_bo_qua_khi_chua_co_ham_gieo(gd, monkeypatch):
    for ten in gd.MODULE_TAI_KHOAN:
        monkeypatch.setitem(sys.modules, ten, None)  # import ra ImportError
    kq, ly_do = gd.gieo_tai_khoan(None, "postgresql://u:p@127.0.0.1:5432/x")
    assert kq == gd.BO_QUA
    assert "N1" in ly_do


def test_tai_khoan_goi_ham_gieo_cua_n1(gd, monkeypatch):
    goi: list[str] = []
    mod = types.ModuleType("livelift.dbops.tai_khoan")

    def gieo_tai_khoan_demo(database_url: str) -> dict:
        goi.append(database_url)
        lan = len(goi)
        return {
            "tao_moi": ["quan-tri", "giam-khao"] if lan == 1 else [],
            "da_co": [] if lan == 1 else ["quan-tri", "giam-khao"],
        }

    mod.gieo_tai_khoan_demo = gieo_tai_khoan_demo  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "livelift.dbops.tai_khoan", mod)
    url = "postgresql://u:p@127.0.0.1:5432/x"
    kq1, ct1 = gd.gieo_tai_khoan(None, url)
    kq2, ct2 = gd.gieo_tai_khoan(None, url)
    assert (kq1, kq2) == (gd.TAO_MOI, gd.DA_CO)
    assert goi == [url, url]
    assert "quan-tri" in ct1
    assert "p@" not in ct1 + ct2


def test_tai_khoan_can_kho_ma_khong_co_thi_bo_qua(gd, monkeypatch):
    mod = types.ModuleType("livelift.dbops.tai_khoan")
    mod.gieo_tai_khoan_demo = lambda store: {"tao_moi": ["x"]}  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "livelift.dbops.tai_khoan", mod)
    kq, ly_do = gd.gieo_tai_khoan(None, None)
    assert kq == gd.BO_QUA
    assert "--truc-tiep" in ly_do


# ---------------------------------------------------------------------------
# Duyệt đợt 3 (N4b): video tới sau, mã hàng cũ, tài khoản theo kho thật của API
# ---------------------------------------------------------------------------


def _gieo_bang(gd, client, tep: Path, video=None, **kw):
    bang, data = gd.gieo(client, nguon="api:thu", tep_trang_thai=tep, video=video, **kw)
    if data.get("phong"):
        gd.ghi_trang_thai(tep, data)
    return {ten: (kq, ct) for ten, kq, ct in bang}, data


def test_video_toi_sau_lan_gieo_dau_thi_cap_nhat_phong_giu_ma(gd, api, tmp_path):
    """mp4 người dẫn AI giao sau (V1, 20/10): phòng gieo trước đó phải nhận video khi
    chạy lại với --video, không im lặng báo ĐÃ CÓ với video_url=None mãi mãi."""
    client, store = api
    tep = tmp_path / "t.json"
    _, data1 = _gieo_bang(gd, client, tep, video=None)
    code = data1["phong"]["code"]
    assert client.get(f"/xem-api/{code}/trang-thai").json()["room"]["video_url"] is None
    truoc = _dem(store)

    kq, data2 = _gieo_bang(gd, client, tep, video="/xem/nguoi-dan-ai.mp4")
    assert kq["Phòng xem dry_run"][0] == gd.CAP_NHAT
    assert "video" in kq["Phòng xem dry_run"][1]
    assert data2["phong"]["code"] == code
    assert data2["phong"]["video_url"] == "/xem/nguoi-dan-ai.mp4"
    room = client.get(f"/xem-api/{code}/trang-thai").json()["room"]
    assert room["video_url"] == "/xem/nguoi-dan-ai.mp4"
    assert room["dry_run"] is True
    assert _dem(store) == truoc

    # chạy lại cùng video: ĐÃ CÓ; chạy không video: giữ video cũ, không xoá
    kq, _ = _gieo_bang(gd, client, tep, video="/xem/nguoi-dan-ai.mp4")
    assert kq["Phòng xem dry_run"][0] == gd.DA_CO
    kq, _ = _gieo_bang(gd, client, tep, video=None)
    assert kq["Phòng xem dry_run"][0] == gd.DA_CO
    assert (
        client.get(f"/xem-api/{code}/trang-thai").json()["room"]["video_url"]
        == "/xem/nguoi-dan-ai.mp4"
    )


def test_phong_bi_tat_thi_bat_lai_va_noi_ro(gd, api, tmp_path):
    client, _ = api
    tep = tmp_path / "t.json"
    _, data = _gieo_bang(gd, client, tep)
    sid, code = data["phong"]["session_id"], data["phong"]["code"]
    tat = client.post(
        f"/sessions/{sid}/phong-xem",
        json={"enabled": False, "consent_version": "2026-10-15", "products": ["LAB-1", "LAB-2"]},
    )
    assert tat.status_code == 200
    assert client.get(f"/xem-api/{code}/trang-thai").status_code == 404
    kq, data2 = _gieo_bang(gd, client, tep)
    assert kq["Phòng xem dry_run"][0] == gd.CAP_NHAT
    assert "BẬT LẠI" in kq["Phòng xem dry_run"][1]
    assert data2["phong"]["code"] == code
    assert client.get(f"/xem-api/{code}/trang-thai").status_code == 200


def test_kho_con_ma_cu_truoc_d025_thi_canh_bao_khong_xoa(gd, api, tmp_path):
    client, store = api
    for pid in ("P-SAP", "P-BINH"):
        r = client.post(
            "/products",
            json={"product_id": pid, "name": f"cũ {pid}", "cost": 1, "price": 2, "stock": 5},
        )
        assert r.status_code < 300, r.text
    kq, data = _gieo_bang(gd, client, tmp_path / "t.json")
    trang_thai, chi_tiet = kq["Mã hàng ngoài D-025"]
    assert trang_thai == gd.CANH_BAO
    assert "P-SAP" in chi_tiet
    assert "P-BINH" in chi_tiet
    assert "không xoá" in chi_tiet
    assert "gieo_lai=true" in chi_tiet
    assert {"P-SAP", "P-BINH"} <= {p["product_id"] for p in store.list_products()}
    assert data["ma_ngoai_d025"] == ["P-BINH", "P-SAP"]


def test_kho_sach_khong_co_dong_canh_bao(gd, api, tmp_path):
    client, _ = api
    kq, _ = _gieo_bang(gd, client, tmp_path / "t.json")
    assert "Mã hàng ngoài D-025" not in kq


def test_canh_bao_ma_cu_kho_ben_doi_m_quyet_dinh(gd):
    assert "M quyết định" in gd.canh_bao_ma_cu(["P-KHAN"], ben=True)
    assert "kho mới" in gd.canh_bao_ma_cu(["X-1"], ben=False)


def test_api_chay_ram_khong_gieo_tai_khoan_vao_postgres(gd, env, monkeypatch, tmp_path):
    """.env ghi postgres nhưng API đang chạy RAM: tài khoản gieo vào Postgres thì lúc demo
    không đăng nhập được. Quyết định theo /health của API, không theo .env."""
    goi: list[str] = []

    def gieo_tai_khoan_demo(database_url: str) -> dict:
        goi.append(database_url)
        return {"tao_moi": ["giam-khao"]}

    monkeypatch.setattr(gd, "_tim_ham_tai_khoan", lambda: ("n1.gieo", gieo_tai_khoan_demo))
    with TestClient(create_app(store=InMemoryStore())) as client:
        bang, _ = gd.gieo(
            client,
            nguon="api:thu",
            tep_trang_thai=tmp_path / "t.json",
            video=None,
            database_url="postgresql://u:p@127.0.0.1:5432/x",
        )
    kq = {ten: (k, ct) for ten, k, ct in bang}
    assert kq["Tài khoản quản trị, giám khảo"][0] == gd.BO_QUA
    assert "kho RAM" in kq["Tài khoản quản trị, giám khảo"][1]
    assert goi == []


def test_kho_chet_thi_ma_thoat_2(gd):
    assert gd.kho_chet([("Kho", gd.LOI, "postgres · durable=False · kho không trả lời")])
    assert not gd.kho_chet([("Kho", gd.DA_CO, "memory"), ("Bộ hàng D-025", gd.LOI, "x")])


def test_main_khong_api_khong_postgres_tra_2(gd, monkeypatch, capsys):
    monkeypatch.setattr(gd, "_api_song", lambda _u: False)
    monkeypatch.setattr(gd, "_postgres_da_cau_hinh", lambda: (False, None))
    assert gd.main(["--api", "http://127.0.0.1:9"]) == 2
    assert "bat_postgres.py" in capsys.readouterr().out

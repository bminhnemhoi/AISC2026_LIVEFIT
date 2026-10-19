"""Đơn vị N2: ``GET /tong-quan/thong-ke`` (kế hoạch bản 3.1, mục 4 và 5).

Chốt chặn:

* số phiên tách riêng theo nhãn nguồn, đủ năm ô, không trường tổng cộng qua nhãn;
* phiên phân tích video có thật (replay không phải mẫu) là QUAN SÁT, không vào MÔ
  PHỎNG, không vào kết quả gộp;
* THẬT bằng 0 khi kho chỉ có dữ liệu mẫu; hàng gộp 0 phiên ghi "Chưa có phiên" kể
  cả khi khoá §7 bật;
* mỗi hàng gộp đúng một nhãn (hình thoi không trộn THẬT với DÀN DỰNG);
* bộ nhớ đệm: không tính lại trong hạn, tính lại ngay khi dấu phiên hay khoá đổi;
* ``env`` lọc đúng ranh giới ``is_demo``;
* phiên còn khoá §7 chỉ có trạng thái "Đang khoá", không một con số;
* kết luận đọc lại từ đúng báo cáo sau phiên (``/bao-cao``) và bản gộp
  (``/experiment/summary``), không tính lại;
* phiên đang live không kèm ước lượng;
* đường đọc mở như mọi GET khác, kể cả khi bật token ghi.

Router được gắn vào ``create_app`` nếu ``api/main.py`` chưa có dòng include (N1 thêm);
khi N1 đã thêm thì fixture dùng nguyên ứng dụng thật.
"""

from __future__ import annotations

import random
import threading
import time
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient

from livelift.api import service
from livelift.api.auth import _moi_route
from livelift.api.main import create_app
from livelift.api.routes import reports, tong_quan
from livelift.api.routes.demo import DEMO_PRODUCTS, _seed_one_session, seed_demo_vang
from livelift.api.store import InMemoryStore
from livelift.config import get_settings

DUONG = "/tong-quan/thong-ke"
_YAML_CANON = Path(__file__).resolve().parents[1] / "docs" / "canon" / "thuat-ngu.yaml"

KHOA_GOC = {
    "env",
    "luc",
    "tinh_luc",
    "dem_theo_nhan",
    "phien_dang_live",
    "rung",
    "rung_bo_bot",
    "gop",
    "nguon_du_lieu",
}
KHOA_DEM = {"ma", "hien_thi", "so_phien", "dang_live", "da_xong", "chua_phat", "da_huy"}
KHOA_LIVE = {
    "session_id",
    "tieu_de",
    "nhan",
    "platform",
    "bat_dau",
    "so_khoi_da_chay",
    "so_khoi_ke_hoach",
}
TRUONG_SO = ("estimate", "ci_low", "ci_high", "p_value", "n_draws", "n_blocks", "n_on", "n_off")


# ---------------------------------------------------------------------------
# Fixture và tiện ích
# ---------------------------------------------------------------------------


def _co_route(app) -> bool:
    return any(getattr(r, "path", None) == DUONG for r in _moi_route(app))


def _dung_app(store):
    app = create_app(store=store)
    if not _co_route(app):  # N1 chưa thêm dòng include vào api/main.py
        app.include_router(tong_quan.router, tags=["tong-quan"])
    return app


@pytest.fixture(autouse=True)
def _khong_khoa(monkeypatch):
    """Mặc định không khoá §7 và bộ nhớ đệm rỗng; test nào cần khoá tự đặt ngày."""
    monkeypatch.delenv("RESULTS_FREEZE_UNTIL", raising=False)
    get_settings.cache_clear()
    tong_quan.xoa_bo_dem()
    yield
    tong_quan.xoa_bo_dem()
    get_settings.cache_clear()


@pytest.fixture
def store():
    s = InMemoryStore()
    now = service.now_utc()
    for p in DEMO_PRODUCTS:
        s.create_product({**p, "created_at": now})
    return s


@pytest.fixture
def client(store):
    with TestClient(_dung_app(store)) as c:
        yield c


def _khoa_toi(monkeypatch, ngay: str) -> None:
    monkeypatch.setenv("RESULTS_FREEZE_UNTIL", ngay)
    get_settings.cache_clear()


def _gieo(
    store,
    *,
    platform: str = "sim",
    is_demo: bool = True,
    dry_run: bool = False,
    duration_min: int = 40,
    effect: float = 0.8,
    seed: int = 1000,
    ago_min: int = 300,
    leave_live: bool = False,
    title: str | None = None,
) -> str:
    """Một phiên đủ dữ liệu qua đúng đường gieo demo, đổi được nền tảng và cờ chạy thử.

    Máy sinh chỉ tạo phiên ``sim``/``replay``; để có phiên mang nhãn THẬT, DÀN DỰNG,
    THỬ NỘI BỘ, test tạm che ``create_session`` của kho đúng lúc tạo phiên.
    """
    goc = store.create_session

    def tao(row: dict[str, Any]) -> dict[str, Any]:
        return goc({**row, "platform": platform, "dry_run": dry_run})

    store.create_session = tao
    try:
        return _seed_one_session(
            store,
            random.Random(seed),
            duration_min=duration_min,
            effect=effect,
            seed=seed,
            start_offset_ago_min=ago_min,
            leave_live=leave_live,
            is_demo=is_demo,
            title=title or f"phiên test {platform} seed={seed}",
        )
    finally:
        del store.create_session


def _phien_tran(
    store, *, platform: str, status: str, is_demo=False, dry_run=False, design=None
) -> str:
    """Phiên không có lịch, không dữ liệu: đủ cho phép đếm."""
    now = service.now_utc()
    sid = service.new_id()
    store.create_session(
        {
            "session_id": sid,
            "platform": platform,
            "title": f"trần {platform} {status}",
            "mode": "auto",
            "status": status,
            "planned_duration_min": 30,
            "host_id": "test",
            "start_ts": now if status in ("live", "ended") else None,
            "end_ts": now if status == "ended" else None,
            "design": design,
            "created_at": now,
            "is_demo": is_demo,
            "dry_run": dry_run,
        }
    )
    return sid


def _phien_phan_tich_video(store) -> str:
    """Đúng dạng phiên POST /replays/youtube tạo: replay, đã xong, analysis_only, không mẫu."""
    return _phien_tran(
        store,
        platform="replay",
        status="ended",
        design={"analysis_only": True, "source_url": "https://youtu.be/x", "video_id": "x"},
    )


def _dem(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {d["ma"]: d for d in body["dem_theo_nhan"]}


def _cac_so(obj: Any) -> list[Any]:
    """Mọi giá trị số (không tính bool) trong một cây JSON."""
    if isinstance(obj, bool):
        return []
    if isinstance(obj, int | float):
        return [obj]
    if isinstance(obj, dict):
        return [x for v in obj.values() for x in _cac_so(v)]
    if isinstance(obj, list):
        return [x for v in obj for x in _cac_so(v)]
    return []


def _cac_chu(obj: Any) -> list[str]:
    if isinstance(obj, str):
        return [obj]
    if isinstance(obj, dict):
        return [x for v in obj.values() for x in _cac_chu(v)]
    if isinstance(obj, list):
        return [x for v in obj for x in _cac_chu(v)]
    return []


# ---------------------------------------------------------------------------
# Hợp đồng
# ---------------------------------------------------------------------------


def test_duong_nam_o_tong_quan_khong_duoi_sessions(client):
    assert tong_quan.DUONG_THONG_KE == DUONG
    assert not DUONG.startswith("/sessions/"), "route {session_id} sẽ nuốt mất đường này"
    r = client.get(DUONG)
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == KHOA_GOC
    assert body["env"] == "all"
    assert [d["ma"] for d in body["dem_theo_nhan"]] == list(tong_quan.THU_TU_NHAN)
    assert tong_quan.THU_TU_NHAN == ("THAT", "THU_NOI_BO", "DAN_DUNG", "MO_PHONG", "QUAN_SAT")
    assert all(d["so_phien"] == 0 for d in body["dem_theo_nhan"])
    assert body["phien_dang_live"] == []
    assert body["rung"] == []
    assert [g["env"] for g in body["gop"]] == ["real", "demo"]


def test_env_sai_bi_tu_choi(client):
    assert client.get(DUONG, params={"env": "tat_ca"}).status_code == 422


def test_nhan_va_chu_ket_luan_khop_canon_yaml():
    canon = yaml.safe_load(_YAML_CANON.read_text(encoding="utf-8"))
    tu_yaml = {n["id"]: n["hien_thi"] for n in canon["nhan_nguon"]}
    assert {ma: tu_yaml[ma] for ma in tong_quan.THU_TU_NHAN} == tong_quan.NHAN_NGUON
    assert {k["id"]: k["chu"] for k in canon["ket_luan"]} == tong_quan.CHU_KET_LUAN


@pytest.mark.parametrize(
    ("platform", "is_demo", "dry_run", "ma"),
    [
        ("youtube", False, False, "THAT"),
        ("facebook", False, False, "THAT"),
        ("youtube", False, True, "THU_NOI_BO"),
        ("lab", False, False, "DAN_DUNG"),
        ("lab", False, True, "THU_NOI_BO"),
        ("lab", True, False, "DAN_DUNG"),
        ("sim", True, False, "MO_PHONG"),
        ("sim", False, False, "MO_PHONG"),
        ("replay", True, False, "MO_PHONG"),
        ("youtube", True, False, "MO_PHONG"),
        # Phân tích video có thật (phát lại YouTube): QUAN SÁT, không phải MÔ PHỎNG.
        ("replay", False, False, "QUAN_SAT"),
        ("replay", False, True, "QUAN_SAT"),
    ],
)
def test_ma_nhan_cung_luat_voi_giao_dien(platform, is_demo, dry_run, ma):
    """Cùng bảng với sourceLabel (desk.ts) + maNhanPhien (PhienList.tsx), thêm nhánh
    QUAN SÁT mà giao diện phải thêm: ``platform === "replay" && !is_demo``."""
    s = {"platform": platform, "is_demo": is_demo, "dry_run": dry_run}
    assert tong_quan.ma_nhan_phien(s) == ma


def test_ma_nhan_quan_sat_theo_co_analysis_only():
    s = {"platform": "replay", "is_demo": False, "design": {"analysis_only": True}}
    assert tong_quan.ma_nhan_phien(s) == "QUAN_SAT"
    # Dữ liệu mẫu phát lại (máy sinh) vẫn là MÔ PHỎNG, dù có cờ phân tích.
    assert tong_quan.ma_nhan_phien({**s, "is_demo": True}) == "MO_PHONG"


# ---------------------------------------------------------------------------
# (1) Đếm theo nhãn: tách riêng, không cộng gộp
# ---------------------------------------------------------------------------


def test_dem_tach_rieng_tung_nhan_khong_co_tong_cong(client, store):
    _phien_tran(store, platform="youtube", status="ended")
    _phien_tran(store, platform="youtube", status="planned")
    _phien_tran(store, platform="facebook", status="cancelled")
    _phien_tran(store, platform="youtube", status="ended", dry_run=True)
    _phien_tran(store, platform="lab", status="live", dry_run=True)
    _phien_tran(store, platform="lab", status="ended")
    _phien_tran(store, platform="sim", status="ended", is_demo=True)
    _phien_tran(store, platform="sim", status="ended", is_demo=True)
    _phien_tran(store, platform="replay", status="live", is_demo=True)

    body = client.get(DUONG).json()
    dem = _dem(body)
    assert dem["THAT"] == {
        "ma": "THAT",
        "hien_thi": "THẬT",
        "so_phien": 3,
        "dang_live": 0,
        "da_xong": 1,
        "chua_phat": 1,
        "da_huy": 1,
    }
    assert (dem["THU_NOI_BO"]["so_phien"], dem["THU_NOI_BO"]["dang_live"]) == (2, 1)
    assert (dem["DAN_DUNG"]["so_phien"], dem["DAN_DUNG"]["da_xong"]) == (1, 1)
    assert (dem["MO_PHONG"]["so_phien"], dem["MO_PHONG"]["dang_live"]) == (3, 1)
    assert dem["QUAN_SAT"]["so_phien"] == 0

    # Không trường nào cộng qua các nhãn: gốc và từng ô chỉ có đúng các khoá đã hẹn.
    assert set(body) == KHOA_GOC
    for d in body["dem_theo_nhan"]:
        assert set(d) == KHOA_DEM
    for cam in ("tong", "total", "tong_cong", "tong_so_phien", "n_sessions"):
        assert cam not in body


def test_that_bang_0_khi_kho_chi_co_du_lieu_mau(client):
    r = client.post("/demo/seed", json={"n_sessions": 2, "duration_min": 40})
    assert r.status_code == 200, r.text

    for env in ("all", "demo"):
        dem = _dem(client.get(DUONG, params={"env": env}).json())
        assert dem["THAT"]["so_phien"] == 0, env
        assert dem["THU_NOI_BO"]["so_phien"] == 0, env
        assert dem["DAN_DUNG"]["so_phien"] == 0, env
        assert dem["MO_PHONG"]["so_phien"] == 3, env  # 2 phiên xong + 1 phiên đang phát
        assert dem["MO_PHONG"]["dang_live"] == 1, env
        assert dem["QUAN_SAT"]["so_phien"] == 0, env

    that = client.get(DUONG, params={"env": "real"}).json()
    assert all(d["so_phien"] == 0 for d in that["dem_theo_nhan"])
    assert that["rung"] == []
    assert that["phien_dang_live"] == []
    (gop,) = that["gop"]
    assert gop["env"] == "real"
    assert (gop["ma_nhan"], gop["nhan"]) == ("THAT", "THẬT")
    assert gop["nhan_trong_gop"] == {}
    assert gop["trang_thai"] == "chua_uoc_luong"
    assert gop["trang_thai_hien_thi"] == "Chưa có phiên"
    assert gop["ket_luan"] is None, "0 phiên thật thì không có kết luận nào, kể cả ĐO THÊM"
    assert gop["n_sessions"] == 0
    assert gop["estimate"] is None
    assert gop["ly_do"] == "Chưa có phiên THẬT nào đã xong trong mẫu gộp."


# ---------------------------------------------------------------------------
# env lọc đúng
# ---------------------------------------------------------------------------


def test_env_loc_dung_ranh_gioi_du_lieu_mau(client, store):
    demo_xong = _gieo(store, seed=1001, ago_min=400)
    demo_live = _gieo(store, platform="replay", seed=1002, ago_min=12, leave_live=True)
    that_xong = _gieo(store, platform="youtube", is_demo=False, seed=1003, ago_min=300)
    phong_live = _phien_tran(store, platform="lab", status="live")

    def ids(body):
        return (
            {h["session_id"] for h in body["rung"]},
            {p["session_id"] for p in body["phien_dang_live"]},
        )

    tat_ca = client.get(DUONG, params={"env": "all"}).json()
    that = client.get(DUONG, params={"env": "real"}).json()
    mau = client.get(DUONG, params={"env": "demo"}).json()

    assert ids(tat_ca) == ({demo_xong, that_xong}, {demo_live, phong_live})
    assert ids(that) == ({that_xong}, {phong_live})
    assert ids(mau) == ({demo_xong}, {demo_live})

    assert _dem(that)["MO_PHONG"]["so_phien"] == 0
    assert (_dem(that)["THAT"]["so_phien"], _dem(that)["DAN_DUNG"]["so_phien"]) == (1, 1)
    assert _dem(mau)["THAT"]["so_phien"] == 0
    assert _dem(mau)["MO_PHONG"]["so_phien"] == 2

    assert [g["env"] for g in tat_ca["gop"]] == ["real", "demo"]
    assert [g["env"] for g in that["gop"]] == ["real"]
    assert [g["env"] for g in mau["gop"]] == ["demo"]
    assert that["gop"][0]["nhan_trong_gop"] == {"THAT": 1}
    assert mau["gop"][0]["nhan_trong_gop"] == {"MO_PHONG": 1}

    # Kho mẫu có 1 phiên xong: ĐO THÊM, lý do của máy chủ đã làm sạch ký hiệu.
    g = mau["gop"][0]
    assert (g["trang_thai"], g["ket_luan"]) == ("chua_uoc_luong", "DO_THEM")
    assert g["ly_do"]
    for cam in ("\u2265", "\u2264", "l\u0169y", "\u2014"):
        assert cam not in g["ly_do"], (cam, g["ly_do"])


# ---------------------------------------------------------------------------
# (3)(4) Khoá §7: phiên khoá không có số
# ---------------------------------------------------------------------------


def test_phien_khoa_chi_co_trang_thai_khong_co_so(client, store, monkeypatch):
    that = _gieo(store, platform="youtube", is_demo=False, seed=2001, ago_min=500)
    that2 = _gieo(store, platform="youtube", is_demo=False, seed=2002, ago_min=300)
    mau = _gieo(store, seed=2003, ago_min=200)
    _khoa_toi(monkeypatch, "2099-01-01")

    body = client.get(DUONG).json()
    hang = {h["session_id"]: h for h in body["rung"]}
    for sid in (that, that2):
        h = hang[sid]
        assert h["trang_thai"] == "dang_khoa"
        assert h["trang_thai_hien_thi"] == "Đang khoá"
        assert h["ket_luan"] is None
        assert all(h[k] is None for k in TRUONG_SO)
        assert _cac_so(h) == [], f"hàng khoá lộ số: {_cac_so(h)}"
        # Cùng trạng thái với báo cáo sau phiên của chính phiên đó.
        kq = client.get(f"/sessions/{sid}/bao-cao").json()["ket_qua_thi_nghiem"]
        assert kq["khoa"] is True

    # Phiên MÔ PHỎNG được miễn khoá (như /bao-cao và bản gộp demo).
    assert hang[mau]["trang_thai"] in ("co_uoc_luong", "chua_uoc_luong")
    assert hang[mau]["n_blocks"] is not None

    gop = {g["env"]: g for g in body["gop"]}
    assert gop["real"]["trang_thai"] == "dang_khoa"
    assert gop["real"]["nhan_trong_gop"] == {"THAT": 2}
    assert _cac_so({k: v for k, v in gop["real"].items() if k != "nhan_trong_gop"}) == []
    assert gop["demo"]["trang_thai"] != "dang_khoa"
    assert gop["demo"]["n_sessions"] == 1


def test_khoa_bat_ma_0_phien_that_thi_ghi_chua_co_phien(client, monkeypatch):
    """Không có gì để khoá thì không ghi "Đang khoá": câu đó ngầm báo có kết quả thật bị giấu."""
    assert client.post("/demo/seed", json={"n_sessions": 2, "duration_min": 40}).status_code == 200
    _khoa_toi(monkeypatch, "2099-01-01")

    for env in ("all", "real"):
        body = client.get(DUONG, params={"env": env}).json()
        that = next(g for g in body["gop"] if g["env"] == "real")
        assert _dem(body)["THAT"]["so_phien"] == 0
        assert that["ma_nhan"] == "THAT"
        assert that["trang_thai"] == "chua_uoc_luong", env
        assert that["trang_thai_hien_thi"] == "Chưa có phiên", env
        assert that["ket_luan"] is None
        assert that["nhan_trong_gop"] == {}
        assert that["n_sessions"] == 0
        assert all(that[k] is None for k in ("estimate", "ci_low", "ci_high", "p_value"))
        # Cùng câu trả lời với bản gộp gốc: 0 phiên trong mẫu thật.
        assert client.get("/experiment/summary", params={"env": "real"}).json()["n_sessions"] == 0


def test_gop_co_phien_nhung_chua_co_khoi_la_do_them_khong_phai_chua_co_phien(client, store):
    """ "Chưa có phiên" xét theo mẫu gộp, không theo số phiên có khối đo được."""
    _phien_tran(store, platform="youtube", status="ended")  # xong nhưng không có lịch
    (gop,) = client.get(DUONG, params={"env": "real"}).json()["gop"]
    assert gop["nhan_trong_gop"] == {"THAT": 1}
    assert gop["n_sessions"] == 0
    assert (gop["trang_thai"], gop["ket_luan"]) == ("chua_uoc_luong", "DO_THEM")
    assert gop["trang_thai_hien_thi"] == "ĐO THÊM"


# ---------------------------------------------------------------------------
# (3)(4) Kết luận đọc lại, không tính lại
# ---------------------------------------------------------------------------


def test_ket_luan_doc_lai_tu_bao_cao_va_ban_gop(client, store):
    seed_demo_vang(store)
    body = client.get(DUONG, params={"env": "demo"}).json()
    assert len(body["rung"]) == 6

    for h in body["rung"]:
        kq = client.get(f"/sessions/{h['session_id']}/bao-cao").json()["ket_qua_thi_nghiem"]
        assert kq["khoa"] is False
        ten = h["tieu_de"]
        if "CHƯA ĐỦ KHỐI" in ten:
            assert h["trang_thai"] == "chua_uoc_luong"
            assert h["ket_luan"] == "DO_THEM"
            assert h["estimate"] is None
            assert h["ci_low"] is None
            assert h["n_blocks"] == kq["n_blocks"]
            assert h["ly_do"]
            continue
        assert h["trang_thai"] == "co_uoc_luong"
        for k in ("estimate", "ci_low", "ci_high", "p_value", "n_draws", "n_blocks"):
            assert h[k] == kq[k], (ten, k)
        if "ĐỔI" in ten:
            assert (h["ket_luan"], h["trang_thai_hien_thi"]) == ("DOI", "ĐỔI")
        else:
            assert (h["ket_luan"], h["trang_thai_hien_thi"]) == ("DO_THEM", "ĐO THÊM")

    (gop,) = body["gop"]
    tom = client.get("/experiment/summary", params={"env": "demo"}).json()
    assert gop["nhan"] == "MÔ PHỎNG"
    assert gop["n_sessions"] == tom["n_sessions"]
    for k in ("estimate", "ci_low", "ci_high", "p_value", "n_blocks"):
        assert gop[k] == tom[k], k

    for chu in _cac_chu(body):
        assert "\u2014" not in chu, f"chữ công khai có dấu gạch dài: {chu!r}"


def test_cau_may_chu_bo_dau_gach_dai():
    gach = chr(0x2014)
    assert tong_quan._lam_sach(f"Khoá{gach}chỉ số vận hành") == "Khoá, chỉ số vận hành"
    assert tong_quan._lam_sach(f"a {gach} b {gach} c") == "a, b, c"
    assert tong_quan._lam_sach(None) is None


def test_cau_may_chu_doi_ky_hieu_sang_loi_thuong():
    cau = (
        "Chưa đủ dữ liệu cho phân tích gộp (cần \u2265 2 phiên đã kết thúc và "
        "\u22658 khối). Kết quả sẽ xuất hiện khi chuỗi thí nghiệm tích l\u0169y thêm."
    )
    assert tong_quan._lam_sach(cau) == (
        "Chưa đủ dữ liệu cho phân tích gộp (cần từ 2 phiên đã kết thúc và "
        "từ 8 khối). Kết quả sẽ xuất hiện khi chuỗi thí nghiệm tích lu\u1ef9 thêm."
    )


def test_mot_phien_hong_khong_lam_sap_ca_bang(client, store, monkeypatch):
    tot = _gieo(store, seed=3001, ago_min=300)
    hong = _gieo(store, seed=3002, ago_min=200)
    goc = reports._bao_cao_ket_qua

    def gia(session, st, cov=None):
        if session["session_id"] == hong:
            raise RuntimeError("hỏng giả")
        return goc(session, st, cov)

    monkeypatch.setattr(reports, "_bao_cao_ket_qua", gia)
    r = client.get(DUONG)
    assert r.status_code == 200, r.text
    hang = {h["session_id"]: h for h in r.json()["rung"]}
    assert hang[hong]["trang_thai"] == "khong_doc_duoc"
    assert _cac_so(hang[hong]) == []
    assert hang[tot]["trang_thai"] in ("co_uoc_luong", "chua_uoc_luong")


def test_rung_co_tran_va_noi_so_phien_bo_bot(client, store, monkeypatch):
    for _ in range(3):
        _phien_tran(store, platform="youtube", status="ended")
    monkeypatch.setattr(tong_quan, "TRAN_HANG_RUNG", 2)
    body = client.get(DUONG).json()
    assert len(body["rung"]) == 2
    assert body["rung_bo_bot"] == 1
    assert {h["trang_thai"] for h in body["rung"]} == {"quan_sat"}


# ---------------------------------------------------------------------------
# (2) Phiên đang live: không ước lượng
# ---------------------------------------------------------------------------


def test_phien_dang_live_khong_kem_uoc_luong(client, store):
    sid = _gieo(store, platform="youtube", is_demo=False, seed=4001, ago_min=12, leave_live=True)
    mau = _gieo(store, platform="replay", seed=4002, ago_min=12, leave_live=True)

    body = client.get(DUONG).json()
    live = {p["session_id"]: p for p in body["phien_dang_live"]}
    assert set(live) == {sid, mau}
    for p in live.values():
        assert set(p) == KHOA_LIVE, "phiên đang live không được mang trường ước lượng"
    assert live[sid]["nhan"] == {"ma": "THAT", "hien_thi": "THẬT"}
    assert live[mau]["nhan"] == {"ma": "MO_PHONG", "hien_thi": "MÔ PHỎNG"}

    session = store.get_session(sid)
    da_qua = service.elapsed_seconds(session, service.now_utc())
    khoi = [b for b in store.get_blocks(sid) if not b.get("is_washout")]
    assert live[sid]["so_khoi_ke_hoach"] == len(khoi)
    assert live[sid]["so_khoi_da_chay"] == sum(1 for b in khoi if b["end_offset_s"] <= da_qua)
    assert 0 < live[sid]["so_khoi_da_chay"] < live[sid]["so_khoi_ke_hoach"]

    assert not {h["session_id"] for h in body["rung"]} & {sid, mau}


# ---------------------------------------------------------------------------
# (5) Nguồn dữ liệu
# ---------------------------------------------------------------------------


def test_nguon_du_lieu_dung_cau_ke_hoach(client):
    nguon = client.get(DUONG).json()["nguon_du_lieu"]
    assert nguon["cau"] == (
        "TikTok LIVE không có API bình luận cho bên ngoài; TikTok Shop có số liệu theo "
        "phút, bộ nối chưa chạy với khoá thật"
    )
    theo_ma = {n["platform"]: n for n in nguon["nen_tang"]}
    assert theo_ma["tiktok"]["san_sang"] is False
    assert theo_ma["tiktok"]["che_do"] == "khong_ho_tro"
    for n in nguon["nen_tang"]:
        assert set(n) == {"platform", "ten", "san_sang", "che_do"}, "không trả tên biến khoá"


# ---------------------------------------------------------------------------
# Mức bảo vệ: đường đọc mở như mọi GET khác
# ---------------------------------------------------------------------------


def test_duong_doc_mo_khi_bat_token_ghi(store, monkeypatch):
    monkeypatch.setenv("INGEST_TOKEN", "token-test-tong-quan")
    get_settings.cache_clear()
    with TestClient(_dung_app(store)) as c:
        assert c.get(DUONG).status_code == 200
        assert c.post(DUONG).status_code == 405


# ---------------------------------------------------------------------------
# QUAN SÁT: phân tích video có thật không phải MÔ PHỎNG
# ---------------------------------------------------------------------------


def test_phien_phan_tich_video_la_quan_sat_khong_vao_mo_phong_khong_vao_gop(client, store):
    qs = _phien_phan_tich_video(store)
    mau = _gieo(store, seed=7001, ago_min=300)

    for env in ("all", "real"):
        body = client.get(DUONG, params={"env": env}).json()
        dem = _dem(body)
        assert dem["QUAN_SAT"] == {
            "ma": "QUAN_SAT",
            "hien_thi": "QUAN SÁT",
            "so_phien": 1,
            "dang_live": 0,
            "da_xong": 1,
            "chua_phat": 0,
            "da_huy": 0,
        }, env
        assert dem["MO_PHONG"]["so_phien"] == (1 if env == "all" else 0), env
        hang = {h["session_id"]: h for h in body["rung"]}
        assert hang[qs]["nhan"] == {"ma": "QUAN_SAT", "hien_thi": "QUAN SÁT"}
        assert hang[qs]["trang_thai"] == "quan_sat"
        assert _cac_so(hang[qs]) == []
        # Không vào kết quả gộp nào: không hàng gộp QUAN SÁT, không đếm trong mẫu.
        for g in body["gop"]:
            assert g["ma_nhan"] != "QUAN_SAT"
            assert "QUAN_SAT" not in g["nhan_trong_gop"]
        that = next(g for g in body["gop"] if g["env"] == "real")
        assert that["trang_thai_hien_thi"] == "Chưa có phiên"

    mau_body = client.get(DUONG, params={"env": "demo"}).json()
    assert _dem(mau_body)["QUAN_SAT"]["so_phien"] == 0
    assert {h["session_id"] for h in mau_body["rung"]} == {mau}


# ---------------------------------------------------------------------------
# Hình thoi gộp: một hàng, một nhãn
# ---------------------------------------------------------------------------


def _kho_nhieu_nhan(store) -> dict[str, list[str]]:
    """Kho thật có THẬT và DÀN DỰNG (phòng xem không chạy thử); kho mẫu có MÔ PHỎNG và
    phòng xem do khách tạo (DÀN DỰNG, is_demo)."""
    return {
        "that": [
            _gieo(
                store, platform="youtube", is_demo=False, seed=6001, ago_min=900, duration_min=90
            ),
            _gieo(
                store, platform="youtube", is_demo=False, seed=6002, ago_min=800, duration_min=90
            ),
        ],
        "phong": [
            _gieo(store, platform="lab", is_demo=False, seed=6003, ago_min=700, duration_min=90),
            _gieo(store, platform="lab", is_demo=False, seed=6004, ago_min=600, duration_min=90),
        ],
        "mau": [
            _gieo(store, seed=6005, ago_min=500, duration_min=90),
            _gieo(store, seed=6006, ago_min=400, duration_min=90),
        ],
        "khach": [_gieo(store, platform="lab", is_demo=True, seed=6007, ago_min=300)],
    }


def test_hinh_thoi_gop_khong_tron_nhan(client, store):
    _kho_nhieu_nhan(store)
    body = client.get(DUONG).json()
    assert [(g["env"], g["ma_nhan"]) for g in body["gop"]] == [
        ("real", "THAT"),
        ("real", "DAN_DUNG"),
        ("demo", "MO_PHONG"),
        ("demo", "DAN_DUNG"),
    ]
    for g in body["gop"]:
        assert "·" not in g["nhan"], "một hình thoi chỉ mang một nhãn"
        assert g["nhan"] == tong_quan.NHAN_NGUON[g["ma_nhan"]]
        assert list(g["nhan_trong_gop"]) == [g["ma_nhan"]]
    gop = {(g["env"], g["ma_nhan"]): g for g in body["gop"]}
    assert gop[("real", "THAT")]["n_sessions"] == 2
    assert gop[("real", "DAN_DUNG")]["n_sessions"] == 2
    assert gop[("demo", "MO_PHONG")]["n_sessions"] == 2
    assert gop[("demo", "DAN_DUNG")]["nhan_trong_gop"] == {"DAN_DUNG": 1}
    for k in (("real", "THAT"), ("real", "DAN_DUNG"), ("demo", "MO_PHONG")):
        assert gop[k]["trang_thai"] == "co_uoc_luong", k

    # Bản gộp gốc §8.2 của kho thật trộn hai nhãn (4 phiên); hàng THẬT chỉ có 2.
    tron = client.get("/experiment/summary", params={"env": "real"}).json()
    assert tron["n_sessions"] == 4

    # Hàng THẬT trùng bản gộp của một kho CHỈ có hai phiên THẬT ấy (cùng hạt giống).
    rieng = InMemoryStore()
    for p in DEMO_PRODUCTS:
        rieng.create_product({**p, "created_at": service.now_utc()})
    _gieo(rieng, platform="youtube", is_demo=False, seed=6001, ago_min=900, duration_min=90)
    _gieo(rieng, platform="youtube", is_demo=False, seed=6002, ago_min=800, duration_min=90)
    s = reports.experiment_summary(rieng, env="real")
    that = gop[("real", "THAT")]
    assert (that["n_blocks"], that["n_on"], that["n_off"]) == (s.n_blocks, s.n_on, s.n_off)
    assert that["estimate"] == pytest.approx(s.estimate)


def test_hinh_thoi_gop_nhieu_nhan_khi_khoa(client, store, monkeypatch):
    _kho_nhieu_nhan(store)
    _khoa_toi(monkeypatch, "2099-01-01")
    body = client.get(DUONG).json()
    gop = {(g["env"], g["ma_nhan"]): g for g in body["gop"]}
    for k in (("real", "THAT"), ("real", "DAN_DUNG")):
        assert gop[k]["trang_thai"] == "dang_khoa", k
        assert _cac_so({x: v for x, v in gop[k].items() if x != "nhan_trong_gop"}) == []
    # Kho mẫu được miễn khoá, như /experiment/summary?env=demo và /bao-cao của phiên mẫu.
    assert gop[("demo", "MO_PHONG")]["trang_thai"] == "co_uoc_luong"


# ---------------------------------------------------------------------------
# Bộ nhớ đệm
# ---------------------------------------------------------------------------


def _dem_lan_tinh(monkeypatch, cho_s: float = 0.0) -> dict[str, int]:
    """Đếm số lần tổng quan gọi đường báo cáo một phiên và đường gộp."""
    dem = {"phien": 0, "gop": 0}
    goc_phien = reports._bao_cao_ket_qua
    goc_gop = reports.experiment_summary

    def phien(session, st, cov=None):
        dem["phien"] += 1
        if cho_s:
            time.sleep(cho_s)
        return goc_phien(session, st, cov)

    def gop(st, env="real"):
        dem["gop"] += 1
        return goc_gop(st, env=env)

    monkeypatch.setattr(reports, "_bao_cao_ket_qua", phien)
    monkeypatch.setattr(reports, "experiment_summary", gop)
    return dem


def test_bo_dem_khong_tinh_lai_trong_han(client, store, monkeypatch):
    _gieo(store, seed=8001, ago_min=400)
    _gieo(store, seed=8002, ago_min=300)
    dem = _dem_lan_tinh(monkeypatch)
    dau = client.get(DUONG).json()
    sau_lan_1 = dict(dem)
    assert sau_lan_1 == {"phien": 2, "gop": 1}  # kho thật 0 phiên: không cần gọi gộp
    for _ in range(3):
        lai = client.get(DUONG).json()
    assert dem == sau_lan_1, "trong hạn không được tính lại"
    assert lai["tinh_luc"] == dau["tinh_luc"]
    assert lai["rung"] == dau["rung"]
    assert lai["gop"] == dau["gop"]


def test_bo_dem_tinh_lai_ngay_khi_dau_phien_doi(client, store, monkeypatch):
    sid = _gieo(store, seed=8101, ago_min=400)
    dem = _dem_lan_tinh(monkeypatch)
    client.get(DUONG)
    assert dem["phien"] == 1

    store.update_session(sid, {"title": "đổi tên phiên"})
    body = client.get(DUONG).json()
    assert dem["phien"] == 2
    assert body["rung"][0]["tieu_de"] == "đổi tên phiên"

    moi = _gieo(store, seed=8102, ago_min=200)
    body = client.get(DUONG).json()
    assert moi in {h["session_id"] for h in body["rung"]}


def test_bo_dem_bat_khoa_thi_khoa_ngay(client, store, monkeypatch):
    """Bật khoá §7 trong hạn đệm: hàng thật phải khoá NGAY, không đợi đệm hết hạn."""
    sid = _gieo(store, platform="youtube", is_demo=False, seed=8201, ago_min=400)
    _gieo(store, platform="youtube", is_demo=False, seed=8202, ago_min=300)
    truoc = client.get(DUONG).json()
    hang = {h["session_id"]: h for h in truoc["rung"]}
    assert hang[sid]["trang_thai"] != "dang_khoa"
    assert truoc["gop"][0]["trang_thai"] != "dang_khoa"

    _khoa_toi(monkeypatch, "2099-01-01")
    sau = client.get(DUONG).json()
    hang = {h["session_id"]: h for h in sau["rung"]}
    assert hang[sid]["trang_thai"] == "dang_khoa"
    assert sau["gop"][0]["trang_thai"] == "dang_khoa"
    assert _cac_so(hang[sid]) == []


def test_bo_dem_het_han_thi_tinh_lai(client, store, monkeypatch):
    _gieo(store, seed=8301, ago_min=400)
    dem = _dem_lan_tinh(monkeypatch)
    monkeypatch.setattr(tong_quan, "HAN_BO_DEM_S", 0.0)
    client.get(DUONG)
    client.get(DUONG)
    assert dem["phien"] == 2


def test_bo_dem_hai_lan_goi_cung_luc_chi_tinh_mot_lan(store, monkeypatch):
    _gieo(store, seed=8401, ago_min=400)
    dem = _dem_lan_tinh(monkeypatch, cho_s=0.3)
    rao = threading.Barrier(2)
    ket_qua: list[Any] = []

    def goi():
        rao.wait()
        ket_qua.append(tong_quan.tong_quan_thong_ke(store=store, env="all"))

    luong = [threading.Thread(target=goi) for _ in range(2)]
    for t in luong:
        t.start()
    for t in luong:
        t.join(timeout=30)
    assert len(ket_qua) == 2
    assert dem["phien"] == 1, "lần gọi thứ hai phải chờ rồi dùng lại kết quả"
    assert ket_qua[0].tinh_luc == ket_qua[1].tinh_luc

"""``scripts/chay_demo_next.py``: bảng ĐẠT/KHÔNG trước buổi demo, thoát 1 khi có KHÔNG.

Lõi là API thật (``create_app`` + kho bộ nhớ, đã gieo bằng ``gieo_demo_db.py``). Next
được giả bằng ``httpx.MockTransport``: trang trả 200 (hoặc mã do test chọn), còn
``/api/ll/...`` và ``/xem-api/...`` chuyển thẳng vào lõi như proxy và rewrite thật.
Các luật được giữ:

1. hệ thống lành: mọi dòng ĐẠT ở cả N lần, mã thoát 0;
2. một trang Next lỗi, lõi chết, thiếu mã phòng, phòng không ``dry_run``, hay kho RAM
   khi đòi kho bền: có dòng KHÔNG, mã thoát 1, không văng ngoại lệ;
3. trang 200 mà dữ liệu sau nó hỏng (mã phòng sai) vẫn là KHÔNG.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from livelift.api.main import create_app
from livelift.api.store import InMemoryStore
from livelift.config import get_settings

GOC = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:8000"


def _nap(ten: str):
    spec = importlib.util.spec_from_file_location(ten, GOC / "scripts" / f"{ten}.py")
    assert spec is not None
    assert spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def cd():
    try:
        yield _nap("chay_demo_next")
    finally:
        sys.modules.pop("chay_demo_next", None)


@pytest.fixture(scope="module")
def he_thong(tmp_path_factory):
    """Lõi đã gieo đủ bộ demo (phòng đang phát) + tệp trạng thái của gieo_demo_db."""
    gd = _nap("gieo_demo_db")
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("LIVELIFT_AUTOPILOT", "0")
        mp.delenv("INGEST_TOKEN", raising=False)
        mp.setattr(gd, "_tim_ham_tai_khoan", lambda: None)
        get_settings.cache_clear()
        store = InMemoryStore()
        tep = tmp_path_factory.mktemp("trang-thai") / "gieo-demo.json"
        with TestClient(create_app(store=store)) as client:
            _, data = gd.gieo(
                client, nguon=f"api:{API}", tep_trang_thai=tep, video=None, bat_dau=True
            )
            gd.ghi_trang_thai(tep, data)
            yield client, store, tep, data
        get_settings.cache_clear()
    sys.modules.pop("gieo_demo_db", None)


def _chuyen(client: TestClient) -> Callable[[httpx.Request], httpx.Response]:
    def gui(req: httpx.Request, path: str) -> httpx.Response:
        r = client.request(req.method, path, content=req.content)
        return httpx.Response(
            r.status_code,
            content=r.content,
            headers={"content-type": r.headers.get("content-type", "")},
        )

    return gui


def _api_transport(client: TestClient) -> httpx.MockTransport:
    gui = _chuyen(client)
    return httpx.MockTransport(lambda req: gui(req, req.url.raw_path.decode()))


def _next_transport(
    client: TestClient, ma_trang: dict[str, int] | None = None, *, bo_co_phong: bool = False
) -> httpx.MockTransport:
    """``bo_co_phong``: giả lõi cũ, ``room`` của trang-thai chưa có khoá ``dry_run``."""
    gui = _chuyen(client)
    ma_trang = ma_trang or {}

    def handler(req: httpx.Request) -> httpx.Response:
        path = req.url.raw_path.decode()
        if path.startswith("/api/ll/"):
            return gui(req, path[len("/api/ll") :])
        if path.startswith("/xem-api/"):
            r = gui(req, path)
            if bo_co_phong and r.status_code == 200 and path.endswith("/trang-thai"):
                tt = json.loads(r.content)
                tt["room"].pop("dry_run", None)
                return httpx.Response(200, json=tt)
            return r
        # Next dựng trang ở trình duyệt: mã sai vẫn 200, đúng như máy chủ dev thật
        return httpx.Response(ma_trang.get(path.split("?")[0], 200), text="<html lang=vi></html>")

    return httpx.MockTransport(handler)


def _chay(cd, he, argv: list[str] | None = None, **kw) -> int:
    client, _, tep, _ = he
    return cd.main(
        ["--tep-trang-thai", str(tep), "--nghi-s", "0", *(argv or [])],
        api_transport=kw.get("api_transport") or _api_transport(client),
        next_transport=kw.get("next_transport") or _next_transport(client, kw.get("ma_trang")),
    )


def test_he_thong_lanh_dat_ca_ba_lan(cd, he_thong, capsys):
    assert _chay(cd, he_thong, ["--lan", "3"]) == 0
    out = capsys.readouterr().out
    assert "TỔNG: 3/3 lần ĐẠT" in out
    assert "KHÔNG" not in out.replace("KHÔNG dry_run", "")
    assert "RAM: store_backend=memory" in out
    assert "phòng=dang_mo" in out
    assert "tất cả dry_run" not in out  # biết đúng phiên của phòng từ tệp trạng thái
    assert "dry_run=True" in out


def test_trang_next_loi_thi_khong_va_thoat_1(cd, he_thong, capsys):
    assert _chay(cd, he_thong, ma_trang={"/gioi-thieu": 500}) == 1
    out = capsys.readouterr().out
    assert "Next /gioi-thieu" in out
    assert "/gioi-thieu HTTP 500" in out


def test_ma_phong_sai_trang_van_200_nhung_khong(cd, he_thong, capsys):
    assert _chay(cd, he_thong, ["--ma-phong", "khongco1"]) == 1
    out = capsys.readouterr().out
    assert "/xem/khongco1 HTTP 200" in out
    assert "/xem-api/…/trang-thai HTTP 404" in out


def test_loi_chet_khong_vang_ngoai_le(cd, he_thong, capsys):
    def chet(_req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("từ chối kết nối")

    assert _chay(cd, he_thong, api_transport=httpx.MockTransport(chet)) == 1
    out = capsys.readouterr().out
    assert "không gọi được" in out


def test_kho_ram_la_khong_khi_doi_kho_ben(cd, he_thong, capsys):
    assert _chay(cd, he_thong, ["--can-ben"]) == 1
    assert "cần kho bền" in capsys.readouterr().out


def test_thieu_ma_phong_thi_chi_cach_sua(cd, he_thong, tmp_path, capsys):
    client, store, _, data = he_thong
    rong = tmp_path / "khong-co.json"
    rc = cd.main(
        ["--tep-trang-thai", str(rong)],
        api_transport=_api_transport(client),
        next_transport=_next_transport(client),
    )
    assert rc == 1
    assert "gieo_demo_db.py" in capsys.readouterr().out


def test_tep_trang_thai_cua_api_khac_khong_dung(cd, he_thong, tmp_path, capsys):
    client, _, tep, _ = he_thong
    khac = tmp_path / "khac.json"
    data = json.loads(tep.read_text(encoding="utf-8"))
    data["nguon"] = "api:http://may-khac:8000"
    khac.write_text(json.dumps(data), encoding="utf-8")
    rc = cd.main(
        ["--tep-trang-thai", str(khac)],
        api_transport=_api_transport(client),
        next_transport=_next_transport(client),
    )
    assert rc == 1
    assert "không dùng mã phòng" in capsys.readouterr().out


def test_phong_khong_dry_run_la_khong(cd, he_thong, capsys):
    client, store, _, _ = he_thong
    r = client.post(
        "/sessions",
        json={"platform": "lab", "title": "Phòng thật", "mode": "auto", "planned_duration_min": 90},
    )
    sid = r.json()["session_id"]
    assert r.json()["dry_run"] is False
    assert client.post(f"/sessions/{sid}/schedule", json={}).status_code == 200
    code = client.post(
        f"/sessions/{sid}/phong-xem",
        json={"consent_version": "2026-10-15", "products": ["LAB-1", "LAB-2"]},
    ).json()["code"]
    try:
        # biết phiên: kiểm thẳng
        assert _chay(cd, he_thong, ["--ma-phong", code, "--phien-phong", sid]) == 1
        assert "dry_run=False" in capsys.readouterr().out
        # không biết phiên: cờ room.dry_run mà điện thoại nhận được nói KHÔNG
        assert _chay(cd, he_thong, ["--ma-phong", code]) == 1
        out = capsys.readouterr().out
        assert "room.dry_run=False" in out
        assert "điện thoại thấy phòng KHÔNG dry_run" in out
        # lõi cũ không có cờ phòng: lùi về đoán theo tiêu đề, vẫn KHÔNG
        assert (
            _chay(
                cd,
                he_thong,
                ["--ma-phong", code],
                next_transport=_next_transport(client, bo_co_phong=True),
            )
            == 1
        )
        out = capsys.readouterr().out
        assert "đoán theo tiêu đề" in out
        assert "KHÔNG dry_run" in out
    finally:
        client.post(f"/sessions/{sid}/cancel")


def test_co_phong_dry_run_nhung_phien_khai_bao_sai_van_khong(cd, he_thong, capsys):
    """Hai bằng chứng phải cùng nói dry_run: cờ phòng True mà phiên truyền vào là phiên
    thật thì vẫn KHÔNG (truyền nhầm --phien-phong cũng phải lộ ra)."""
    client, _, _, data = he_thong
    phien_that = next(
        s["session_id"] for s in client.get("/sessions").json() if s.get("dry_run") is not True
    )
    rc = _chay(cd, he_thong, ["--ma-phong", data["phong"]["code"], "--phien-phong", phien_that])
    assert rc == 1
    out = capsys.readouterr().out
    assert "room.dry_run=True" in out
    assert "dry_run=False" in out


def test_lo_cu_khong_co_co_phong_doan_theo_tieu_de_van_dat(cd, he_thong, capsys):
    client, _, _, data = he_thong
    rc = _chay(
        cd,
        he_thong,
        ["--ma-phong", data["phong"]["code"]],
        next_transport=_next_transport(client, bo_co_phong=True),
    )
    assert rc == 0
    assert "đoán theo tiêu đề" in capsys.readouterr().out


def _api_postgres_ben(client: TestClient) -> httpx.MockTransport:
    """Lõi như đang chạy trên PostgreSQL bền: chỉ sửa thân /health, còn lại chuyển thẳng."""
    gui = _chuyen(client)

    def handler(req: httpx.Request) -> httpx.Response:
        path = req.url.raw_path.decode()
        r = gui(req, path)
        if path == "/health":
            h = json.loads(r.content)
            h.update({"store_backend": "postgres", "durable": True})
            return httpx.Response(200, json=h)
        return r

    return httpx.MockTransport(handler)


def test_tep_trang_thai_truc_tiep_dung_khi_loi_tren_postgres(cd, he_thong, tmp_path, capsys):
    """Luồng D3: bat_postgres → gieo_demo_db --truc-tiep → API trên Postgres → kiểm.
    Tệp của --truc-tiep mang nguon='truc-tiep:postgres', không phải 'api:<địa chỉ>'."""
    client, _, tep, data = he_thong
    tt = tmp_path / "truc-tiep.json"
    d = json.loads(tep.read_text(encoding="utf-8"))
    d["nguon"] = "truc-tiep:postgres"
    tt.write_text(json.dumps(d), encoding="utf-8")
    rc = cd.main(
        ["--tep-trang-thai", str(tt), "--can-ben"],
        api_transport=_api_postgres_ben(client),
        next_transport=_next_transport(client),
    )
    out = capsys.readouterr().out
    assert rc == 0, out
    assert f"Mã phòng {data['phong']['code']} lấy từ tệp trạng thái (truc-tiep:postgres)" in out
    assert "room.dry_run=True" in out
    # cùng tệp, lõi chạy RAM: kho khác, không tin mã phòng
    rc = cd.main(
        ["--tep-trang-thai", str(tt)],
        api_transport=_api_transport(client),
        next_transport=_next_transport(client),
    )
    assert rc == 1
    assert "không dùng mã phòng" in capsys.readouterr().out


def test_nguon_khop(cd):
    ben = {"store_backend": "postgres", "durable": True}
    assert cd.nguon_khop("api:http://127.0.0.1:8000", "http://127.0.0.1:8000/", None)
    assert not cd.nguon_khop("api:http://may-khac:8000", "http://127.0.0.1:8000", ben)
    assert cd.nguon_khop("truc-tiep:postgres", "http://127.0.0.1:8000", ben)
    assert not cd.nguon_khop("truc-tiep:postgres", "http://127.0.0.1:8000", None)
    assert not cd.nguon_khop(
        "truc-tiep:postgres", "http://127.0.0.1:8000", {"store_backend": "memory"}
    )
    assert not cd.nguon_khop(
        "truc-tiep:postgres", "http://x", {"store_backend": "postgres", "durable": False}
    )
    assert not cd.nguon_khop("", "http://127.0.0.1:8000", ben)


def test_chon_phien(cd):
    ss = [
        {"session_id": "a", "status": "live", "platform": "lab", "created_at": "3"},
        {
            "session_id": "b",
            "status": "live",
            "platform": "replay",
            "is_demo": True,
            "title": "Phiên đang phát (mô phỏng) · x",
            "created_at": "1",
        },
        {"session_id": "c", "status": "live", "platform": "youtube", "created_at": "2"},
        {"session_id": "d", "status": "ended", "title": "Demo vàng · ĐỔI #2", "created_at": "5"},
        {"session_id": "e", "status": "ended", "title": "Demo vàng · ĐỔI #1", "created_at": "4"},
        {"session_id": "f", "status": "ended", "title": "khác", "created_at": "9"},
    ]
    assert cd.chon_phien_dang_phat(ss)["session_id"] == "b"
    assert cd.chon_phien_dang_phat(ss[:1] + ss[2:3])["session_id"] == "c"
    assert cd.chon_phien_dang_phat(ss[:1])["session_id"] == "a"
    assert cd.chon_phien_dang_phat([]) is None
    assert cd.chon_phien_tong_ket(ss)["session_id"] == "e"
    assert cd.chon_phien_tong_ket(ss[5:])["session_id"] == "f"
    assert cd.chon_phien_tong_ket(ss[:3]) is None

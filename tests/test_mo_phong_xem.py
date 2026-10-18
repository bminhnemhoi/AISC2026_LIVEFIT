"""``scripts/mo_phong_xem.py --thu-noi-bo`` — buổi thử nội bộ 20/10 không được thành số THẬT.

Tối 20/10 nhóm thử phòng xem bằng điện thoại của chính mình. Phiên đó phải được
khai báo ``dry_run`` NGAY LÚC TẠO (cờ bất biến, tiền đăng ký §8.2), nếu không nó
sẽ nằm trong kết quả gộp như một phòng dàn dựng có người ngoài. Test chạy script
thật đối với API thật (``create_app`` + kho bộ nhớ) qua ``TestClient``, chỉ thay
``httpx.Client`` của script, và kiểm ba điều:

1. cờ có thì thân ``POST /sessions`` mang ``dry_run=True``, máy chủ LƯU nó, phiên
   bị loại khỏi mẫu phân tích, tiêu đề mặc định là tiêu đề thử nội bộ;
2. không có cờ thì yêu cầu gửi đi giữ nguyên như trước (không có khoá ``dry_run``);
3. máy chủ bỏ qua ``dry_run`` (API cũ) thì script huỷ phiên và dừng, không mở phòng.
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from livelift.api import service
from livelift.api.main import create_app
from livelift.api.routes.reports import _in_analysis_sample
from livelift.api.store import InMemoryStore
from livelift.config import get_settings

GOC = Path(__file__).resolve().parents[1]
T0 = datetime(2026, 10, 20, 19, 0, tzinfo=UTC)


# Đồng hồ giả và môi trường (autopilot tắt, không token) như test hợp đồng phòng xem,
# khai báo riêng ở đây để test này không phụ thuộc fixture của tệp khác.
@pytest.fixture
def clock(monkeypatch):
    monkeypatch.setattr(service, "now_utc", lambda: T0)
    return T0


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("LIVELIFT_AUTOPILOT", "0")
    monkeypatch.delenv("INGEST_TOKEN", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="module")
def mpx():
    spec = importlib.util.spec_from_file_location(
        "mo_phong_xem", GOC / "scripts" / "mo_phong_xem.py"
    )
    assert spec is not None
    assert spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    try:
        spec.loader.exec_module(mod)
        yield mod
    finally:
        sys.modules.pop(spec.name, None)


class _ClientGhiLai(TestClient):
    """TestClient ghi lại mọi yêu cầu script gửi; ``bo_dry_run`` giả một API cũ bỏ qua trường lạ."""

    def __init__(self, app: Any, ghi: list[tuple[str, str, Any]], bo_dry_run: bool, **kw: Any):
        super().__init__(app, **kw)
        self._ghi = ghi
        self._bo_dry_run = bo_dry_run

    def request(self, method: str, url: Any, **kw: Any) -> Any:  # type: ignore[override]
        than = kw.get("json")
        self._ghi.append((method, str(url), than))
        if self._bo_dry_run and isinstance(than, dict) and "dry_run" in than:
            kw["json"] = {k: v for k, v in than.items() if k != "dry_run"}
        return super().request(method, url, **kw)


@pytest.fixture
def api(env, clock, mpx, monkeypatch):
    """API thật trên kho bộ nhớ. Trả (store, ghi, bo_dry_run).

    Đặt ``bo_dry_run[0] = True`` để giả một API cũ bỏ qua ``dry_run``.
    """
    store = InMemoryStore()
    app = create_app(store=store)
    ghi: list[tuple[str, str, Any]] = []
    bo_dry_run = [False]

    def tao_client(base_url: str, headers: dict[str, str], timeout: float) -> TestClient:
        return _ClientGhiLai(app, ghi, bo_dry_run[0], headers=headers)

    monkeypatch.setattr(mpx, "httpx", SimpleNamespace(Client=tao_client))
    return store, ghi, bo_dry_run


def _than_tao_phien(ghi: list[tuple[str, str, Any]]) -> dict[str, Any]:
    (than,) = [b for m, u, b in ghi if m == "POST" and u == "/sessions"]
    return than


def _phien_duy_nhat(store: InMemoryStore) -> dict[str, Any]:
    (s,) = store.list_sessions()
    return s


def test_thu_noi_bo_gui_va_luu_dry_run(mpx, api, capsys):
    store, ghi, _ = api
    assert mpx.main(["--thu-noi-bo", "--bat-dau"]) == 0

    than = _than_tao_phien(ghi)
    assert than["dry_run"] is True
    assert than["platform"] == "lab"
    assert than["title"] == mpx.TIEU_DE_THU_NOI_BO == "Thử nội bộ · Phòng xem LiveLift"

    s = _phien_duy_nhat(store)
    assert s["dry_run"] is True, "máy chủ phải LƯU cờ, không chỉ nhận"
    assert s["is_demo"] is False, "thử nội bộ là phiên chạy thử, không phải dữ liệu mẫu"
    assert s["title"] == mpx.TIEU_DE_THU_NOI_BO
    assert s["phong_xem"]["title"] == mpx.TIEU_DE_THU_NOI_BO
    assert s["status"] == "live"

    # Giao diện đọc cờ qua GET /sessions/{id} (SessionDetail mang dry_run).
    with TestClient(create_app(store=store)) as c:
        r = c.get(f"/sessions/{s['session_id']}")
        assert r.status_code == 200, r.text
        assert r.json()["dry_run"] is True
        # Kể cả khi đã kết thúc, phiên thử nội bộ không vào mẫu phân tích (§8.2).
        assert c.post(f"/sessions/{s['session_id']}/end").status_code == 200
    assert not _in_analysis_sample(store.get_session(s["session_id"]))

    out = capsys.readouterr().out
    assert "PHIÊN THỬ NỘI BỘ" in out
    assert "Không vào số THẬT" in out
    assert "DÀN DỰNG · THỬ NỘI BỘ" in out


def test_thu_noi_bo_giu_tieu_de_tu_dat(mpx, api):
    store, ghi, _ = api
    assert mpx.main(["--thu-noi-bo", "--tieu-de", "Buổi thử tối 20/10"]) == 0
    assert _than_tao_phien(ghi)["title"] == "Buổi thử tối 20/10"
    s = _phien_duy_nhat(store)
    assert s["dry_run"] is True
    assert s["title"] == "Buổi thử tối 20/10"
    assert s["status"] == "scheduled", "không --bat-dau thì chưa phát"


def test_khong_co_co_thi_giu_nguyen_hanh_vi_cu(mpx, api, capsys):
    store, ghi, _ = api
    assert mpx.main([]) == 0
    than = _than_tao_phien(ghi)
    assert "dry_run" not in than, "không có cờ thì thân yêu cầu giống hệt trước 19/10"
    assert than == {
        "platform": "lab",
        "title": "Phòng xem LiveLift",
        "mode": "auto",
        "planned_duration_min": 180,
    }
    s = _phien_duy_nhat(store)
    assert s["dry_run"] is False
    assert s["phong_xem"]["title"] == "Phòng xem LiveLift"
    assert "THỬ NỘI BỘ" not in capsys.readouterr().out


def test_may_chu_bo_qua_dry_run_thi_huy_phien_va_dung(mpx, api):
    store, ghi, bo_dry_run = api
    bo_dry_run[0] = True  # API cũ: nhận thân yêu cầu nhưng không lưu dry_run
    with pytest.raises(SystemExit) as e:
        mpx.main(["--thu-noi-bo", "--bat-dau"])
    assert "không lưu dry_run" in str(e.value.code)

    s = _phien_duy_nhat(store)
    assert s["dry_run"] is False
    assert s["status"] == "cancelled", "phiên mang nhãn sai phải bị huỷ khi chưa có số nào"
    assert not s.get("phong_xem"), "không được mở phòng trên phiên sẽ bị tính như thật"
    duong = [u for _, u, _ in ghi]
    assert not any(u.endswith("/schedule") or u.endswith("/start") for u in duong)

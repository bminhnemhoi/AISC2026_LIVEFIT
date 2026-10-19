"""Món ghim của một tick là món ghim CỦA MỐC ẤY, không phải món đang ghim lúc ghi.

V2-loi-ghim (19/10/2026): ``_store_tick`` luôn đóng dấu ``pinned_product_id``
bằng món đang ghim lúc ghi. Với tick sống thì đúng; với mọi lần ghi lại một mốc
đã qua thì sai: rút lui ở phòng xem tính lại tick cũ (xem
``tests/test_api_xem.py::test_withdrawal_keeps_the_pin_recorded_in_every_old_bucket``)
và bộ thu gửi bù tick sau khi kho sống lại đều đóng dấu món của MỐC SAU lên mốc
trước. Ở đây khoá ba nhánh của :func:`livelift.api.routes.events.ghim_cua_moc`
bằng một phiên YouTube thường, không qua phòng xem.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from livelift.api import service
from livelift.api.main import create_app
from livelift.api.store import InMemoryStore
from livelift.config import get_settings

T0 = datetime(2026, 10, 19, 20, 0, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = T0

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def phien(monkeypatch):
    """Phiên YouTube đang phát, bắt đầu đúng ``T0``. Trả (client, clock, sid)."""
    monkeypatch.setenv("LIVELIFT_AUTOPILOT", "0")
    monkeypatch.delenv("INGEST_TOKEN", raising=False)
    get_settings.cache_clear()
    clock = Clock()
    monkeypatch.setattr(service, "now_utc", clock)
    with TestClient(create_app(store=InMemoryStore())) as client:
        for pid in ("p-a", "p-b"):
            r = client.post(
                "/products",
                json={"product_id": pid, "name": pid, "cost": 50, "price": 120, "stock": 9},
            )
            assert r.status_code == 200, r.text
        sid = client.post(
            "/sessions", json={"platform": "youtube", "planned_duration_min": 90}
        ).json()["session_id"]
        assert client.post(f"/sessions/{sid}/schedule", json={"seed": 3}).status_code == 200
        assert client.post(f"/sessions/{sid}/start").status_code == 200
        yield client, clock, sid
    get_settings.cache_clear()


def _ghim(client, sid, product_id: str | None) -> None:
    r = client.post(
        f"/sessions/{sid}/actions/override",
        json={"product_id": product_id, "reason": "sự cố kỹ thuật"},
    )
    assert r.status_code == 200, r.text


def _tick(client, sid, giay: float | None = None) -> str | None:
    """Gửi một tick (``giay``: thời điểm sự kiện tính từ T0; None = giờ máy chủ)
    và trả món ghim máy chủ ghi cho mốc ấy."""
    body: dict = {"viewers": 40}
    if giay is not None:
        body["ts_utc"] = (T0 + timedelta(seconds=giay)).isoformat()
    r = client.post(f"/sessions/{sid}/ticks", json=body)
    assert r.status_code == 200, r.text
    return r.json()["pinned_product_id"]


def _ghim_theo_moc(client, sid) -> dict[int, str | None]:
    ticks = client.get(f"/sessions/{sid}/ticks").json()
    return {
        int((datetime.fromisoformat(t["ts_bucket"]) - T0).total_seconds()): t["pinned_product_id"]
        for t in ticks
    }


def test_tick_gui_lai_hay_gui_bu_khong_lay_mon_cua_moc_sau(phien):
    client, clock, sid = phien
    # Mốc 0 (0–30 s): chưa ghim. Mốc 30 bỏ trống (bộ thu mất tick ấy).
    clock.now = T0 + timedelta(seconds=5)
    assert _tick(client, sid) is None
    # Mốc 60: ghim p-a. Mốc 90 bỏ trống. Mốc 120: đổi sang p-b.
    clock.now = T0 + timedelta(seconds=70)
    _ghim(client, sid, "p-a")
    assert _tick(client, sid) == "p-a"
    clock.now = T0 + timedelta(seconds=130)
    _ghim(client, sid, "p-b")
    assert _tick(client, sid) == "p-b"
    truoc = _ghim_theo_moc(client, sid)
    assert truoc == {0: None, 60: "p-a", 120: "p-b"}

    # Gửi lại đúng tick cũ (bộ thu khởi động lại, spool phát lại): giữ món đã lưu.
    assert _tick(client, sid, 5) is None
    assert _tick(client, sid, 72) == "p-a"
    # Gửi bù tick của mốc chưa từng có: món ghim ĐÚNG LÚC sự kiện.
    assert _tick(client, sid, 45) is None
    assert _tick(client, sid, 100) == "p-a"
    assert _ghim_theo_moc(client, sid) == {**truoc, 30: None, 90: "p-a"}


def test_moc_da_co_tick_giu_mon_da_luu_khong_phat_lai_nhat_ky_den_ts(phien):
    """Tách hai nhánh của mốc ĐÃ QUA (G4, 19/10/2026).

    Ca trên không phân biệt được chúng: ở mọi tick gửi lại của ca trên, phát lại
    nhật ký đến ``ts`` cho cùng món với món đã lưu. Ở đây ghim p-a lúc 70 s, tick
    sống 72 s ghi p-a cho mốc 60; khi mốc đã trôi qua, bộ thu gửi lại tick ts 65 s
    (cùng mốc, TRƯỚC lúc ghim). Nhánh "giữ món đã lưu" trả p-a. Bỏ nhánh ấy thì
    nhánh "phát lại nhật ký đến ts" chỉ thấy nhật ký trước 65 s, trả None và viết
    đè None lên mốc đã ghi đúng; hành vi cũ (món đang ghim lúc ghi) trả p-b.
    """
    client, clock, sid = phien
    clock.now = T0 + timedelta(seconds=70)
    _ghim(client, sid, "p-a")
    clock.now = T0 + timedelta(seconds=72)
    assert _tick(client, sid) == "p-a"
    clock.now = T0 + timedelta(seconds=130)
    _ghim(client, sid, "p-b")

    # Mốc 60 đã qua (60 + 30 ≤ 130) và đã có tick: giữ p-a dù 65 s < 70 s.
    assert _tick(client, sid, 65) == "p-a"
    assert _ghim_theo_moc(client, sid) == {60: "p-a"}

    # Đối chứng: mốc 120 chưa có tick, gửi bù sau khi mốc đã qua thì đi nhánh
    # phát lại. Tick 125 s lấy món đúng lúc 125 s (p-a), không phải p-b ghim lúc 130 s.
    clock.now = T0 + timedelta(seconds=160)
    assert _tick(client, sid, 125) == "p-a"
    assert _ghim_theo_moc(client, sid) == {60: "p-a", 120: "p-a"}


def test_moc_dang_chay_van_lay_mon_dang_ghim(phien):
    """Nhánh tick sống không đổi: trong mốc chưa trôi hết, lần ghi sau thắng."""
    client, clock, sid = phien
    clock.now = T0 + timedelta(seconds=62)
    _ghim(client, sid, "p-a")
    assert _tick(client, sid) == "p-a"
    clock.now = T0 + timedelta(seconds=75)
    _ghim(client, sid, None)
    assert _tick(client, sid, 74) is None
    assert _ghim_theo_moc(client, sid) == {60: None}


def test_sau_khi_phien_ket_thuc_tick_cu_khong_nhan_mon_ghim_cuoi(phien):
    client, clock, sid = phien
    clock.now = T0 + timedelta(seconds=10)
    assert _tick(client, sid) is None
    clock.now = T0 + timedelta(seconds=40)
    _ghim(client, sid, "p-b")
    assert _tick(client, sid) == "p-b"
    clock.now = T0 + timedelta(minutes=20)
    assert client.post(f"/sessions/{sid}/end").status_code == 200
    clock.now += timedelta(hours=2)
    assert _tick(client, sid, 10) is None
    assert _ghim_theo_moc(client, sid) == {0: None, 30: "p-b"}

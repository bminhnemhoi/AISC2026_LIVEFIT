"""Phòng xem dàn dựng (``/xem-api/*``) — hợp đồng, làm mù, đồng ý, rút lui.

Phòng này là nơi người THẬT (ẩn danh, tiền ảo) đi vào cùng đường ống với phiên
thật. Bốn điều phải đúng trước mọi tính năng:

1. **Làm mù**: người xem không suy ra được BẬT/TẮT từ bất cứ trường nào —
   phản hồi ở khối BẬT và khối TẮT chỉ được khác nhau ở chính thẻ ghim.
2. **Đồng ý trước**: không thao tác nào được ghi trước ``dong_y``.
3. **Rút lui là xoá thật**: click, bình luận, đơn tiền ảo, nhật ký đều biến mất
   và tick phơi nhiễm được tính lại.
4. **Không dữ liệu cá nhân**: chỉ lưu băm của mã ngẫu nhiên; bình luận qua bộ
   lọc PII như bình luận thật.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from livelift.api import service
from livelift.api.main import create_app
from livelift.api.routes.xem import pinned_in_block, viewer_hash
from livelift.api.store import InMemoryStore
from livelift.config import get_settings

T0 = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
PRODUCTS = ("P-SAP", "P-BINH", "P-AO")
VIEWERS = ("viewer-aaaaaaaaaaaaaaaa", "viewer-bbbbbbbbbbbbbbbb", "viewer-cccccccccccccccc")


class Clock:
    def __init__(self) -> None:
        self.now = T0

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setattr(service, "now_utc", c)
    return c


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("LIVELIFT_AUTOPILOT", "0")
    monkeypatch.delenv("INGEST_TOKEN", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def room(env, clock):
    """A live 'lab' session with an open room. Returns (client, store, sid, code)."""
    store = InMemoryStore()
    app = create_app(store=store)
    with TestClient(app) as client:
        for pid, price in zip(PRODUCTS, (45_000, 129_000, 99_000), strict=True):
            r = client.post(
                "/products",
                json={
                    "product_id": pid,
                    "name": f"SP {pid}",
                    "cost": 10_000,
                    "price": price,
                    "stock": 50,
                },
            )
            assert r.status_code == 200, r.text
        r = client.post(
            "/sessions",
            json={
                "platform": "lab",
                "title": "Phòng thử",
                "planned_duration_min": 60,
                "mode": "auto",
            },
        )
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        assert client.post(f"/sessions/{sid}/schedule", json={}).status_code == 200
        r = client.post(
            f"/sessions/{sid}/phong-xem",
            json={"consent_version": "2026-10-15", "products": list(PRODUCTS)},
        )
        assert r.status_code == 200, r.text
        code = r.json()["code"]
        assert client.post(f"/sessions/{sid}/start").status_code == 200
        yield client, store, sid, code


def _event(client, code, viewer, event_id, kind, **extra):
    body = {"viewer_id": viewer, "event_id": event_id, "kind": kind, **extra}
    return client.post(f"/xem-api/{code}/su-kien", json=body)


def _consent(client, code, viewer):
    r = _event(client, code, viewer, "dong-y", "dong_y")
    assert r.status_code == 200, r.text


def _blocks(store, sid):
    return [b for b in store.get_blocks(sid) if not b["is_washout"]]


def _go_to(clock, store, sid, block, offset_s: float = 10.0):
    start = store.get_session(sid)["start_ts"]
    clock.now = start + timedelta(seconds=block["start_offset_s"] + offset_s)


# ---------------------------------------------------------------------------
# 1. Contract + blinding
# ---------------------------------------------------------------------------


def test_admin_returns_a_short_public_code_not_the_session_id(room):
    client, store, sid, code = room
    assert sid not in code
    assert 6 <= len(code) <= 16
    assert store.get_session(sid)["phong_xem"]["products"] == list(PRODUCTS)


def test_trang_thai_shape(room):
    client, _, _, code = room
    r = client.get(f"/xem-api/{code}/trang-thai")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {
        "room",
        "pinned",
        "products",
        "server_time_ms",
        "poll_after_ms",
        "source_code_url",
    }
    assert body["room"]["status"] == "dang_mo"
    assert body["room"]["source_label"] == "DÀN DỰNG"
    assert [p["product_id"] for p in body["products"]] == list(PRODUCTS)
    assert r.headers["cache-control"] == "no-store"
    assert body["source_code_url"].startswith("https://")


def test_responses_in_on_and_off_blocks_differ_only_by_the_pinned_card(room, clock):
    """The blinding contract: strip the pinned card and the clock, and an ON
    block looks exactly like an OFF block."""
    client, store, sid, code = room
    seen = {}
    for block in _blocks(store, sid):
        _go_to(clock, store, sid, block)
        if block["assignment"] == "ON":
            r = client.post(f"/sessions/{sid}/actions/execute", json={})
            assert r.status_code == 200, r.text
        body = client.get(f"/xem-api/{code}/trang-thai").json()
        text = json.dumps(body, ensure_ascii=False).lower()
        for forbidden in ("assignment", "arm", "block", "schedule", "design", "propensity"):
            assert forbidden not in text, forbidden
        stripped = {k: v for k, v in body.items() if k not in ("pinned", "server_time_ms")}
        seen.setdefault(block["assignment"], stripped)
        assert stripped == seen.get("ON", stripped) == seen.get("OFF", stripped)
    assert {"ON", "OFF"} <= set(seen)


def test_pin_is_visible_only_in_the_block_where_it_was_placed(room, clock):
    client, store, sid, code = room
    blocks = _blocks(store, sid)
    i = next(
        k
        for k, b in enumerate(blocks[:-1])
        if b["assignment"] == "ON" and blocks[k + 1]["assignment"] == "OFF"
    )
    _go_to(clock, store, sid, blocks[i])
    assert client.post(f"/sessions/{sid}/actions/execute", json={}).status_code == 200
    on = client.get(f"/xem-api/{code}/trang-thai").json()
    assert on["pinned"] is not None
    assert on["pinned"]["product_id"] in PRODUCTS
    _go_to(clock, store, sid, blocks[i + 1])
    off = client.get(f"/xem-api/{code}/trang-thai").json()
    assert off["pinned"] is None


def test_pinned_in_block_replays_only_that_block():
    log = [
        {"block_id": "b1", "action_type": "pin", "product_id": "A", "executed": True},
        {"block_id": "b2", "action_type": "pin", "product_id": "B", "executed": True},
        {"block_id": "b2", "action_type": "unpin", "product_id": None, "executed": True},
    ]
    assert pinned_in_block(log, "b1") == "A"
    assert pinned_in_block(log, "b2") is None
    assert pinned_in_block(log, "b3") is None
    assert pinned_in_block(log, None) is None


# ---------------------------------------------------------------------------
# 2. Consent, idempotency, room state
# ---------------------------------------------------------------------------


def test_nothing_is_recorded_before_consent(room):
    client, store, sid, code = room
    r = _event(client, code, VIEWERS[0], "e1", "bam", product_id="P-SAP")
    assert r.status_code == 403
    assert store.list_clicks(sid) == []
    _consent(client, code, VIEWERS[0])
    assert _event(client, code, VIEWERS[0], "e1", "bam", product_id="P-SAP").status_code == 200
    assert len(store.list_clicks(sid)) == 1


def test_event_ids_are_idempotent(room):
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    a = _event(client, code, VIEWERS[0], "e1", "bam", product_id="P-SAP").json()
    b = _event(client, code, VIEWERS[0], "e1", "bam", product_id="P-SAP").json()
    assert (a["accepted"], a["duplicate"]) == (True, False)
    assert (b["accepted"], b["duplicate"]) == (False, True)
    assert len(store.list_clicks(sid)) == 1


@pytest.mark.parametrize("kind", ["xem_san_pham", "bam", "them_gio", "mua"])
def test_product_outside_the_room_is_refused(room, kind):
    client, _, _, code = room
    _consent(client, code, VIEWERS[0])
    assert _event(client, code, VIEWERS[0], "e1", kind, product_id="P-KHAC").status_code == 422


def test_unknown_or_disabled_room_is_404(room):
    client, _, sid, code = room
    assert client.get("/xem-api/khong-co/trang-thai").status_code == 404
    r = client.post(
        f"/sessions/{sid}/phong-xem",
        json={"enabled": False, "consent_version": "v", "products": list(PRODUCTS)},
    )
    assert r.status_code == 200
    assert r.json()["code"] == code  # disabling keeps the code
    assert client.get(f"/xem-api/{code}/trang-thai").status_code == 404
    assert _event(client, code, VIEWERS[0], "x", "dong_y").status_code == 404


def test_closed_room_rejects_events(room):
    client, _, sid, code = room
    assert client.post(f"/sessions/{sid}/end").status_code == 200
    assert client.get(f"/xem-api/{code}/trang-thai").json()["room"]["status"] == "da_dong"
    assert _event(client, code, VIEWERS[0], "x", "dong_y").status_code == 409


def test_only_lab_sessions_can_open_a_room(env, clock):
    store = InMemoryStore()
    with TestClient(create_app(store=store)) as client:
        for pid in ("A1", "A2"):
            client.post(
                "/products",
                json={"product_id": pid, "name": pid, "cost": 1, "price": 2, "stock": 5},
            )
        sid = client.post(
            "/sessions", json={"platform": "youtube", "planned_duration_min": 30}
        ).json()["session_id"]
        r = client.post(
            f"/sessions/{sid}/phong-xem", json={"consent_version": "v", "products": ["A1", "A2"]}
        )
        assert r.status_code == 409


def test_room_warns_when_the_catalog_has_foreign_products(env, clock):
    store = InMemoryStore()
    with TestClient(create_app(store=store)) as client:
        for pid in ("A1", "A2", "LA"):
            client.post(
                "/products",
                json={"product_id": pid, "name": pid, "cost": 1, "price": 2, "stock": 5},
            )
        sid = client.post(
            "/sessions", json={"platform": "lab", "planned_duration_min": 30, "mode": "auto"}
        ).json()["session_id"]
        r = client.post(
            f"/sessions/{sid}/phong-xem", json={"consent_version": "v", "products": ["A1", "A2"]}
        )
        assert r.status_code == 200
        assert any("LA" in w for w in r.json()["warnings"])


# ---------------------------------------------------------------------------
# 3. Outcomes flow into the standard tables and analysis
# ---------------------------------------------------------------------------


def test_bam_becomes_a_click_attributed_to_the_current_block(room, clock):
    client, store, sid, code = room
    block = _blocks(store, sid)[1]
    _go_to(clock, store, sid, block, 30)
    _consent(client, code, VIEWERS[0])
    _event(client, code, VIEWERS[0], "e1", "bam", product_id="P-BINH")
    (click,) = store.list_clicks(sid)
    assert click["block_id"] == block["block_id"]
    assert click["product_id"] == "P-BINH"
    assert click["shortlink_code"] is None
    assert click["dedup_hash"] == viewer_hash(sid, VIEWERS[0])
    assert click["is_valid"] is True


def test_mua_is_a_play_money_order_with_the_product_price(room):
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    _event(client, code, VIEWERS[0], "m1", "mua", product_id="P-BINH")
    (order,) = store.list_orders(sid)
    assert order["order_id"].startswith(f"lab:{viewer_hash(sid, VIEWERS[0])}:")
    assert float(order["gross"]) == 129_000


def test_heartbeats_become_ticks_of_distinct_viewers(room, clock):
    client, store, sid, code = room
    for i, v in enumerate(VIEWERS):
        _consent(client, code, v)
        _event(client, code, v, f"n{i}", "nhip")
        _event(client, code, v, f"n{i}b", "nhip")  # same viewer twice: still one
    ticks = store.list_ticks(sid)
    assert ticks[-1]["viewers"] == 3


def test_report_counts_lab_clicks(room, clock):
    client, store, sid, code = room
    for block in _blocks(store, sid)[:6]:
        _go_to(clock, store, sid, block, 70)
        for i, v in enumerate(VIEWERS):
            _consent(client, code, v)
            for k in range(3):
                clock.now += timedelta(seconds=8)
                _event(client, code, v, f"{block['block_index']}-{i}-{k}", "nhip")
            _event(client, code, v, f"{block['block_index']}-{i}-c", "bam", product_id="P-SAP")
    r = client.get(f"/sessions/{sid}/report")
    assert r.status_code == 200, r.text
    rep = r.json()
    clicks_in_blocks = sum(b.get("clicks", 0) or 0 for b in rep["blocks"])
    assert clicks_in_blocks > 0


# ---------------------------------------------------------------------------
# 4. Privacy: PII and withdrawal
# ---------------------------------------------------------------------------


def test_comments_are_scrubbed_and_tagged_lab(room):
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    r = _event(
        client,
        code,
        VIEWERS[0],
        "c1",
        "binh_luan",
        text="giá bao nhiêu shop, sđt mình 0912 345 678 nha",
    )
    assert r.status_code == 200
    (comment,) = store.list_comments(sid)
    assert "0912" not in comment["text_scrubbed"]
    assert comment["platform"] == "lab"
    (ev,) = [e for e in store.list_lab_events(sid) if e["kind"] == "binh_luan"]
    assert "text" not in ev


def test_viewer_id_is_never_stored_raw(room):
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    snapshot = store.export_json()
    assert VIEWERS[0] not in snapshot
    assert viewer_hash(sid, VIEWERS[0]) in snapshot


def test_withdrawal_deletes_every_trace_and_blocks_further_events(room):
    client, store, sid, code = room
    keep, leave = VIEWERS[0], VIEWERS[1]
    for v in (keep, leave):
        _consent(client, code, v)
        _event(client, code, v, "n", "nhip")
        _event(client, code, v, "b", "bam", product_id="P-SAP")
        _event(client, code, v, "m", "mua", product_id="P-AO")
        _event(client, code, v, "c", "binh_luan", text="đẹp quá")
    assert store.list_ticks(sid)[-1]["viewers"] == 2

    assert _event(client, code, leave, "out", "rut_lui").status_code == 200
    h = viewer_hash(sid, leave)
    assert all(c["dedup_hash"] != h for c in store.list_clicks(sid))
    assert all(not o["order_id"].startswith(f"lab:{h}:") for o in store.list_orders(sid))
    assert all(not str(c.get("ext_id", "")).startswith(h) for c in store.list_comments(sid))
    mine = [e for e in store.list_lab_events(sid) if e["viewer_hash"] == h]
    assert [e["kind"] for e in mine] == ["rut_lui"]
    assert store.list_ticks(sid)[-1]["viewers"] == 1
    assert len(store.list_clicks(sid)) == 1  # the other viewer stays
    assert _event(client, code, leave, "again", "bam", product_id="P-SAP").status_code == 410


def test_snapshot_round_trip_keeps_lab_events_and_idempotency(room):
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    restored = InMemoryStore()
    counts = restored.import_json(store.export_json())
    assert counts["lab_events"] == 1
    row, duplicate = restored.add_lab_event(
        sid,
        {
            "viewer_hash": viewer_hash(sid, VIEWERS[0]),
            "event_id": "dong-y",
            "kind": "dong_y",
            "ts": T0,
        },
    )
    assert duplicate is True


# ---------------------------------------------------------------------------
# 5. Rate limits
# ---------------------------------------------------------------------------


def test_per_viewer_rate_limit(room, monkeypatch):
    client, _, _, code = room
    monkeypatch.setenv("PHONG_XEM_VIEWER_RATE_LIMIT_PER_MIN", "3")
    get_settings.cache_clear()
    codes = [_event(client, code, VIEWERS[2], f"e{k}", "dong_y").status_code for k in range(4)]
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429


def test_bad_viewer_ids_are_rejected(room):
    client, _, _, code = room
    assert _event(client, code, "short", "e", "dong_y").status_code == 422
    assert _event(client, code, "x" * 20 + "<script>", "e", "dong_y").status_code == 422

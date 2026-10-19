"""Phòng xem dàn dựng (``/xem-api/*``) — hợp đồng, làm mù, đồng ý, rút lui.

Phòng này là nơi người THẬT (ẩn danh, tiền ảo) đi vào cùng đường ống với phiên
thật. Bốn điều phải đúng trước mọi tính năng:

1. **Làm mù**: người xem không suy ra được BẬT/TẮT từ bất cứ trường nào —
   phản hồi ở khối BẬT và khối TẮT chỉ được khác nhau ở chính thẻ ghim.
2. **Đồng ý trước**: không thao tác nào được ghi trước ``dong_y``.
3. **Rút lui là xoá thật**: click, bình luận, đơn tiền ảo, nhật ký đều biến mất
   và tick phơi nhiễm được tính lại, ở MỌI trạng thái phòng (cả khi đã đóng).
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
        sid, code = _lab_room(client)
        assert client.post(f"/sessions/{sid}/start").status_code == 200
        yield client, store, sid, code


@pytest.fixture(params=["planned", "scheduled"])
def planned_room(request, env, clock):
    """Như ``room`` nhưng phiên CHƯA bắt đầu (phòng 'chua_mo'): 'planned' là chưa
    bốc lịch, 'scheduled' là đã bốc lịch nhưng chưa phát."""
    store = InMemoryStore()
    with TestClient(create_app(store=store)) as client:
        sid, code = _lab_room(client, schedule=request.param == "scheduled")
        assert store.get_session(sid)["status"] == request.param
        yield client, store, sid, code


def _lab_room(client, *, schedule: bool = True, dry_run: bool = False) -> tuple[str, str]:
    """Danh mục, phiên 'lab' (đã bốc lịch nếu ``schedule``, chạy thử nếu
    ``dry_run``) và phòng xem đã bật; chưa bắt đầu phiên."""
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
            "dry_run": dry_run,
        },
    )
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    if schedule:
        assert client.post(f"/sessions/{sid}/schedule", json={}).status_code == 200
    r = client.post(
        f"/sessions/{sid}/phong-xem",
        json={"consent_version": "2026-10-15", "products": list(PRODUCTS)},
    )
    assert r.status_code == 200, r.text
    return sid, r.json()["code"]


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


def _tables(store) -> dict:
    """Toàn bộ dữ liệu của kho, bỏ giờ chụp và bộ đếm sửa đổi (không phải dữ liệu)."""
    state = json.loads(store.export_json())
    state.pop("saved_at")
    state.pop("rev")
    return state


def _close_room(client, sid, how: str) -> None:
    """``ket_thuc``: phiên kết thúc (da_dong); ``tat_phong``: người vận hành tắt
    phòng (mã công khai trả 404); ``ca_hai``: cả hai."""
    if how in ("ket_thuc", "ca_hai"):
        assert client.post(f"/sessions/{sid}/end").status_code == 200
    if how in ("tat_phong", "ca_hai"):
        r = client.post(
            f"/sessions/{sid}/phong-xem",
            json={"enabled": False, "consent_version": "2026-10-15", "products": list(PRODUCTS)},
        )
        assert r.status_code == 200, r.text


def _two_viewers_act(client, code, viewers) -> None:
    for v in viewers:
        _consent(client, code, v)
        _event(client, code, v, "n", "nhip")
        _event(client, code, v, "b", "bam", product_id="P-SAP")
        _event(client, code, v, "m", "mua", product_id="P-AO")
        _event(client, code, v, "c", "binh_luan", text="đẹp quá")


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
    assert body["room"]["dry_run"] is False
    assert [p["product_id"] for p in body["products"]] == list(PRODUCTS)
    assert r.headers["cache-control"] == "no-store"
    assert body["source_code_url"].startswith("https://")


def test_trang_thai_gui_co_dry_run_cua_phien(env, clock):
    """Phòng của phiên chạy thử gửi room.dry_run=true (chip THỬ NỘI BỘ không
    phải đoán theo tên phòng); cờ cố định cả phiên, không mang nhánh."""
    store = InMemoryStore()
    with TestClient(create_app(store=store)) as client:
        sid, code = _lab_room(client, dry_run=True)
        assert store.get_session(sid)["dry_run"] is True
        assert client.post(f"/sessions/{sid}/start").status_code == 200
        dau = client.get(f"/xem-api/{code}/trang-thai").json()["room"]
        assert dau["dry_run"] is True
        assert "Thử nội bộ" not in dau["title"]
        for b in _blocks(store, sid):
            _go_to(clock, store, sid, b)
            assert client.get(f"/xem-api/{code}/trang-thai").json()["room"] == dau


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


@pytest.mark.parametrize(
    ("kind", "extra"),
    [
        ("dong_y", {}),
        ("nhip", {}),
        ("xem_san_pham", {"product_id": "P-SAP"}),
        ("bam", {"product_id": "P-SAP"}),
        ("them_gio", {"product_id": "P-SAP"}),
        ("mua", {"product_id": "P-SAP"}),
        ("binh_luan", {"text": "còn hàng không shop"}),
    ],
)
def test_closed_room_refuses_every_kind_but_withdrawal_and_writes_nothing(room, kind, extra):
    """Rút lui là NGOẠI LỆ DUY NHẤT của cổng 409: người đã đồng ý, sau khi phòng
    đóng, không ghi thêm được bất cứ thao tác nào khác."""
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    assert client.post(f"/sessions/{sid}/end").status_code == 200
    before = _tables(store)
    r = _event(client, code, VIEWERS[0], "late", kind, **extra)
    assert r.status_code == 409, r.text
    assert _tables(store) == before


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


def test_lab_pins_only_room_products_even_with_a_shared_catalog(env, clock):
    """The catalog is shared system-wide; a lab session must still only ever pin
    one of its own room products (otherwise the viewer would see no card in an
    ON block and the treatment would silently not happen)."""
    store = InMemoryStore()
    with TestClient(create_app(store=store)) as client:
        for pid in ("A1", "A2", "NGOAI-1", "NGOAI-2", "NGOAI-3"):
            client.post(
                "/products",
                json={"product_id": pid, "name": pid, "cost": 1, "price": 2, "stock": 5},
            )
        sid = client.post(
            "/sessions", json={"platform": "lab", "planned_duration_min": 60, "mode": "auto"}
        ).json()["session_id"]
        assert client.post(f"/sessions/{sid}/schedule", json={}).status_code == 200
        r = client.post(
            f"/sessions/{sid}/phong-xem", json={"consent_version": "v", "products": ["A1", "A2"]}
        )
        assert r.status_code == 200
        assert r.json()["warnings"] == []
        assert client.post(f"/sessions/{sid}/start").status_code == 200
        pinned = set()
        for block in _blocks(store, sid):
            if block["assignment"] != "ON":
                continue
            _go_to(clock, store, sid, block)
            assert client.post(f"/sessions/{sid}/actions/execute", json={}).status_code == 200
        for row in store.list_interventions(sid):
            if row.get("action_type") == "pin":
                pinned.add(row["product_id"])
        assert pinned
        assert pinned <= {"A1", "A2"}


def test_desk_cards_use_the_same_room_candidates_as_execute(env, clock):
    """15/10/2026: /state built its cards from the whole catalog while /actions/execute
    filtered to the room, so the desk could invite a pin the server would refuse. Both
    now go through livelift.api.ung_vien."""
    store = InMemoryStore()
    with TestClient(create_app(store=store)) as client:
        for pid in ("A1", "A2", "NGOAI-1", "NGOAI-2", "NGOAI-3"):
            client.post(
                "/products",
                json={"product_id": pid, "name": pid, "cost": 1, "price": 2, "stock": 50},
            )
        sid = client.post(
            "/sessions", json={"platform": "lab", "planned_duration_min": 60, "mode": "auto"}
        ).json()["session_id"]
        client.post(f"/sessions/{sid}/schedule", json={})
        client.post(
            f"/sessions/{sid}/phong-xem", json={"consent_version": "v", "products": ["A1", "A2"]}
        )
        client.post(f"/sessions/{sid}/start")
        on = next(b for b in _blocks(store, sid) if b["assignment"] == "ON")
        _go_to(clock, store, sid, on)
        cards = client.get(f"/sessions/{sid}/state").json()["cards"]
        assert cards
        assert {c["product_id"] for c in cards} <= {"A1", "A2"}


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


@pytest.mark.parametrize("how", ["ket_thuc", "tat_phong", "ca_hai"])
def test_withdrawal_still_works_after_the_room_closes(room, clock, how):
    """19/10/2026: cổng 409 "Phòng chưa mở hoặc đã đóng" từng đứng trước mọi xét
    loại, nên bấm "Rút lui" sau buổi phát bị chặn và dữ liệu ở lại. Quyền rút
    lui phải sống lâu hơn buổi phát, kể cả khi phòng đã bị tắt."""
    client, store, sid, code = room
    keep, leave = VIEWERS[0], VIEWERS[1]
    _two_viewers_act(client, code, (keep, leave))
    clock.now += timedelta(minutes=2)
    _close_room(client, sid, how)
    clock.now += timedelta(hours=3)  # rút lui khi buổi phát đã xong từ lâu
    n_ticks = len(store.list_ticks(sid))

    r = _event(client, code, leave, "out", "rut_lui")
    assert r.status_code == 200, r.text
    assert (r.json()["accepted"], r.json()["duplicate"]) == (True, False)
    h = viewer_hash(sid, leave)
    assert all(c["dedup_hash"] != h for c in store.list_clicks(sid))
    assert all(not o["order_id"].startswith(f"lab:{h}:") for o in store.list_orders(sid))
    assert all(not str(c.get("ext_id", "")).startswith(h) for c in store.list_comments(sid))
    mine = [e for e in store.list_lab_events(sid) if e["viewer_hash"] == h]
    assert [e["kind"] for e in mine] == ["rut_lui"]
    # Tick phơi nhiễm của mốc cũ được tính lại; không mốc mới nào được đẻ ra.
    assert len(store.list_ticks(sid)) == n_ticks
    assert store.list_ticks(sid)[-1]["viewers"] == 1
    # Người ở lại còn nguyên.
    assert len(store.list_clicks(sid)) == 1
    assert len(store.list_orders(sid)) == 1
    assert len(store.list_comments(sid)) == 1
    # Phòng đóng chỉ mở cửa cho rút lui: thao tác khác vẫn bị chặn như trước.
    late = _event(client, code, keep, "late", "bam", product_id="P-SAP")
    assert late.status_code == (409 if how == "ket_thuc" else 404)
    assert len(store.list_clicks(sid)) == 1


def test_withdrawal_after_close_leaves_the_same_analysis_as_withdrawal_while_open(room, clock):
    """Rút lui rồi đóng phòng, hay đóng phòng rồi mới rút lui: kho và báo cáo
    phải GIỐNG HỆT nhau. Người rút lui muộn bị loại khỏi phân tích y như người
    rút lui sớm (click, đơn, bình luận, số người xem từng mốc)."""
    client, store, sid, code = room
    for block in _blocks(store, sid)[:4]:
        _go_to(clock, store, sid, block, 70)
        if block["assignment"] == "ON":
            assert client.post(f"/sessions/{sid}/actions/execute", json={}).status_code == 200
        for i, v in enumerate(VIEWERS):
            _consent(client, code, v)
            for k in range(3):
                clock.now += timedelta(seconds=8)
                _event(client, code, v, f"{block['block_index']}-{i}-{k}", "nhip")
            _event(client, code, v, f"{block['block_index']}-{i}-b", "bam", product_id="P-SAP")
            _event(client, code, v, f"{block['block_index']}-{i}-m", "mua", product_id="P-AO")
    leave = VIEWERS[1]
    h = viewer_hash(sid, leave)
    assert any(c["dedup_hash"] == h for c in store.list_clicks(sid))
    snapshot = store.export_json()

    # A: rút lui khi phòng còn mở, rồi kết thúc phiên.
    assert _event(client, code, leave, "out", "rut_lui").status_code == 200
    assert client.post(f"/sessions/{sid}/end").status_code == 200
    report_a = client.get(f"/sessions/{sid}/report")
    assert report_a.status_code == 200, report_a.text

    # B: cùng dữ liệu, cùng giờ, nhưng kết thúc phiên trước rồi mới rút lui.
    other = InMemoryStore()
    other.import_json(snapshot)
    with TestClient(create_app(store=other)) as late:
        assert late.post(f"/sessions/{sid}/end").status_code == 200
        r = _event(late, code, leave, "out", "rut_lui")
        assert r.status_code == 200, r.text
        report_b = late.get(f"/sessions/{sid}/report")
        assert report_b.status_code == 200, report_b.text

    assert report_b.json() == report_a.json()
    assert _tables(other) == _tables(store)
    assert all(c["dedup_hash"] != h for c in other.list_clicks(sid))
    assert sum(b.get("clicks", 0) or 0 for b in report_b.json()["blocks"]) > 0


@pytest.mark.parametrize("closed", [False, True])
def test_repeated_withdrawal_is_a_harmless_duplicate(room, closed):
    """Bấm "Rút lui" lần hai (hoặc máy gửi lại sau lỗi mạng) không xoá, không
    ghi gì thêm và không lỗi: trả lời như một bản trùng."""
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    _event(client, code, VIEWERS[0], "b", "bam", product_id="P-SAP")
    if closed:
        assert client.post(f"/sessions/{sid}/end").status_code == 200
    first = _event(client, code, VIEWERS[0], "out", "rut_lui")
    assert first.status_code == 200, first.text
    assert (first.json()["accepted"], first.json()["duplicate"]) == (True, False)
    before = _tables(store)
    for event_id in ("out", "out-lan-2"):
        again = _event(client, code, VIEWERS[0], event_id, "rut_lui")
        assert again.status_code == 200, again.text
        assert (again.json()["accepted"], again.json()["duplicate"]) == (False, True)
    assert _tables(store) == before
    other = _event(client, code, VIEWERS[0], "sau", "bam", product_id="P-SAP")
    assert other.status_code == (409 if closed else 410)


@pytest.mark.parametrize(
    ("how", "status"), [("ket_thuc", 403), ("tat_phong", 404), ("ca_hai", 404)]
)
def test_withdrawal_without_consent_writes_nothing_even_when_closed(room, how, status):
    """Phòng đóng không phải cửa sau để ghi: người chưa từng đồng ý thì không có
    gì để xoá, và cũng không để lại dòng ``rut_lui`` nào. Phòng đã tắt còn không
    được thừa nhận là có thật (404 như mã sai); phòng chỉ đóng thì trang trạng
    thái vẫn công khai, nên 403 không lộ thêm gì."""
    client, store, sid, code = room
    _close_room(client, sid, how)
    before = _tables(store)
    assert _event(client, code, VIEWERS[2], "out", "rut_lui").status_code == status
    assert _tables(store) == before


@pytest.mark.parametrize("how", ["tat_phong", "ca_hai"])
def test_stranger_withdrawal_in_a_switched_off_room_looks_like_an_unknown_code(
    room, monkeypatch, how
):
    """V2-loi-ghim (19/10/2026): người lạ gửi ``rut_lui`` vào mã của phòng đã tắt
    từng nhận 403 "Cần đồng ý", tức là biết mã ấy có thật. Nay nhận ĐÚNG phản hồi
    của mã không tồn tại, cả khi gửi dồn (không bao giờ 429 theo người xem, vì mã
    sai không bao giờ trả 429 ấy). Người đã đồng ý vẫn rút lui được."""
    client, store, sid, code = room
    monkeypatch.setenv("PHONG_XEM_VIEWER_RATE_LIMIT_PER_MIN", "2")
    get_settings.cache_clear()
    member = VIEWERS[0]
    _consent(client, code, member)
    assert _event(client, code, member, "b", "bam", product_id="P-SAP").status_code == 200
    _close_room(client, sid, how)
    before = _tables(store)

    unknown = _event(client, "khong-co", VIEWERS[2], "out", "rut_lui")
    assert unknown.status_code == 404
    for k in range(4):
        r = _event(client, code, VIEWERS[2], f"out-{k}", "rut_lui")
        assert (r.status_code, r.json()) == (404, unknown.json())
    assert _tables(store) == before

    # Người đã đồng ý đã tiêu hết 2 lượt (đồng ý + bấm); người lạ không tốn lượt nào.
    client.app.state.gioi_han_ghi.xoa_het()
    r = _event(client, code, member, "out", "rut_lui")
    assert r.status_code == 200, r.text
    assert (r.json()["accepted"], r.json()["duplicate"]) == (True, False)
    h = viewer_hash(sid, member)
    assert store.list_clicks(sid) == []
    assert [e["kind"] for e in store.list_lab_events(sid) if e["viewer_hash"] == h] == ["rut_lui"]


def test_repeated_withdrawal_in_a_switched_off_room_is_still_a_duplicate(room):
    """Người đã rút lui chỉ còn dòng ``rut_lui`` (dòng ``dong_y`` đã bị xoá cùng
    mọi dấu vết khác); họ vẫn là người từng tham gia, nên bấm lại sau khi phòng
    tắt nhận ``duplicate`` chứ không phải 404."""
    client, store, sid, code = room
    _consent(client, code, VIEWERS[0])
    assert _event(client, code, VIEWERS[0], "out", "rut_lui").status_code == 200
    _close_room(client, sid, "tat_phong")
    before = _tables(store)
    again = _event(client, code, VIEWERS[0], "out-lan-2", "rut_lui")
    assert again.status_code == 200, again.text
    assert (again.json()["accepted"], again.json()["duplicate"]) == (False, True)
    assert _tables(store) == before


def test_withdrawal_while_the_session_is_still_planned(planned_room):
    """Phiên chưa phát ('planned' hoặc 'scheduled', phòng 'chua_mo'): rút lui
    không vướng cổng 409 như mọi loại khác, nhưng chưa ai đồng ý được nên người
    gửi là người lạ: 403, không ghi gì. Phòng đã tắt thì 404 y như mã sai."""
    client, store, sid, code = planned_room
    assert client.get(f"/xem-api/{code}/trang-thai").json()["room"]["status"] == "chua_mo"
    before = _tables(store)
    assert _event(client, code, VIEWERS[0], "dy", "dong_y").status_code == 409
    r = _event(client, code, VIEWERS[0], "out", "rut_lui")
    assert r.status_code == 403, r.text
    assert _tables(store) == before

    _close_room(client, sid, "tat_phong")
    before = _tables(store)
    unknown = _event(client, "khong-co", VIEWERS[0], "out", "rut_lui")
    r = _event(client, code, VIEWERS[0], "out", "rut_lui")
    assert (r.status_code, r.json()) == (404, unknown.json())
    assert _tables(store) == before


@pytest.mark.parametrize("how", ["dang_mo", "ket_thuc", "tat_phong"])
def test_withdrawal_keeps_the_pin_recorded_in_every_old_bucket(room, clock, how):
    """V2-loi-ghim (19/10/2026): rút lui tính lại tick của các mốc cũ, và
    ``_store_tick`` từng đóng dấu món đang ghim LÚC RÚT LUI (sau khi phiên kết
    thúc là món ghim cuối) lên mọi mốc ấy. Ghim đổi qua nhiều khối (chưa ghim,
    A, B, gỡ, C); rút lui; món ghim của từng mốc không đổi, chỉ số người xem
    được tính lại."""
    client, store, sid, code = room
    keep, leave = VIEWERS[0], VIEWERS[1]
    steps = [None, "P-SAP", "P-BINH", "unpin", "P-AO"]
    for k, (block, step) in enumerate(zip(_blocks(store, sid), steps, strict=False)):
        _go_to(clock, store, sid, block)
        if step is not None:
            r = client.post(
                f"/sessions/{sid}/actions/override",
                json={
                    "product_id": None if step == "unpin" else step,
                    "reason": "sự cố kỹ thuật",
                },
            )
            assert r.status_code == 200, r.text
        for offset in (0, 30):  # hai mốc 30 giây mỗi khối
            clock.now = clock.now + timedelta(seconds=offset)
            for v in (keep, leave):
                if k == 0 and offset == 0:
                    _consent(client, code, v)
                assert _event(client, code, v, f"n{k}-{offset}", "nhip").status_code == 200
    before = {t["ts_bucket"]: t["pinned_product_id"] for t in store.list_ticks(sid)}
    assert set(before.values()) == {None, "P-SAP", "P-BINH", "P-AO"}
    assert {t["viewers"] for t in store.list_ticks(sid)} == {2}

    if how != "dang_mo":
        clock.now += timedelta(minutes=2)
        _close_room(client, sid, how)
        clock.now += timedelta(hours=3)
    r = _event(client, code, leave, "out", "rut_lui")
    assert r.status_code == 200, r.text

    after = store.list_ticks(sid)
    assert {t["ts_bucket"]: t["pinned_product_id"] for t in after} == before
    assert {t["viewers"] for t in after} == {1}  # tick đã được tính lại thật


def test_withdrawal_from_an_unknown_room_is_404(room):
    client, _, _, _ = room
    assert _event(client, "khong-co", VIEWERS[0], "out", "rut_lui").status_code == 404


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


def test_withdrawal_after_close_still_respects_the_per_viewer_rate_limit(room, monkeypatch):
    """Phòng đóng không gỡ trần tần suất của rút lui; lượt bị chặn không xoá gì."""
    client, store, sid, code = room
    monkeypatch.setenv("PHONG_XEM_VIEWER_RATE_LIMIT_PER_MIN", "2")
    get_settings.cache_clear()
    _consent(client, code, VIEWERS[0])
    assert _event(client, code, VIEWERS[0], "b", "bam", product_id="P-SAP").status_code == 200
    assert client.post(f"/sessions/{sid}/end").status_code == 200

    r = _event(client, code, VIEWERS[0], "out", "rut_lui")
    assert r.status_code == 429, r.text
    assert int(r.headers["retry-after"]) >= 1
    assert len(store.list_clicks(sid)) == 1
    assert all(e["kind"] != "rut_lui" for e in store.list_lab_events(sid))

    client.app.state.gioi_han_ghi.xoa_het()  # thay cho chờ hết cửa sổ một phút
    assert _event(client, code, VIEWERS[0], "out", "rut_lui").status_code == 200
    assert store.list_clicks(sid) == []


def test_bad_viewer_ids_are_rejected(room):
    client, _, _, code = room
    assert _event(client, code, "short", "e", "dong_y").status_code == 422
    assert _event(client, code, "x" * 20 + "<script>", "e", "dong_y").status_code == 422

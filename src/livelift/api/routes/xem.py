"""Phòng xem dàn dựng — the staged live room (15/10/2026).

Why it exists: the team has no partner seller yet. To run the first randomized
experiment with REAL people, a pre-recorded host video loops in a public room,
a product card is pinned by the autopilot in ON blocks of the sealed switchback
schedule, and anonymous volunteers on their phones view, tap, add to cart, buy
with PLAY MONEY and comment. Everything they do flows into the SAME tables and
the SAME analysis as a real session — the only difference is ``platform='lab'``.

Contract
--------
* ``POST /sessions/{session_id}/phong-xem`` (token) — enable/disable the room of
  a ``lab`` session, set consent version, video and product list. Returns the
  short random public ``code``; the session UUID never leaves the server.
* ``GET  /xem-api/{code}/trang-thai`` (public read) — room status, the pinned
  product card, the product list. **Never** the arm, the block index, the
  schedule or anything else a viewer could use to infer treatment.
* ``POST /xem-api/{code}/su-kien`` (public write, :data:`MUC_CONG_KHAI`) — one
  viewer action, idempotent on ``(viewer, event_id)``.

The JSON API lives under ``/xem-api/`` so it never collides with the Next.js page
``/xem/{code}`` that renders the room; ``docker/Caddyfile.tunnel`` routes the two.

Research rules enforced here
----------------------------
* **Consent first**: any action before ``dong_y`` is refused (403).
* **Withdrawal** (``rut_lui``): every trace of the viewer — room log, clicks,
  comments, play-money orders — is deleted and the exposure ticks they were part
  of are recomputed; later events from that viewer are refused (410).
* **No personal data**: the client sends a random ``viewer_id``; the server stores
  only ``sha256(session_id:viewer_id)``. Comment text goes through the same PII
  scrubber as real comments before anything is stored. No IP address is stored.
* **Pin lasts for its block**: the room shows the pinned card only while the
  CURRENT block has a pin in the intervention log. With no live host there is no
  "business as usual" to fall back on, so the control arm is "no pinned card" and
  the experiment answers exactly "does pinning a product sell more?".
* **Exposure** comes from heartbeats: each 30 s tick holds the number of distinct
  viewers who sent any event in that bucket (a 15 s heartbeat guarantees at least
  one per bucket while the page is visible), so the pre-registered outcome
  (valid clicks per 1000 viewer-seconds) works unchanged.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from livelift.api import service
from livelift.api.auth import _bo_dem, chi_token, cong_khai
from livelift.api.routes.events import TICK_S, _store_comment, _store_tick, _tick_bucket
from livelift.api.schemas import CommentIn, TickIn
from livelift.api.service import StoreDep
from livelift.config import get_settings
from livelift.core.click_validity import PriorClick, classify_click

router = APIRouter()

API_PREFIX = "/xem-api"
SOURCE_LABEL = "DÀN DỰNG"
POLL_AFTER_MS = 3000
CODE_BYTES = 6  # secrets.token_urlsafe(6) -> 8 ký tự, ~2^48 khả năng

Kind = Literal["dong_y", "nhip", "xem_san_pham", "bam", "them_gio", "mua", "binh_luan", "rut_lui"]
KINDS_NEED_PRODUCT = frozenset({"xem_san_pham", "bam", "them_gio", "mua"})

_ID_PATTERN = r"^[A-Za-z0-9_-]+$"


# --- schemas -----------------------------------------------------------------


class PhongXemIn(BaseModel):
    enabled: bool = True
    consent_version: str = Field(min_length=1, max_length=40)
    products: list[str] = Field(min_length=2, max_length=12)
    video_url: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=120)


class PhongXemOut(BaseModel):
    code: str
    public_path: str
    enabled: bool
    consent_version: str
    products: list[str]
    warnings: list[str] = Field(default_factory=list)


class XemSanPham(BaseModel):
    product_id: str
    name: str
    price_vnd: float
    image_url: str | None = None


class XemPhong(BaseModel):
    title: str
    status: Literal["chua_mo", "dang_mo", "da_dong"]
    video_url: str | None = None
    consent_version: str
    source_label: str = SOURCE_LABEL


class XemTrangThai(BaseModel):
    room: XemPhong
    pinned: XemSanPham | None = None
    products: list[XemSanPham]
    server_time_ms: int
    poll_after_ms: int = POLL_AFTER_MS
    source_code_url: str


class XemSuKienIn(BaseModel):
    viewer_id: str = Field(min_length=16, max_length=64, pattern=_ID_PATTERN)
    event_id: str = Field(min_length=1, max_length=64, pattern=_ID_PATTERN)
    kind: Kind
    product_id: str | None = Field(default=None, max_length=64)
    text: str | None = Field(default=None, max_length=200)
    client_time_ms: int | None = Field(default=None, ge=0)


class XemSuKienOut(BaseModel):
    ok: bool = True
    accepted: bool
    duplicate: bool


# --- helpers -----------------------------------------------------------------


def viewer_hash(session_id: str, viewer_id: str) -> str:
    """Stable across restarts (withdrawal must find the viewer tomorrow), unlinkable
    across sessions (salted with the session id), never the raw id."""
    return hashlib.sha256(f"lab:{session_id}:{viewer_id}".encode()).hexdigest()[:32]


def _room(session: dict[str, Any]) -> dict[str, Any]:
    return dict(session.get("phong_xem") or {})


def _status(session: dict[str, Any]) -> Literal["chua_mo", "dang_mo", "da_dong"]:
    status = session.get("status")
    if status == "live":
        return "dang_mo"
    if status in ("ended", "cancelled"):
        return "da_dong"
    return "chua_mo"


def _require_room(store: Any, code: str) -> tuple[dict[str, Any], dict[str, Any]]:
    session = store.find_session_by_room_code(code)
    room = _room(session) if session else {}
    if session is None or not room.get("enabled"):
        raise HTTPException(status_code=404, detail="Phòng xem không tồn tại hoặc đã tắt.")
    return session, room


def _product_card(store: Any, product_id: str) -> XemSanPham | None:
    p = store.get_product(product_id)
    if p is None:
        return None
    return XemSanPham(product_id=product_id, name=p["name"], price_vnd=float(p.get("price") or 0))


def _current_block(store: Any, session: dict[str, Any], now: datetime) -> dict[str, Any] | None:
    if session.get("status") != "live":
        return None
    return service.block_at_offset(
        store.get_blocks(session["session_id"]), service.elapsed_seconds(session, now)
    )


def pinned_in_block(interventions: list[dict[str, Any]], block_id: str | None) -> str | None:
    """Replay only the CURRENT block's pin/unpin log — the pin lasts for its block."""
    if block_id is None:
        return None
    return service.current_pinned_product_id(
        [i for i in interventions if i.get("block_id") == block_id]
    )


def _viewers_in_bucket(events: list[dict[str, Any]], session: dict, bucket: datetime) -> int:
    end = bucket + timedelta(seconds=TICK_S)
    present = {
        e["viewer_hash"]
        for e in events
        if e.get("ts") is not None and e.get("kind") != "rut_lui" and bucket <= e["ts"] < end
    }
    return len(present)


def _refresh_tick(store: Any, session: dict[str, Any], at: datetime) -> None:
    sid = session["session_id"]
    bucket = _tick_bucket(session, at)
    events = store.list_lab_events(sid)
    withdrawn = {e["viewer_hash"] for e in events if e.get("kind") == "rut_lui"}
    events = [e for e in events if e["viewer_hash"] not in withdrawn]
    _store_tick(sid, TickIn(viewers=_viewers_in_bucket(events, session, bucket), ts_utc=at), store)


def _per_viewer_limit(request: Request, vhash: str) -> None:
    limit = get_settings().phong_xem_viewer_rate_limit_per_min
    wait = _bo_dem(request).xin_luot((vhash, "phong_xem_nguoi"), limit, 60.0, time.monotonic())
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"Bạn thao tác hơi nhanh, chờ {wait} giây rồi thử lại nhé.",
            headers={"Retry-After": str(wait)},
        )


# --- admin -------------------------------------------------------------------


@chi_token
@router.post("/sessions/{session_id}/phong-xem", response_model=PhongXemOut)
def bat_phong_xem(session_id: str, body: PhongXemIn, store: StoreDep) -> PhongXemOut:
    """Enable (or disable) the staged room of a ``lab`` session."""
    session = service.require_session(store, session_id)
    if session.get("platform") != "lab":
        raise HTTPException(
            status_code=409,
            detail="Chỉ phiên nền tảng 'lab' (phòng dàn dựng) mới mở được phòng xem.",
        )
    missing = [pid for pid in body.products if store.get_product(pid) is None]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Sản phẩm chưa có trong danh mục: {', '.join(missing)}. Tạo bằng POST /products."
            ),
        )
    room = _room(session)
    code = room.get("code")
    while not code or (
        (other := store.find_session_by_room_code(code)) is not None
        and other["session_id"] != session_id
    ):
        code = secrets.token_urlsafe(CODE_BYTES)
    room.update(
        {
            "code": code,
            "enabled": body.enabled,
            "consent_version": body.consent_version,
            "products": list(dict.fromkeys(body.products)),
            "video_url": body.video_url,
            "title": body.title or session.get("title") or "Phòng live dàn dựng",
        }
    )
    store.update_session(session_id, {"phong_xem": room})
    # Ứng viên ghim của phiên 'lab' đã bị giới hạn trong danh sách phòng ngay tại
    # execute_action (routes/actions.py), nên danh mục dùng chung không còn là rủi ro.
    warnings: list[str] = []
    if session.get("mode") != "auto":
        warnings.append(
            "Phiên không ở chế độ 'auto': không có người vận hành thì autopilot sẽ không ghim."
        )
    return PhongXemOut(
        code=code,
        public_path=f"/xem/{code}",
        enabled=body.enabled,
        consent_version=body.consent_version,
        products=room["products"],
        warnings=warnings,
    )


# --- public ------------------------------------------------------------------


@router.get(API_PREFIX + "/{code}/trang-thai", response_model=XemTrangThai)
def trang_thai(code: str, response: Response, store: StoreDep) -> XemTrangThai:
    session, room = _require_room(store, code)
    now = service.now_utc()
    response.headers["Cache-Control"] = "no-store"
    pinned = None
    block = _current_block(store, session, now)
    if block is not None:
        pid = pinned_in_block(store.list_interventions(session["session_id"]), block["block_id"])
        if pid is not None and pid in room.get("products", []):
            pinned = _product_card(store, pid)
    products = [c for pid in room.get("products", []) if (c := _product_card(store, pid))]
    return XemTrangThai(
        room=XemPhong(
            title=room.get("title") or "Phòng live dàn dựng",
            status=_status(session),
            video_url=room.get("video_url"),
            consent_version=room.get("consent_version", ""),
        ),
        pinned=pinned,
        products=products,
        server_time_ms=int(now.timestamp() * 1000),
        source_code_url=get_settings().source_code_url,
    )


@cong_khai
@router.post(API_PREFIX + "/{code}/su-kien", response_model=XemSuKienOut)
def su_kien(code: str, body: XemSuKienIn, request: Request, store: StoreDep) -> XemSuKienOut:
    session, room = _require_room(store, code)
    if _status(session) != "dang_mo":
        raise HTTPException(status_code=409, detail="Phòng chưa mở hoặc đã đóng.")
    sid = session["session_id"]
    vhash = viewer_hash(sid, body.viewer_id)
    _per_viewer_limit(request, vhash)

    history = [e for e in store.list_lab_events(sid) if e["viewer_hash"] == vhash]
    if any(e["kind"] == "rut_lui" for e in history):
        raise HTTPException(status_code=410, detail="Bạn đã rút lui khỏi nghiên cứu này.")
    if body.kind != "dong_y" and not any(e["kind"] == "dong_y" for e in history):
        raise HTTPException(status_code=403, detail="Cần đồng ý tham gia trước khi vào phòng.")
    if body.kind in KINDS_NEED_PRODUCT and body.product_id not in room.get("products", []):
        raise HTTPException(status_code=422, detail="Sản phẩm không thuộc phòng này.")
    if body.kind == "binh_luan" and not (body.text or "").strip():
        raise HTTPException(status_code=422, detail="Bình luận trống.")

    now = service.now_utc()
    client_ts = (
        datetime.fromtimestamp(body.client_time_ms / 1000, tz=UTC)
        if body.client_time_ms is not None
        else None
    )

    if body.kind == "rut_lui":
        touched = sorted({e["ts"] for e in history if e.get("ts") is not None})
        store.forget_lab_viewer(sid, vhash)
        store.add_lab_event(
            sid,
            {"viewer_hash": vhash, "event_id": body.event_id, "kind": "rut_lui", "ts": now},
        )
        for ts in {_tick_bucket(session, t) for t in touched}:
            _refresh_tick(store, session, ts)
        return XemSuKienOut(accepted=True, duplicate=False)

    _, duplicate = store.add_lab_event(
        sid,
        {
            "viewer_hash": vhash,
            "event_id": body.event_id,
            "kind": body.kind,
            "product_id": body.product_id,
            "ts": now,
            "client_ts": client_ts,
        },
    )
    if duplicate:
        return XemSuKienOut(accepted=False, duplicate=True)

    block = _current_block(store, session, now)
    block_id = block["block_id"] if block else None
    if body.kind == "bam":
        _record_click(store, request, sid, vhash, body.product_id, block_id, now)
    elif body.kind == "mua":
        product = store.get_product(body.product_id) or {}
        price = float(product.get("price") or 0)
        store.add_order(
            sid,
            {
                "order_id": f"lab:{vhash}:{body.event_id}",
                "block_id": block_id,
                "ts": now,
                "product_id": body.product_id,
                "qty": 1,
                "gross": price,  # TIỀN ẢO — phiên 'lab', không phải doanh thu thật
                "fees": 0,
                "net_margin": price - float(product.get("cost") or 0),
            },
        )
    elif body.kind == "binh_luan":
        _store_comment(
            sid,
            CommentIn(
                text=body.text or "",
                platform="lab",
                ext_id=f"{vhash}:{body.event_id}",
                ts_utc=now,
            ),
            store,
        )
    _refresh_tick(store, session, now)
    return XemSuKienOut(accepted=True, duplicate=False)


def _record_click(
    store: Any,
    request: Request,
    sid: str,
    vhash: str,
    product_id: str | None,
    block_id: str | None,
    now: datetime,
) -> None:
    """Same validity rules as a /r/{code} click (assignment-blind), with the
    viewer hash as the fingerprint and no shortlink."""
    priors = [
        PriorClick(
            age_s=(now - prior["ts"]).total_seconds(),
            counted=prior.get("is_valid") is not False,
            same_block=prior.get("block_id") == block_id,
        )
        for prior in store.list_clicks_for_fingerprint(sid, vhash, None)
    ]
    is_valid, invalid_reason, ua_class = classify_click(
        request.headers.get("user-agent"), request.headers, "GET", priors
    )
    store.add_click(
        sid,
        {
            "click_id": service.new_id(),
            "block_id": block_id,
            "ts": now,
            "product_id": product_id,
            "shortlink_code": None,
            "dedup_hash": vhash,
            "is_valid": is_valid,
            "invalid_reason": invalid_reason,
            "ua_class": ua_class,
        },
    )
    store.publish(sid, {"type": "click", "data": {"product_id": product_id, "is_valid": is_valid}})


__all__ = ["pinned_in_block", "router", "viewer_hash"]

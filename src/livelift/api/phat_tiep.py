"""Phát tiếp phiên MÔ PHỎNG đang live (T1, 19/10/2026; sửa theo lần duyệt độc lập, T1b).

Vì sao có tệp này
-----------------
``POST /demo/seed`` sinh "Phiên đang phát (mô phỏng)" bằng cách chạy bộ mô phỏng
cho CẢ phiên rồi chỉ ghi phần đã "trôi qua" (mặc định 45 phút đầu của phiên 90
phút) và để phiên ở trạng thái ``live``. Sau lúc gieo không ai ghi gì thêm, nên
bàn thí nghiệm đứng hình: số người xem, Tỷ lệ nhấp và luồng bình luận dừng ở mốc
gieo, trong khi đồng hồ phiên vẫn chạy.

Tác vụ nền ở đây phát nốt phần còn lại theo giờ thật: mỗi ``N`` giây nó chạy lại
ĐÚNG bộ mô phỏng đã sinh phiên (cùng seed, cùng hiệu ứng, cùng lịch đã niêm phong)
và ghi những gì "vừa xảy ra" kể từ lần ghi trước: mốc 30 giây (người xem, nhịp
bình luận, nhịp tim, lượt nhấp), từng lượt nhấp và bình luận lấy từ bộ câu mẫu
:data:`livelift.api.routes.demo.DEMO_COMMENTS`, lọc thông tin cá nhân trước khi
lưu như mọi bình luận khác.

Luật (không thương lượng)
-------------------------
* **Chỉ phiên máy chủ tự gieo, và chỉ khi đã gieo xong.** :func:`la_phien_phat_tiep`
  đòi dấu ``design["gieo_xong"]`` (:data:`KHOA_GIEO_XONG`). Máy gieo
  ``routes/demo.py::_seed_one_session`` ghi dấu này ở bước CUỐI CÙNG khi gieo phiên
  đang phát, sau mọi mốc 30 giây, lượt nhấp, bình luận và lần ghim. Thấy dấu nghĩa
  là phần đã trôi đã nằm đủ trong kho, nên không lượt nào chen được vào giữa lúc
  gieo. (Lỗi ĐỎ của lần duyệt: một lượt rơi vào giữa ``start_session`` và lúc máy
  gieo ghi xong thì ghi lại cả nửa đầu phiên, nhân đôi lượt nhấp và bình luận.)
  Không yêu cầu nào từ ngoài đặt được dấu này: ``POST /sessions`` luôn lưu
  ``design=None`` và ``POST /sessions/{id}/schedule`` thay cả ``design`` bằng bản
  máy chủ tính. Ngoài dấu vẫn đòi ``is_demo``, không ``dry_run``, đang ``live`` và
  không phải phân tích video quan sát. Không dựa vào tên phiên hay ``host_id`` vì
  client gửi được cả hai. Phiên THẬT, phiên THỬ NỘI BỘ và phiên giám khảo tự tạo
  (DÀN DỰNG · CHƯA XÁC MINH, D-023) không bao giờ mang dấu này.
* **Đúng tham số của lần gieo.** Dấu mang hiệu ứng và seed mà máy gieo đã đưa vào
  bộ mô phỏng. Nút "Tạo phiên mẫu đang phát" trên mặt tiền gửi ``effect=0.5``, còn
  ``scripts/gieo_demo_db.py`` để mặc định 0,15; đọc từ dấu thì phần phát tiếp trùng
  khít phần đã gieo ở cả hai đường, không có bậc tụt Tỷ lệ nhấp ở khối BẬT.
* **Không đổi lịch.** Tệp này chỉ ĐỌC khối; lượt nhấp tuân theo khối BẬT/TẮT vì
  bộ mô phỏng nhân xác suất nhấp với ``1 + hiệu ứng`` đúng trong khối BẬT của lịch
  dựng lại từ kho (:func:`livelift.api.service.rebuild_schedule`). Ghim vẫn do bộ
  thực thi tự động (:mod:`livelift.api.autopilot`) làm, qua đường sản xuất.
* **Dừng khi phiên kết thúc.** Hết thời lượng dự kiến thì thôi ghi; phiên chuyển
  ``ended``/``cancelled`` thì không còn hợp lệ. Tắt máy chủ thì
  :func:`dung_phat_tiep` huỷ vòng lặp VÀ chờ lượt đang chạy trong luồng phụ dừng
  hẳn, nên không có lần ghi nào sau khi kho đóng.
* **Không chạy chồng lượt.** Mỗi lượt giữ :data:`_KHOA`; lượt sau gặp khoá đang giữ
  thì bỏ lượt, không xếp hàng. Mọi lần đọc/ghi mốc trong tiến trình đều trong khoá.
* **Mặc định TẮT.** Chỉ chạy khi ``LIVELIFT_DEMO_PHAT_TIEP=1`` (đọc từ biến môi
  trường của tiến trình, giống ``LIVELIFT_AUTOPILOT``; dòng trong ``.env`` không tự
  vào đây vì ``config.Settings`` bỏ qua khoá lạ).

Không nhân đôi
--------------
Bộ mô phỏng tất định, nên "đã phát tới đâu" suy ra được. Lượt nhấp và bình luận
chỉ được ghi SAU cả ba mốc:

1. giây mà máy gieo đã ghi tới (``den_s`` trong dấu);
2. sự kiện muộn nhất đã lưu (lượt nhấp hay bình luận);
3. cuối mốc 30 giây muộn nhất đã có trong kho.

Mốc 3 áp ở MỌI lượt, không chỉ lần đầu thấy phiên: khoảng đã có tick là khoảng đã
có số trên bàn (do máy gieo hay lượt trước ghi), và tệp này không bao giờ ghi thêm
sự kiện vào đó. Mốc tick mới chỉ ghi sau tick muộn nhất đã có. Phần đã ghi tới đâu
được nhớ trong tiến trình để khỏi quét lại kho mỗi lượt; khởi động lại thì tính
lại từ kho. Thêm hai khoá idempotency cho trường hợp hai tiến trình cùng ghi một
kho PostgreSQL: bình luận mang ``platform="sim"`` + ``ext_id="phat-tiep-<số>"``
(kho bỏ bản trùng), lượt nhấp mang ``click_id`` UUID5 tất định (bản trùng vấp khoá
chính và bị bỏ qua). Mốc 30 giây ghi bằng upsert nên ghi lại vô hại.

Biến môi trường
---------------
===================================  =========  ================================
``LIVELIFT_DEMO_PHAT_TIEP``          (trống)    ``1``/``true``/``yes``/``on`` bật.
``LIVELIFT_DEMO_PHAT_TIEP_GIAY``     ``5``      Số giây giữa hai lượt.
===================================  =========  ================================

Nối vào máy chủ (``api/main.py``, trong ``lifespan`` của ``create_app``)::

    app.state.phat_tiep_task = phat_tiep.bat_phat_tiep(app.state.store)
    ...
    await phat_tiep.dung_phat_tiep(app.state.phat_tiep_task)  # trước store.close()

Giới hạn đã biết: một tiến trình. Hai tiến trình cùng bật trên một kho thì khoá
idempotency ở trên chặn bản trùng, nhưng mỗi tiến trình vẫn tự chạy lượt của mình.
Quy tắc triển khai giống bộ thực thi tự động: chỉ bật trên một tiến trình.
"""

from __future__ import annotations

import asyncio
import bisect
import contextlib
import logging
import math
import os
import random
import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, TypeGuard

from livelift.api import service
from livelift.api.store import Store
from livelift.core.features import Event, Tick

logger = logging.getLogger("livelift.phat_tiep")

BIEN_BAT = "LIVELIFT_DEMO_PHAT_TIEP"
BIEN_NHIP = "LIVELIFT_DEMO_PHAT_TIEP_GIAY"

NHIP_MAC_DINH_S = 5.0
"""Giây giữa hai lượt. Bình luận và lượt nhấp hiện gần như theo giờ thật; mốc 30
giây chỉ ghi khi đã trôi hết (giống bộ thu thật gửi tick theo nhịp)."""

MOC_S = 30
"""Độ dài một mốc ``session_tick``, cùng lưới với ``routes/events.py`` (``TICK_S``)."""

BU_TOI_DA_S = 600.0
"""Mỗi lượt ghi bù tối đa chừng này giây dữ liệu cho một phiên. Bật cờ khi phiên
đã chạy lâu (hay máy chủ vừa khởi động lại) thì phần thiếu được ghi dần qua vài
lượt thay vì dồn hàng nghìn dòng vào một lượt."""

CHO_DUNG_S = 10.0
"""Lúc tắt máy chủ, chờ lượt đang chạy trong luồng phụ dừng tối đa chừng này giây."""

KHOA_GIEO_XONG = "gieo_xong"
"""Khoá trong ``live_session.design`` đánh dấu phiên đang phát do MÁY CHỦ tự gieo,
đã gieo xong. Giá trị ``{"hieu_ung": float, "seed": int, "den_s": float}``: hiệu
ứng và seed đã đưa vào ``simulate_session`` lúc gieo, và giây (tính từ đầu phiên)
mà máy gieo đã ghi sự kiện tới, kể cả giây đó. Chỉ
``routes/demo.py::_seed_one_session`` ghi khoá này, ở bước cuối, khi
``leave_live=True``."""

NEN_TANG_SU_KIEN = "sim"
"""Nhãn nền tảng của bình luận do tệp này sinh, giống ``livelift.ingest.mo_phong``."""

TIEN_TO_EXT = "phat-tiep-"
"""Tiền tố ``ext_id`` của bình luận phát tiếp; khác ``sim-`` của kịch bản mô phỏng
bộ thu nên hai nguồn không bao giờ đụng khoá của nhau."""

_DUNG_SAI_S = 0.001
"""Kho lưu thời điểm tới micro giây; cộng 1 ms vào mốc tính từ kho để sự kiện cuối
đã lưu không bị làm tròn thành "chưa lưu" rồi ghi lại."""

_BAT = frozenset({"1", "true", "yes", "on"})
_TEN_LOI_TRUNG = frozenset({"UniqueViolation", "IntegrityError"})
_NS_NHAP = uuid.UUID("5d0f6f2e-8a51-4c6b-9c7e-1f9b3a2d7e10")
_CACHE_TOI_DA = 16


# ---------------------------------------------------------------------------
# Cấu hình
# ---------------------------------------------------------------------------


def dang_bat() -> bool:
    """Cờ ``LIVELIFT_DEMO_PHAT_TIEP``. Mặc định TẮT (không đặt = tắt)."""
    return os.environ.get(BIEN_BAT, "").strip().lower() in _BAT


def nhip_giay() -> float:
    """Số giây giữa hai lượt; giá trị hỏng hoặc ≤ 0 thì dùng mặc định."""
    raw = os.environ.get(BIEN_NHIP)
    if raw is None:
        return NHIP_MAC_DINH_S
    try:
        value = float(raw)
    except ValueError:
        logger.warning("%s = %r không phải số, dùng %s giây.", BIEN_NHIP, raw, NHIP_MAC_DINH_S)
        return NHIP_MAC_DINH_S
    if value <= 0:
        logger.warning("%s = %r phải > 0, dùng %s giây.", BIEN_NHIP, raw, NHIP_MAC_DINH_S)
        return NHIP_MAC_DINH_S
    return value


# ---------------------------------------------------------------------------
# Phiên nào được ghi
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class DauGieo:
    """Tham số của lần gieo, đọc từ ``design["gieo_xong"]`` (:data:`KHOA_GIEO_XONG`)."""

    hieu_ung: float
    """Hiệu ứng mô phỏng bơm vào khối BẬT (``SimParams.treatment_effect``)."""
    seed: int
    """Seed đã đưa vào ``simulate_session``."""
    den_s: float
    """Máy gieo đã ghi sự kiện tới giây này của phiên (kể cả giây đó)."""


def _la_so_huu_han(x: object) -> TypeGuard[float]:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def doc_dau_gieo(session: dict[str, Any] | None) -> DauGieo | None:
    """Dấu "máy chủ đã gieo xong" của phiên; thiếu hay sai dạng thì ``None``."""
    if not session:
        return None
    design = session.get("design")
    if not isinstance(design, dict):
        return None
    dau = design.get(KHOA_GIEO_XONG)
    if not isinstance(dau, dict):
        return None
    hieu_ung, seed, den_s = dau.get("hieu_ung"), dau.get("seed"), dau.get("den_s")
    if not _la_so_huu_han(hieu_ung):
        return None
    if not _la_so_huu_han(den_s):
        return None
    if not isinstance(seed, int) or isinstance(seed, bool):
        return None
    if float(hieu_ung) <= -1.0:  # xác suất nhấp nhân với (1 + hiệu ứng) phải dương
        return None
    return DauGieo(hieu_ung=float(hieu_ung), seed=seed, den_s=float(den_s))


def la_phien_phat_tiep(session: dict[str, Any] | None) -> TypeGuard[dict[str, Any]]:
    """Phiên này có phải phiên MÔ PHỎNG máy chủ tự gieo, đã gieo xong, đang phát không?

    Đòi ĐỦ mọi điều kiện. Dấu :data:`KHOA_GIEO_XONG` là điều kiện quyết định vì chỉ
    máy gieo phía máy chủ đặt được; ``is_demo`` một mình thì trùng với phiên giám
    khảo tự tạo (DÀN DỰNG · CHƯA XÁC MINH).
    """
    if not session:
        return False
    return (
        session.get("is_demo") is True
        and not session.get("dry_run")
        and session.get("status") == "live"
        and session.get("start_ts") is not None
        and doc_dau_gieo(session) is not None
        and not service.is_analysis_only(session)
    )


# ---------------------------------------------------------------------------
# Bản mô phỏng của một phiên (tất định, đệm trong tiến trình)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _BanMoPhong:
    seed: int
    thoi_luong_s: int
    su_kien: tuple[Event, ...]
    """Lượt nhấp và bình luận, theo thời điểm tăng dần."""
    moc: tuple[float, ...]
    """``ts_offset_s`` của ``su_kien``, để tìm khoảng bằng bisect."""
    thu_tu: tuple[int, ...]
    """Số thứ tự của từng sự kiện TRONG LOẠI của nó (gốc của khoá idempotency)."""
    tick: dict[int, Tick]
    """Mốc 30 giây theo ``bucket_start_s``."""


_DEM: OrderedDict[tuple[Any, ...], _BanMoPhong] = OrderedDict()
_DEM_KHOA = threading.Lock()


def _ban_mo_phong(
    session: dict[str, Any], blocks: list[dict[str, Any]], dau: DauGieo
) -> _BanMoPhong:
    """Chạy lại bộ mô phỏng của phiên với ĐÚNG seed và hiệu ứng của lần gieo.

    ``routes/demo.py`` gieo phiên đang phát bằng ``simulate_session(lịch, hiệu ứng,
    seed)`` trên lịch đã niêm phong và ghi hai tham số ấy vào dấu gieo, nên chạy
    lại ở đây ra đúng chuỗi sự kiện ấy, kể cả phần chưa ghi."""
    from livelift.core.features import build_ticks
    from livelift.sim.simulator import SimParams, simulate_session

    schedule = service.rebuild_schedule(session, blocks)
    khoa = (
        str(session["session_id"]),
        dau.seed,
        schedule.session_duration_min,
        tuple(
            (b.index, b.assignment, b.start_offset_s, b.end_offset_s, b.is_washout)
            for b in schedule.blocks
        ),
        dau.hieu_ung,
    )
    with _DEM_KHOA:
        ban = _DEM.get(khoa)
        if ban is not None:
            _DEM.move_to_end(khoa)
            return ban

    thoi_luong_s = schedule.session_duration_min * 60
    out = simulate_session(schedule, SimParams(treatment_effect=dau.hieu_ung), dau.seed)
    su_kien = sorted(
        (e for e in out.events if e.kind in ("click", "comment")), key=lambda e: e.ts_offset_s
    )
    dem: dict[str, int] = {"click": 0, "comment": 0}
    thu_tu: list[int] = []
    for e in su_kien:
        thu_tu.append(dem[e.kind])
        dem[e.kind] += 1
    ban = _BanMoPhong(
        seed=dau.seed,
        thoi_luong_s=thoi_luong_s,
        su_kien=tuple(su_kien),
        moc=tuple(e.ts_offset_s for e in su_kien),
        thu_tu=tuple(thu_tu),
        tick={t.bucket_start_s: t for t in build_ticks(out.events, thoi_luong_s, MOC_S)},
    )
    with _DEM_KHOA:
        _DEM[khoa] = ban
        while len(_DEM) > _CACHE_TOI_DA:
            _DEM.popitem(last=False)
    return ban


# ---------------------------------------------------------------------------
# Mốc "đã phát tới đâu"
# ---------------------------------------------------------------------------

_MOC: dict[str, float] = {}
"""session_id → giây (tính từ đầu phiên) mà sự kiện đã được ghi tới. Chỉ đọc/ghi
khi giữ :data:`_KHOA`."""

_DA_BAO_HET: set[str] = set()
"""Phiên đã ghi log "phát hết". Chỉ đọc/ghi khi giữ :data:`_KHOA`."""

_KHOA = threading.Lock()
"""Một lượt tại một thời điểm, cho mọi kho trong tiến trình."""


def dat_lai() -> None:
    """Quên mốc và bản đệm (test; giống tiến trình vừa khởi động lại)."""
    with _KHOA:
        _MOC.clear()
        _DA_BAO_HET.clear()
    with _DEM_KHOA:
        _DEM.clear()


def _giay_tu_dau(start: datetime, ts: datetime) -> float:
    return (ts - start).total_seconds()


def _truoc(giay: float) -> float:
    """Số thực liền trước ``giay``. Làm sàn cho ``bisect_right`` thì sự kiện ở ĐÚNG
    ``giay`` (đầu mốc 30 giây chưa có tick) vẫn được ghi."""
    return math.nextafter(float(giay), -math.inf)


def _moc_tick_cuoi(start: datetime, ticks: list[dict[str, Any]]) -> int | None:
    if not ticks:
        return None
    giay = max(_giay_tu_dau(start, t["ts_bucket"]) for t in ticks)
    return round(giay / MOC_S) * MOC_S


def _moc_tu_kho(store: Store, session_id: str, start: datetime) -> float:
    """Sự kiện muộn nhất đã lưu (lượt nhấp hoặc bình luận), dùng khi tiến trình chưa
    nhớ gì về phiên (lần đầu thấy, vừa khởi động lại). Chưa có gì thì ``-1`` để sự
    kiện ở đúng giây 0 vẫn được ghi. Sàn theo dấu gieo và theo tick áp sau, ở
    :func:`_buoc_phien`."""
    thoi_diem = [
        _giay_tu_dau(start, row["ts"])
        for rows in (store.list_clicks(session_id), store.list_comments(session_id))
        for row in rows
        if row.get("ts") is not None
    ]
    return max(thoi_diem) + _DUNG_SAI_S if thoi_diem else -1.0


# ---------------------------------------------------------------------------
# Một lượt
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class KetQuaLuot:
    """Một lượt đã ghi gì vào một phiên."""

    session_id: str
    tu_s: float
    den_s: float
    so_moc: int
    so_nhap: int
    so_binh_luan: int
    het_phien: bool


def _la_loi_trung(exc: BaseException) -> bool:
    return any(cls.__name__ in _TEN_LOI_TRUNG for cls in type(exc).__mro__)


def _la_kho_chet(exc: BaseException) -> bool:
    from livelift.api.routes.events import is_storage_outage

    return is_storage_outage(exc)


def _ghi_nhap(
    store: Store,
    sid: str,
    start: datetime,
    blocks: list[dict[str, Any]],
    ev: Event,
    stt: int,
    seed: int,
    san_pham: list[str],
) -> bool:
    chon = random.Random(f"{seed}:nhap:{stt}")
    block = service.block_at_offset(blocks, ev.ts_offset_s)
    product_id = chon.choice(san_pham) if san_pham else None
    row: dict[str, Any] = {
        "click_id": str(uuid.uuid5(_NS_NHAP, f"{sid}:{stt}")),
        "block_id": block["block_id"] if block else None,
        "ts": start + timedelta(seconds=ev.ts_offset_s),
        "product_id": product_id,
        "shortlink_code": None,
        "dedup_hash": None,
        "is_valid": True,
        "invalid_reason": None,
        "ua_class": None,
    }
    try:
        store.add_click(sid, row)
    except Exception as exc:
        if _la_loi_trung(exc):  # tiến trình khác đã ghi đúng lượt này
            return False
        raise
    store.publish(sid, {"type": "click", "data": {"product_id": product_id, "is_valid": True}})
    return True


def _ghi_binh_luan(
    store: Store,
    sid: str,
    start: datetime,
    blocks: list[dict[str, Any]],
    ev: Event,
    stt: int,
    seed: int,
) -> bool:
    from livelift.api.routes.demo import DEMO_COMMENTS
    from livelift.api.schemas import CommentOut
    from livelift.ingest.pii import scrub
    from livelift.nlp.intent import classify_with_confidence

    text = random.Random(f"{seed}:binh-luan:{stt}").choice(DEMO_COMMENTS)
    loc = scrub(text)  # lọc trước khi lưu, như mọi đường ghi bình luận khác
    intent, confidence = classify_with_confidence(loc.text)
    block = service.block_at_offset(blocks, ev.ts_offset_s)
    row: dict[str, Any] = {
        "comment_id": service.new_id(),
        "session_id": sid,
        "block_id": block["block_id"] if block else None,
        "ts": start + timedelta(seconds=ev.ts_offset_s),
        "platform": NEN_TANG_SU_KIEN,
        "ext_id": f"{TIEN_TO_EXT}{stt:05d}",
        "text_scrubbed": loc.text,
        "pii_kinds": sorted({m.kind for m in loc.matches}),
        "intent_label": intent,
        "intent_confidence": confidence,
        "sentiment": None,
    }
    stored = store.add_comment(sid, row)
    if stored["comment_id"] != row["comment_id"]:  # bản trùng: kho trả dòng cũ
        return False
    out = CommentOut(
        comment_id=stored["comment_id"],
        session_id=sid,
        block_id=stored.get("block_id"),
        ts=stored["ts"],
        text=stored["text_scrubbed"],
        pii_kinds=list(stored.get("pii_kinds") or []),
        intent=stored.get("intent_label"),
        intent_confidence=stored.get("intent_confidence"),
    )
    store.publish(sid, {"type": "comment", "data": out.model_dump(mode="json")})
    return True


def _ghi_moc(
    store: Store,
    sid: str,
    start: datetime,
    ban: _BanMoPhong,
    tu_moc: int,
    den_s: float,
) -> int:
    """Ghi các mốc 30 giây đã TRÔI HẾT trong ``[tu_moc, den_s]``."""
    from livelift.api.schemas import TickOut

    cuoi = int(den_s // MOC_S) * MOC_S  # mốc b ghi được khi b + 30 ≤ den_s
    can_ghi = [b for b in range(max(tu_moc, 0), cuoi, MOC_S) if b in ban.tick]
    if not can_ghi:
        return 0
    ghim = store.list_interventions(sid)
    so = 0
    for b in can_ghi:
        t = ban.tick[b]
        ts_bucket = start + timedelta(seconds=b)
        het_moc = ts_bucket + timedelta(seconds=MOC_S)
        pinned = service.current_pinned_product_id(
            [i for i in ghim if i.get("ts") is None or i["ts"] <= het_moc]
        )
        row: dict[str, Any] = {
            "ts_bucket": ts_bucket,
            "viewers": t.viewers,
            "comment_rate": t.comment_count * 60.0 / MOC_S,
            "like_rate": t.like_count * 60.0 / MOC_S,
            "click_count": t.click_count,
            "pinned_product_id": pinned,
        }
        store.add_tick(sid, row)
        out = TickOut(session_id=sid, **row)
        store.publish(sid, {"type": "tick", "data": out.model_dump(mode="json")})
        so += 1
    return so


def _buoc_phien(
    store: Store,
    session: dict[str, Any],
    dau: DauGieo,
    now: datetime,
    *,
    dung: threading.Event | None = None,
) -> KetQuaLuot | None:
    """Ghi phần mô phỏng "vừa xảy ra" của MỘT phiên, tới ``now``.

    CHỈ gọi khi đã giữ :data:`_KHOA` (đọc và ghi :data:`_MOC`, :data:`_DA_BAO_HET`);
    :func:`buoc_tat_ca` là nơi duy nhất gọi, sau khi lọc bằng
    :func:`la_phien_phat_tiep`. ``now`` truyền vào (không đọc đồng hồ ở đây) để test
    đi qua nhiều khối mà không phải ngủ.
    """
    assert _KHOA.locked(), "_buoc_phien phải chạy trong lúc giữ _KHOA"
    from livelift.api.routes.demo import DEMO_PRODUCTS

    sid = str(session["session_id"])
    start: datetime = session["start_ts"]
    blocks = store.get_blocks(sid)
    if not blocks:
        return None
    ban = _ban_mo_phong(session, blocks, dau)
    het_s = min(service.elapsed_seconds(session, now), float(ban.thoi_luong_s))

    tick_cuoi = _moc_tick_cuoi(start, store.list_ticks(sid))
    # Sàn của lượt, áp ở MỌI lượt: không ghi lại phần máy gieo đã ghi (den_s của
    # dấu), và không ghi sự kiện vào khoảng đã có tick (khoảng ấy đã có số trên bàn).
    san = dau.den_s
    if tick_cuoi is not None:
        san = max(san, _truoc(tick_cuoi + MOC_S))
    da_ghi = _MOC.get(sid)
    if da_ghi is None:
        da_ghi = _moc_tu_kho(store, sid, start)
        logger.info(
            "Phát tiếp phiên mô phỏng %s từ giây %.0f của phiên, hiệu ứng mô phỏng %+.0f%% "
            "(lịch giữ nguyên).",
            sid,
            max(da_ghi, san, 0.0),
            dau.hieu_ung * 100,
        )
    tu_s = max(da_ghi, san)
    den_s = max(tu_s, min(het_s, max(tu_s, 0.0) + BU_TOI_DA_S))

    i0 = bisect.bisect_right(ban.moc, tu_s)
    i1 = bisect.bisect_right(ban.moc, den_s)
    san_pham: list[str] = [
        str(p["product_id"])
        for p in DEMO_PRODUCTS
        if store.get_product(str(p["product_id"])) is not None
    ]
    so_nhap = so_binh_luan = 0
    da_ghi_den = tu_s
    bi_dung = False
    try:
        for j in range(i0, i1):
            if dung is not None and dung.is_set():
                bi_dung = True
                break
            ev = ban.su_kien[j]
            if ev.kind == "click":
                so_nhap += _ghi_nhap(
                    store, sid, start, blocks, ev, ban.thu_tu[j], ban.seed, san_pham
                )
            else:
                so_binh_luan += _ghi_binh_luan(
                    store, sid, start, blocks, ev, ban.thu_tu[j], ban.seed
                )
            da_ghi_den = ev.ts_offset_s
        else:
            da_ghi_den = den_s
    finally:
        # Lỗi hay bị dừng giữa chừng: nhớ đúng tới sự kiện cuối ĐÃ ghi, lượt sau
        # ghi tiếp từ đó, không nhân đôi và không bỏ sót.
        _MOC[sid] = max(tu_s, da_ghi_den)

    so_moc = 0
    if not bi_dung:
        tu_moc = (tick_cuoi + MOC_S) if tick_cuoi is not None else 0
        so_moc = _ghi_moc(store, sid, start, ban, tu_moc, den_s)

    het_phien = den_s >= ban.thoi_luong_s
    if het_phien and sid not in _DA_BAO_HET:
        _DA_BAO_HET.add(sid)
        logger.info(
            "Phiên mô phỏng %s đã phát hết %d phút dự kiến; thôi ghi thêm.",
            sid,
            ban.thoi_luong_s // 60,
        )
    if so_moc or so_nhap or so_binh_luan:
        logger.debug(
            "Phát tiếp %s: giây %.0f→%.0f, +%d mốc, +%d lượt nhấp, +%d bình luận.",
            sid,
            max(tu_s, 0.0),
            den_s,
            so_moc,
            so_nhap,
            so_binh_luan,
        )
    return KetQuaLuot(
        session_id=sid,
        tu_s=max(tu_s, 0.0),
        den_s=den_s,
        so_moc=so_moc,
        so_nhap=so_nhap,
        so_binh_luan=so_binh_luan,
        het_phien=het_phien,
    )


def _bao_kho_chet(exc: BaseException) -> None:
    logger.warning(
        "Phát tiếp mô phỏng tạm dừng: kho dữ liệu không phản hồi (%s). Lượt sau thử lại.",
        type(exc).__name__,
    )


def buoc_tat_ca(
    store: Store,
    now: datetime | None = None,
    *,
    dung: threading.Event | None = None,
) -> list[KetQuaLuot]:
    """Một lượt qua mọi phiên mô phỏng đang phát. Lượt trước chưa xong thì bỏ lượt.

    Kho chết (kể cả lúc liệt kê phiên) thì dừng lượt, ghi một dòng cảnh báo, lượt
    sau thử lại. Lỗi khác ở một phiên được ghi log và không chặn phiên còn lại.
    """
    if not _KHOA.acquire(blocking=False):
        logger.info("Phát tiếp mô phỏng: lượt trước chưa xong, bỏ lượt này.")
        return []
    try:
        moment = now if now is not None else service.now_utc()
        try:
            phien = store.list_sessions()
        except Exception as exc:
            if _la_kho_chet(exc):
                _bao_kho_chet(exc)
                return []
            raise
        ket_qua: list[KetQuaLuot] = []
        con_phat: set[str] = set()
        tron_luot = True
        for s in phien:
            if dung is not None and dung.is_set():
                tron_luot = False
                break
            if not la_phien_phat_tiep(s):
                continue
            sid = str(s["session_id"])
            try:
                moi = store.get_session(sid)  # đọc lại ngay trước khi ghi
                if not la_phien_phat_tiep(moi):
                    continue
                dau = doc_dau_gieo(moi)
                if dau is None:  # la_phien_phat_tiep đã đòi dấu; giữ cho kiểu chặt
                    continue
                con_phat.add(sid)
                kq = _buoc_phien(store, moi, dau, moment, dung=dung)
            except Exception as exc:
                if _la_kho_chet(exc):
                    _bao_kho_chet(exc)
                    return ket_qua
                logger.exception("Phát tiếp mô phỏng lỗi ở phiên %s; bỏ qua phiên này.", sid)
                tron_luot = False
                continue
            if kq is not None:
                ket_qua.append(kq)
        if tron_luot:
            # Phiên đã kết thúc (hay bị xoá) thì quên mốc của nó.
            for sid in [k for k in _MOC if k not in con_phat]:
                _MOC.pop(sid, None)
            _DA_BAO_HET.intersection_update(con_phat)
        return ket_qua
    finally:
        _KHOA.release()


# ---------------------------------------------------------------------------
# Tác vụ nền
# ---------------------------------------------------------------------------


async def chay_mai(store: Store, nhip_s: float | None = None) -> None:
    """Vòng lặp nền: ngủ ``nhip_s`` giây rồi chạy một lượt trong luồng phụ.

    Bị huỷ giữa lượt thì báo lượt đó dừng (``threading.Event``) và chờ nó trả
    luồng, để :func:`dung_phat_tiep` trả về chỉ khi không còn lần ghi nào.
    """
    interval = nhip_giay() if nhip_s is None else nhip_s
    dung = threading.Event()
    logger.info("Phát tiếp phiên mô phỏng đã bật, mỗi %.1f giây một lượt.", interval)
    try:
        while True:
            # Ngủ TRƯỚC lượt đầu, cùng lý do với autopilot: tiến trình nào dựng
            # ứng dụng (kể cả TestClient) cũng không bị ghi chen ngay lúc khởi động.
            await asyncio.sleep(interval)
            luot = asyncio.ensure_future(asyncio.to_thread(buoc_tat_ca, store, dung=dung))
            try:
                await asyncio.shield(luot)
            except asyncio.CancelledError:
                dung.set()
                await asyncio.wait({luot}, timeout=CHO_DUNG_S)
                if luot.done() and not luot.cancelled():
                    luot.exception()  # đã xử lý, khỏi cảnh báo "never retrieved"
                raise
            except Exception:
                logger.exception("Lượt phát tiếp mô phỏng lỗi; vẫn chạy tiếp.")
    except asyncio.CancelledError:
        dung.set()
        logger.info("Phát tiếp phiên mô phỏng đã dừng.")
        raise


def bat_phat_tiep(store: Store) -> asyncio.Task[None] | None:
    """Bật vòng lặp nền nếu ``LIVELIFT_DEMO_PHAT_TIEP=1``; tắt thì trả ``None``.

    Gọi trong ``lifespan`` (cần vòng lặp sự kiện đang chạy).
    """
    if not dang_bat():
        logger.info(
            "Phát tiếp phiên mô phỏng đang TẮT (đặt %s=1 để phiên mẫu đang phát không đứng hình).",
            BIEN_BAT,
        )
        return None
    return asyncio.create_task(chay_mai(store), name="livelift-phat-tiep")


async def dung_phat_tiep(task: asyncio.Task[None] | None) -> None:
    """Dừng vòng lặp và chờ lượt đang chạy xong. ``None`` thì không làm gì."""
    if task is None:
        return
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task

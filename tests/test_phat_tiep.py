"""Cổng T1 (19/10/2026; sửa theo lần duyệt độc lập, T1b): phiên mô phỏng đang phát
không còn đứng hình sau mốc gieo.

``POST /demo/seed`` chỉ ghi phần đã "trôi qua" của phiên đang phát; trước T1 bàn
thí nghiệm đứng hình sau đó. Các cổng ở đây khoá:

* chỉ phát tiếp phiên MÁY CHỦ tự gieo và đã gieo xong (dấu ``design["gieo_xong"]``,
  không yêu cầu ngoài nào đặt được), từ đúng mốc dữ liệu cũ, liền lưới 30 giây;
* chạy song song với máy gieo không nhân đôi; không ghi sự kiện vào khoảng đã có tick;
* dùng đúng hiệu ứng và seed của lần gieo (mặt tiền gửi 0,5; kịch bản để 0,15);
* KHÔNG BAO GIỜ chạm phiên THẬT, THỬ NỘI BỘ (``dry_run``) hay phiên giám khảo tự tạo;
* lượt nhấp theo khối BẬT/TẮT của lịch đã niêm phong, lịch không đổi;
* gọi lại / khởi động lại không nhân đôi; hết phiên thì thôi;
* không chạy chồng lượt; kho chết thì dừng lượt; vòng nền và lifespan dừng sạch.

Thời gian đi bằng tham số ``now``, không ngủ (trừ test chạy đua và vòng nền).
"""

from __future__ import annotations

import asyncio
import logging
import random
import threading
import time
from datetime import timedelta

import pytest

from livelift.api import phat_tiep, service
from livelift.api.routes import demo
from livelift.api.store import InMemoryStore, StoreUnavailableError
from livelift.core.assigner import DesignParams
from livelift.core.features import build_ticks
from livelift.sim.simulator import SimParams, simulate_session

HIEU_UNG = 0.15
"""Mặc định của ``DemoSeedRequest.effect`` (đường ``scripts/gieo_demo_db.py``)."""

HIEU_UNG_MAT_TIEN = 0.5
"""Hiệu ứng nút "Tạo phiên mẫu đang phát" của mặt tiền gửi (``next/.../client.ts``)."""


@pytest.fixture(autouse=True)
def _sach(monkeypatch):
    monkeypatch.delenv(phat_tiep.BIEN_BAT, raising=False)
    monkeypatch.delenv(phat_tiep.BIEN_NHIP, raising=False)
    phat_tiep.dat_lai()
    yield
    phat_tiep.dat_lai()


@pytest.fixture
def store():
    return InMemoryStore()


def _gieo_phien_dang_phat(store, phut=30, da_phat_phut=15, hieu_ung=HIEU_UNG):
    """Đúng đường ``/demo/seed`` sinh "Phiên đang phát (mô phỏng)"."""
    demo._seed_products_and_links(store)
    return demo._seed_one_session(
        store,
        random.Random(4242),
        duration_min=phut,
        effect=hieu_ung,
        seed=999,
        start_offset_ago_min=da_phat_phut,
        leave_live=True,
        title=f"{demo.TIEN_TO_PHIEN_DANG_PHAT} · gieo test",
    )


def _dat_dau(store, sid, *, hieu_ung=HIEU_UNG, seed=999, den_s=-1.0):
    """Đặt dấu gieo như máy gieo đặt (phiên dựng tay, CHƯA có dữ liệu: den_s=-1)."""
    design = dict(store.get_session(sid)["design"] or {})
    design[phat_tiep.KHOA_GIEO_XONG] = {"hieu_ung": hieu_ung, "seed": seed, "den_s": den_s}
    store.update_session(sid, {"design": design})


def _tao_phien(
    store,
    *,
    is_demo=True,
    dry_run=False,
    platform="replay",
    host_id="demo",
    title=None,
    phut=30,
    da_phat_s=900,
    seed=999,
    dau=True,
    hieu_ung=HIEU_UNG,
):
    """Một phiên đang phát CHƯA có dữ liệu, cờ tuỳ chọn (để dựng phiên giống hệt).

    ``dau=True``: mang dấu gieo như phiên máy chủ tự gieo; ``False``: thiếu dấu, như
    phiên ai đó tạo qua ``POST /sessions``."""
    for p in demo.DEMO_PRODUCTS:
        store.create_product({**p, "created_at": service.now_utc()})
    now = service.now_utc()
    s = store.create_session(
        {
            "session_id": service.new_id(),
            "platform": platform,
            "title": title or f"{demo.TIEN_TO_PHIEN_DANG_PHAT} · dựng tay",
            "mode": "auto",
            "status": "planned",
            "planned_duration_min": phut,
            "host_id": host_id,
            "start_ts": None,
            "end_ts": None,
            "design": None,
            "created_at": now,
            "is_demo": is_demo,
            "dry_run": dry_run,
        }
    )
    s, _ = service.schedule_session(store, s, DesignParams(jitter_s=0), seed)
    service.start_session(store, s, now - timedelta(seconds=da_phat_s))
    if dau:
        _dat_dau(store, s["session_id"], hieu_ung=hieu_ung, seed=seed)
    return s["session_id"]


def _dem(store, sid):
    return (len(store.list_ticks(sid)), len(store.list_clicks(sid)), len(store.list_comments(sid)))


def _giay(store, sid, ts):
    return (ts - store.get_session(sid)["start_ts"]).total_seconds()


def _chay_toi_khi_dung(store, now, **kw):
    """Gọi lượt tới khi không còn gì để ghi (mỗi lượt bù tối đa BU_TOI_DA_S giây)."""
    for _ in range(100):
        kq = phat_tiep.buoc_tat_ca(store, now=now, **kw)
        if not any(k.so_moc or k.so_nhap or k.so_binh_luan for k in kq):
            return
    raise AssertionError("phát tiếp không dừng sau 100 lượt")


def _mo_phong(store, sid, hieu_ung, seed=999):
    session = store.get_session(sid)
    schedule = service.rebuild_schedule(session, store.get_blocks(sid))
    return simulate_session(schedule, SimParams(treatment_effect=hieu_ung), seed)


def _cuoi_tick_gieo(den_s):
    """Máy gieo ghi tick có ``bucket_start_s ≤ den_s``; trả cuối mốc muộn nhất ấy."""
    return int(den_s // 30) * 30 + 30


# ---------------------------------------------------------------------------
# 1. Cờ: mặc định TẮT
# ---------------------------------------------------------------------------


def test_mac_dinh_tat_va_chi_bat_khi_dat_co(store, monkeypatch):
    assert phat_tiep.dang_bat() is False
    assert phat_tiep.bat_phat_tiep(store) is None
    for tat in ("0", "false", "no", "off", "", "bat"):
        monkeypatch.setenv(phat_tiep.BIEN_BAT, tat)
        assert phat_tiep.dang_bat() is False, tat
        assert phat_tiep.bat_phat_tiep(store) is None
    for bat in ("1", "true", "YES", " on "):
        monkeypatch.setenv(phat_tiep.BIEN_BAT, bat)
        assert phat_tiep.dang_bat() is True, bat


def test_bat_co_thi_tao_tac_vu_va_dung_sach(store, monkeypatch):
    monkeypatch.setenv(phat_tiep.BIEN_BAT, "1")

    async def chay():
        task = phat_tiep.bat_phat_tiep(store)
        assert isinstance(task, asyncio.Task)
        await phat_tiep.dung_phat_tiep(task)
        assert task.done()
        await phat_tiep.dung_phat_tiep(None)  # tắt cờ thì lifespan truyền None

    asyncio.run(chay())


def test_nhip_hong_thi_dung_mac_dinh(monkeypatch):
    assert phat_tiep.nhip_giay() == phat_tiep.NHIP_MAC_DINH_S
    monkeypatch.setenv(phat_tiep.BIEN_NHIP, "không-phải-số")
    assert phat_tiep.nhip_giay() == phat_tiep.NHIP_MAC_DINH_S
    monkeypatch.setenv(phat_tiep.BIEN_NHIP, "-2")
    assert phat_tiep.nhip_giay() == phat_tiep.NHIP_MAC_DINH_S
    monkeypatch.setenv(phat_tiep.BIEN_NHIP, "2.5")
    assert phat_tiep.nhip_giay() == 2.5


# ---------------------------------------------------------------------------
# 2. Dấu gieo: chỉ máy chủ đặt, đặt sau cùng, mang đúng tham số
# ---------------------------------------------------------------------------


def test_may_gieo_dat_dau_voi_dung_hieu_ung_seed_va_moc(store):
    sid = _gieo_phien_dang_phat(store, phut=30, da_phat_phut=15, hieu_ung=HIEU_UNG_MAT_TIEN)
    dau = phat_tiep.doc_dau_gieo(store.get_session(sid))
    assert dau == phat_tiep.DauGieo(hieu_ung=HIEU_UNG_MAT_TIEN, seed=999, den_s=15 * 60.0)
    # Dấu không đụng gì khác của thiết kế: lịch, seed lịch, mã băm vẫn như lúc bốc thăm.
    design = store.get_session(sid)["design"]
    assert design["seed"] == 999
    assert design["design_hash"]
    assert design["blocks"]

    # Phiên đã kết thúc do máy gieo sinh (``leave_live=False``) không mang dấu.
    xong = demo._seed_one_session(
        store,
        random.Random(1),
        duration_min=30,
        effect=HIEU_UNG,
        seed=1000,
        start_offset_ago_min=120,
    )
    assert phat_tiep.KHOA_GIEO_XONG not in store.get_session(xong)["design"]


def test_dau_hong_thi_khong_phat_tiep(store):
    sid = _tao_phien(store)
    assert phat_tiep.la_phien_phat_tiep(store.get_session(sid))
    goc = store.get_session(sid)["design"]
    hong = [
        None,
        "có",
        {},
        {"hieu_ung": 0.15, "seed": 999},  # thiếu den_s
        {"hieu_ung": "0.15", "seed": 999, "den_s": 0.0},
        {"hieu_ung": float("nan"), "seed": 999, "den_s": 0.0},
        {"hieu_ung": -1.0, "seed": 999, "den_s": 0.0},
        {"hieu_ung": 0.15, "seed": True, "den_s": 0.0},
        {"hieu_ung": 0.15, "seed": 999.5, "den_s": 0.0},
        {"hieu_ung": True, "seed": 999, "den_s": 0.0},
        {"hieu_ung": 0.15, "seed": 999, "den_s": float("inf")},
    ]
    for gia_tri in hong:
        store.update_session(sid, {"design": {**goc, phat_tiep.KHOA_GIEO_XONG: gia_tri}})
        assert phat_tiep.doc_dau_gieo(store.get_session(sid)) is None, gia_tri
        assert not phat_tiep.la_phien_phat_tiep(store.get_session(sid)), gia_tri
    phat_tiep.buoc_tat_ca(store, now=service.now_utc() + timedelta(minutes=10))
    assert _dem(store, sid) == (0, 0, 0)


def test_khach_gia_du_ten_host_nen_tang_qua_api_van_khong_duoc_phat_tiep(store, monkeypatch):
    """Lỗi VÀNG của lần duyệt: điều kiện cũ (tên, host_id) client gửi được.

    Ở chế độ trưng bày công khai, khách không token tạo phiên ``is_demo`` với ĐÚNG
    tên, host_id và nền tảng của phiên máy gieo, gửi kèm cả một ``design`` có dấu
    gieo, rồi bốc lịch và phát. Máy chủ không lưu dấu ấy, nên không phát tiếp.
    """
    from fastapi.testclient import TestClient

    from livelift.api.main import create_app
    from livelift.config import get_settings

    monkeypatch.setenv("INGEST_TOKEN", "token-kiem-thu-phat-tiep-0123456789")
    get_settings.cache_clear()
    try:
        app = create_app(store=store)
        with TestClient(app) as client:
            dau_gia = {"hieu_ung": 0.15, "seed": 999, "den_s": -1.0}
            r = client.post(
                "/sessions",
                json={
                    "platform": "replay",
                    "title": f"{demo.TIEN_TO_PHIEN_DANG_PHAT} · gieo 09:00 19/10",
                    "planned_duration_min": 30,
                    "host_id": "demo",
                    "design": {phat_tiep.KHOA_GIEO_XONG: dau_gia},
                    phat_tiep.KHOA_GIEO_XONG: dau_gia,
                },
            )
            assert r.status_code == 200, r.text
            sid = r.json()["session_id"]
            assert client.post(f"/sessions/{sid}/schedule", json={}).status_code == 200
            assert client.post(f"/sessions/{sid}/start").status_code == 200
    finally:
        monkeypatch.delenv("INGEST_TOKEN", raising=False)
        get_settings.cache_clear()

    s = store.get_session(sid)
    # Đủ mọi điều kiện cũ (is_demo, live, replay, host "demo", tên phiên máy gieo)...
    assert s["is_demo"] is True
    assert s["status"] == "live"
    assert s["host_id"] == "demo"
    assert s["title"].startswith(demo.TIEN_TO_PHIEN_DANG_PHAT)
    # ...mà không có dấu, nên không được phát tiếp.
    assert phat_tiep.KHOA_GIEO_XONG not in (s["design"] or {})
    assert not phat_tiep.la_phien_phat_tiep(s)
    phat_tiep.buoc_tat_ca(store, now=service.now_utc() + timedelta(minutes=10))
    assert _dem(store, sid) == (0, 0, 0)


# ---------------------------------------------------------------------------
# 3. Chạy song song với máy gieo (lỗi ĐỎ của lần duyệt)
# ---------------------------------------------------------------------------


def test_chay_song_song_voi_may_gieo_khong_nhan_doi(store):
    """Lượt phát tiếp chạy liên tục TRONG LÚC ``/demo/seed`` đang ghi phần đã trôi.

    Trước bản sửa: lượt rơi vào giữa ``start_session`` và lúc máy gieo ghi xong thì
    ghi lại cả nửa đầu phiên (đo được 235 lượt nhấp thay vì 118). ``add_tick`` chậm
    1 ms như một vòng gọi PostgreSQL để cửa sổ đó đủ rộng.
    """
    goc_tick = store.add_tick

    def add_tick_cham(session_id, row):
        time.sleep(0.001)
        return goc_tick(session_id, row)

    store.add_tick = add_tick_cham
    demo._seed_products_and_links(store)
    ket: dict[str, str] = {}

    def gieo():
        ket["sid"] = demo._seed_one_session(
            store,
            random.Random(4242),
            duration_min=90,
            effect=HIEU_UNG,
            seed=999,
            start_offset_ago_min=45,
            leave_live=True,
            title=f"{demo.TIEN_TO_PHIEN_DANG_PHAT} · gieo chạy đua",
        )

    luong = threading.Thread(target=gieo)
    so_luot = 0
    luong.start()
    while luong.is_alive():
        phat_tiep.buoc_tat_ca(store)  # giờ thật, như vòng nền
        so_luot += 1
        time.sleep(0.001)
    luong.join()
    assert so_luot >= 5, "lượt phát tiếp không thật sự chạy trong lúc gieo"
    sid = ket["sid"]

    sau = service.now_utc() + timedelta(minutes=10)
    _chay_toi_khi_dung(store, sau)

    dau = phat_tiep.doc_dau_gieo(store.get_session(sid))
    assert dau is not None
    out = _mo_phong(store, sid, HIEU_UNG)
    het = service.elapsed_seconds(store.get_session(sid), sau)
    san = _cuoi_tick_gieo(dau.den_s)

    def mong(kind, gioi_han_gieo=None):
        da_gieo = [
            e.ts_offset_s for e in out.events if e.kind == kind and e.ts_offset_s <= dau.den_s
        ]
        if gioi_han_gieo is not None:
            da_gieo = da_gieo[:gioi_han_gieo]
        phat = [e.ts_offset_s for e in out.events if e.kind == kind and san <= e.ts_offset_s <= het]
        return sorted(da_gieo + phat)

    co_nhap = sorted(_giay(store, sid, c["ts"]) for c in store.list_clicks(sid))
    mong_nhap = mong("click")
    assert len(co_nhap) == len(mong_nhap), (len(co_nhap), len(mong_nhap))
    assert all(abs(a - b) < 1e-5 for a, b in zip(co_nhap, mong_nhap, strict=True))
    co_bl = sorted(_giay(store, sid, c["ts"]) for c in store.list_comments(sid))
    mong_bl = mong("comment", gioi_han_gieo=150)
    assert len(co_bl) == len(mong_bl), (len(co_bl), len(mong_bl))
    assert all(abs(a - b) < 1e-5 for a, b in zip(co_bl, mong_bl, strict=True))
    # Có phần phát tiếp thật (không chỉ "không ghi gì nên không trùng").
    assert any(o >= san for o in co_nhap), "không có lượt nhấp phát tiếp nào"
    offs = sorted(_giay(store, sid, t["ts_bucket"]) for t in store.list_ticks(sid))
    assert offs == [float(b) for b in range(0, int(offs[-1]) + 30, 30)], "tick trùng hoặc hở"
    assert offs[-1] > dau.den_s


def test_khong_ghi_su_kien_vao_khoang_da_co_tick(store):
    """Khoảng đã có tick là khoảng đã có số trên bàn: không ghi thêm sự kiện vào đó,
    kể cả khi tick xuất hiện SAU lúc tiến trình đã nhớ mốc."""
    sid = _gieo_phien_dang_phat(store, phut=60, da_phat_phut=10)
    dau = phat_tiep.doc_dau_gieo(store.get_session(sid))
    goc = service.now_utc()

    # Lượt đầu: mọi sự kiện phát tiếp nằm sau cuối mốc tick máy gieo đã ghi.
    phat_tiep.buoc_tat_ca(store, now=goc + timedelta(minutes=3))
    san_gieo = _cuoi_tick_gieo(dau.den_s)
    for c in store.list_clicks(sid):
        o = _giay(store, sid, c["ts"])
        assert o <= dau.den_s or o >= san_gieo, f"nhấp ở giây {o} rơi vào mốc tick đã gieo"
    for c in store.list_comments(sid):
        o = _giay(store, sid, c["ts"])
        assert o <= dau.den_s or o >= san_gieo, f"bình luận ở giây {o} rơi vào mốc tick đã gieo"

    # Một nguồn khác ghi tick đi trước tới phút 25 (mốc tiến trình đang nhớ ~ phút 13).
    start = store.get_session(sid)["start_ts"]
    tick_cuoi = int(max(_giay(store, sid, t["ts_bucket"]) for t in store.list_ticks(sid)))
    for b in range(tick_cuoi + 30, 25 * 60, 30):
        store.add_tick(
            sid,
            {
                "ts_bucket": start + timedelta(seconds=b),
                "viewers": 1,
                "comment_rate": 0.0,
                "like_rate": 0.0,
                "click_count": 0,
                "pinned_product_id": None,
            },
        )
    truoc = {c["click_id"] for c in store.list_clicks(sid)}
    truoc_bl = {c["comment_id"] for c in store.list_comments(sid)}
    phat_tiep.buoc_tat_ca(store, now=goc + timedelta(minutes=20))
    moi = [c for c in store.list_clicks(sid) if c["click_id"] not in truoc]
    moi += [c for c in store.list_comments(sid) if c["comment_id"] not in truoc_bl]
    assert moi, "không ghi tiếp sau khoảng đã có tick"
    assert all(_giay(store, sid, c["ts"]) >= 25 * 60 for c in moi)
    offs = [_giay(store, sid, t["ts_bucket"]) for t in store.list_ticks(sid)]
    assert len(offs) == len(set(offs)), "mốc 30 giây bị ghi trùng"


# ---------------------------------------------------------------------------
# 4. Sinh thêm sau mốc dữ liệu cũ, đúng tham số gieo
# ---------------------------------------------------------------------------


def test_sinh_them_tick_sau_moc_cu_lien_luoi_30_giay(store):
    sid = _gieo_phien_dang_phat(store, phut=30, da_phat_phut=15)
    ticks_cu = store.list_ticks(sid)
    moc_cu = max(_giay(store, sid, t["ts_bucket"]) for t in ticks_cu)
    nhap_cu = max(_giay(store, sid, c["ts"]) for c in store.list_clicks(sid))
    ten_tick_cu = {t["ts_bucket"]: dict(t) for t in ticks_cu}
    q = store.subscribe(sid)  # ngoài vòng lặp: nhận thẳng

    # 10 phút: bình luận theo nhịp đã hiệu chỉnh khá thưa (khoảng 2 phút một câu).
    now2 = service.now_utc() + timedelta(minutes=10)
    kq = phat_tiep.buoc_tat_ca(store, now=now2)

    assert [k.session_id for k in kq] == [sid]
    ticks = store.list_ticks(sid)
    offs = [_giay(store, sid, t["ts_bucket"]) for t in ticks]
    assert len(ticks) > len(ticks_cu)
    assert max(offs) > moc_cu
    assert len(set(offs)) == len(offs), "mốc 30 giây bị ghi trùng"
    assert all(b - a == 30 for a, b in zip(offs, offs[1:], strict=False)), "lưới 30 giây bị hở"
    # Mốc chỉ ghi khi đã trôi hết: không mốc nào kết thúc sau "bây giờ".
    elapsed = service.elapsed_seconds(store.get_session(sid), now2)
    assert max(offs) + 30 <= elapsed
    # Tick cũ giữ nguyên (không ghi đè quá khứ).
    for t in store.list_ticks(sid):
        if t["ts_bucket"] in ten_tick_cu:
            assert t == ten_tick_cu[t["ts_bucket"]]
    # Lượt nhấp và bình luận mới nằm SAU cuối mốc tick cũ, trong khoảng đã trôi.
    moi = [c for c in store.list_clicks(sid) if _giay(store, sid, c["ts"]) > nhap_cu]
    assert moi, "không có lượt nhấp mới"
    assert all(moc_cu + 30 <= _giay(store, sid, c["ts"]) <= elapsed for c in moi)
    assert all(c["is_valid"] is True for c in moi)
    # Bình luận lấy từ bộ câu mẫu, đã lọc thông tin cá nhân, mang nhãn sim. Nhịp bình
    # luận đã hiệu chỉnh khá thưa (phiên 30 phút này có 7 câu) nên chạy tới hết phiên.
    _chay_toi_khi_dung(store, now2 + timedelta(hours=1))
    bl_moi = [c for c in store.list_comments(sid) if c.get("platform") == "sim"]
    assert bl_moi
    for c in bl_moi:
        assert c["ext_id"].startswith(phat_tiep.TIEN_TO_EXT)
        assert "0901234567" not in c["text_scrubbed"]
        assert _giay(store, sid, c["ts"]) >= moc_cu + 30
    # Bàn nhận qua WebSocket như dữ liệu của bộ thu thật.
    loai = set()
    while not q.empty():
        loai.add(q.get_nowait()["type"])
    assert {"tick", "click"} <= loai


@pytest.mark.parametrize("hieu_ung", [HIEU_UNG, HIEU_UNG_MAT_TIEN])
def test_phan_phat_tiep_trung_khit_bo_mo_phong_da_sinh_phien(store, hieu_ung):
    """Cùng seed, cùng lịch, cùng hiệu ứng CỦA LẦN GIEO: không nhảy số ở mốc gieo.

    Lỗi VÀNG của lần duyệt: mặt tiền gieo với 0,5 mà phần phát tiếp luôn dùng 0,15,
    nên Tỷ lệ nhấp ở khối BẬT tụt bậc ngay ở phút gieo.
    """
    sid = _gieo_phien_dang_phat(store, phut=30, da_phat_phut=10, hieu_ung=hieu_ung)
    out = _mo_phong(store, sid, hieu_ung)
    mong = {t.bucket_start_s: t for t in build_ticks(out.events, 30 * 60, 30)}

    _chay_toi_khi_dung(store, service.now_utc() + timedelta(hours=1))

    ticks = store.list_ticks(sid)
    assert len(ticks) == 60  # 30 phút = 60 mốc, đủ cả phần gieo lẫn phần phát tiếp
    for t in ticks:
        b = round(_giay(store, sid, t["ts_bucket"]))
        assert t["viewers"] == mong[b].viewers
        assert t["click_count"] == mong[b].click_count
    # Từng lượt nhấp phát tiếp đúng bộ mô phỏng với hiệu ứng ấy.
    dau = phat_tiep.doc_dau_gieo(store.get_session(sid))
    san = _cuoi_tick_gieo(dau.den_s)
    mong_nhap = sorted(
        e.ts_offset_s for e in out.events if e.kind == "click" and e.ts_offset_s >= san
    )
    co_nhap = sorted(
        o for o in (_giay(store, sid, c["ts"]) for c in store.list_clicks(sid)) if o > dau.den_s
    )
    assert len(co_nhap) == len(mong_nhap)
    assert all(abs(a - b) < 1e-5 for a, b in zip(co_nhap, mong_nhap, strict=True))


def test_hieu_ung_khac_thi_chuoi_khac_nen_doc_tu_dau_la_can_thiet(store):
    """Giữ test trên có nghĩa: với cùng lịch và seed, 0,5 và 0,15 cho chuỗi lượt nhấp khác."""
    sid = _gieo_phien_dang_phat(store, phut=30, da_phat_phut=10, hieu_ung=HIEU_UNG_MAT_TIEN)
    nhap = {
        h: [e.ts_offset_s for e in _mo_phong(store, sid, h).events if e.kind == "click"]
        for h in (HIEU_UNG, HIEU_UNG_MAT_TIEN)
    }
    assert nhap[HIEU_UNG] != nhap[HIEU_UNG_MAT_TIEN]


# ---------------------------------------------------------------------------
# 5. Không chạm phiên THẬT, THỬ NỘI BỘ, giám khảo
# ---------------------------------------------------------------------------


def test_khong_bao_gio_ghi_vao_phien_that_thu_noi_bo_hay_giam_khao(store):
    hop_le = _gieo_phien_dang_phat(store)
    cam = {
        # Có cả dấu gieo mà vẫn không được: cờ phiên thật / thử nội bộ thắng.
        "THẬT giống hệt (có dấu)": _tao_phien(store, is_demo=False),
        "dry_run giống hệt (có dấu)": _tao_phien(store, is_demo=True, dry_run=True),
        "THỬ NỘI BỘ phòng xem": _tao_phien(
            store,
            is_demo=False,
            dry_run=True,
            platform="lab",
            host_id=None,
            title="Thử nội bộ",
            dau=False,
        ),
        "giám khảo tự tạo": _tao_phien(
            store,
            is_demo=True,
            platform="youtube",
            host_id=None,
            title="Phiên YouTube 90 phút",
            dau=False,
        ),
        # Đủ tên, host_id, nền tảng, is_demo của phiên máy gieo, chỉ thiếu dấu.
        "giả đủ tên và host, thiếu dấu": _tao_phien(store, is_demo=True, dau=False),
    }
    da_ket_thuc = _tao_phien(store, is_demo=True)
    store.update_session(da_ket_thuc, {"status": "ended", "end_ts": service.now_utc()})
    cam["đã kết thúc (có dấu)"] = da_ket_thuc
    truoc = {ten: _dem(store, sid) for ten, sid in cam.items()}

    kq = phat_tiep.buoc_tat_ca(store, now=service.now_utc() + timedelta(minutes=10))

    assert [k.session_id for k in kq] == [hop_le]
    for ten, sid in cam.items():
        assert _dem(store, sid) == truoc[ten], f"phát tiếp đã ghi vào phiên {ten}"
        assert not phat_tiep.la_phien_phat_tiep(store.get_session(sid)), ten
    assert phat_tiep.la_phien_phat_tiep(store.get_session(hop_le))


def test_phan_tich_video_quan_sat_khong_bi_ghi(store):
    sid = _tao_phien(store)
    store.update_session(
        sid, {"design": {**store.get_session(sid)["design"], "analysis_only": True}}
    )
    assert not phat_tiep.la_phien_phat_tiep(store.get_session(sid))
    phat_tiep.buoc_tat_ca(store, now=service.now_utc() + timedelta(minutes=10))
    assert _dem(store, sid) == (0, 0, 0)


# ---------------------------------------------------------------------------
# 6. Lượt nhấp theo khối BẬT/TẮT, lịch không đổi
# ---------------------------------------------------------------------------


def test_luot_nhap_theo_khoi_bat_tat_va_lich_khong_doi(store):
    # Hiệu ứng lớn để phép so sánh BẬT/TẮT không phụ thuộc may rủi của một seed.
    sid = _tao_phien(store, phut=60, da_phat_s=3600, hieu_ung=4.0)
    khoi_truoc = store.get_blocks(sid)
    gan_truoc = store.list_assignment_events(sid)
    thiet_ke_truoc = store.get_session(sid)["design"]

    _chay_toi_khi_dung(store, service.now_utc() + timedelta(minutes=5))

    assert store.get_blocks(sid) == khoi_truoc
    assert store.list_assignment_events(sid) == gan_truoc
    assert store.get_session(sid)["design"] == thiet_ke_truoc

    theo_id = {b["block_id"]: b for b in khoi_truoc}
    nhap = {"ON": 0, "OFF": 0}
    giay_nguoi = {"ON": 0.0, "OFF": 0.0}
    for c in store.list_clicks(sid):
        giay = _giay(store, sid, c["ts"])
        khoi = service.block_at_offset(khoi_truoc, giay)
        assert khoi is not None, "nhấp nằm ngoài mọi khối"
        assert c["block_id"] == khoi["block_id"], "nhấp gắn sai khối"
        if not khoi["is_washout"]:
            nhap[khoi["assignment"]] += 1
    for t in store.list_ticks(sid):
        khoi = service.block_at_offset(khoi_truoc, _giay(store, sid, t["ts_bucket"]))
        if khoi and not khoi["is_washout"]:
            giay_nguoi[khoi["assignment"]] += t["viewers"] * 30
    assert giay_nguoi["ON"] > 0
    assert giay_nguoi["OFF"] > 0
    ty_le_bat = nhap["ON"] / giay_nguoi["ON"]
    ty_le_tat = nhap["OFF"] / giay_nguoi["OFF"]
    assert ty_le_bat > 2 * ty_le_tat, (ty_le_bat, ty_le_tat)
    assert set(theo_id) >= {c["block_id"] for c in store.list_clicks(sid)}


def test_luot_nhap_dung_bang_bo_mo_phong_chay_tren_lich_niem_phong(store):
    """Không chỉ "nhiều hơn ở BẬT": đúng từng lượt bộ mô phỏng sinh trên lịch ấy."""
    sid = _tao_phien(store, phut=30, da_phat_s=1800, seed=31337)
    _chay_toi_khi_dung(store, service.now_utc())
    out = _mo_phong(store, sid, HIEU_UNG, seed=31337)
    mong = sorted(e.ts_offset_s for e in out.events if e.kind == "click")
    co = sorted(_giay(store, sid, c["ts"]) for c in store.list_clicks(sid))
    assert len(co) == len(mong)
    # Kho lưu tới micro giây: so với dung sai, không làm tròn (làm tròn có thể rơi hai phía).
    assert all(abs(a - b) < 1e-5 for a, b in zip(co, mong, strict=True))


# ---------------------------------------------------------------------------
# 7. Gọi lại, khởi động lại, hết phiên
# ---------------------------------------------------------------------------


def test_goi_lai_va_khoi_dong_lai_khong_nhan_doi(store):
    sid = _gieo_phien_dang_phat(store)
    now2 = service.now_utc() + timedelta(minutes=6)
    phat_tiep.buoc_tat_ca(store, now=now2)
    sau_lan_1 = _dem(store, sid)

    phat_tiep.buoc_tat_ca(store, now=now2)
    assert _dem(store, sid) == sau_lan_1, "gọi lại cùng thời điểm đã ghi thêm"

    phat_tiep.dat_lai()  # như tiến trình vừa khởi động lại: mốc tính lại từ kho
    phat_tiep.buoc_tat_ca(store, now=now2)
    assert _dem(store, sid) == sau_lan_1, "khởi động lại đã ghi lại quá khứ"

    phat_tiep.buoc_tat_ca(store, now=now2 + timedelta(minutes=4))
    sau = _dem(store, sid)
    assert sau[0] > sau_lan_1[0]
    assert sau[1] >= sau_lan_1[1]
    ids = [c["click_id"] for c in store.list_clicks(sid)]
    assert len(ids) == len(set(ids))
    ext = [c["ext_id"] for c in store.list_comments(sid) if c.get("ext_id")]
    assert len(ext) == len(set(ext))
    offs = [_giay(store, sid, t["ts_bucket"]) for t in store.list_ticks(sid)]
    assert all(b - a == 30 for a, b in zip(offs, offs[1:], strict=False))


def test_khoi_dong_lai_giua_moc_khong_mat_khong_trung(store):
    """Ngắt giữa mốc 30 giây (sự kiện đã ghi tới 'bây giờ', tick chưa) rồi khởi động lại."""
    sid = _tao_phien(store, phut=30, da_phat_s=0, seed=4040)
    goc = service.now_utc()
    for giay in (95, 140, 400, 401, 1000):
        phat_tiep.dat_lai()  # mỗi lượt như một tiến trình mới
        phat_tiep.buoc_tat_ca(store, now=goc + timedelta(seconds=giay))
    _chay_toi_khi_dung(store, goc + timedelta(hours=1))
    out = _mo_phong(store, sid, HIEU_UNG, seed=4040)
    assert len(store.list_clicks(sid)) == sum(1 for e in out.events if e.kind == "click")
    assert len(store.list_comments(sid)) == sum(1 for e in out.events if e.kind == "comment")
    assert len(store.list_ticks(sid)) == 60


def test_het_thoi_luong_thi_thoi_va_ket_thuc_thi_dung(store):
    sid = _gieo_phien_dang_phat(store, phut=30, da_phat_phut=15)
    rat_muon = service.now_utc() + timedelta(hours=3)
    _chay_toi_khi_dung(store, rat_muon)
    offs = [_giay(store, sid, t["ts_bucket"]) for t in store.list_ticks(sid)]
    assert max(offs) == 30 * 60 - 30, "mốc cuối phải là mốc cuối của phiên, không hơn"
    assert all(_giay(store, sid, c["ts"]) < 30 * 60 for c in store.list_clicks(sid))
    kq = phat_tiep.buoc_tat_ca(store, now=rat_muon)
    assert kq
    assert kq[0].het_phien is True

    store.update_session(sid, {"status": "ended", "end_ts": service.now_utc()})
    truoc = _dem(store, sid)
    assert phat_tiep.buoc_tat_ca(store, now=rat_muon + timedelta(hours=1)) == []
    assert _dem(store, sid) == truoc


def test_moi_luot_chi_bu_toi_da_mot_khoang(store):
    sid = _tao_phien(store, phut=90, da_phat_s=90 * 60)
    kq = phat_tiep.buoc_tat_ca(store, now=service.now_utc())
    assert kq[0].den_s - max(kq[0].tu_s, 0) <= phat_tiep.BU_TOI_DA_S + 1e-6
    offs = [_giay(store, sid, t["ts_bucket"]) for t in store.list_ticks(sid)]
    assert max(offs) + 30 <= phat_tiep.BU_TOI_DA_S


# ---------------------------------------------------------------------------
# 8. Chống chạy chồng lượt, lỗi kho, vòng nền
# ---------------------------------------------------------------------------


def test_luot_dang_chay_thi_luot_khac_bo_luot(store):
    sid = _gieo_phien_dang_phat(store)
    now2 = service.now_utc() + timedelta(minutes=5)
    assert phat_tiep._KHOA.acquire(blocking=False)
    try:
        assert phat_tiep.buoc_tat_ca(store, now=now2) == []
        truoc = _dem(store, sid)
    finally:
        phat_tiep._KHOA.release()
    assert phat_tiep.buoc_tat_ca(store, now=now2)
    assert _dem(store, sid) != truoc


def test_buoc_phien_doi_giu_khoa(store):
    """Mốc trong tiến trình chỉ đọc/ghi khi giữ _KHOA: gọi lẻ không giữ khoá thì vỡ."""
    sid = _gieo_phien_dang_phat(store)
    s = store.get_session(sid)
    with pytest.raises(AssertionError):
        phat_tiep._buoc_phien(store, s, phat_tiep.doc_dau_gieo(s), service.now_utc())


def test_hai_luong_cung_luc_khong_nhan_doi(store):
    sid = _gieo_phien_dang_phat(store, phut=90, da_phat_phut=10)
    now2 = service.now_utc() + timedelta(minutes=9)
    cho = threading.Barrier(4)

    def chay():
        cho.wait()
        for _ in range(5):
            phat_tiep.buoc_tat_ca(store, now=now2)

    luong = [threading.Thread(target=chay) for _ in range(4)]
    for t in luong:
        t.start()
    for t in luong:
        t.join()
    _chay_toi_khi_dung(store, now2)
    ids = [c["click_id"] for c in store.list_clicks(sid)]
    assert len(ids) == len(set(ids))
    buckets = [t["ts_bucket"] for t in store.list_ticks(sid)]
    assert len(buckets) == len(set(buckets))


class _KhoHong:
    """Bọc kho thật; ``get_blocks`` của một phiên (hay ``list_sessions``) ném lỗi chọn trước."""

    def __init__(self, inner, sid_hong, loi, *, hong_liet_ke=False):
        self._inner, self._sid_hong, self._loi = inner, sid_hong, loi
        self._hong_liet_ke = hong_liet_ke

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def get_blocks(self, session_id):
        if session_id == self._sid_hong:
            raise self._loi
        return self._inner.get_blocks(session_id)

    def list_sessions(self):
        if self._hong_liet_ke:
            raise self._loi
        return self._inner.list_sessions()


def test_loi_o_mot_phien_khong_chan_phien_khac(store):
    hong = _gieo_phien_dang_phat(store)
    lanh = _tao_phien(store)
    kho = _KhoHong(store, hong, RuntimeError("lỗi thử"))
    kq = phat_tiep.buoc_tat_ca(kho, now=service.now_utc() + timedelta(minutes=5))
    assert [k.session_id for k in kq] == [lanh]
    assert _dem(store, lanh)[0] > 0


def test_kho_chet_thi_dung_luot_khong_no(store):
    sid = _gieo_phien_dang_phat(store)
    kho = _KhoHong(store, sid, StoreUnavailableError("kho chết thử"))
    truoc = _dem(store, sid)
    assert phat_tiep.buoc_tat_ca(kho, now=service.now_utc() + timedelta(minutes=5)) == []
    assert _dem(store, sid) == truoc


def test_kho_chet_luc_liet_ke_phien_thi_mot_dong_canh_bao(store, caplog):
    """Lỗi XANH của lần duyệt: list_sessions nằm ngoài try, mỗi 5 giây một traceback."""
    sid = _gieo_phien_dang_phat(store)
    kho = _KhoHong(store, None, StoreUnavailableError("kho chết thử"), hong_liet_ke=True)
    truoc = _dem(store, sid)
    with caplog.at_level(logging.WARNING, logger="livelift.phat_tiep"):
        assert phat_tiep.buoc_tat_ca(kho, now=service.now_utc() + timedelta(minutes=5)) == []
    assert _dem(store, sid) == truoc
    ban_ghi = [r for r in caplog.records if r.name == "livelift.phat_tiep"]
    assert len(ban_ghi) == 1
    assert ban_ghi[0].levelno == logging.WARNING
    assert ban_ghi[0].exc_info is None, "không in traceback cho lỗi kho tạm thời"
    # Khoá đã nhả: lượt sau với kho lành chạy bình thường.
    assert phat_tiep.buoc_tat_ca(store, now=service.now_utc() + timedelta(minutes=5))

    # Lỗi KHÁC lúc liệt kê không bị nuốt: rơi lên vòng nền (ở đó ghi log rồi chạy tiếp).
    kho_loi = _KhoHong(store, None, RuntimeError("lỗi lạ"), hong_liet_ke=True)
    with pytest.raises(RuntimeError):
        phat_tiep.buoc_tat_ca(kho_loi, now=service.now_utc())
    assert not phat_tiep._KHOA.locked()


def test_vong_nen_that_su_ghi_va_dung_sach(store):
    sid = _tao_phien(store, phut=30, da_phat_s=600)

    async def chay():
        task = asyncio.create_task(phat_tiep.chay_mai(store, nhip_s=0.01))
        for _ in range(1000):  # tối đa ~10 giây (lần nạp bộ phân loại đầu), thoát ngay khi có
            await asyncio.sleep(0.01)
            if store.list_ticks(sid):
                break
        await phat_tiep.dung_phat_tiep(task)
        assert task.done()
        sau_khi_dung = _dem(store, sid)
        await asyncio.sleep(0.1)
        assert _dem(store, sid) == sau_khi_dung, "còn ghi sau khi đã dừng"
        return sau_khi_dung

    dem = asyncio.run(chay())
    assert dem[0] > 0


def test_dung_giua_luot_thi_luot_dang_chay_tra_luong(store):
    """Huỷ đúng lúc một lượt đang ghi trong luồng phụ: dung_phat_tiep chờ nó dừng."""
    sid = _tao_phien(store, phut=90, da_phat_s=600)
    dang_ghi = threading.Event()
    cho_phep = threading.Event()
    goc = store.add_click

    def add_click_cham(session_id, row):
        dang_ghi.set()
        cho_phep.wait(timeout=5)
        return goc(session_id, row)

    store.add_click = add_click_cham

    async def chay():
        task = asyncio.create_task(phat_tiep.chay_mai(store, nhip_s=0.01))
        for _ in range(1000):
            await asyncio.sleep(0.01)
            if dang_ghi.is_set():
                break
        assert dang_ghi.is_set()
        dung = asyncio.create_task(phat_tiep.dung_phat_tiep(task))
        await asyncio.sleep(0.05)
        cho_phep.set()
        await dung
        assert task.done()
        sau = _dem(store, sid)
        await asyncio.sleep(0.1)
        assert _dem(store, sid) == sau

    asyncio.run(chay())
    # Bị dừng giữa chừng: chỉ một lượt nhấp kịp ghi, tick chưa ghi (lượt sau ghi).
    assert len(store.list_clicks(sid)) == 1


# ---------------------------------------------------------------------------
# 9. Nối vào lifespan của api/main.py
# ---------------------------------------------------------------------------


def test_lifespan_tat_co_thi_khong_co_tac_vu(store):
    from fastapi.testclient import TestClient

    from livelift.api.main import create_app

    sid = _tao_phien(store, phut=30, da_phat_s=600)
    app = create_app(store=store)
    with TestClient(app):
        assert app.state.phat_tiep_task is None
    assert _dem(store, sid) == (0, 0, 0)


def test_lifespan_bat_co_thi_phat_tiep_va_dung_sach(store, monkeypatch):
    from fastapi.testclient import TestClient

    from livelift.api.main import create_app

    sid = _tao_phien(store, phut=30, da_phat_s=600)
    monkeypatch.setenv(phat_tiep.BIEN_BAT, "1")
    monkeypatch.setenv(phat_tiep.BIEN_NHIP, "0.01")
    app = create_app(store=store)
    with TestClient(app):
        task = app.state.phat_tiep_task
        assert isinstance(task, asyncio.Task)
        assert not task.done()
        han = time.monotonic() + 20  # lần nạp bộ phân loại đầu có thể mất vài giây
        while not store.list_ticks(sid) and time.monotonic() < han:
            time.sleep(0.02)
        assert store.list_ticks(sid), "lifespan bật cờ mà không phát tiếp"
    assert task.done()
    sau = _dem(store, sid)
    time.sleep(0.1)
    assert _dem(store, sid) == sau, "còn ghi sau khi ứng dụng đã tắt"

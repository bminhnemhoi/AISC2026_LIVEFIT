#!/usr/bin/env python3
"""Gieo bộ dữ liệu demo vào kho đang cấu hình, chạy lại không sinh bản trùng (N4, 19/10/2026).

Gieo năm thứ, mỗi thứ kiểm "đã có chưa" trước khi tạo:

1. **Tài khoản quản trị và giám khảo** (D-017): gọi hàm gieo của gói tài khoản
   (``livelift.dbops.tai_khoan`` hoặc ``livelift.api.tai_khoan``) nếu đã có; chưa
   có thì BỎ QUA và nói rõ. Mật khẩu là việc của hàm đó (lấy từ ``.env`` hoặc sinh
   ngẫu nhiên), script này không in mật khẩu nào;
2. **Bộ hàng chung D-025** (``LAB-1``..``LAB-4``, nguồn ``routes/demo.py``):
   ``POST /products`` ghi đè theo mã nên gọi lại không sinh món trùng;
3. **Bộ phiên mẫu** (bộ demo vàng ĐỔI / ĐO THÊM / CHƯA ĐỦ KHỐI):
   ``POST /demo/seed-vang`` đã có sẵn thì trả lại bộ cũ;
4. **Một phiên đang phát mẫu** (``/demo/seed`` một lần) chỉ khi kho chưa có phiên
   mẫu nào đang phát, để bàn thí nghiệm và ``chay_demo_next.py`` có phiên để mở;
5. **Một phòng xem ``dry_run``** (D-023): phiên ``lab`` mang tiêu đề cố định
   :data:`TIEU_DE_PHONG`, khai báo ``dry_run=True`` lúc tạo. Đã có phòng còn mở
   thì dùng lại, không tạo phiên mới. Video (``--video``, hay mp4 người dẫn AI khi
   đã có) hoặc bộ hàng của phòng lệch thì gửi lại ``phong-xem``, mã phòng giữ
   nguyên, bảng báo CẬP NHẬT. Phòng đã bị tắt thì được BẬT LẠI và bảng nói rõ.

Kho còn mã hàng ngoài D-025 (đặc biệt ``P-SAP``, ``P-BINH``, ``P-KHAN`` của bộ cũ)
thì thêm dòng CẢNH BÁO; script không xoá gì. Tài khoản qua API chỉ được gieo thẳng
vào ``DATABASE_URL`` khi ``/health`` của chính API báo ``store_backend=postgres``,
``durable=true``; API chạy RAM thì BỎ QUA có lý do.

Hai đường vào kho:

* **qua API** (mặc định, ``--api http://127.0.0.1:8000``): gieo vào đúng kho của
  tiến trình API đang chạy, bộ nhớ hay PostgreSQL đều được. Kho bộ nhớ nằm trong
  tiến trình API nên đây là đường duy nhất gieo được vào nó;
* **trực tiếp** (``--truc-tiep``): API chưa chạy thì dựng lõi ngay trong tiến trình
  này trên ``STORE_BACKEND=postgres`` (autopilot tắt) và gọi cùng các endpoint.
  Không chấp nhận kho bộ nhớ: gieo vào RAM của một tiến trình sắp thoát là vô ích.

Token ghi: ``INGEST_TOKEN`` của môi trường, không có thì đọc ``.env`` của repo.
Không in token.

Kết quả (mã phiên, mã phòng, không có bí mật hay dữ liệu cá nhân) ghi vào
``data/phong-xem/gieo-demo.json`` (đã nằm trong .gitignore) để
``scripts/chay_demo_next.py`` biết phòng nào cần kiểm.

    .venv/Scripts/python scripts/gieo_demo_db.py
    .venv/Scripts/python scripts/gieo_demo_db.py --bat-dau        # mở phòng ngay
    .venv/Scripts/python scripts/gieo_demo_db.py --truc-tiep      # API chưa chạy

Mã thoát: 0 = mọi bước ĐÃ CÓ / TẠO MỚI / CẬP NHẬT / CẢNH BÁO / BỎ QUA có lý do ·
1 = có bước LỖI · 2 = không vào được kho nào (API không trả lời, hoặc ``/health``
báo kho chết ``storage_ok=false``).
"""

from __future__ import annotations

import argparse
import importlib
import inspect
import json
import os
import sys
import warnings
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

import httpx  # noqa: E402

from livelift.console import configure  # noqa: E402

TEP_TRANG_THAI = REPO_ROOT / "data" / "phong-xem" / "gieo-demo.json"

#: Khoá nhận dạng phòng của script này: phiên ``lab`` + ``dry_run`` + đúng tiêu đề.
TIEU_DE_PHONG = "Thử nội bộ · Phòng xem demo"
PHIEN_BAN_DONG_Y = "2026-10-15"
PHUT_PHONG = 180
VIDEO_NGUOI_DAN_AI = "/xem/nguoi-dan-ai.mp4"
TIEN_TO_PHIEN_DANG_PHAT = "Phiên đang phát (mô phỏng)"

#: Nơi tìm hàm gieo tài khoản của gói tài khoản (N1). Hàm nhận một trong các tham
#: số ``database_url`` / ``url`` / ``store`` / ``kho`` (hoặc không tham số) và tự
#: bảo đảm chạy lại không sinh bản trùng.
MODULE_TAI_KHOAN = ("livelift.dbops.tai_khoan", "livelift.api.tai_khoan")
HAM_TAI_KHOAN = ("gieo_tai_khoan_demo", "gieo_tai_khoan", "gieo_mac_dinh")

TRANG_THAI_CON_MO = ("planned", "scheduled", "live")

#: Mã hàng của bộ trước D-025 (kho dev và có thể cả ``livelift_pgdata`` còn giữ).
MA_CU_TRUOC_D025 = ("P-SAP", "P-BINH", "P-KHAN")

DA_CO = "ĐÃ CÓ"
TAO_MOI = "TẠO MỚI"
CAP_NHAT = "CẬP NHẬT"
CANH_BAO = "CẢNH BÁO"
BO_QUA = "BỎ QUA"
LOI = "LỖI"


class LoiGieo(RuntimeError):  # noqa: N818 - tên tiếng Việt, "Loi" là "Error"
    """Một bước không làm được; thông điệp tiếng Việt, không chứa bí mật."""


def _san_pham_d025() -> list[dict[str, Any]]:
    from livelift.api.routes.demo import DEMO_PRODUCTS

    return [dict(p) for p in DEMO_PRODUCTS]


def _goi(c: Any, method: str, path: str, **kw: Any) -> Any:
    r = c.request(method, path, **kw)
    if r.status_code >= 400:
        raise LoiGieo(f"{method} {path} trả {r.status_code}: {r.text[:300]}")
    return r.json()


# ---------------------------------------------------------------------------
# Từng bước
# ---------------------------------------------------------------------------


def gieo_san_pham(c: Any) -> tuple[str, str, list[str], list[str]]:
    """Trả (kết quả, chi tiết, mã D-025, mã NGOÀI D-025 còn trong kho)."""
    hang = _san_pham_d025()
    co_san = {p["product_id"]: p for p in _goi(c, "GET", "/products")}
    moi: list[str] = []
    for p in hang:
        cu = co_san.get(p["product_id"])
        if cu is None or any(cu.get(k) != v for k, v in p.items()):
            _goi(c, "POST", "/products", json=p)
            moi.append(p["product_id"])
    ids = [p["product_id"] for p in hang]
    ngoai = sorted(pid for pid in co_san if pid not in set(ids))
    if moi:
        return TAO_MOI, f"ghi {', '.join(moi)} (D-025)", ids, ngoai
    return DA_CO, f"{', '.join(ids)} đúng bộ D-025", ids, ngoai


def canh_bao_ma_cu(ngoai: list[str], ben: bool) -> str:
    """Chi tiết dòng cảnh báo khi kho còn mã hàng ngoài D-025. Script KHÔNG xoá gì."""
    cu = [m for m in MA_CU_TRUOC_D025 if m in ngoai]
    khac = [m for m in ngoai if m not in MA_CU_TRUOC_D025]
    phan = []
    if cu:
        phan.append(f"còn mã cũ trước D-025: {', '.join(cu)}")
    if khac:
        phan.append(f"mã khác: {', '.join(khac[:8])}" + (" …" if len(khac) > 8 else ""))
    loi_khuyen = (
        "kho BỀN: xoá hay gieo lại cần M quyết định"
        if ben
        else "dùng kho mới (khởi động lại API trên ảnh chụp trống)"
    )
    return (
        "; ".join(phan)
        + ". Bước Chọn món, bàn thí nghiệm và tổng kết bộ vàng cũ có thể hiện hàng cũ, trái"
        " D-025. Script không xoá gì. Cách sửa: "
        + loi_khuyen
        + ", hoặc POST /demo/seed-vang?gieo_lai=true sau khi cân nhắc chuyện dòng trùng tên."
    )


def gieo_bo_vang(c: Any) -> tuple[str, str, dict[str, Any]]:
    kq = _goi(c, "POST", "/demo/seed-vang")
    nhom = kq.get("nhom") or {}
    dem = {k: len(v) for k, v in nhom.items()}
    chi_tiet = (
        f"ĐỔI {dem.get('duong', 0)} · ĐO THÊM {dem.get('null', 0)} · "
        f"CHƯA ĐỦ KHỐI {dem.get('thieu', 0)}"
    )
    return (DA_CO if kq.get("da_co_san") else TAO_MOI), chi_tiet, nhom


def _phien_dang_phat_mau(sessions: list[dict[str, Any]]) -> dict[str, Any] | None:
    ung_vien = [
        s
        for s in sessions
        if s.get("is_demo")
        and s.get("status") == "live"
        and str(s.get("title") or "").startswith(TIEN_TO_PHIEN_DANG_PHAT)
    ]
    ung_vien.sort(key=lambda s: str(s.get("created_at") or ""), reverse=True)
    return ung_vien[0] if ung_vien else None


def gieo_phien_dang_phat(c: Any) -> tuple[str, str, str | None]:
    co = _phien_dang_phat_mau(_goi(c, "GET", "/sessions"))
    if co is not None:
        return DA_CO, f"{co['session_id']} ({co.get('title')})", co["session_id"]
    kq = _goi(c, "POST", "/demo/seed", json={"n_sessions": 1, "duration_min": 90})
    sid = kq["replay_session_id"]
    return TAO_MOI, f"{sid} (gieo /demo/seed một lần)", sid


def _la_phong_cua_minh(s: dict[str, Any]) -> bool:
    return (
        s.get("platform") == "lab"
        and s.get("dry_run") is True
        and s.get("title") == TIEU_DE_PHONG
        and s.get("status") in TRANG_THAI_CON_MO
    )


def _than_phong(video: str | None) -> dict[str, Any]:
    than: dict[str, Any] = {
        "consent_version": PHIEN_BAN_DONG_Y,
        "products": [p["product_id"] for p in _san_pham_d025()],
        "title": TIEU_DE_PHONG,
    }
    # Không có video thì bỏ hẳn trường: máy chủ giữ video cũ của phòng (gửi null mới là xoá).
    if video is not None:
        than["video_url"] = video
    return than


def _dam_bao_lich(c: Any, sid: str) -> None:
    if not _goi(c, "GET", f"/sessions/{sid}/schedule"):
        _goi(c, "POST", f"/sessions/{sid}/schedule", json={})


def _can_cap_nhat(room_tt: dict[str, Any], video: str | None) -> list[str]:
    """So phòng đang phát (``/xem-api/<mã>/trang-thai``) với điều người gọi muốn.

    ``video`` là None (không truyền ``--video`` và chưa có mp4) thì không đụng video cũ.
    """
    khac: list[str] = []
    room = room_tt.get("room") or {}
    if video is not None and room.get("video_url") != video:
        khac.append(f"video {room.get('video_url')!r} → {video!r}")
    muon = [p["product_id"] for p in _san_pham_d025()]
    dang = [p.get("product_id") for p in room_tt.get("products") or []]
    if dang != muon:
        khac.append(f"hàng {dang} → {muon}")
    return khac


def gieo_phong(
    c: Any, trang_thai_cu: dict[str, Any] | None, video: str | None, phut: int, bat_dau: bool
) -> tuple[str, str, dict[str, Any]]:
    phong: dict[str, Any] | None = None
    trang_thai = DA_CO
    ghi_chu: list[str] = []
    sid_bi_tat: str | None = None

    # 1) phòng ghi trong tệp trạng thái còn sống và vẫn là phòng của mình. Video hay bộ
    #    hàng lệch điều người gọi muốn (mp4 tới sau lần gieo đầu) thì gửi lại phong-xem;
    #    máy chủ giữ nguyên mã phòng.
    cu = (trang_thai_cu or {}).get("phong") or {}
    if cu.get("session_id") and cu.get("code"):
        s = c.get(f"/sessions/{cu['session_id']}")
        r = c.get(f"/xem-api/{cu['code']}/trang-thai")
        cua_minh = s.status_code == 200 and _la_phong_cua_minh(s.json())
        if cua_minh and r.status_code == 200:
            phong = {"session_id": cu["session_id"], "code": cu["code"]}
            khac = _can_cap_nhat(r.json(), video)
            if khac:
                sid = cu["session_id"]
                video_gui = (
                    video if video is not None else (r.json().get("room") or {}).get("video_url")
                )
                _dam_bao_lich(c, sid)
                out = _goi(c, "POST", f"/sessions/{sid}/phong-xem", json=_than_phong(video_gui))
                phong["code"] = out["code"]
                trang_thai = CAP_NHAT
                ghi_chu.append("gửi lại phong-xem: " + "; ".join(khac))
        elif cua_minh and r.status_code == 404:
            sid_bi_tat = cu["session_id"]  # phiên còn mở mà mã phòng 404: phòng đã bị tắt

    # 2) mất tệp trạng thái (hay kho đổi, hay phòng bị tắt) nhưng phiên phòng vẫn còn: gửi
    #    lại phong-xem cho chính phiên đó (enabled=True). Máy chủ giữ nguyên mã phòng cũ.
    if phong is None:
        cua_minh_ds = [s for s in _goi(c, "GET", "/sessions") if _la_phong_cua_minh(s)]
        cua_minh_ds.sort(key=lambda s: (s.get("status") != "live", str(s.get("created_at") or "")))
        if cua_minh_ds:
            sid = cua_minh_ds[0]["session_id"]
            _dam_bao_lich(c, sid)
            out = _goi(c, "POST", f"/sessions/{sid}/phong-xem", json=_than_phong(video))
            phong = {"session_id": sid, "code": out["code"]}
            if sid == sid_bi_tat:
                trang_thai = CAP_NHAT
                ghi_chu.append("đã BẬT LẠI phòng bị tắt (mã cũ trả 404)")
            else:
                ghi_chu.append("gửi lại phong-xem enabled=True (phòng đã bị tắt thì nay BẬT LẠI)")

    # 3) chưa có: tạo phiên lab dry_run (khai báo LÚC TẠO, bất biến về sau)
    if phong is None:
        trang_thai = TAO_MOI
        s = _goi(
            c,
            "POST",
            "/sessions",
            json={
                "platform": "lab",
                "title": TIEU_DE_PHONG,
                "mode": "auto",
                "planned_duration_min": phut,
                "dry_run": True,
            },
        )
        sid = s["session_id"]
        if s.get("dry_run") is not True or s.get("is_demo"):
            # API cũ bỏ qua dry_run, hoặc yêu cầu đi không token nên phiên thành phiên mẫu:
            # huỷ khi còn planned (chưa có số nào) rồi dừng.
            c.post(f"/sessions/{sid}/cancel")
            raise LoiGieo(
                f"máy chủ không lưu dry_run=True (hoặc gắn is_demo) cho phiên {sid}; đã huỷ. "
                "Kiểm INGEST_TOKEN và phiên bản API."
            )
        _goi(c, "POST", f"/sessions/{sid}/schedule", json={})
        out = _goi(c, "POST", f"/sessions/{sid}/phong-xem", json=_than_phong(video))
        phong = {"session_id": sid, "code": out["code"]}

    sid = phong["session_id"]
    s = _goi(c, "GET", f"/sessions/{sid}")
    if bat_dau and s.get("status") != "live":
        s = _goi(c, "POST", f"/sessions/{sid}/start")
    phong.update(
        {
            "public_path": f"/xem/{phong['code']}",
            "dry_run": bool(s.get("dry_run")),
            "status": s.get("status"),
            "title": s.get("title"),
        }
    )
    tt = c.get(f"/xem-api/{phong['code']}/trang-thai")
    if tt.status_code == 200:
        phong["video_url"] = (tt.json().get("room") or {}).get("video_url")
    chi_tiet = (
        f"/xem/{phong['code']} · phiên {sid} · dry_run={phong['dry_run']} · {phong['status']}"
        f" · video={phong.get('video_url') or 'không có'}"
    )
    if ghi_chu:
        chi_tiet += " · " + "; ".join(ghi_chu)
    return trang_thai, chi_tiet, phong


def _tim_ham_tai_khoan() -> tuple[str, Callable[..., Any]] | None:
    for ten_mod in MODULE_TAI_KHOAN:
        try:
            mod = importlib.import_module(ten_mod)
        except ImportError:
            continue
        for ten in HAM_TAI_KHOAN:
            f = getattr(mod, ten, None)
            if callable(f):
                return f"{ten_mod}.{ten}", f
    return None


def gieo_tai_khoan(
    store: Any | None, database_url: str | None, ly_do_khong_url: str | None = None
) -> tuple[str, str]:
    """Gọi hàm gieo của gói tài khoản nếu có. Không in mật khẩu.

    ``ly_do_khong_url``: vì sao ``database_url`` bị giữ lại (API chạy kho RAM), nói ra
    khi hàm gieo cần nó.
    """
    tim = _tim_ham_tai_khoan()
    if tim is None:
        return BO_QUA, (
            "chưa có hàm gieo tài khoản (" + " / ".join(MODULE_TAI_KHOAN) + "): "
            "gói tài khoản N1 chưa ghép"
        )
    ten, f = tim
    tham_so = inspect.signature(f).parameters
    kw: dict[str, Any] = {}
    for p in tham_so.values():
        if p.name in ("store", "kho"):
            if store is None:
                return BO_QUA, f"{ten} cần kho trong tiến trình; chạy lại với --truc-tiep"
            kw[p.name] = store
        elif p.name in ("database_url", "url", "dsn"):
            if not database_url:
                return BO_QUA, f"{ten} cần DATABASE_URL (PostgreSQL)" + (
                    f": {ly_do_khong_url}" if ly_do_khong_url else ""
                )
            kw[p.name] = database_url
        elif p.default is inspect.Parameter.empty and p.kind not in (
            inspect.Parameter.VAR_POSITIONAL,
            inspect.Parameter.VAR_KEYWORD,
        ):
            return BO_QUA, f"{ten} cần tham số {p.name!r} mà script chưa biết cách đưa"
    kq = f(**kw)
    if isinstance(kq, dict):
        tao = kq.get("tao_moi") or kq.get("created") or []
        co = kq.get("da_co") or kq.get("existing") or []
        ten_tk = ", ".join(str(x) for x in [*tao, *co]) or "?"
        return (TAO_MOI if tao else DA_CO), f"{ten}: {ten_tk}"
    return DA_CO, f"{ten} đã chạy"


# ---------------------------------------------------------------------------
# Điều phối
# ---------------------------------------------------------------------------


def doc_trang_thai(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def ghi_trang_thai(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def gieo(
    c: Any,
    *,
    nguon: str,
    tep_trang_thai: Path,
    video: str | None,
    phut: int = PHUT_PHONG,
    bat_dau: bool = False,
    phien_dang_phat: bool = True,
    store: Any | None = None,
    database_url: str | None = None,
) -> tuple[list[tuple[str, str, str]], dict[str, Any]]:
    """Chạy mọi bước trên client ``c`` (httpx.Client hoặc TestClient).

    Trả (các dòng bảng, trạng thái để ghi tệp). Một bước lỗi không chặn các bước sau.
    """
    bang: list[tuple[str, str, str]] = []
    health = _goi(c, "GET", "/health")
    kho = (
        f"{health.get('store_backend')} · {health.get('storage_mode')} · "
        f"durable={health.get('durable')}"
    )
    if health.get("storage_ok") is False:
        # Kho chết: mọi bước sau chỉ lặp lại cùng một lỗi 503, nói một lần là đủ.
        bang.append(("Kho", LOI, f"{kho} · {health.get('storage_warning') or 'kho không trả lời'}"))
        return bang, {"nguon": nguon, "store_backend": health.get("store_backend")}
    bang.append(("Kho", DA_CO, kho))
    kho_ben = health.get("store_backend") == "postgres" and health.get("durable") is True
    ly_do_khong_url: str | None = None
    if store is None and not kho_ben:
        # Qua API: tài khoản phải vào ĐÚNG kho của API. API chạy RAM mà gieo thẳng vào
        # Postgres theo .env cục bộ thì bảng báo TẠO MỚI nhưng lúc demo không đăng nhập
        # được. Quyết định theo /health của chính API, không theo .env.
        database_url = None
        ly_do_khong_url = "API chạy kho RAM, gieo tài khoản phải qua API của N1"
    cu = doc_trang_thai(tep_trang_thai)
    if cu and cu.get("nguon") != nguon:
        cu = None  # tệp của một kho khác: không tin mã phòng trong đó
    data: dict[str, Any] = {
        "nguon": nguon,
        "store_backend": health.get("store_backend"),
        "durable": health.get("durable"),
    }

    def buoc(ten: str, fn: Callable[[], tuple[Any, ...]]) -> tuple[Any, ...] | None:
        try:
            kq = fn()
        except LoiGieo as exc:
            bang.append((ten, LOI, str(exc)))
            return None
        except httpx.HTTPError as exc:
            bang.append((ten, LOI, f"không gọi được API: {exc}"))
            return None
        bang.append((ten, kq[0], kq[1]))
        return kq

    kq_tk = buoc(
        "Tài khoản quản trị, giám khảo",
        lambda: gieo_tai_khoan(store, database_url, ly_do_khong_url),
    )
    data["tai_khoan"] = kq_tk[0] if kq_tk else LOI
    kq_sp = buoc("Bộ hàng D-025", lambda: gieo_san_pham(c))
    data["san_pham"] = kq_sp[2] if kq_sp else []
    if kq_sp and kq_sp[3]:
        bang.append(("Mã hàng ngoài D-025", CANH_BAO, canh_bao_ma_cu(kq_sp[3], kho_ben)))
        data["ma_ngoai_d025"] = kq_sp[3]
    kq_vang = buoc("Bộ phiên mẫu (demo vàng)", lambda: gieo_bo_vang(c))
    data["bo_vang"] = kq_vang[2] if kq_vang else {}
    if phien_dang_phat:
        kq_live = buoc("Phiên đang phát mẫu", lambda: gieo_phien_dang_phat(c))
        data["phien_dang_phat"] = kq_live[2] if kq_live else None
    kq_phong = buoc("Phòng xem dry_run", lambda: gieo_phong(c, cu, video, phut, bat_dau))
    if kq_phong:
        data["phong"] = kq_phong[2]
    data["cap_nhat"] = datetime.now(UTC).isoformat(timespec="seconds")
    return bang, data


def kho_chet(bang: list[tuple[str, str, str]]) -> bool:
    """Dòng Kho là LỖI (``/health`` báo ``storage_ok=false``): mã thoát 2."""
    return any(ten == "Kho" and kq == LOI for ten, kq, _ in bang)


def in_bang(bang: list[tuple[str, str, str]]) -> None:
    rong = max(len(r[0]) for r in bang)
    for ten, kq, chi_tiet in bang:
        print(f"  {ten:<{rong}}  {kq:<8}  {chi_tiet}")


def _token() -> str:
    tok = os.environ.get("INGEST_TOKEN", "")
    if tok:
        return tok
    try:
        from livelift.config import Settings

        return Settings(_env_file=str(REPO_ROOT / ".env")).ingest_token  # type: ignore[call-arg]
    except Exception:  # noqa: BLE001 - không có .env thì chạy không token
        return ""


def _video_mac_dinh() -> str | None:
    tep = REPO_ROOT / "next" / "public" / "xem" / "nguoi-dan-ai.mp4"
    return VIDEO_NGUOI_DAN_AI if tep.is_file() else None


def _api_song(url: str) -> bool:
    try:
        return httpx.get(f"{url.rstrip('/')}/health", timeout=5).status_code == 200
    except httpx.HTTPError:
        return False


def _postgres_da_cau_hinh() -> tuple[bool, str | None]:
    from livelift.config import Settings

    s = Settings(_env_file=str(REPO_ROOT / ".env"))  # type: ignore[call-arg]
    backend = os.environ.get("STORE_BACKEND") or _doc_env_khoa("STORE_BACKEND")
    return (backend or "").strip().lower() == "postgres", s.database_url


def _doc_env_khoa(key: str) -> str | None:
    tep = REPO_ROOT / ".env"
    if not tep.is_file():
        return None
    for line in tep.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        k, sep, v = line.strip().partition("=")
        if sep and k.strip() == key:
            return v.strip().strip("'\"")
    return None


def main(argv: list[str] | None = None) -> int:
    configure()
    ap = argparse.ArgumentParser(description="Gieo bộ dữ liệu demo (idempotent) cho LiveLift")
    ap.add_argument("--api", default="http://127.0.0.1:8000", help="địa chỉ lõi API")
    ap.add_argument(
        "--truc-tiep",
        action="store_true",
        help="không qua API: dựng lõi trong tiến trình trên STORE_BACKEND=postgres",
    )
    ap.add_argument(
        "--video", default=None, help="video người dẫn của phòng (mặc định: video AI nếu có)"
    )
    ap.add_argument(
        "--phut", type=int, default=PHUT_PHONG, help="thời lượng phiên phòng xem (phút)"
    )
    ap.add_argument("--bat-dau", action="store_true", help="bắt đầu phát phòng xem ngay")
    ap.add_argument(
        "--khong-phien-dang-phat",
        action="store_true",
        help="không gieo phiên đang phát mẫu khi kho chưa có",
    )
    ap.add_argument("--tep-trang-thai", type=Path, default=TEP_TRANG_THAI)
    args = ap.parse_args(argv)
    args.tep_trang_thai = args.tep_trang_thai.resolve()
    video = args.video if args.video is not None else _video_mac_dinh()
    token = _token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    truc_tiep = args.truc_tiep
    if not truc_tiep and not _api_song(args.api):
        co_pg, _ = _postgres_da_cau_hinh()
        if not co_pg:
            print(f"Không gọi được API {args.api}/health và chưa cấu hình STORE_BACKEND=postgres.")
            print("Bật API (kho nào cũng được) rồi chạy lại, hoặc bật PostgreSQL bằng")
            print("scripts/bat_postgres.py rồi chạy với --truc-tiep.")
            return 2
        print(
            f"API {args.api} không trả lời; STORE_BACKEND=postgres đã cấu hình nên gieo trực tiếp."
        )
        truc_tiep = True

    print("== Gieo bộ dữ liệu demo LiveLift ==")
    kw = {
        "tep_trang_thai": args.tep_trang_thai,
        "video": video,
        "phut": args.phut,
        "bat_dau": args.bat_dau,
        "phien_dang_phat": not args.khong_phien_dang_phat,
    }
    if truc_tiep:
        co_pg, database_url = _postgres_da_cau_hinh()
        if not co_pg:
            print(
                "--truc-tiep chỉ chạy trên STORE_BACKEND=postgres "
                "(kho bộ nhớ chết cùng tiến trình này)."
            )
            return 2
        os.environ["LIVELIFT_AUTOPILOT"] = "0"  # tiến trình gieo không được ghim thay API
        # Lõi đọc .env theo thư mục hiện hành (DATABASE_URL, INGEST_TOKEN): đứng ở gốc repo
        # để kho và cổng ghi trong tiến trình này giống hệt API chạy từ repo.
        os.chdir(REPO_ROOT)
        from livelift.config import get_settings

        get_settings.cache_clear()
        # TestClient ở đây là kênh gọi lõi trong tiến trình, không phải kiểm thử; lời
        # cảnh báo "httpx với starlette.testclient" của Starlette chỉ làm rối màn hình.
        warnings.filterwarnings("ignore", message=".*starlette.testclient.*")
        from fastapi.testclient import TestClient

        from livelift.api.main import create_app
        from livelift.api.store import build_store

        try:
            store = build_store("postgres")
            with TestClient(
                create_app(store=store),
                base_url="http://gieo-truc-tiep",
                headers=headers,
                raise_server_exceptions=False,
            ) as c:
                bang, data = gieo(
                    c, nguon="truc-tiep:postgres", store=store, database_url=database_url, **kw
                )
        except (LoiGieo, httpx.HTTPError) as exc:
            print(f"  Không vào được kho PostgreSQL: {exc}")
            return 2
    else:
        print(f"  qua API {args.api} (token: {'có' if token else 'không'})")
        try:
            with httpx.Client(base_url=args.api, headers=headers, timeout=60) as c:
                # gieo() chỉ dùng database_url khi /health của API báo Postgres bền
                _, database_url = _postgres_da_cau_hinh()
                bang, data = gieo(
                    c,
                    nguon=f"api:{args.api.rstrip('/')}",
                    database_url=database_url,
                    **kw,
                )
        except (LoiGieo, httpx.HTTPError) as exc:
            print(f"  Không vào được API {args.api}: {exc}")
            return 2
    in_bang(bang)
    if kho_chet(bang):
        print("  Kho không trả lời: không gieo được gì, tệp trạng thái giữ nguyên.")
        return 2
    if data.get("phong"):
        ghi_trang_thai(args.tep_trang_thai, data)
        print(f"  Đã ghi {args.tep_trang_thai}")
        if data["phong"].get("status") != "live":
            print(
                "  Phòng chưa phát. Trước buổi demo: bấm Bắt đầu trên bàn, "
                "hoặc chạy lại với --bat-dau."
            )
    loi = [r for r in bang if r[1] == LOI]
    return 1 if loi else 0


if __name__ == "__main__":
    raise SystemExit(main())

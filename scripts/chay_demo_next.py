#!/usr/bin/env python3
"""Một lệnh kiểm trước buổi demo: lõi, kho, mặt tiền Next và phòng xem (N4, 19/10/2026).

Hỏi một hệ thống ĐANG CHẠY đúng những đường giám khảo sẽ đi qua, rồi in bảng
ĐẠT/KHÔNG. Mỗi trang Next được kiểm hai lớp: trang trả 200 VÀ dữ liệu phía sau nó
đi được qua Next (proxy ``/api/ll/...`` hoặc rewrite ``/xem-api/...``). Lý do: Next
dựng trang ở trình duyệt nên ``/phien/<mã sai>`` hay ``/xem/<mã sai>`` vẫn trả 200;
chỉ nhìn mã trang thì một phòng đã mất vẫn báo ĐẠT.

Các dòng kiểm:

1. lõi sống (``/health`` trả 200, ``status=ok``);
2. kho của lõi: bền (PostgreSQL) hay RAM. RAM vẫn ĐẠT, chi tiết nói rõ;
   ``--can-ben`` biến RAM thành KHÔNG (D3: chạy được trên PostgreSQL);
3. ``/gioi-thieu``;
4. ``/phien`` + danh sách phiên qua proxy Next;
5. ``/phien/<phiên đang phát>`` + phiên đó qua proxy, trạng thái ``live``;
6. ``/phien/<id>/tong-ket`` + báo cáo ``bao-cao`` của phiên đó qua proxy;
7. ``/xem/<mã phòng>`` + ``/xem-api/<mã>/trang-thai`` qua Next, phòng chưa đóng;
8. phòng xem là ``dry_run`` (D-023: giám khảo tương tác không vào số nào). Bằng
   chứng chính là ``room.dry_run`` của ``/xem-api/<mã>/trang-thai``, đúng cờ điện
   thoại nhận; phiên của phòng là bằng chứng thứ hai.

Mã phòng và phiên của phòng lấy theo thứ tự: ``--ma-phong``/``--phien-phong``,
rồi tệp ``data/phong-xem/gieo-demo.json`` do ``scripts/gieo_demo_db.py`` ghi. Tệp
ghi qua API chỉ dùng khi trùng ``--api``; tệp ghi bằng ``--truc-tiep`` (Postgres)
chỉ dùng khi ``/health`` của lõi báo ``store_backend=postgres``, ``durable=true``.

    .venv/Scripts/python scripts/chay_demo_next.py
    .venv/Scripts/python scripts/chay_demo_next.py --lan 3          # ĐẠT 3 lần liên tiếp
    .venv/Scripts/python scripts/chay_demo_next.py --ma-phong AbCd1234

Mã thoát: 0 = mọi dòng ĐẠT (ở mọi lần) · 1 = có ít nhất một dòng KHÔNG.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

import httpx  # noqa: E402

from livelift.console import configure  # noqa: E402

TEP_TRANG_THAI = REPO_ROOT / "data" / "phong-xem" / "gieo-demo.json"
HET_GIO_S = 90.0  # Next dev biên dịch trang ở lần gọi đầu, có khi mất vài chục giây
TIEN_TO_PHIEN_DANG_PHAT = "Phiên đang phát (mô phỏng)"
TIEN_TO_VANG_DOI = "Demo vàng · ĐỔI"

DAT = "ĐẠT"
KHONG = "KHÔNG"


@dataclass
class Dong:
    hang_muc: str
    dat: bool
    chi_tiet: str


@dataclass
class TuyChon:
    ma_phong: str | None = None
    phien_phong: str | None = None
    phien: str | None = None
    tong_ket: str | None = None
    can_ben: bool = False


def _json(r: httpx.Response) -> Any:
    try:
        return r.json()
    except ValueError:
        return None


def _get(c: httpx.Client, path: str) -> tuple[int | None, Any, str]:
    """(mã HTTP hoặc None, JSON nếu có, lỗi mạng nếu có)."""
    try:
        r = c.get(path)
    except httpx.HTTPError as exc:
        return None, None, f"{type(exc).__name__}: {exc}"[:200]
    return r.status_code, _json(r), ""


def _ma(code: int | None, loi: str) -> str:
    return f"HTTP {code}" if code is not None else f"không gọi được ({loi})"


def _trang(nxt: httpx.Client, path: str) -> tuple[bool, str]:
    code, _, loi = _get(nxt, path)
    return code == 200, f"{path} {_ma(code, loi)}"


def chon_phien_dang_phat(sessions: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Phiên mẫu "đang phát" mới nhất; không có thì phiên live nào không phải phòng xem."""
    live = [s for s in sessions if s.get("status") == "live"]
    live.sort(key=lambda s: str(s.get("created_at") or ""), reverse=True)
    for s in live:
        if s.get("is_demo") and str(s.get("title") or "").startswith(TIEN_TO_PHIEN_DANG_PHAT):
            return s
    for s in live:
        if s.get("platform") != "lab":
            return s
    return live[0] if live else None


def chon_phien_tong_ket(sessions: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Phiên vàng ĐỔI #1 nếu có, không thì phiên đã kết thúc mới nhất."""
    ended = [s for s in sessions if s.get("status") == "ended"]
    vang = sorted(
        (s for s in ended if str(s.get("title") or "").startswith(TIEN_TO_VANG_DOI)),
        key=lambda s: str(s.get("title")),
    )
    if vang:
        return vang[0]
    ended.sort(key=lambda s: str(s.get("created_at") or ""), reverse=True)
    return ended[0] if ended else None


def doc_trang_thai(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def kiem_mot_lan(api: httpx.Client, nxt: httpx.Client, tc: TuyChon) -> list[Dong]:
    dong: list[Dong] = []

    # 1-2. lõi và kho -----------------------------------------------------
    code, health, loi = _get(api, "/health")
    song = code == 200 and isinstance(health, dict) and health.get("status") == "ok"
    trang_thai = health.get("status") if isinstance(health, dict) else None
    dong.append(Dong("Lõi sống (/health)", song, f"{_ma(code, loi)} · status={trang_thai}"))
    if isinstance(health, dict):
        ben = health.get("durable") is True
        loai = "BỀN" if ben else "RAM"
        chi_tiet = (
            f"{loai}: store_backend={health.get('store_backend')} · "
            f"storage_mode={health.get('storage_mode')} · durable={health.get('durable')}"
        )
        ok_kho = health.get("storage_ok") is not False and (ben or not tc.can_ben)
        if not ben and tc.can_ben:
            chi_tiet += " · cần kho bền (--can-ben): bật scripts/bat_postgres.py"
        dong.append(Dong("Kho của lõi", ok_kho, chi_tiet))
    else:
        dong.append(Dong("Kho của lõi", False, "không đọc được /health"))

    # 3. landing ----------------------------------------------------------
    ok, ct = _trang(nxt, "/gioi-thieu")
    dong.append(Dong("Next /gioi-thieu", ok, ct))

    # 4. danh sách phiên ---------------------------------------------------
    ok_trang, ct_trang = _trang(nxt, "/phien")
    code, sessions, loi = _get(nxt, "/api/ll/sessions")
    ok_ds = code == 200 and isinstance(sessions, list)
    sessions = sessions if isinstance(sessions, list) else []
    dong.append(
        Dong(
            "Next /phien",
            ok_trang and ok_ds,
            f"{ct_trang} · /api/ll/sessions {_ma(code, loi)} · {len(sessions)} phiên",
        )
    )

    # 5. phiên đang phát ---------------------------------------------------
    sid = tc.phien or ((chon_phien_dang_phat(sessions) or {}).get("session_id"))
    if not sid:
        dong.append(
            Dong(
                "Next /phien/<đang phát>",
                False,
                "kho không có phiên đang phát: chạy scripts/gieo_demo_db.py hoặc truyền --phien",
            )
        )
    else:
        ok_trang, ct_trang = _trang(nxt, f"/phien/{sid}")
        code, s, loi = _get(nxt, f"/api/ll/sessions/{sid}")
        st = s.get("status") if isinstance(s, dict) else None
        dong.append(
            Dong(
                "Next /phien/<đang phát>",
                ok_trang and code == 200 and st == "live",
                f"{ct_trang} · /api/ll/sessions/{sid[:8]}… {_ma(code, loi)} · status={st}",
            )
        )

    # 6. tổng kết ------------------------------------------------------------
    sid_tk = tc.tong_ket or ((chon_phien_tong_ket(sessions) or {}).get("session_id"))
    if not sid_tk:
        dong.append(
            Dong(
                "Next /phien/<id>/tong-ket",
                False,
                "kho không có phiên đã kết thúc: chạy scripts/gieo_demo_db.py "
                "hoặc truyền --tong-ket",
            )
        )
    else:
        ok_trang, ct_trang = _trang(nxt, f"/phien/{sid_tk}/tong-ket")
        code, bc, loi = _get(nxt, f"/api/ll/sessions/{sid_tk}/bao-cao")
        dong.append(
            Dong(
                "Next /phien/<id>/tong-ket",
                ok_trang and code == 200 and isinstance(bc, dict),
                f"{ct_trang} · bao-cao {_ma(code, loi)}",
            )
        )

    # 7-8. phòng xem -------------------------------------------------------
    if not tc.ma_phong:
        dong.append(
            Dong(
                "Next /xem/<mã phòng>",
                False,
                "chưa biết mã phòng: chạy scripts/gieo_demo_db.py hoặc truyền --ma-phong",
            )
        )
        dong.append(Dong("Phòng xem là dry_run", False, "chưa biết phòng nào"))
        return dong
    ok_trang, ct_trang = _trang(nxt, f"/xem/{tc.ma_phong}")
    code, tt, loi = _get(nxt, f"/xem-api/{tc.ma_phong}/trang-thai")
    phong = tt.get("room") if isinstance(tt, dict) else None
    st_phong = phong.get("status") if isinstance(phong, dict) else None
    dong.append(
        Dong(
            "Next /xem/<mã phòng>",
            ok_trang and code == 200 and st_phong in ("chua_mo", "dang_mo"),
            f"{ct_trang} · /xem-api/…/trang-thai {_ma(code, loi)} · phòng={st_phong}"
            + (" (chưa phát: bấm Bắt đầu trước buổi demo)" if st_phong == "chua_mo" else ""),
        )
    )
    dong.append(kiem_dry_run(api, tc, sessions, phong if isinstance(phong, dict) else None))
    return dong


def kiem_dry_run(
    api: httpx.Client,
    tc: TuyChon,
    sessions: list[dict[str, Any]],
    phong: dict[str, Any] | None,
) -> Dong:
    """Dòng 8. Bằng chứng chính là ``room.dry_run`` của ``/xem-api/<mã>/trang-thai``:
    đúng cờ mà điện thoại giám khảo nhận được. Phiên của phòng (``--phien-phong`` hay
    tệp trạng thái) là bằng chứng thứ hai, đòi khớp khi biết. Lõi cũ chưa có cờ đó thì
    lùi về cách đoán theo tiêu đề (mọi phiên lab cùng tiêu đề phải là dry_run)."""
    ten = "Phòng xem là dry_run"
    co_co = isinstance(phong, dict) and "dry_run" in phong
    phan: list[str] = []
    ok = True
    if co_co:
        assert isinstance(phong, dict)
        co_phong = phong.get("dry_run")
        phan.append(f"room.dry_run={co_phong}")
        if co_phong is not True:
            ok = False
            phan.append("điện thoại thấy phòng KHÔNG dry_run")
    if tc.phien_phong:
        code, s, loi = _get(api, f"/sessions/{tc.phien_phong}")
        if code != 200 or not isinstance(s, dict):
            return Dong(
                ten, False, "; ".join([*phan, f"/sessions/{tc.phien_phong[:8]}… {_ma(code, loi)}"])
            )
        ok = ok and s.get("dry_run") is True and s.get("platform") == "lab"
        phan.append(
            f"phiên {tc.phien_phong[:8]}… platform={s.get('platform')} dry_run={s.get('dry_run')}"
        )
        return Dong(ten, ok, "; ".join(phan))
    if co_co:
        return Dong(ten, ok, "; ".join(phan) + " (cờ máy chủ gửi tới điện thoại)")
    # Lõi cũ: không có cờ phòng, không biết phiên của phòng (API công khai không lộ
    # mã phiên từ mã phòng). Mọi phiên lab cùng tiêu đề với phòng đều phải là dry_run.
    if not phong:
        return Dong(ten, False, "không đọc được phòng, không xác định được phiên")
    ung_vien = [
        s for s in sessions if s.get("platform") == "lab" and s.get("title") == phong.get("title")
    ]
    if not ung_vien:
        return Dong(ten, False, "không tìm thấy phiên lab của phòng; truyền --phien-phong")
    sai = [s["session_id"][:8] for s in ung_vien if s.get("dry_run") is not True]
    return Dong(
        ten,
        not sai,
        f"lõi chưa trả room.dry_run, đoán theo tiêu đề: {len(ung_vien)} phiên lab mang "
        f"tiêu đề {phong.get('title')!r}"
        + (f"; KHÔNG dry_run: {', '.join(sai)}" if sai else ", tất cả dry_run"),
    )


def nguon_khop(nguon: str, api_url: str, health: Any) -> bool:
    """Tệp trạng thái có ghi cho đúng kho của lõi đang kiểm không.

    * ``api:<địa chỉ>``: khớp khi trùng ``--api``;
    * ``truc-tiep:postgres`` (``gieo_demo_db.py --truc-tiep``): khớp khi lõi đang chạy
      trên PostgreSQL bền (``/health``: ``store_backend=postgres``, ``durable=true``).
      Mã phòng còn được dòng 7 kiểm thật qua Next, nên tin nó không có rủi ro.
    """
    if nguon == f"api:{api_url.rstrip('/')}":
        return True
    if nguon == "truc-tiep:postgres":
        return (
            isinstance(health, dict)
            and health.get("store_backend") == "postgres"
            and health.get("durable") is True
        )
    return False


def in_bang(dong: list[Dong]) -> None:
    rong = max(len(d.hang_muc) for d in dong)
    for d in dong:
        print(f"  {d.hang_muc:<{rong}}  {DAT if d.dat else KHONG:<5}  {d.chi_tiet}")


def main(
    argv: list[str] | None = None,
    *,
    api_transport: httpx.BaseTransport | None = None,
    next_transport: httpx.BaseTransport | None = None,
) -> int:
    configure()
    ap = argparse.ArgumentParser(
        description="Kiểm trước buổi demo LiveLift (lõi + Next + phòng xem)"
    )
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--next", dest="next_url", default="http://127.0.0.1:3130")
    ap.add_argument("--ma-phong", default=None, help="mã phòng xem (mặc định: tệp trạng thái)")
    ap.add_argument("--phien-phong", default=None, help="mã phiên của phòng xem")
    ap.add_argument("--phien", default=None, help="phiên đang phát cần mở (mặc định: tự chọn)")
    ap.add_argument("--tong-ket", default=None, help="phiên cần mở tổng kết (mặc định: tự chọn)")
    ap.add_argument("--tep-trang-thai", type=Path, default=TEP_TRANG_THAI)
    ap.add_argument("--lan", type=int, default=1, help="chạy N lần liên tiếp, ĐẠT khi cả N lần ĐẠT")
    ap.add_argument("--nghi-s", type=float, default=2.0, help="nghỉ giữa các lần (giây)")
    ap.add_argument("--can-ben", action="store_true", help="kho RAM tính là KHÔNG")
    ap.add_argument("--het-gio", type=float, default=HET_GIO_S, help="hạn mỗi yêu cầu (giây)")
    args = ap.parse_args(argv)

    trang_thai = doc_trang_thai(args.tep_trang_thai)
    phong = trang_thai.get("phong") if isinstance(trang_thai.get("phong"), dict) else {}
    nguon = str(trang_thai.get("nguon") or "")

    print("== Kiểm trước buổi demo (lõi + Next + phòng xem) ==")
    print(f"  lõi {args.api} · Next {args.next_url}")
    ket_qua: list[bool] = []
    with (
        httpx.Client(base_url=args.api, timeout=args.het_gio, transport=api_transport) as api,
        httpx.Client(
            base_url=args.next_url,
            timeout=args.het_gio,
            transport=next_transport,
            follow_redirects=True,
        ) as nxt,
    ):
        # Tệp của --truc-tiep chỉ khớp khi lõi đang chạy trên PostgreSQL bền: hỏi /health
        # một lần trước (lỗi mạng thì coi như không khớp; dòng 1 sẽ báo lõi chết).
        health = _get(api, "/health")[1] if nguon == "truc-tiep:postgres" else None
        khop = nguon_khop(nguon, args.api, health)
        tc = TuyChon(
            ma_phong=args.ma_phong or (phong.get("code") if khop else None),
            phien_phong=args.phien_phong
            or (phong.get("session_id") if khop and not args.ma_phong else None),
            phien=args.phien,
            tong_ket=args.tong_ket,
            can_ben=args.can_ben,
        )
        if not args.ma_phong and phong:
            if khop:
                print(f"  Mã phòng {phong.get('code')} lấy từ tệp trạng thái ({nguon}).")
            else:
                print(
                    f"  ! Tệp trạng thái ghi cho {nguon or 'nguồn khác'}, không khớp kho của lõi"
                    " này: không dùng mã phòng trong đó."
                )
        for lan in range(1, max(1, args.lan) + 1):
            if lan > 1 and args.nghi_s > 0:
                time.sleep(args.nghi_s)
            t0 = time.monotonic()
            dong = kiem_mot_lan(api, nxt, tc)
            dat = all(d.dat for d in dong)
            ket_qua.append(dat)
            print()
            print(
                f"  Lần {lan}/{args.lan} · {time.monotonic() - t0:.1f} s · {DAT if dat else KHONG}"
            )
            in_bang(dong)
    print()
    so_dat = sum(ket_qua)
    print(f"  TỔNG: {so_dat}/{len(ket_qua)} lần ĐẠT")
    return 0 if all(ket_qua) else 1


if __name__ == "__main__":
    raise SystemExit(main())

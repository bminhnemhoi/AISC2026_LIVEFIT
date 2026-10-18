"""Đếm số liệu của phòng xem dàn dựng từ ảnh chụp kho (15/10/2026).

Đọc ``STORE_SNAPSHOT_PATH`` mà API phòng xem ghi ra (docs/HUONG-DAN-PHONG-XEM.md §3),
không gọi API và không cần token. Ảnh chụp chỉ chứa băm mã người xem, không có PII.

Đếm cho mỗi phiên ``platform='lab'`` đã phát:

  - người tham gia: băm có sự kiện ``dong_y`` (người đã rút lui chỉ còn ``rut_lui``,
    nên tự động không được đếm, và được đếm riêng);
  - người có thao tác: có ít nhất một lần xem sản phẩm, bấm, thêm giỏ, mua hay bình luận;
  - khối đã chạy xong (bỏ khối washout), tách BẬT/TẮT;
  - số sự kiện theo loại.

Mốc ``--den`` cắt mọi thứ tại một thời điểm, để con số trên slide là "đến lúc nộp".

    .venv\\Scripts\\python scripts\\so_phong_xem.py --anh-chup data\\phong-xem\\snapshot.json ^
        --tu-ngay 2026-10-18 --ra-slide ..\\AISC26_Vong2\\so-phong-dan-dung.txt

``--ra-slide`` chỉ ghi khi có ít nhất một khối chạy xong; chưa có thì giữ ô ⬜ để cổng
của ``dung_slide.py`` chặn, thay vì in một con số 0 lên slide.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

GOC = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(GOC / "src"))

from livelift.api import service  # noqa: E402
from livelift.api.store import InMemoryStore  # noqa: E402
from livelift.console import configure  # noqa: E402

GIO_VN = timezone(timedelta(hours=7))
THAO_TAC = frozenset({"xem_san_pham", "bam", "them_gio", "mua", "binh_luan"})


def nap(duong_dan: Path) -> InMemoryStore:
    store = InMemoryStore()
    store.import_json(duong_dan.read_text(encoding="utf-8"))
    return store


def _truoc(ts: datetime | None, den: datetime | None) -> bool:
    return ts is not None and (den is None or ts <= den)


def tom_tat_phien(store: InMemoryStore, sid: str, den: datetime | None) -> dict[str, Any] | None:
    """Số liệu của một phiên lab đã bắt đầu phát trước ``den``; ``None`` nếu chưa phát."""
    s = store.get_session(sid)
    if s is None or s.get("platform") != "lab" or s.get("status") not in ("live", "ended"):
        return None
    bat_dau = s.get("start_ts")
    if not _truoc(bat_dau, den):
        return None
    cat = min(t for t in (s.get("end_ts"), den, service.now_utc()) if t is not None)

    su_kien = [e for e in store.list_lab_events(sid) if _truoc(e.get("ts"), cat)]
    rut_lui = {e["viewer_hash"] for e in su_kien if e["kind"] == "rut_lui"}
    dong_y = {e["viewer_hash"] for e in su_kien if e["kind"] == "dong_y"} - rut_lui
    co_thao_tac = {e["viewer_hash"] for e in su_kien if e["kind"] in THAO_TAC} - rut_lui

    khoi = [
        b
        for b in store.get_blocks(sid)
        if not b.get("is_washout") and b.get("end_ts") is not None and b["end_ts"] <= cat
    ]
    theo_nhanh = Counter(b["assignment"] for b in khoi)
    return {
        "session_id": sid,
        "ngay": bat_dau.astimezone(GIO_VN).date().isoformat(),
        "nguoi": len(dong_y),
        "nguoi_co_thao_tac": len(co_thao_tac),
        "rut_lui": len(rut_lui),
        "khoi_xong": len(khoi),
        "khoi_bat": theo_nhanh.get("ON", 0),
        "khoi_tat": theo_nhanh.get("OFF", 0),
        "su_kien": dict(
            sorted(Counter(e["kind"] for e in su_kien if e["viewer_hash"] not in rut_lui).items())
        ),
    }


def tom_tat(
    stores: list[InMemoryStore], tu_ngay: date | None, den: datetime | None
) -> dict[str, Any]:
    phien = []
    for store in stores:
        for s in store.list_sessions():
            tt = tom_tat_phien(store, s["session_id"], den)
            if tt is not None and (tu_ngay is None or date.fromisoformat(tt["ngay"]) >= tu_ngay):
                phien.append(tt)
    phien.sort(key=lambda p: (p["ngay"], p["session_id"]))
    return {
        "den": den.isoformat() if den else None,
        "tu_ngay": tu_ngay.isoformat() if tu_ngay else None,
        "phien": phien,
        # Băm có muối là mã phiên (routes/xem.py::viewer_hash), nên một người dự hai tối
        # không nối được với nhau: tổng là lượt tham gia theo phiên, không phải số người.
        "luot_tham_gia": sum(p["nguoi"] for p in phien),
        "khoi_xong": sum(p["khoi_xong"] for p in phien),
        "luot_nhap": sum(p["su_kien"].get("bam", 0) for p in phien),
        "toi": len({p["ngay"] for p in phien}),
    }


def dong_slide(tt: dict[str, Any]) -> str | None:
    """Một dòng cho ô "ĐẾN LÚC NỘP SLIDE" của slide 8, hoặc ``None`` khi chưa có khối nào."""
    if tt["khoi_xong"] == 0:
        return None
    return (
        f"{tt['luot_tham_gia']} lượt người · {tt['khoi_xong']} khối · {tt['luot_nhap']} lượt nhấp"
    )


def main(argv: list[str] | None = None) -> int:
    configure()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--anh-chup",
        type=Path,
        action="append",
        default=None,
        help="ảnh chụp kho (lặp lại được); mặc định data/phong-xem/snapshot.json",
    )
    ap.add_argument(
        "--tu-ngay", type=date.fromisoformat, default=None, help="bỏ phiên trước ngày này (giờ VN)"
    )
    ap.add_argument(
        "--den", type=datetime.fromisoformat, default=None, help="mốc cắt, ISO có múi giờ"
    )
    ap.add_argument("--json", type=Path, default=None, help="ghi chi tiết ra tệp JSON")
    ap.add_argument("--ra-slide", type=Path, default=None, help="ghi dòng cho slide 8")
    a = ap.parse_args(argv)
    if a.den is not None and a.den.tzinfo is None:
        ap.error("--den phải có múi giờ, ví dụ 2026-10-19T21:00+07:00")

    duong_dan = a.anh_chup or [GOC / "data" / "phong-xem" / "snapshot.json"]
    for p in duong_dan:
        if not p.exists():
            print(f"Không thấy ảnh chụp {p}")
            return 1
    tt = tom_tat([nap(p) for p in duong_dan], a.tu_ngay, a.den)

    for p in tt["phien"]:
        nguoi = f"{p['nguoi']} người ({p['nguoi_co_thao_tac']} có thao tác, {p['rut_lui']} rút lui)"
        khoi = f"{p['khoi_xong']} khối ({p['khoi_bat']} BẬT, {p['khoi_tat']} TẮT)"
        su_kien = f"{sum(p['su_kien'].values())} sự kiện"
        print(f"{p['ngay']} {p['session_id'][:8]}: {nguoi} · {khoi} · {su_kien}")
    dong = dong_slide(tt)
    print(dong or "Chưa có khối nào chạy xong — không ghi dòng slide.")
    if a.json:
        a.json.write_text(json.dumps(tt, ensure_ascii=False, indent=2), encoding="utf-8")
    if a.ra_slide and dong:
        a.ra_slide.write_text(dong + "\n", encoding="utf-8")
        print(f"Đã ghi {a.ra_slide}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

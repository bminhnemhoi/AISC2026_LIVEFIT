"""Đếm số liệu của phòng xem dàn dựng từ ảnh chụp kho (15/10/2026).

Đọc ``STORE_SNAPSHOT_PATH`` mà API phòng xem ghi ra (docs/HUONG-DAN-PHONG-XEM.md §3),
không gọi API và không cần token. Ảnh chụp chỉ chứa băm mã người xem, không có PII.

Đếm cho mỗi phiên ``platform='lab'`` đã phát:

  - người tham gia: băm có sự kiện ``dong_y`` (người đã rút lui chỉ còn ``rut_lui``,
    nên tự động không được đếm, và được đếm riêng);
  - người có thao tác: có ít nhất một lần xem sản phẩm, bấm, thêm giỏ, mua hay bình luận;
  - khối đã chạy xong (bỏ khối washout), tách BẬT/TẮT;
  - số sự kiện theo loại.

Mốc ``--den`` cắt mọi thứ tại một thời điểm, để con số trên slide là "đến lúc nộp". Riêng
``rut_lui`` không bị cắt: người rút lui sau khi phiên kết thúc (hay sau mốc) vẫn vào cột
rút lui (xem ``tom_tat_phien``). Vì vậy cột ``rut_lui`` là số tính đến lúc chụp kho, KHÔNG
theo ``--den``, và có thể gồm cả người vào phòng SAU mốc rồi mới rút lui: dòng ``dong_y``
của họ đã bị xoá lúc rút lui, nên không còn biết họ vào lúc nào. Ở mốc ``--den``, cột này
có thể lớn hơn số người thật sự đã tham gia tính đến mốc. Dòng slide không dùng cột này
(chỉ in ra màn hình và JSON); cột người (``nguoi``) vẫn đúng vì người đã rút lui không
được đếm ở đó.

Phiên ``dry_run`` (``mo_phong_xem.py --thu-noi-bo``, cờ ghi một lần lúc tạo phiên) là buổi
thử của nhóm, không phải người ngoài: đếm TÁCH RIÊNG dưới khoá ``thu_noi_bo``, luôn đi kèm
nhãn "DÀN DỰNG · THỬ NỘI BỘ" (cùng nhãn bàn thí nghiệm hiện, ``next/.../desk.ts``) và không
bao giờ cộng vào dòng slide của phòng dàn dựng.

    .venv\\Scripts\\python scripts\\so_phong_xem.py --anh-chup data\\phong-xem\\snapshot.json ^
        --tu-ngay 2026-10-18 --ra-slide ..\\AISC26_Vong2\\so-phong-dan-dung.txt ^
        --ra-thu-noi-bo data\\phong-xem\\so-thu-noi-bo.txt

``--ra-slide`` chỉ ghi khi có ít nhất một khối chạy xong; chưa có thì giữ ô ⬜ để cổng
của ``dung_slide.py`` chặn, thay vì in một con số 0 lên slide. ``--ra-thu-noi-bo`` cũng vậy,
nhưng ra tệp riêng (xem ``dong_thu_noi_bo``). Tệp riêng đó bị từ chối (trước khi đọc ảnh
chụp, không ghi gì) khi tên là so-phong-dan-dung.txt, kể cả lúc không có ``--ra-slide``, hoặc
khi trùng tệp hay trùng tên tệp ``--ra-slide``: ghi vào đó sẽ đè dòng slide hợp lệ, và
``kiem_so.py`` sẽ coi số buổi thử là số có nguồn.
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
NHAN_THU_NOI_BO = "DÀN DỰNG · THỬ NỘI BỘ"
# Tên tệp dung_slide.py đọc cho slide 8 (AISC26_Vong2/dung_slide.py: SO_PHONG); kiem_so.py
# cũng coi số trong tệp này là số có nguồn. Dòng thử nội bộ không bao giờ được ghi vào đây.
TEP_SLIDE = "so-phong-dan-dung.txt"


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

    nhat_ky = store.list_lab_events(sid)
    # Rút lui tính trên TOÀN BỘ nhật ký, không cắt theo ``cat``: routes/xem.py nhận rut_lui
    # cả khi phòng đã đóng, và lúc đó mọi dòng khác của người ấy đã bị xoá. Cắt dòng rut_lui
    # ghi sau end_ts (hay sau --den) thì người ấy biến mất khỏi cả cột người lẫn cột rút lui.
    # Các loại khác vẫn cắt theo ``cat``. Hệ quả: cột rut_lui là số đến lúc chụp kho, không
    # theo --den, và có thể gồm người vào SAU mốc rồi rút lui (dòng dong_y của họ đã bị xoá,
    # không còn biết họ vào lúc nào).
    rut_lui = {e["viewer_hash"] for e in nhat_ky if e["kind"] == "rut_lui"}
    su_kien = [e for e in nhat_ky if _truoc(e.get("ts"), cat)]
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
        "thu_noi_bo": bool(s.get("dry_run")),
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


def _cong(phien: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "phien": phien,
        # Băm có muối là mã phiên (routes/xem.py::viewer_hash), nên một người dự hai tối
        # không nối được với nhau: tổng là lượt tham gia theo phiên, không phải số người.
        "luot_tham_gia": sum(p["nguoi"] for p in phien),
        "khoi_xong": sum(p["khoi_xong"] for p in phien),
        "luot_nhap": sum(p["su_kien"].get("bam", 0) for p in phien),
        "toi": len({p["ngay"] for p in phien}),
    }


def tom_tat(
    stores: list[InMemoryStore], tu_ngay: date | None, den: datetime | None
) -> dict[str, Any]:
    """Các khoá cấp ngoài (``phien``, ``luot_tham_gia``…) chỉ gồm phiên dàn dựng chung; phiên
    ``dry_run`` nằm riêng dưới ``thu_noi_bo``, cùng bộ khoá ấy và nhãn ``nhan``."""
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
        **_cong([p for p in phien if not p["thu_noi_bo"]]),
        "thu_noi_bo": {"nhan": NHAN_THU_NOI_BO, **_cong([p for p in phien if p["thu_noi_bo"]])},
    }


def dong_slide(tt: dict[str, Any]) -> str | None:
    """Một dòng cho ô "ĐẾN LÚC NỘP SLIDE" của slide 8, hoặc ``None`` khi chưa có khối nào."""
    if tt["khoi_xong"] == 0:
        return None
    return (
        f"{tt['luot_tham_gia']} lượt người · {tt['khoi_xong']} khối · {tt['luot_nhap']} lượt nhấp"
    )


def dong_thu_noi_bo(tt: dict[str, Any]) -> str | None:
    """Dòng của các phiên thử nội bộ, mở đầu bằng nhãn; ``None`` khi chưa có khối nào.

    Ra tệp RIÊNG (``--ra-thu-noi-bo``), không nối vào so-phong-dan-dung.txt: dung_slide.py
    đọc cả tệp đó rồi tách theo " · ", nên một dòng thêm sẽ thành cột thứ tư trên slide 8.
    Nhãn "DÀN DỰNG · THỬ NỘI BỘ" đứng đầu còn là chốt an toàn: lỡ trỏ dung_slide.py vào tệp
    này thì ``tach_so_phong`` dừng (cột đầu "DÀN DỰNG" không mở bằng số) thay vì in số buổi
    thử thành số phòng dàn dựng. Đổi nhãn thì giữ chốt này (có test).
    """
    dong = dong_slide(tt["thu_noi_bo"])
    return f"{NHAN_THU_NOI_BO}: {dong}" if dong else None


def _dong_phien(p: dict[str, Any]) -> str:
    nguoi = f"{p['nguoi']} người ({p['nguoi_co_thao_tac']} có thao tác, {p['rut_lui']} rút lui)"
    khoi = f"{p['khoi_xong']} khối ({p['khoi_bat']} BẬT, {p['khoi_tat']} TẮT)"
    su_kien = f"{sum(p['su_kien'].values())} sự kiện"
    nhan = f"[{NHAN_THU_NOI_BO}] " if p["thu_noi_bo"] else ""
    return f"{nhan}{p['ngay']} {p['session_id'][:8]}: {nguoi} · {khoi} · {su_kien}"


def _chan_tep_thu_trung_tep_slide(
    ap: argparse.ArgumentParser, ra_thu: Path | None, ra_slide: Path | None
) -> None:
    """Từ chối (``ap.error``, thoát 2, chưa ghi gì) tệp thử nội bộ có thể đè tệp slide.

    Chặn theo TÊN trước, nên vẫn chặn khi không có ``--ra-slide``: chạy riêng
    ``--ra-thu-noi-bo ..\\AISC26_Vong2\\so-phong-dan-dung.txt`` với mã cũ sẽ đè dòng slide hợp lệ.
    So tên không phân biệt hoa thường (Windows coi là cùng tệp).
    """
    if ra_thu is None:
        return
    if ra_thu.name.casefold() == TEP_SLIDE.casefold():
        ap.error(
            f"--ra-thu-noi-bo không được là {TEP_SLIDE} (tệp dòng slide 8 mà dung_slide.py "
            "đọc); ghi số thử nội bộ ra tệp khác, ví dụ data\\phong-xem\\so-thu-noi-bo.txt"
        )
    if ra_slide is None:
        return
    cung_tep = ra_thu.resolve() == ra_slide.resolve() or (
        ra_thu.exists() and ra_slide.exists() and ra_thu.samefile(ra_slide)
    )
    if cung_tep or ra_thu.name.casefold() == ra_slide.name.casefold():
        ap.error(
            "--ra-thu-noi-bo phải là tệp khác --ra-slide, khác cả tên tệp "
            "(không trộn số thử nội bộ)"
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
    ap.add_argument(
        "--ra-thu-noi-bo",
        type=Path,
        default=None,
        help=(
            f"ghi dòng {NHAN_THU_NOI_BO} (phiên dry_run) ra tệp riêng; không được là "
            f"{TEP_SLIDE} hay trùng tệp/tên tệp --ra-slide"
        ),
    )
    a = ap.parse_args(argv)
    if a.den is not None and a.den.tzinfo is None:
        ap.error("--den phải có múi giờ, ví dụ 2026-10-19T21:00+07:00")
    _chan_tep_thu_trung_tep_slide(ap, a.ra_thu_noi_bo, a.ra_slide)

    duong_dan = a.anh_chup or [GOC / "data" / "phong-xem" / "snapshot.json"]
    for p in duong_dan:
        if not p.exists():
            print(f"Không thấy ảnh chụp {p}")
            return 1
    tt = tom_tat([nap(p) for p in duong_dan], a.tu_ngay, a.den)

    for p in tt["phien"]:
        print(_dong_phien(p))
    dong = dong_slide(tt)
    print(dong or "Chưa có khối nào chạy xong — không ghi dòng slide.")
    tnb = tt["thu_noi_bo"]
    for p in tnb["phien"]:
        print(_dong_phien(p))
    dong_tnb = dong_thu_noi_bo(tt)
    if tnb["phien"]:
        print(dong_tnb or f"{NHAN_THU_NOI_BO}: chưa có khối nào chạy xong.")
        print(f"(Phiên {NHAN_THU_NOI_BO} không cộng vào dòng slide.)")
    if a.json:
        a.json.write_text(json.dumps(tt, ensure_ascii=False, indent=2), encoding="utf-8")
    if a.ra_slide and dong:
        a.ra_slide.write_text(dong + "\n", encoding="utf-8")
        print(f"Đã ghi {a.ra_slide}")
    if a.ra_thu_noi_bo and dong_tnb:
        a.ra_thu_noi_bo.write_text(dong_tnb + "\n", encoding="utf-8")
        print(f"Đã ghi {a.ra_thu_noi_bo}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

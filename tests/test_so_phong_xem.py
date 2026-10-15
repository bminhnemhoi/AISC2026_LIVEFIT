"""``scripts/so_phong_xem.py`` — con số "đến lúc nộp slide" của phòng xem dàn dựng.

Con số này lên slide 8, nên phải đếm đúng ba điều: người đã rút lui không được tính,
khối chưa chạy xong (hoặc sau mốc cắt) không được tính, và chưa có khối nào thì
script không ghi gì (ô ⬜ còn đó để cổng dựng slide chặn) thay vì in "0 khối".
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import timedelta
from pathlib import Path

import pytest

from tests import test_api_xem as xem
from tests.test_api_xem import _blocks, _consent, _event, _go_to

# Dùng lại đúng phòng thật của test hợp đồng (phiên lab đã phát, có phòng xem).
clock, env, room = xem.clock, xem.env, xem.room

GOC = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def spx():
    spec = importlib.util.spec_from_file_location(
        "so_phong_xem", GOC / "scripts" / "so_phong_xem.py"
    )
    assert spec is not None
    assert spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    try:
        spec.loader.exec_module(mod)
        yield mod
    finally:
        sys.modules.pop(spec.name, None)


def _anh_chup(store, tmp_path: Path) -> Path:
    p = tmp_path / "snapshot.json"
    p.write_text(store.export_json(), encoding="utf-8")
    return p


def test_dem_nguoi_khoi_va_bo_nguoi_rut_lui(spx, room, clock, tmp_path):
    client, store, sid, code = room
    khoi = _blocks(store, sid)
    _go_to(clock, store, sid, khoi[0])
    for v in ("viewer-aaaaaaaaaaaaaaaa", "viewer-bbbbbbbbbbbbbbbb", "viewer-cccccccccccccccc"):
        _consent(client, code, v)
    assert (
        _event(client, code, "viewer-aaaaaaaaaaaaaaaa", "b1", "bam", product_id="P-SAP").status_code
        == 200
    )
    assert _event(client, code, "viewer-cccccccccccccccc", "rl", "rut_lui").status_code == 200

    # Sang khối thứ ba: hai khối đầu đã chạy xong.
    _go_to(clock, store, sid, khoi[2])
    tt = spx.tom_tat([spx.nap(_anh_chup(store, tmp_path))], None, clock.now)
    (p,) = tt["phien"]
    assert p["nguoi"] == 2
    assert p["nguoi_co_thao_tac"] == 1
    assert p["rut_lui"] == 1
    assert p["khoi_xong"] == 2
    assert p["khoi_bat"] + p["khoi_tat"] == 2
    assert p["su_kien"] == {"bam": 1, "dong_y": 2}
    assert tt["toi"] == 1
    assert spx.dong_slide(tt) == "2 lượt người · 2 khối · 1 lượt nhấp"


def test_moc_cat_bo_khoi_va_su_kien_sau_moc(spx, room, clock, tmp_path):
    client, store, sid, code = room
    khoi = _blocks(store, sid)
    _go_to(clock, store, sid, khoi[0])
    _consent(client, code, "viewer-aaaaaaaaaaaaaaaa")
    moc = clock.now
    _go_to(clock, store, sid, khoi[3])
    _consent(client, code, "viewer-bbbbbbbbbbbbbbbb")

    anh = _anh_chup(store, tmp_path)
    truoc = spx.tom_tat([spx.nap(anh)], None, moc)
    assert truoc["luot_tham_gia"] == 1
    assert truoc["khoi_xong"] == 0
    assert spx.dong_slide(truoc) is None
    sau = spx.tom_tat([spx.nap(anh)], None, clock.now)
    assert sau["luot_tham_gia"] == 2
    assert sau["khoi_xong"] == 3


def test_loc_tu_ngay_bo_buoi_chay_thu(spx, room, clock, tmp_path):
    _, store, sid, _ = room
    _go_to(clock, store, sid, _blocks(store, sid)[2])
    anh = _anh_chup(store, tmp_path)
    ngay = spx.tom_tat([spx.nap(anh)], None, clock.now)["phien"][0]["ngay"]
    sau_mot_ngay = (clock.now + timedelta(days=1)).astimezone(spx.GIO_VN).date()
    assert spx.tom_tat([spx.nap(anh)], sau_mot_ngay, clock.now)["phien"] == []
    assert ngay == clock.now.astimezone(spx.GIO_VN).date().isoformat()


def test_chua_co_khoi_thi_khong_ghi_tep_slide(spx, room, clock, tmp_path):
    _, store, _, _ = room
    ra = tmp_path / "so-phong-dan-dung.txt"
    assert spx.main(["--anh-chup", str(_anh_chup(store, tmp_path)), "--ra-slide", str(ra)]) == 0
    assert not ra.exists()


def test_den_khong_mui_gio_bi_tu_choi(spx, tmp_path):
    with pytest.raises(SystemExit):
        spx.main(["--anh-chup", str(tmp_path / "x.json"), "--den", "2026-10-19T21:00"])

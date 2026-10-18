"""``scripts/so_phong_xem.py`` — con số "đến lúc nộp slide" của phòng xem dàn dựng.

Con số này lên slide 8, nên phải đếm đúng ba điều: người đã rút lui không được tính,
khối chưa chạy xong (hoặc sau mốc cắt) không được tính, và chưa có khối nào thì
script không ghi gì (ô ⬜ còn đó để cổng dựng slide chặn) thay vì in "0 khối".

Từ 19/10 thêm hai điều: phiên ``dry_run`` (thử nội bộ 20/10) đếm riêng, mang nhãn
"DÀN DỰNG · THỬ NỘI BỘ" (như bàn thí nghiệm) và không lọt vào tệp slide, kể cả khi
``--ra-thu-noi-bo`` lỡ trỏ vào so-phong-dan-dung.txt; dòng ``rut_lui`` ghi sau khi phiên
kết thúc (hay sau mốc ``--den``) vẫn vào cột rút lui.

Luật đọc tệp slide lấy từ CHÍNH hàm ``so_phong`` + ``tach_so_phong`` của
``AISC26_Vong2/dung_slide.py`` khi kho đó nằm cạnh repo (máy nhóm); trên CI không có kho đó
thì dùng bản mô phỏng ``_luat_mo_phong``, và có một test đối chiếu hai bản khi đủ cả hai.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest

from tests import test_api_xem as xem
from tests.test_api_xem import _blocks, _consent, _event, _go_to

# Dùng lại đúng phòng thật của test hợp đồng (phiên lab đã phát, có phòng xem).
clock, env, room = xem.clock, xem.env, xem.room

GOC = Path(__file__).resolve().parents[1]
VA, VB, VC = xem.VIEWERS
DUNG_SLIDE = GOC.parent / "AISC26_Vong2" / "dung_slide.py"
NHAN = "DÀN DỰNG · THỬ NỘI BỘ"


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


def _phien_thu_noi_bo(client) -> tuple[str, str]:
    """Phiên lab ``dry_run`` có phòng mở (như ``mo_phong_xem.py --thu-noi-bo``), phát từ
    giờ hiện tại của đồng hồ giả. Trả về (session_id, mã phòng)."""
    r = client.post(
        "/sessions",
        json={
            "platform": "lab",
            "title": "Thử nội bộ · Phòng thử",
            "planned_duration_min": 60,
            "mode": "auto",
            "dry_run": True,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["dry_run"] is True
    sid = r.json()["session_id"]
    assert client.post(f"/sessions/{sid}/schedule", json={}).status_code == 200
    r = client.post(
        f"/sessions/{sid}/phong-xem",
        json={"consent_version": "2026-10-15", "products": list(xem.PRODUCTS)},
    )
    assert r.status_code == 200, r.text
    assert client.post(f"/sessions/{sid}/start").status_code == 200
    return sid, r.json()["code"]


class SlideDungError(Exception):
    """dung_slide.py dừng ở tệp này: không in số nào lên ô slide 8."""


def _ham_doc_that(tep: Path) -> dict[str, Any] | None:
    """``so_phong`` + ``tach_so_phong`` THẬT của dung_slide.py, đọc ``tep`` thay cho
    so-phong-dan-dung.txt; ``None`` khi kho AISC26_Vong2 không nằm cạnh repo (CI).

    Lấy đúng mã hai hàm bằng ast thay vì import cả tệp: dung_slide.py cần python-pptx, PIL
    và chạy mã cấp module. Hai hàm đổi tên thì test đỏ, để bản mô phỏng được xem lại.
    """
    if not DUNG_SLIDE.exists():
        return None
    cay = ast.parse(DUNG_SLIDE.read_text(encoding="utf-8"), filename=str(DUNG_SLIDE))
    ham = [
        n
        for n in cay.body
        if isinstance(n, ast.FunctionDef) and n.name in ("so_phong", "tach_so_phong")
    ]
    assert sorted(n.name for n in ham) == ["so_phong", "tach_so_phong"], DUNG_SLIDE
    ns: dict[str, Any] = {"SO_PHONG": tep}
    exec(compile(ast.Module(body=ham, type_ignores=[]), str(DUNG_SLIDE), "exec"), ns)
    return ns


def _luat_mo_phong(chu: str) -> list[tuple[str, str]]:
    """Bản sao luật ``tach_so_phong`` (khi không có kho AISC26_Vong2): tách theo " · ",
    mỗi cột mở bằng một số rồi tới nhãn. Sai dạng thì dừng, như dung_slide.py."""
    cot = []
    for phan in chu.split(" · "):
        so, _, nhan = phan.strip().partition(" ")
        if not so.replace(".", "").isdigit() or not nhan:
            raise SlideDungError(repr(phan))
        cot.append((so, nhan))
    return cot


def _doc_nhu_dung_slide(tep: Path) -> list[tuple[str, str]] | None:
    """Đọc ``tep`` đúng như dung_slide.py đọc tệp slide cho ô slide 8 (``so_phong`` đọc CẢ
    tệp, bỏ trắng hai đầu; rỗng hay không có tệp thì ô ⬜, tức ``None``). Dừng thì ném
    ``SlideDungError``."""
    ns = _ham_doc_that(tep)
    if ns is None:
        chu = tep.read_text(encoding="utf-8").strip() if tep.exists() else ""
        return _luat_mo_phong(chu) if chu else None
    chu = ns["so_phong"]()
    if chu is None:
        return None
    try:
        return ns["tach_so_phong"](chu)
    except SystemExit as e:
        raise SlideDungError(str(e)) from e


def _phien_dan_dung_co_khoi_xong(client, store, sid, code, clock) -> None:
    """Phiên dàn dựng chung: VA đồng ý ở khối đầu, rồi sang khối thứ ba (2 khối xong)."""
    khoi = _blocks(store, sid)
    _go_to(clock, store, sid, khoi[0])
    _consent(client, code, VA)
    _go_to(clock, store, sid, khoi[2])


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


# ---------------------------------------------------------------------------
# Phiên thử nội bộ (dry_run): đếm riêng, nhãn THỬ NỘI BỘ, không vào tệp slide
# ---------------------------------------------------------------------------


def test_phien_thu_noi_bo_dem_rieng_khong_tron_vao_so_slide(spx, room, clock, tmp_path, capsys):
    client, store, sid, code = room
    sid_thu, code_thu = _phien_thu_noi_bo(client)
    _go_to(clock, store, sid, _blocks(store, sid)[0])
    _consent(client, code, VA)
    for v in (VB, VC):
        _consent(client, code_thu, v)
    assert _event(client, code_thu, VB, "b1", "bam", product_id="P-SAP").status_code == 200
    _go_to(clock, store, sid, _blocks(store, sid)[2])
    khoi_thu = sum(1 for b in _blocks(store, sid_thu) if b["end_ts"] <= clock.now)
    assert khoi_thu >= 1

    anh = _anh_chup(store, tmp_path)
    tt = spx.tom_tat([spx.nap(anh)], None, clock.now)
    # Cấp ngoài (nguồn của dòng slide) chỉ có phiên dàn dựng chung.
    assert [p["session_id"] for p in tt["phien"]] == [sid]
    assert tt["phien"][0]["thu_noi_bo"] is False
    assert (tt["luot_tham_gia"], tt["khoi_xong"], tt["luot_nhap"], tt["toi"]) == (1, 2, 0, 1)
    # Phiên thử nằm riêng, mang nhãn.
    tnb = tt["thu_noi_bo"]
    assert tnb["nhan"] == NHAN
    (p,) = tnb["phien"]
    assert p["session_id"] == sid_thu
    assert p["thu_noi_bo"] is True
    assert p["su_kien"] == {"bam": 1, "dong_y": 2}
    assert (tnb["luot_tham_gia"], tnb["khoi_xong"], tnb["luot_nhap"], tnb["toi"]) == (
        2,
        khoi_thu,
        1,
        1,
    )
    assert spx.dong_slide(tt) == "1 lượt người · 2 khối · 0 lượt nhấp"
    assert spx.dong_thu_noi_bo(tt) == f"{NHAN}: 2 lượt người · {khoi_thu} khối · 1 lượt nhấp"

    # Qua main(): tệp slide giữ đúng một dòng ba cột mà dung_slide.py đọc, số thử nội bộ
    # ra tệp riêng; JSON giữ các khoá cũ và thêm khoá thu_noi_bo.
    slide = tmp_path / "so-phong-dan-dung.txt"
    thu = tmp_path / "so-thu-noi-bo.txt"
    js = tmp_path / "so-phong.json"
    argv = ["--anh-chup", str(anh), "--den", clock.now.isoformat(), "--json", str(js)]
    assert spx.main([*argv, "--ra-slide", str(slide), "--ra-thu-noi-bo", str(thu)]) == 0
    noi_dung = slide.read_text(encoding="utf-8")
    assert noi_dung == "1 lượt người · 2 khối · 0 lượt nhấp\n"
    assert _doc_nhu_dung_slide(slide) == [("1", "lượt người"), ("2", "khối"), ("0", "lượt nhấp")]
    assert thu.read_text(encoding="utf-8") == spx.dong_thu_noi_bo(tt) + "\n"
    du_lieu = json.loads(js.read_text(encoding="utf-8"))
    assert du_lieu["luot_tham_gia"] == 1
    assert du_lieu["thu_noi_bo"]["luot_tham_gia"] == 2
    assert du_lieu["thu_noi_bo"]["nhan"] == NHAN
    out = capsys.readouterr().out
    assert f"[{NHAN}] {p['ngay']} {sid_thu[:8]}: 2 người" in out
    assert f"{p['ngay']} {sid[:8]}: 1 người" in out


def test_chi_co_phien_thu_noi_bo_thi_khong_ghi_tep_slide(spx, room, clock, tmp_path):
    """Tối 20/10 chỉ có buổi thử: ô slide vẫn ⬜ (không ghi tệp slide), số thử ra tệp riêng."""
    client, store, sid, _ = room
    # Phiên dàn dựng dừng ngay lúc bắt đầu: không khối nào chạy xong.
    assert client.post(f"/sessions/{sid}/end").status_code == 200
    sid_thu, code_thu = _phien_thu_noi_bo(client)
    khoi = _blocks(store, sid_thu)
    _go_to(clock, store, sid_thu, khoi[0])
    _consent(client, code_thu, VA)
    _go_to(clock, store, sid_thu, khoi[2])

    slide = tmp_path / "so-phong-dan-dung.txt"
    thu = tmp_path / "so-thu-noi-bo.txt"
    argv = ["--anh-chup", str(_anh_chup(store, tmp_path))]
    assert spx.main([*argv, "--ra-slide", str(slide), "--ra-thu-noi-bo", str(thu)]) == 0
    assert not slide.exists()
    noi_dung = thu.read_text(encoding="utf-8")
    assert noi_dung == "DÀN DỰNG · THỬ NỘI BỘ: 1 lượt người · 2 khối · 0 lượt nhấp\n"
    # Lỡ trỏ dung_slide.py vào tệp thử thì nó dừng ngay ở cột đầu "DÀN DỰNG" (không mở bằng
    # số), không in số buổi thử thành số phòng dàn dựng.
    with pytest.raises(SlideDungError, match="DÀN DỰNG"):
        _doc_nhu_dung_slide(thu)


def test_chi_co_phien_dan_dung_thi_khong_tao_tep_thu_noi_bo(spx, room, clock, tmp_path, capsys):
    """Có --ra-thu-noi-bo mà không có phiên dry_run nào: không tạo tệp thử (kể cả tệp rỗng),
    tệp slide vẫn ghi bình thường."""
    client, store, sid, code = room
    _phien_dan_dung_co_khoi_xong(client, store, sid, code, clock)

    slide = tmp_path / "so-phong-dan-dung.txt"
    thu = tmp_path / "so-thu-noi-bo.txt"
    argv = ["--anh-chup", str(_anh_chup(store, tmp_path))]
    assert spx.main([*argv, "--ra-slide", str(slide), "--ra-thu-noi-bo", str(thu)]) == 0
    assert not thu.exists()
    assert slide.read_text(encoding="utf-8") == "1 lượt người · 2 khối · 0 lượt nhấp\n"
    out = capsys.readouterr().out
    assert "THỬ NỘI BỘ" not in out
    assert f"Đã ghi {thu}" not in out


@pytest.mark.parametrize(
    ("ten_thu", "ten_slide", "loi"),
    [
        # Không truyền --ra-slide: vẫn chặn theo tên tệp slide.
        ("so-phong-dan-dung.txt", None, "không được là so-phong-dan-dung.txt"),
        ("AISC26_Vong2/SO-PHONG-DAN-DUNG.TXT", None, "không được là so-phong-dan-dung.txt"),
        ("so-phong-dan-dung.txt", "so-phong-dan-dung.txt", "không được là so-phong-dan-dung.txt"),
        # Có --ra-slide với tên khác: trùng tệp (qua "..") hay trùng tên tệp đều bị chặn.
        ("ra/../slide-8.txt", "slide-8.txt", "phải là tệp khác --ra-slide"),
        ("khac/slide-8.txt", "slide-8.txt", "phải là tệp khác --ra-slide"),
    ],
)
def test_tep_thu_noi_bo_co_the_de_tep_slide_bi_tu_choi(
    spx, tmp_path, capsys, ten_thu, ten_slide, loi
):
    """Kiểm THÔNG BÁO lỗi, không chỉ SystemExit: trên mã chưa có cờ --ra-thu-noi-bo, argparse
    cũng thoát 2 (cờ lạ) nhưng với thông báo khác, nên test này đỏ đúng lý do."""
    argv = ["--anh-chup", str(tmp_path / "x.json"), "--ra-thu-noi-bo", str(tmp_path / ten_thu)]
    if ten_slide is not None:
        argv += ["--ra-slide", str(tmp_path / ten_slide)]
    with pytest.raises(SystemExit) as loi_thoat:
        spx.main(argv)
    assert loi_thoat.value.code == 2
    err = capsys.readouterr().err
    assert loi in err, err
    assert list(tmp_path.rglob("*")) == []  # không ghi tệp nào


def test_chi_ra_thu_noi_bo_tro_vao_tep_slide_khong_de_dong_slide(
    spx, room, clock, tmp_path, capsys
):
    """Ca người duyệt đã tái hiện: chạy RIÊNG
    ``--ra-thu-noi-bo ..\\AISC26_Vong2\\so-phong-dan-dung.txt`` sau buổi thử. Mã trước đó ghi
    đè dòng slide hợp lệ bằng dòng thử nội bộ (slide 8 mất số, kiem_so.py coi số buổi thử là
    số có nguồn). Nay bị từ chối trước khi đọc ảnh chụp, tệp slide giữ nguyên."""
    client, store, sid, code = room
    assert client.post(f"/sessions/{sid}/end").status_code == 200
    sid_thu, code_thu = _phien_thu_noi_bo(client)
    khoi = _blocks(store, sid_thu)
    _go_to(clock, store, sid_thu, khoi[0])
    _consent(client, code_thu, VA)
    _go_to(clock, store, sid_thu, khoi[2])

    slide = tmp_path / "AISC26_Vong2" / "so-phong-dan-dung.txt"
    slide.parent.mkdir()
    cu = "3 lượt người · 4 khối · 5 lượt nhấp\n"
    slide.write_text(cu, encoding="utf-8")
    anh = _anh_chup(store, tmp_path)
    with pytest.raises(SystemExit):
        spx.main(["--anh-chup", str(anh), "--ra-thu-noi-bo", str(slide)])
    assert "không được là so-phong-dan-dung.txt" in capsys.readouterr().err
    assert slide.read_text(encoding="utf-8") == cu
    assert _doc_nhu_dung_slide(slide) == [("3", "lượt người"), ("4", "khối"), ("5", "lượt nhấp")]


@pytest.mark.skipif(not DUNG_SLIDE.exists(), reason="không có kho AISC26_Vong2 cạnh repo")
@pytest.mark.parametrize(
    "chu",
    [
        "12 lượt người · 36 khối · 140 lượt nhấp\n",
        "1 lượt người · 2 khối · 0 lượt nhấp",
        "  7 lượt người · 1.200 khối · 3 lượt nhấp  \n",
        "DÀN DỰNG · THỬ NỘI BỘ: 1 lượt người · 2 khối · 0 lượt nhấp\n",
        "THỬ NỘI BỘ: 1 lượt người · 2 khối · 0 lượt nhấp\n",
        "12 lượt người · ⬜ khối · 140 lượt nhấp",
        "12 · 36 khối",
        "",
        "\n",
    ],
)
def test_luat_mo_phong_khop_ham_that_cua_dung_slide(tmp_path, chu):
    """Bản mô phỏng (dùng trên CI) phải cho cùng kết quả với hàm thật của dung_slide.py."""
    tep = tmp_path / "so-phong-dan-dung.txt"
    tep.write_text(chu, encoding="utf-8")
    ns = _ham_doc_that(tep)
    assert ns is not None
    goc = chu.strip()
    try:
        mo_phong = _luat_mo_phong(goc) if goc else None
    except SlideDungError:
        mo_phong = "dừng"
    try:
        that = _doc_nhu_dung_slide(tep)
    except SlideDungError:
        that = "dừng"
    assert that == mo_phong


# ---------------------------------------------------------------------------
# Rút lui ghi sau khi phiên kết thúc / sau mốc cắt
# ---------------------------------------------------------------------------


def test_rut_lui_sau_khi_phien_ket_thuc_van_vao_cot_rut_lui(spx, room, clock, tmp_path):
    client, store, sid, code = room
    khoi = _blocks(store, sid)
    _go_to(clock, store, sid, khoi[0])
    for v in (VA, VB):
        _consent(client, code, v)
    assert _event(client, code, VB, "b1", "bam", product_id="P-SAP").status_code == 200
    _go_to(clock, store, sid, khoi[2])
    assert client.post(f"/sessions/{sid}/end").status_code == 200
    het = store.get_session(sid)["end_ts"]

    # Nửa giờ sau khi đóng phòng, VB mới bấm "Rút lui" (routes/xem.py nhận ở mọi trạng thái).
    clock.now = het + timedelta(minutes=30)
    assert _event(client, code, VB, "rl", "rut_lui").status_code == 200
    (dong,) = [e for e in store.list_lab_events(sid) if e["kind"] == "rut_lui"]
    assert dong["ts"] > het  # đúng ca lỗi cũ: dòng nằm sau end_ts

    (p,) = spx.tom_tat([spx.nap(_anh_chup(store, tmp_path))], None, None)["phien"]
    assert p["rut_lui"] == 1
    assert p["nguoi"] == 1
    assert p["nguoi_co_thao_tac"] == 0
    assert p["su_kien"] == {"dong_y": 1}
    assert p["khoi_xong"] == 2


def test_rut_lui_sau_moc_den_van_dem_loai_khac_van_cat(spx, room, clock, tmp_path):
    """Chỉ rut_lui bỏ qua mốc cắt; cú bấm và lần đồng ý sau mốc vẫn bị cắt."""
    client, store, sid, code = room
    khoi = _blocks(store, sid)
    _go_to(clock, store, sid, khoi[0])
    for v in (VA, VB):
        _consent(client, code, v)
    moc = clock.now
    _go_to(clock, store, sid, khoi[3])
    assert _event(client, code, VA, "b1", "bam", product_id="P-SAP").status_code == 200
    assert _event(client, code, VB, "rl", "rut_lui").status_code == 200
    _consent(client, code, VC)

    (p,) = spx.tom_tat([spx.nap(_anh_chup(store, tmp_path))], None, moc)["phien"]
    assert p["nguoi"] == 1  # VA; VB đã rút lui, VC vào sau mốc
    assert p["rut_lui"] == 1
    assert p["nguoi_co_thao_tac"] == 0  # cú bấm của VA sau mốc bị cắt
    assert p["su_kien"] == {"dong_y": 1}

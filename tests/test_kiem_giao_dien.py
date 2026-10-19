"""``scripts/kiem_giao_dien.py``: phần phân loại thuần (không mở trình duyệt).

Trình duyệt chỉ đo (DO_JS); mọi quyết định ĐỎ/VÀNG nằm ở Python và được thử ở đây bằng số đo
dựng tay: tràn ngang, nút thấp, phần tử nghiêng chứa nút, chữ cấm, vùng chính, tương phản.
"""

from __future__ import annotations

import importlib.util
import math
import sys
from pathlib import Path

import pytest

TEP = Path(__file__).resolve().parents[1] / "scripts" / "kiem_giao_dien.py"


def _nap():
    spec = importlib.util.spec_from_file_location("kiem_giao_dien", TEP)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["kiem_giao_dien"] = mod
    spec.loader.exec_module(mod)
    return mod


kg = _nap()


# ------------------------------------------------------------------ khung, tuyến
def test_doc_khung():
    assert kg.doc_khung("1280x720") == (1280, 720)
    assert kg.doc_khung(" 390×844 ") == (390, 844)
    with pytest.raises(kg.LoiCauHinh):
        kg.doc_khung("1280-720")


def test_chuan_tuyen_sua_duong_git_bash():
    assert kg.chuan_tuyen("C:/Program Files/Git/phien") == "/phien"
    assert kg.chuan_tuyen("phien/abc") == "/phien/abc"
    assert kg.chuan_tuyen("/xem/ijfCUXSD") == "/xem/ijfCUXSD"


def test_mo_rong_tuyen_va_ten_tep():
    gia = {"phien_live": "c79068d1-3e16-4e4a-a94a-c458c3e4a036", "ma_phong": "ijfCUXSD"}
    tuyen, thieu = kg.mo_rong_tuyen("/phien/{phien_live}/nguoi-dan", gia)
    assert thieu == []
    assert tuyen == "/phien/c79068d1-3e16-4e4a-a94a-c458c3e4a036/nguoi-dan"
    assert kg.ten_tep(tuyen) == "phien_c79068d1_nguoi-dan"
    assert kg.mo_rong_tuyen("/phien/{phien_doi}/tong-ket", gia) == (None, ["phien_doi"])
    assert kg.ten_tep("/") == "goc"
    assert kg.ten_tep("/gioi-thieu?anh-poster=1") == "gioi-thieu"


def test_chon_phien_tu_danh_sach_api():
    ds = [
        {
            "session_id": "a",
            "status": "ended",
            "title": "Demo vàng · ĐỔI #1",
            "is_demo": True,
            "platform": "sim",
            "start_ts": "2026-10-18T11:00:00Z",
        },
        {
            "session_id": "b",
            "status": "ended",
            "title": "Demo vàng · ĐO THÊM #1",
            "is_demo": True,
            "platform": "sim",
            "start_ts": "2026-10-18T12:00:00Z",
        },
        {
            "session_id": "c",
            "status": "ended",
            "title": "Demo vàng · CHƯA ĐỦ KHỐI",
            "is_demo": True,
            "platform": "sim",
            "start_ts": "2026-10-18T13:00:00Z",
        },
        {
            "session_id": "d",
            "status": "live",
            "title": "Phiên đang phát",
            "is_demo": True,
            "platform": "replay",
            "start_ts": "2026-10-19T04:00:00Z",
        },
        {
            "session_id": "e",
            "status": "live",
            "title": "Thử nội bộ",
            "is_demo": False,
            "platform": "lab",
            "start_ts": "2026-10-19T05:00:00Z",
        },
        {
            "session_id": "f",
            "status": "ended",
            "title": "Phiên thật ĐỔI",
            "is_demo": False,
            "platform": "sim",
            "start_ts": "2026-10-19T06:00:00Z",
        },
    ]
    gia = kg.chon_phien(ds)
    assert gia == {
        "phien_live": "d",
        "phien_doi": "a",
        "phien_do_them": "b",
        "phien_chua_du": "c",
        "phien_lab": "e",
    }
    assert kg.chon_phien([]) == {}


# ------------------------------------------------------------------ góc nghiêng
def _m(deg: float) -> str:
    r = math.radians(deg)
    return f"matrix({math.cos(r)}, {math.sin(r)}, {-math.sin(r)}, {math.cos(r)}, 4, 8)"


@pytest.mark.parametrize(
    ("transform", "rotate", "goc"),
    [
        ("none", "none", 0.0),
        ("matrix(1, 0, 0, 1, 10, 20)", None, 0.0),
        ("matrix(1.05, 0, 0, 1.05, 0, 0)", None, 0.0),
        (_m(3), None, 3.0),
        (_m(-1.5), None, 1.5),
        (_m(180), None, 180.0),
        (f"matrix(1, 0, {math.tan(math.radians(5))}, 1, 0, 0)", None, 5.0),
        ("matrix(-1, 0, 0, 1, 0, 0)", None, 0.0),
        (
            "matrix3d(-1, 0, 1.22465e-16, 0, 0, 1, 0, 0, -1.22465e-16, 0, -1, 0, 0, 0, 0, 1)",
            None,
            0.0,
        ),
        ("matrix3d(0.5, 0, -0.866025, 0, 0, 1, 0, 0, 0.866025, 0, 0.5, 0, 0, 0, 0, 1)", None, 0.0),
        ("none", "2deg", 2.0),
        ("none", "z 4deg", 4.0),
        ("none", "x 30deg", 0.0),
        ("none", "0 0 1 6deg", 6.0),
        ("none", "0.5turn", 180.0),
        ("none", "-358deg", 2.0),
    ],
)
def test_goc_nghieng(transform, rotate, goc):
    assert kg.goc_nghieng(transform, rotate) == pytest.approx(goc, abs=1e-3)


# ------------------------------------------------------------------ chữ
@pytest.mark.parametrize(
    ("chu", "nhan"),
    [
        ("Phiên SIMULATED Live", "SIMULATED"),
        ("Click để ghim", "Click"),
        ("CTOR 4,2", "CTOR"),
        ("Giá: null", "NULL"),
        ("Tổng undefined đồng", "undefined"),
        ("NaN lượt", "NaN"),
        ("[object Object]", "[object Object]"),
        ("Loading…", "Loading"),
        ("TypeError: Failed to fetch", "Failed to fetch"),
        ("404 Not Found", "Not Found"),
        ("Kết quả — 16 khối", "—"),
        ("Tung đồng xu cho từng khúc 5 phút", "khúc"),
        ("Bấm Khoá lịch", "khoá lịch"),
        ("khóa lịch trước giờ live", "khoá lịch"),
    ],
)
def test_tim_chu_cam_bat_duoc(chu, nhan):
    assert nhan in [n for n, _, _ in kg.tim_chu_cam(chu)]


@pytest.mark.parametrize(
    "chu",
    [
        "Ca khúc mở màn",
        "Mỗi khối 5 phút, niêm phong lịch trước giờ live",
        "Đang tải",
        "Tỷ lệ nhấp",
        "Khoá bằng mã băm",
        "khúc mắc của người bán",
    ],
)
def test_tim_chu_cam_khong_bao_nham(chu):
    assert kg.tim_chu_cam(chu) == []


def test_them_chu_cam():
    them = (("thêm: A/B", r"A/B", 0),)
    assert [n for n, _, _ in kg.tim_chu_cam("thử A/B", them)] == ["thêm: A/B"]


def test_tim_tieng_anh():
    ra = kg.tim_tieng_anh(
        "Skip to main content\nBàn thí nghiệm\nLiveLift Live Desk\nHome\nXem ngay"
    )
    assert "«Skip to main content»" in ra
    assert "«Home»" in ra
    assert any(x.startswith("«Home»") for x in ra)
    assert not any(
        "Bàn thí nghiệm" in x or "LiveLift Live Desk" in x or "Xem ngay" in x for x in ra
    )


# ------------------------------------------------------------------ tương phản
def test_ty_le_tuong_phan():
    assert kg.ty_le_tuong_phan("rgb(0, 0, 0)", "rgb(255, 255, 255)") == pytest.approx(21.0)
    assert kg.ty_le_tuong_phan("rgb(119, 119, 119)", "rgb(255, 255, 255)") == pytest.approx(
        4.48, abs=0.01
    )
    # chữ đen mờ 50% trên nền trắng = xám (127,5)
    assert kg.ty_le_tuong_phan("rgba(0, 0, 0, 0.5)", "rgb(255, 255, 255)") == pytest.approx(
        3.95, abs=0.05
    )
    assert kg.ty_le_tuong_phan("oklch(0.5 0.1 120)", "rgb(255, 255, 255)") is None
    assert kg.ty_le_tuong_phan("rgb(0, 0, 0)", "rgba(255, 255, 255, 0.5)") is None
    assert kg.chu_lon(24, 400)
    assert kg.chu_lon(19, 700)
    assert not kg.chu_lon(18, 700)


# ------------------------------------------------------------------ phân loại số đo
def _do(**kw):
    co_ban = {
        "tran": {"sw": 1280, "cw": 1280, "thu_pham": []},
        "tuong_tac": [],
        "nghieng": [],
        "vung_chinh": [{"mo_ta": "main[data-vung-chinh]", "top": 0, "bottom": 600, "hien": True}],
        "thuoc_tinh": [],
        "chu_mau": [],
        "chu": "Bàn thí nghiệm",
        "tieu_de": "LiveLift · Đo hiệu quả ghim",
        "next_loi": None,
        "cao_man": 720,
    }
    co_ban.update(kw)
    return co_ban


def _loai(phat):
    return {(p.muc, p.loai) for p in phat}


def test_trang_sach_khong_co_gi():
    assert kg.phan_tich(_do(), "/phien", (1280, 720)) == []


def test_tran_ngang_la_do():
    do = _do(
        tran={
            "sw": 638,
            "cw": 390,
            "thu_pham": [{"mo_ta": "table.ph-table", "right": 638, "left": 0}],
        }
    )
    phat = kg.phan_tich(do, "/phien", (390, 844))
    assert ("ĐỎ", "tran-ngang") in _loai(phat)
    assert "table.ph-table" in phat[0].mo_ta


def test_nut_thap_vang_nut_chinh_do_lien_ket_trong_cau_mien():
    do = _do(
        tuong_tac=[
            {"mo_ta": "button «Ghim»", "h": 36, "nut_chinh": False, "noi_dong": False},
            {"mo_ta": "button «Ghim»", "h": 36, "nut_chinh": False, "noi_dong": False},
            {
                "mo_ta": "button «Ghim món của khối này»",
                "h": 44,
                "nut_chinh": True,
                "noi_dong": False,
            },
            {"mo_ta": "a «nguồn»", "h": 18, "nut_chinh": False, "noi_dong": True},
            {"mo_ta": "button «Kết thúc phiên»", "h": 48, "nut_chinh": True, "noi_dong": False},
        ]
    )
    phat = kg.phan_tich(do, "/phien/x", (1280, 720))
    assert _loai(phat) == {("VÀNG", "nut-thap"), ("ĐỎ", "nut-chinh-thap")}
    thap = [p for p in phat if p.loai == "nut-thap"]
    assert len(thap) == 1
    assert "(×2)" in thap[0].mo_ta
    assert ("ĐỎ", "nut-thap") in _loai(kg.phan_tich(do, "/phien/x", (1280, 720), nghiem=True))


def test_nghieng_chua_nut_la_do_trang_tri_nho_duoc_phep():
    do = _do(
        nghieng=[
            {
                "mo_ta": "div.the-ghim",
                "transform": _m(-2),
                "rotate": "none",
                "la_tuong_tac": False,
                "chua_tuong_tac": 2,
                "aria_hidden": False,
            },
            {
                "mo_ta": "svg.xu",
                "transform": _m(1.5),
                "rotate": "none",
                "la_tuong_tac": False,
                "chua_tuong_tac": 0,
                "aria_hidden": True,
            },
            {
                "mo_ta": "div.dong-xu-lat",
                "transform": "matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)",
                "rotate": "none",
                "la_tuong_tac": False,
                "chua_tuong_tac": 1,
                "aria_hidden": False,
            },
            {
                "mo_ta": "span.nhan",
                "transform": "none",
                "rotate": "5deg",
                "la_tuong_tac": False,
                "chua_tuong_tac": 0,
                "aria_hidden": True,
            },
            {
                "mo_ta": "span.chip",
                "transform": _m(1),
                "rotate": "none",
                "la_tuong_tac": False,
                "chua_tuong_tac": 0,
                "aria_hidden": False,
            },
        ]
    )
    phat = kg.phan_tich(do, "/xem/abc", (390, 844))
    do_ = [p for p in phat if p.muc == "ĐỎ"]
    assert [p.loai for p in do_] == ["nghieng-chua-nut"]
    assert "div.the-ghim" in do_[0].mo_ta
    vang = sorted(p.mo_ta for p in phat if p.loai == "nghieng-trang-tri")
    assert len(vang) == 2
    assert "span.chip" in vang[0]
    assert "span.nhan" in vang[1]


def test_chu_cam_trong_tieu_de_va_thuoc_tinh():
    do = _do(
        tieu_de="LiveLift — Livestream",
        thuoc_tinh=[{"mo_ta": "button", "thuoc_tinh": "aria-label", "chu": "Ghim SIMULATED"}],
        chu="Bàn thí nghiệm\nkhúc 5 phút",
    )
    phat = [p for p in kg.phan_tich(do, "/phien", (1280, 720)) if p.loai == "chu-cam"]
    assert len(phat) == 3
    assert all(p.muc == "ĐỎ" for p in phat)
    assert any("tiêu đề tab" in p.mo_ta for p in phat)
    assert any("aria-label" in p.mo_ta for p in phat)


def test_vung_chinh_rong_do_hep_vang_thieu_vang():
    do = _do(
        vung_chinh=[{"mo_ta": "section[data-vung-chinh]", "top": 80, "bottom": 900, "hien": True}]
    )
    assert ("ĐỎ", "vung-chinh") in _loai(kg.phan_tich(do, "/phien/x", (1280, 720)))
    do_dt = _do(cao_man=844, vung_chinh=[{"mo_ta": "s", "top": 80, "bottom": 1200, "hien": True}])
    assert ("VÀNG", "vung-chinh") in _loai(kg.phan_tich(do_dt, "/phien/x", (390, 844)))
    assert ("VÀNG", "thieu-vung-chinh") in _loai(
        kg.phan_tich(_do(vung_chinh=[]), "/phien", (1280, 720))
    )


def test_tuong_phan_kem_la_vang_chu_lon_nguong_3():
    do = _do(
        chu_mau=[
            {
                "mo_ta": "p.mo",
                "mau": "rgb(160, 160, 160)",
                "nen": "rgb(255, 255, 255)",
                "co": 16,
                "dam": 400,
            },
            {
                "mo_ta": "h1.to",
                "mau": "rgb(130, 130, 130)",
                "nen": "rgb(255, 255, 255)",
                "co": 32,
                "dam": 700,
            },
            {
                "mo_ta": "p.ro",
                "mau": "rgb(40, 40, 40)",
                "nen": "rgb(255, 255, 255)",
                "co": 16,
                "dam": 400,
            },
        ]
    )
    phat = [p for p in kg.phan_tich(do, "/phien", (1280, 720)) if p.loai == "tuong-phan"]
    assert len(phat) == 1
    assert "p.mo" in phat[0].mo_ta
    assert phat[0].muc == "VÀNG"


def test_loi_next_va_trang_loi_la_do():
    do = _do(next_loi="huy hiệu Next báo lỗi chạy", chu="Operational Workspace Degraded")
    assert {("ĐỎ", "loi-next"), ("ĐỎ", "trang-loi")} <= _loai(
        kg.phan_tich(do, "/phien", (1280, 720))
    )


def test_ma_thoat_va_bang_dem():
    vang = kg.Phat("VÀNG", "nut-thap", "/phien", "1280x720", "x")
    do = kg.Phat("ĐỎ", "tran-ngang", "/phien", "390x844", "y")
    assert kg.ma_thoat([vang]) == 0
    assert kg.ma_thoat([vang, do]) == 1
    dong = kg.bang_dem([vang, do])
    assert dong[-1] == "kiem_giao_dien: 1 đỏ · 1 vàng"
    assert do.dong_in().startswith("ĐỎ   /phien @390x844 [tran-ngang]")


def test_thu_muc_anh_mac_dinh_nam_trong_vong2_hoac_cay():
    p = kg.thu_muc_anh_mac_dinh()
    assert p.parts[-2:] == ("_tam", "anh-ui")

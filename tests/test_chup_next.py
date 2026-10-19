"""``scripts/chup_next.py``: cấu hình cảnh K8, lọc cảnh, chặn ghi đè ảnh đã nộp.

Không mở trình duyệt: chỉ thử phần thuần.
"""

from __future__ import annotations

import importlib.util
import struct
import sys
import zlib
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def _nap(ten):
    spec = importlib.util.spec_from_file_location(ten, SCRIPTS / f"{ten}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[ten] = mod
    spec.loader.exec_module(mod)
    return mod


kg = _nap("kiem_giao_dien")
cn = _nap("chup_next")


def test_cau_hinh_k8_hop_le_va_du_trang():
    ds = cn.nap_cau_hinh(cn.CAU_HINH_MAC_DINH)
    ten = [c.ten for c in ds]
    assert len(ten) == len(set(ten))
    slide = {s for c in ds for s in c.slide}
    assert {"01", "13", "14", "M1", "M2", "M3", "M4"} <= slide
    for c in ds:
        assert c.tuyen.startswith("/")
        assert c.dsf in (2, 3)
        if c.dien_thoai:
            assert c.khung == (390, 844)
    # ảnh thay ảnh K7 giữ đúng cỡ (khung × dsf) để khung laptop/điện thoại của deck không đổi
    theo_ten = {c.ten: c for c in ds}
    assert theo_ten["ban-thi-nghiem"].khung == (1600, 1000)
    assert theo_ten["ban-thi-nghiem"].dsf == 2
    assert theo_ten["xem-dang-ghim"].khung == (390, 844)
    assert theo_ten["xem-dang-ghim"].dsf == 3


def test_doc_cau_hinh_ap_mac_dinh_va_chuan_hoa_buoc():
    ds = cn.doc_cau_hinh(
        {
            "mac_dinh": {"khung": [1280, 720], "dsf": 2, "cho_ms": 500},
            "canh": [
                {"ten": "a", "tuyen": "phien", "buoc": [{"bam": "text=Đồng ý"}, {"doi_ms": 300}]}
            ],
        }
    )
    c = ds[0]
    assert (c.tuyen, c.khung, c.dsf, c.cho_ms, c.phan_tu) == ("/phien", (1280, 720), 2.0, 500, None)
    assert c.buoc == [{"bam": ["text=Đồng ý"]}, {"doi_ms": 300}]
    assert c.co_bam


@pytest.mark.parametrize(
    "du_lieu",
    [
        {},
        {"canh": [{"ten": "a"}]},
        {"canh": [{"ten": "A B", "tuyen": "/x"}]},
        {"canh": [{"ten": "a", "tuyen": "/x"}, {"ten": "a", "tuyen": "/y"}]},
        {"canh": [{"ten": "a", "tuyen": "/x", "khung": [1280]}]},
        {"canh": [{"ten": "a", "tuyen": "/x", "buoc": [{"go": "x"}]}]},
        {"canh": [{"ten": "a", "tuyen": "/x", "buoc": [{"bam": []}]}]},
        {"canh": [{"ten": "a", "tuyen": "/x", "lạ": 1}]},
        {"canh": [{"ten": "a", "tuyen": "/x", "dsf": 9}]},
    ],
)
def test_doc_cau_hinh_tu_choi_cau_hinh_sai(du_lieu):
    with pytest.raises(cn.LoiCauHinh):
        cn.doc_cau_hinh(du_lieu)


def test_loc_canh_theo_ten_va_slide():
    ds = cn.nap_cau_hinh(cn.CAU_HINH_MAC_DINH)
    assert {c.ten for c in cn.loc_canh(ds, "M4")} == {"gioi-thieu", "gioi-thieu-dai-khoi"}
    assert {c.ten for c in cn.loc_canh(ds, "1")} == {"ban-thi-nghiem", "xem-dang-ghim"}
    assert [c.ten for c in cn.loc_canh(ds, "danh-sach")] == ["danh-sach"]
    assert len(cn.loc_canh(ds, None)) == len(ds)
    with pytest.raises(cn.LoiCauHinh):
        cn.loc_canh(ds, "khong-co")


def test_khong_ghi_vao_anh_da_nop(tmp_path):
    cam = tmp_path / "deck18" / "anh"
    cam.mkdir(parents=True)
    with pytest.raises(cn.LoiCauHinh):
        cn.kiem_thu_muc_ra(cam, cam)
    with pytest.raises(cn.LoiCauHinh):
        cn.kiem_thu_muc_ra(cam / "con", cam)
    assert cn.kiem_thu_muc_ra(tmp_path / "deck18" / "anh-moi", cam).name == "anh-moi"
    # thư mục ra mặc định không phải deck18/anh
    assert cn.ra_mac_dinh().name == "anh-moi"


def test_cho_giu_cua_cau_hinh_deu_co_nguon():
    ds = cn.nap_cau_hinh(cn.CAU_HINH_MAC_DINH)
    co = {"phien_live", "phien_doi", "phien_do_them", "phien_chua_du", "phien_lab", "ma_phong"}
    for c in ds:
        assert set(kg.CHO_GIU_RE.findall(c.tuyen)) <= co, c.ten


def _png(w, h):
    tho = b"".join(b"\x00" + b"\xff\xff\xff" * w for _ in range(h))

    def khoi(loai, du_lieu):
        crc = zlib.crc32(loai + du_lieu) & 0xFFFFFFFF
        return struct.pack(">I", len(du_lieu)) + loai + du_lieu + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + khoi(b"IHDR", ihdr)
        + khoi(b"IDAT", zlib.compress(tho))
        + khoi(b"IEND", b"")
    )


def test_kich_thuoc_png(tmp_path):
    p = tmp_path / "a.png"
    p.write_bytes(_png(7, 3))
    assert cn.kich_thuoc_png(p) == (7, 3)
    q = tmp_path / "b.png"
    q.write_bytes(b"khong phai png" * 3)
    with pytest.raises(ValueError, match="PNG"):
        cn.kich_thuoc_png(q)


def test_an_khi_chup_dung_cssom_khong_chen_style():
    # CSP của next/ chặn thẻ <style> chèn thêm: phải ẩn bằng el.style
    assert "[data-an-khi-chup]" in cn.AN_JS
    assert "style.setProperty" in cn.AN_JS
    assert "createElement" not in cn.AN_JS
    assert cn.bo_chon_phan_tu("danh-sach") == '[data-chup="danh-sach"]'


def test_chan_ca_duong_dan_kieu_git_bash_va_ban_sao(tmp_path):
    # /d/... của Git Bash từng lọt qua lượt kiểm cũ (thành D:\d\...): nay đổi về D:/... rồi mới so
    if sys.platform == "win32":
        assert cn.chuan_duong_dan("/d/AISC2026/x") == Path("D:/AISC2026/x")
        assert cn.chuan_duong_dan("/c") == Path("C:/")
    assert cn.chuan_duong_dan("tuong/doi") == Path("tuong/doi")
    cam = tmp_path / "goc" / "deck18" / "anh"
    with pytest.raises(cn.LoiCauHinh):
        cn.kiem_thu_muc_ra(tmp_path / "noi-khac" / "deck18" / "anh", cam)
    with pytest.raises(cn.LoiCauHinh):
        cn.kiem_thu_muc_ra(tmp_path / "goc" / "DECK18" / "Anh" / "con", cam)


# ------------------------------------------- chặn bấm theo phiên của phòng (soát đợt 1 mục 14)
def _trang_thai(tieu_de, trang_thai="dang_mo"):
    return {
        "room": {
            "title": tieu_de,
            "status": trang_thai,
            "video_url": None,
            "consent_version": "2026-10-15",
            "source_label": "DÀN DỰNG",
        },
        "pinned": None,
        "products": [],
    }


def _phien(sid, tieu_de, *, dry_run, is_demo=False, status="live", platform="lab"):
    return {
        "session_id": sid,
        "platform": platform,
        "title": tieu_de,
        "status": status,
        "dry_run": dry_run,
        "is_demo": is_demo,
    }


DS_PHIEN = [
    _phien("aaaa1111-x", "Thử nội bộ · Phòng xem LiveLift", dry_run=True),
    _phien("bbbb2222-x", "Phòng chụp ảnh K8", dry_run=True),
    _phien("cccc3333-x", "Buổi phòng xem thật", dry_run=False),
    _phien("dddd4444-x", "Phòng mẫu", dry_run=False, is_demo=True),
    _phien("eeee5555-x", "Phòng chụp ảnh K8", dry_run=False, status="ended"),
    _phien("ffff6666-x", "Buổi phòng xem thật", dry_run=True, platform="sim"),
]


def test_xac_dinh_phong_theo_tieu_de_va_trang_thai():
    p = cn.xac_dinh_phong("MaRieng1", _trang_thai("Phòng chụp ảnh K8"), DS_PHIEN)
    # phiên cùng tiêu đề đã kết thúc (không dry_run) bị bỏ vì phòng đang mở
    assert (p.xac_dinh, p.an_toan, p.thu_noi_bo, p.phien) == (True, True, False, ("bbbb2222-x",))
    p = cn.xac_dinh_phong("MaMoi2010", _trang_thai("Thử nội bộ · Phòng xem LiveLift"), DS_PHIEN)
    assert (p.xac_dinh, p.an_toan, p.thu_noi_bo) == (True, True, True)
    p = cn.xac_dinh_phong("MaThat", _trang_thai("Buổi phòng xem thật"), DS_PHIEN)
    assert (p.xac_dinh, p.an_toan) == (True, False)  # phiên 'sim' cùng tên không được tính là phòng
    assert "TÍNH vào kết quả" in p.ly_do
    p = cn.xac_dinh_phong("MaMau", _trang_thai("Phòng mẫu"), DS_PHIEN)
    assert (p.xac_dinh, p.an_toan) == (True, True)
    assert not cn.xac_dinh_phong("MaLa", _trang_thai("Không ai đặt tên này"), DS_PHIEN).xac_dinh
    assert not cn.xac_dinh_phong("MaSai", None, DS_PHIEN).xac_dinh
    assert not cn.xac_dinh_phong("MaSai", {"detail": "Phòng xem không tồn tại"}, DS_PHIEN).xac_dinh


def test_nhieu_phien_cung_tieu_de_xet_than_trong():
    ds = [
        _phien("a1", "Phòng chung", dry_run=True),
        _phien("a2", "Phòng chung", dry_run=False),
    ]
    p = cn.xac_dinh_phong("Ma", _trang_thai("Phòng chung"), ds)
    assert p.xac_dinh
    assert not p.an_toan
    assert set(p.phien) == {"a1", "a2"}


def test_chan_bam_theo_phong():
    ds = {c.ten: c for c in cn.nap_cau_hinh(cn.CAU_HINH_MAC_DINH)}
    bam = ds["xem-dang-ghim"]
    rieng = cn.xac_dinh_phong("MaRieng1", _trang_thai("Phòng chụp ảnh K8"), DS_PHIEN)
    noi_bo = cn.xac_dinh_phong(
        "MaMoi2010", _trang_thai("Thử nội bộ · Phòng xem LiveLift"), DS_PHIEN
    )
    that = cn.xac_dinh_phong("MaThat", _trang_thai("Buổi phòng xem thật"), DS_PHIEN)
    la = cn.xac_dinh_phong("MaLa", None, DS_PHIEN)
    # phòng riêng của phiên dry_run: được bấm
    assert cn.chan_phong_thu_noi_bo(bam, rieng, cho_phep=False) is None
    # phòng thử nội bộ (mã nào cũng vậy, không còn so mã cứng): chặn, cờ mở được
    assert "THỬ NỘI BỘ" in cn.chan_phong_thu_noi_bo(bam, noi_bo, cho_phep=False)
    assert cn.chan_phong_thu_noi_bo(bam, noi_bo, cho_phep=True) is None
    # phiên được tính: chặn kể cả có cờ
    assert "được tính" in cn.chan_phong_thu_noi_bo(bam, that, cho_phep=True)
    # không xác định hoặc chưa hỏi API: chặn
    assert "không xác định" in cn.chan_phong_thu_noi_bo(bam, la, cho_phep=True)
    assert "không xác định" in cn.chan_phong_thu_noi_bo(bam, None, cho_phep=True)
    # cảnh rút lui cũng có bước bấm
    assert cn.chan_phong_thu_noi_bo(ds["xem-rut-lui"], that, cho_phep=True)
    # chỉ xem màn đồng ý thì không ghi gì: luôn được chạy
    assert cn.chan_phong_thu_noi_bo(ds["xem-dong-y"], that, cho_phep=False) is None
    assert cn.chan_phong_thu_noi_bo(ds["xem-dong-y"], None, cho_phep=False) is None


def test_ma_phong_mac_dinh_van_la_thu_noi_bo():
    # phòng ijfCUXSD (thử nội bộ 19/10) đổi tiêu đề vẫn bị coi là thử nội bộ
    p = cn.xac_dinh_phong(
        kg.MA_PHONG_MAC_DINH,
        _trang_thai("Phòng tối"),
        [_phien("z", "Phòng tối", dry_run=True)],
    )
    assert p.thu_noi_bo


def test_doc_phong_hoi_api_gia(monkeypatch):
    goi = []

    def gia(url, timeout=8.0):
        goi.append(url)
        if url.endswith("/xem-api/MaRieng1/trang-thai"):
            return _trang_thai("Phòng chụp ảnh K8")
        if url.endswith("/sessions"):
            return DS_PHIEN
        raise cn.urllib.error.HTTPError(url, 404, "Not Found", None, None)

    monkeypatch.setattr(kg, "_get_json", gia)
    p = cn.doc_phong("http://127.0.0.1:8000/", "MaRieng1")
    assert (p.xac_dinh, p.an_toan) == (True, True)
    assert goi == [
        "http://127.0.0.1:8000/xem-api/MaRieng1/trang-thai",
        "http://127.0.0.1:8000/sessions",
    ]
    p = cn.doc_phong("http://127.0.0.1:8000", "MaSai")
    assert not p.xac_dinh
    assert "404" in p.ly_do


def test_canh_dang_ghim_cho_ca_the_ghim_cua_dien_thoai():
    ds = {c.ten: c for c in cn.nap_cau_hinh(cn.CAU_HINH_MAC_DINH)}
    cho = [s for b in ds["xem-dang-ghim"].buoc for s in b.get("cho", [])]
    assert "[data-testid='dien-thoai-ghim']" in cho

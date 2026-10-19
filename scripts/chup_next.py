"""Chụp ảnh giao diện next/ cho slide, video và poster theo [data-chup] (đơn vị U0, kế hoạch bản 3.1 mục 7).

Vì sao có tệp này: ảnh K7 chụp tay bằng các kịch bản tạm (cắt theo toạ độ), nên không biết chụp từ bản nào,
khó chụp lại khi giao diện đổi. Ở giao diện 2.0, mỗi khối cần chụp mang thuộc tính `data-chup="<tên>"`; tệp
này mở tuyến ở đúng khung và device scale factor, làm các bước (bấm đồng ý ở phòng xem...), ẩn phần tử
`[data-an-khi-chup]`, cắt đúng phần tử, ghi PNG và in kích thước. Mỗi lượt ghi `chup.json` cạnh ảnh: commit
của cây mã đang chạy, máy chủ, tuyến đã mở, cỡ ảnh.

Ra mặc định: AISC26_Vong2/deck18/anh-moi/<tên>.png. Từ chối ghi vào deck18/anh/ (ảnh K7 đã nộp).
Không tự bật máy chủ: dùng máy chủ dev chung (API :8000, Next :3130).

Chạy:
    D:\\AISC2026\\livelift\\.venv\\Scripts\\python scripts\\chup_next.py --liet-ke
    ...  --canh 13,M4                         # lọc theo tên cảnh hoặc mã slide trong chup_next_k8.yaml
    ...  --canh xem-dang-ghim --ma-phong <mã phòng riêng>
    ...  --tuyen /phien --phan-tu danh-sach --ten thu-danh-sach --khung 1280x800 --dsf 2   # chụp lẻ
    ...  --tuyen /gioi-thieu --toan-trang --ten landing-ca-trang

Cảnh có {ma_phong} cần --ma-phong (hoặc biến LIVELIFT_MA_PHONG_CHUP) của một phòng riêng để chụp, hoặc
--phong-gia: mở /xem/<mã giả> và page.route chặn mọi lời gọi /xem-api, /api/ll, trả dữ liệu giả (cảnh có
'ghim_gia' thì phòng giả đang ghim món đó), nên ảnh không phụ thuộc khối hiện tại và không ghi gì vào phòng nào. Cảnh có bước
bấm (đồng ý, rút lui) ghi sự kiện vào phòng đó, nên trước khi chạy, tệp hỏi API phòng thuộc phiên nào
(GET /xem-api/<mã>/trang-thai lấy tiêu đề phòng, GET /sessions tìm phiên 'lab' cùng tiêu đề) và:
  * chặn hẳn nếu phiên được tính vào kết quả (không dry_run, không phải dữ liệu mẫu), kể cả có cờ;
  * chặn nếu không xác định được phiên (mã sai, phòng tắt, không có phiên trùng tiêu đề);
  * chặn phòng THỬ NỘI BỘ (tiêu đề hay nhãn "Thử nội bộ") trừ khi có --cho-phep-phong-thu-noi-bo, vì số của
    buổi thử nội bộ lên slide.

Mã thoát: 0 mọi cảnh chụp được; 1 có cảnh hỏng (thiếu phần tử, bước chờ hết giờ, tuyến lỗi); 2 cấu hình sai.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import struct
import subprocess
import sys
import time
import unicodedata
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

try:  # chạy như tệp lệnh thì thư mục scripts/ đã ở đầu sys.path
    import kiem_giao_dien as kg
except ImportError:  # nạp như mô-đun từ nơi khác
    sys.path.append(str(Path(__file__).resolve().parent))
    import kiem_giao_dien as kg

GOC = Path(__file__).resolve().parents[1]
CAU_HINH_MAC_DINH = Path(__file__).resolve().with_name("chup_next_k8.yaml")
TEN_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class LoiCauHinh(Exception):
    """Cấu hình hay tham số sai: thoát 2."""


@dataclass
class Canh:
    ten: str
    tuyen: str
    slide: list[str] = field(default_factory=list)
    phan_tu: str | None = None
    """Tên trong [data-chup]; None = khung nhìn; "toan-trang" = cả trang."""
    khung: tuple[int, int] = (1600, 1000)
    dsf: float = 2.0
    dien_thoai: bool = False
    buoc: list[dict[str, Any]] = field(default_factory=list)
    cho_ms: int = 1200
    ghi_chu: str = ""
    ghim_gia: str | None = None
    """Mã món phòng giả đang ghim khi chụp bằng --phong-gia (None: khối không ghim)."""

    @property
    def co_bam(self) -> bool:
        return any("bam" in b for b in self.buoc)


# ------------------------------------------------------------------ hàm thuần (có test)
def thu_muc_vong2() -> Path:
    for p in GOC.parents:
        if (p / "AISC26_Vong2").is_dir():
            return p / "AISC26_Vong2"
    return GOC.parent / "AISC26_Vong2"


def ra_mac_dinh() -> Path:
    return thu_muc_vong2() / "deck18" / "anh-moi"


chuan_duong_dan = kg.chuan_duong_dan


def _la_thu_muc_cam(r: Path, cam: Path) -> bool:
    a, b = os.path.normcase(str(r)), os.path.normcase(str(cam))
    if a == b or a.startswith(b.rstrip("\\/") + os.sep):
        return True
    # chặn cả bản sao ở nơi khác: mọi đường dẫn có đoạn .../deck18/anh/...
    phan = [x.lower() for x in r.parts]
    return any(phan[i] == "deck18" and phan[i + 1] == "anh" for i in range(len(phan) - 1))


def kiem_thu_muc_ra(ra: Path, cam: Path | None = None) -> Path:
    """Từ chối thư mục ảnh đã nộp (deck18/anh/ và mọi thư mục con của nó, ở bất kỳ ổ nào)."""
    cam = (cam or thu_muc_vong2() / "deck18" / "anh").resolve()
    r = chuan_duong_dan(ra).resolve()
    if _la_thu_muc_cam(r, cam):
        raise LoiCauHinh(f"không ghi vào {r} (ảnh K7 đã nộp); dùng deck18/anh-moi/ hoặc --ra khác")
    return r


def _khung(v: Any, noi: str) -> tuple[int, int]:
    if isinstance(v, str):
        return kg.doc_khung(v)
    if (
        isinstance(v, (list, tuple))
        and len(v) == 2
        and all(isinstance(x, int) and x > 0 for x in v)
    ):
        return int(v[0]), int(v[1])
    raise LoiCauHinh(f"{noi}: khung phải là [rộng, cao] hoặc 'RỘNGxCAO', nhận {v!r}")


def _buoc(ds: Any, noi: str) -> list[dict[str, Any]]:
    if ds is None:
        return []
    if not isinstance(ds, list):
        raise LoiCauHinh(f"{noi}: buoc phải là danh sách")
    ra = []
    for i, b in enumerate(ds):
        if not isinstance(b, dict) or not ({"bam", "cho", "doi_ms"} & b.keys()):
            raise LoiCauHinh(f"{noi}: bước {i + 1} cần một trong bam / cho / doi_ms, nhận {b!r}")
        la = set(b) - {"bam", "cho", "doi_ms", "trong_ms"}
        if la:
            raise LoiCauHinh(f"{noi}: bước {i + 1} có khoá lạ {sorted(la)}")
        b = dict(b)
        for k in ("bam", "cho"):
            if k in b:
                v = b[k]
                b[k] = [v] if isinstance(v, str) else list(v)
                if not b[k] or not all(isinstance(x, str) and x.strip() for x in b[k]):
                    raise LoiCauHinh(f"{noi}: bước {i + 1} '{k}' cần bộ chọn khác rỗng")
        ra.append(b)
    return ra


def doc_cau_hinh(du_lieu: dict[str, Any]) -> list[Canh]:
    """Dữ liệu YAML (đã nạp) → danh sách cảnh, áp mac_dinh, kiểm tên trùng và khoá thiếu."""
    md = du_lieu.get("mac_dinh") or {}
    ds = du_lieu.get("canh")
    if not isinstance(ds, list) or not ds:
        raise LoiCauHinh("cấu hình cần danh sách 'canh' khác rỗng")
    ra: list[Canh] = []
    da: set[str] = set()
    for i, c in enumerate(ds):
        noi = f"cảnh {i + 1}"
        if not isinstance(c, dict):
            raise LoiCauHinh(f"{noi}: phải là bảng khoá/giá trị")
        ten = str(c.get("ten") or "")
        noi = f"cảnh '{ten or i + 1}'"
        if not TEN_RE.match(ten):
            raise LoiCauHinh(f"{noi}: 'ten' chỉ gồm chữ thường không dấu, số, gạch nối")
        if ten in da:
            raise LoiCauHinh(f"{noi}: tên trùng")
        da.add(ten)
        tuyen = c.get("tuyen")
        if not isinstance(tuyen, str) or not tuyen.strip():
            raise LoiCauHinh(f"{noi}: thiếu 'tuyen'")
        la = set(c) - {
            "ten",
            "tuyen",
            "slide",
            "phan_tu",
            "khung",
            "dsf",
            "dien_thoai",
            "buoc",
            "cho_ms",
            "ghi_chu",
            "ghim_gia",
        }
        if la:
            raise LoiCauHinh(f"{noi}: khoá lạ {sorted(la)}")
        dsf = float(c.get("dsf", md.get("dsf", 2)))
        if not 0.5 <= dsf <= 4:
            raise LoiCauHinh(f"{noi}: dsf ngoài khoảng 0,5–4")
        ra.append(
            Canh(
                ten=ten,
                tuyen=kg.chuan_tuyen(tuyen),
                slide=[str(s) for s in (c.get("slide") or [])],
                phan_tu=(str(c["phan_tu"]).strip() or None) if c.get("phan_tu") else None,
                khung=_khung(c.get("khung", md.get("khung", [1600, 1000])), noi),
                dsf=dsf,
                dien_thoai=bool(c.get("dien_thoai", False)),
                buoc=_buoc(c.get("buoc"), noi),
                cho_ms=int(c.get("cho_ms", md.get("cho_ms", 1200))),
                ghi_chu=str(c.get("ghi_chu") or ""),
                ghim_gia=(str(c["ghim_gia"]).strip() or None) if c.get("ghim_gia") else None,
            )
        )
    return ra


def nap_cau_hinh(p: Path) -> list[Canh]:
    import yaml  # noqa: PLC0415

    if not p.is_file():
        raise LoiCauHinh(f"không thấy cấu hình {p}")
    return doc_cau_hinh(yaml.safe_load(p.read_text(encoding="utf-8")) or {})


def loc_canh(ds: list[Canh], chon: str | None) -> list[Canh]:
    """Lọc theo tên cảnh hoặc mã slide (không phân biệt hoa thường; '1' khớp '01')."""
    if not chon:
        return list(ds)
    muon = {x.strip().lower() for x in chon.split(",") if x.strip()}
    chuan = {m.zfill(2) if m.isdigit() else m for m in muon}
    ra = [c for c in ds if c.ten.lower() in muon or {s.lower() for s in c.slide} & chuan]
    khong_khop = {
        m
        for m in muon
        if not any(
            c.ten.lower() == m or (m.zfill(2) if m.isdigit() else m) in {s.lower() for s in c.slide}
            for c in ds
        )
    }
    if khong_khop:
        raise LoiCauHinh(f"--canh không khớp cảnh hay slide nào: {', '.join(sorted(khong_khop))}")
    return ra


def bo_chon_phan_tu(ten: str) -> str:
    return f'[data-chup="{ten}"]'


@dataclass(frozen=True)
class ThongTinPhong:
    """Phòng xem thuộc phiên nào (đọc qua API công khai và /sessions), để quyết định có được bấm không."""

    ma: str
    xac_dinh: bool
    """Tìm được ít nhất một phiên 'lab' khớp phòng."""
    an_toan: bool = False
    """Mọi phiên khớp đều không tính vào kết quả: dry_run (chạy thử) hoặc is_demo (dữ liệu mẫu)."""
    thu_noi_bo: bool = False
    phien: tuple[str, ...] = ()
    ly_do: str = ""


def _chuan(s: Any) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(s or ""))).strip().casefold()


TRANG_THAI_PHONG = {
    "dang_mo": {"live"},
    "da_dong": {"ended", "cancelled"},
    "chua_mo": {"planned", "scheduled"},
}
"""Trạng thái phòng công khai → trạng thái phiên, đúng như lõi (src/livelift/api/routes/xem.py)."""
TIEU_DE_PHONG_MAC_DINH = "Phòng live dàn dựng"
"""Tiêu đề máy chủ đặt cho phòng khi phiên không có tiêu đề (routes/xem.py)."""


def xac_dinh_phong(
    ma: str, trang_thai: dict[str, Any] | None, ds_phien: list[dict[str, Any]]
) -> ThongTinPhong:
    """Hàm thuần: phòng `ma` thuộc phiên nào. API công khai không lộ id phiên, nên khớp theo tiêu đề phòng
    (mặc định là tiêu đề phiên) trong các phiên nền tảng 'lab', ưu tiên phiên cùng trạng thái với phòng. Nhiều
    phiên cùng khớp thì xét thận trọng: chỉ an toàn khi MỌI phiên khớp đều dry_run hoặc is_demo."""
    phong = trang_thai.get("room") if isinstance(trang_thai, dict) else None
    if not isinstance(phong, dict):
        return ThongTinPhong(
            ma, False, ly_do=f"API không trả phòng {ma} (mã sai hoặc phòng đã tắt)"
        )
    tieu_de = _chuan(phong.get("title"))
    lab = [s for s in ds_phien if isinstance(s, dict) and s.get("platform") == "lab"]
    khop = [s for s in lab if _chuan(s.get("title") or TIEU_DE_PHONG_MAC_DINH) == tieu_de]
    hop_trang_thai = TRANG_THAI_PHONG.get(str(phong.get("status")), set())
    cung_trang_thai = [s for s in khop if s.get("status") in hop_trang_thai]
    khop = cung_trang_thai or khop
    # Cờ dry_run công khai của chính phòng (khi lõi có trả) đáng tin hơn khớp tiêu đề: lọc phiên theo cờ.
    co_dry = phong.get("dry_run")
    if isinstance(co_dry, bool):
        khop = [s for s in khop if bool(s.get("dry_run")) == co_dry]
    thu_noi_bo = (
        ma == kg.MA_PHONG_MAC_DINH
        or "thử nội bộ" in tieu_de
        or "thử nội bộ" in _chuan(phong.get("source_label"))
        or any("thử nội bộ" in _chuan(s.get("title")) for s in khop)
    )
    if co_dry is True:
        mo_ta = ", ".join(str(s.get("session_id"))[:8] for s in khop) or "chưa khớp phiên nào"
        return ThongTinPhong(
            ma,
            True,
            an_toan=True,
            thu_noi_bo=thu_noi_bo,
            phien=tuple(str(s.get("session_id")) for s in khop),
            ly_do=f"«{phong.get('title')}» → phòng báo dry_run ({mo_ta})",
        )
    if not khop:
        return ThongTinPhong(
            ma, False, ly_do=f"không có phiên 'lab' nào có tiêu đề «{phong.get('title')}»"
        )
    an_toan = all(bool(s.get("dry_run")) or bool(s.get("is_demo")) for s in khop)

    def loai(s: dict[str, Any]) -> str:
        if s.get("dry_run"):
            return "dry_run"
        return "is_demo" if s.get("is_demo") else "TÍNH vào kết quả"

    mo_ta = ", ".join(f"{str(s.get('session_id'))[:8]} {loai(s)}" for s in khop)
    return ThongTinPhong(
        ma,
        True,
        an_toan=an_toan,
        thu_noi_bo=thu_noi_bo,
        phien=tuple(str(s.get("session_id")) for s in khop),
        ly_do=f"«{phong.get('title')}» → {mo_ta}",
    )


def doc_phong(api: str, ma: str) -> ThongTinPhong:
    """Hỏi API (chỉ GET, không ghi gì): trạng thái phòng công khai và danh sách phiên."""
    goc = api.rstrip("/")
    try:
        trang_thai = kg._get_json(f"{goc}/xem-api/{ma}/trang-thai")
    except urllib.error.HTTPError as e:
        return ThongTinPhong(ma, False, ly_do=f"/xem-api/{ma}/trang-thai trả {e.code}")
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        return ThongTinPhong(ma, False, ly_do=f"không đọc được trạng thái phòng: {e}")
    try:
        ds = kg._get_json(f"{goc}/sessions")
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        return ThongTinPhong(ma, False, ly_do=f"không đọc được /sessions: {e}")
    return xac_dinh_phong(ma, trang_thai, ds if isinstance(ds, list) else [])


def dung_phong_gia(c: Canh, bat: bool) -> bool:
    """Cảnh phòng xem chụp bằng phòng giả (--phong-gia): không chạm phòng thật nào."""
    return bat and "{ma_phong}" in c.tuyen


def tuyen_phong_gia(c: Canh) -> str:
    return c.tuyen.replace("{ma_phong}", kg.MA_PHONG_GIA)


TIEU_DE_PHONG_GIA_CHUP = "Phòng xem LiveLift"
"""Tiêu đề phòng giả khi chụp ảnh (ảnh lên slide: không ghi chữ 'giả để kiểm')."""


def chan_phong_thu_noi_bo(c: Canh, phong: ThongTinPhong | None, cho_phep: bool) -> str | None:
    """Lý do bỏ cảnh có bước bấm trên phòng xem; None nếu được chạy (cảnh không bấm thì luôn được chạy).

    Bấm đồng ý hay rút lui ghi sự kiện người xem vào phiên của phòng. Chặn: phiên không xác định được; phiên
    được tính vào kết quả (không dry_run, không is_demo), kể cả khi có cờ; phòng THỬ NỘI BỘ khi không có
    `cho_phep` (--cho-phep-phong-thu-noi-bo)."""
    if "{ma_phong}" not in c.tuyen or not c.co_bam:
        return None
    if phong is None or not phong.xac_dinh:
        ly_do = phong.ly_do if phong else "chưa hỏi API"
        return f"không xác định được phòng thuộc phiên nào ({ly_do}): không bấm"
    if not phong.an_toan:
        return (
            f"phòng {phong.ma} thuộc phiên được tính vào kết quả ({phong.ly_do}): bấm sẽ ghi người xem "
            "giả vào số thật; dùng phòng của một phiên dry_run"
        )
    if phong.thu_noi_bo and not cho_phep:
        return (
            f"phòng {phong.ma} là phòng THỬ NỘI BỘ ({phong.ly_do}): bấm sẽ ghi người xem giả vào số thử "
            "nội bộ; dùng --ma-phong của phòng riêng (phiên dry_run) hoặc --cho-phep-phong-thu-noi-bo"
        )
    return None


def kich_thuoc_png(p: Path) -> tuple[int, int]:
    """(rộng, cao) đọc từ khối IHDR của PNG."""
    with p.open("rb") as f:
        dau = f.read(24)
    if len(dau) < 24 or dau[:8] != b"\x89PNG\r\n\x1a\n" or dau[12:16] != b"IHDR":
        raise ValueError(f"{p} không phải PNG")
    w, h = struct.unpack(">II", dau[16:24])
    return int(w), int(h)


AN_JS = r"""
() => {
  let n = 0;
  for (const el of document.querySelectorAll('[data-an-khi-chup]')) {
    if (el.getAttribute('data-an-khi-chup') === 'bo') el.style.setProperty('display', 'none', 'important');
    else el.style.setProperty('visibility', 'hidden', 'important');
    n++;
  }
  for (const el of document.querySelectorAll('nextjs-portal')) el.style.setProperty('display', 'none', 'important');
  return n;
}
"""
"""Ẩn bằng CSSOM (el.style), không chèn thẻ <style>: CSP của next/ chặn style nội tuyến mới."""


# ------------------------------------------------------------------ chạy
def _git(goc: Path) -> dict[str, Any]:
    try:
        commit = subprocess.run(
            ["git", "-C", str(goc), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=20,
        ).stdout.strip()
        ban = subprocess.run(
            ["git", "-C", str(goc), "status", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
            timeout=60,
        ).stdout
        nhanh = subprocess.run(
            ["git", "-C", str(goc), "branch", "--show-current"],
            capture_output=True,
            text=True,
            check=True,
            timeout=20,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return {"commit": None}
    return {
        "commit": commit,
        "nhanh": nhanh,
        "tep_chua_commit": len([d for d in ban.splitlines() if d.strip()]),
    }


def _dau_tien_hien(trang: Any, bo_chon: list[str], trong_ms: int) -> Any:
    """Locator đầu tiên trong danh sách hiện ra trong `trong_ms`; lần lượt chờ chia đều thời gian."""
    han = time.monotonic() + max(500, trong_ms) / 1000
    while True:
        for s in bo_chon:
            loc = trang.locator(s).first
            try:
                if loc.is_visible():
                    return loc
            except Exception:  # noqa: BLE001 - bộ chọn sai cú pháp: thử cái sau
                continue
        if time.monotonic() > han:
            return None
        trang.wait_for_timeout(250)


def chup_mot(
    trinh: Any, base: str, c: Canh, tuyen: str, ra: Path, chuyen_dong: bool, phong_gia: bool = False
) -> dict[str, Any]:
    """Chụp một cảnh; trả bản ghi cho chup.json (có 'loi' khi hỏng)."""
    ghi: dict[str, Any] = {
        "ten": c.ten,
        "slide": c.slide,
        "tuyen": tuyen,
        "khung": list(c.khung),
        "dsf": c.dsf,
        "phan_tu": c.phan_tu,
    }
    ctx = trinh.new_context(
        viewport={"width": c.khung[0], "height": c.khung[1]},
        device_scale_factor=c.dsf,
        is_mobile=c.dien_thoai,
        has_touch=c.dien_thoai,
        locale="vi-VN",
        color_scheme="light",
        reduced_motion="no-preference" if chuyen_dong else "reduce",
    )
    trang = ctx.new_page()
    ro: list[str] = []
    if phong_gia:
        ghi["phong_gia"] = {"ma": kg.MA_PHONG_GIA, "ghim": c.ghim_gia}
        kg._vao_phong_gia(trang, c.ghim_gia, ro, TIEU_DE_PHONG_GIA_CHUP)
    try:
        dap = trang.goto(base.rstrip("/") + tuyen, wait_until="load", timeout=120_000)
        if dap is not None and dap.status >= 400:
            ghi["loi"] = f"HTTP {dap.status}"
            return ghi
        try:
            trang.wait_for_load_state("networkidle", timeout=8_000)
        except Exception:  # noqa: BLE001 - trang hỏi định kỳ thì không rảnh mạng
            pass
        for i, b in enumerate(c.buoc, start=1):
            if "doi_ms" in b and not ({"bam", "cho"} & b.keys()):
                trang.wait_for_timeout(int(b["doi_ms"]))
                continue
            ds = b.get("bam") or b.get("cho")
            loc = _dau_tien_hien(trang, ds, int(b.get("trong_ms", 15_000)))
            if loc is None:
                ghi["loi"] = f"bước {i}: không thấy {' | '.join(ds)}"
                return ghi
            if "bam" in b:
                loc.click()
            if b.get("doi_ms"):
                trang.wait_for_timeout(int(b["doi_ms"]))
        trang.evaluate("() => (document.fonts ? document.fonts.ready.then(() => true) : true)")
        trang.wait_for_timeout(c.cho_ms)
        ghi["da_an"] = trang.evaluate(AN_JS)
        tep = ra / f"{c.ten}.png"
        if c.phan_tu == "toan-trang":
            trang.screenshot(path=str(tep), full_page=True, animations="disabled")
        elif c.phan_tu:
            loc = trang.locator(bo_chon_phan_tu(c.phan_tu))
            n = loc.count()
            if n == 0:
                ghi["loi"] = (
                    f"không có phần tử {bo_chon_phan_tu(c.phan_tu)} (đơn vị sở hữu màn chưa gắn?)"
                )
                return ghi
            if n > 1:
                ghi["canh_bao"] = f"{n} phần tử {bo_chon_phan_tu(c.phan_tu)}: chụp cái đầu"
            loc.first.scroll_into_view_if_needed()
            loc.first.screenshot(path=str(tep), animations="disabled")
        else:
            trang.screenshot(path=str(tep), animations="disabled")
        ghi["tep"] = tep.name
        ghi["kich_thuoc"] = list(kich_thuoc_png(tep))
        if ro:
            ghi["loi"] = f"lời gọi ngoài mã giả đã bị huỷ: {', '.join(sorted(set(ro)))[:200]}"
    except Exception as e:  # noqa: BLE001 - mọi lỗi trình duyệt của một cảnh: ghi lại, chụp cảnh sau
        ghi["loi"] = str(e).splitlines()[0][:240]
    finally:
        ctx.close()
    return ghi


def main(argv: list[str] | None = None) -> int:
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    ap.add_argument(
        "--cau-hinh",
        type=chuan_duong_dan,
        default=CAU_HINH_MAC_DINH,
        help="tệp YAML danh sách cảnh",
    )
    ap.add_argument(
        "--canh", default=None, help="lọc theo tên cảnh hoặc mã slide, cách nhau dấu phẩy"
    )
    ap.add_argument("--liet-ke", action="store_true", help="in danh sách cảnh rồi thoát")
    ap.add_argument("--base", default="http://127.0.0.1:3130")
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument(
        "--ma-phong",
        default=os.environ.get("LIVELIFT_MA_PHONG_CHUP"),
        help="mã phòng xem RIÊNG để chụp (không dùng phòng thử nội bộ)",
    )
    ap.add_argument(
        "--phong-gia",
        action="store_true",
        help="cảnh phòng xem dùng phòng giả (page.route, dữ liệu giả), không cần --ma-phong, không chạm máy chủ",
    )
    ap.add_argument(
        "--cho-phep-phong-thu-noi-bo",
        action="store_true",
        help="cho bấm trên phòng THỬ NỘI BỘ (phiên vẫn phải dry_run; phiên được tính thì luôn chặn)",
    )
    ap.add_argument(
        "--ra",
        type=chuan_duong_dan,
        default=None,
        help="thư mục ảnh (mặc định AISC26_Vong2/deck18/anh-moi)",
    )
    ap.add_argument("--khung", default=None, help="đè khung mọi cảnh, RỘNGxCAO")
    ap.add_argument("--dsf", type=float, default=None, help="đè device scale factor mọi cảnh")
    ap.add_argument(
        "--chuyen-dong",
        action="store_true",
        help="giữ chuyển động (mặc định prefers-reduced-motion)",
    )
    ap.add_argument("--tuyen", default=None, help="chụp lẻ: tuyến (bỏ qua tệp cấu hình)")
    ap.add_argument("--phan-tu", default=None, help="chụp lẻ: tên data-chup")
    ap.add_argument("--toan-trang", action="store_true", help="chụp lẻ: cả trang")
    ap.add_argument("--ten", default=None, help="chụp lẻ: tên tệp ảnh")
    a = ap.parse_args(argv)

    try:
        if a.tuyen:
            ds = doc_cau_hinh(
                {
                    "canh": [
                        {
                            "ten": a.ten
                            or kg.ten_tep(kg.chuan_tuyen(a.tuyen)).lower().replace("_", "-"),
                            "tuyen": a.tuyen,
                            "phan_tu": "toan-trang" if a.toan_trang else a.phan_tu,
                            "khung": a.khung or [1600, 1000],
                            "dsf": a.dsf or 2,
                            "dien_thoai": bool(a.khung and kg.doc_khung(a.khung)[0] < 600),
                        }
                    ]
                }
            )
        else:
            ds = loc_canh(nap_cau_hinh(a.cau_hinh), a.canh)
            for c in ds:
                if a.khung:
                    c.khung = kg.doc_khung(a.khung)
                if a.dsf:
                    c.dsf = a.dsf
        ra = kiem_thu_muc_ra(a.ra or ra_mac_dinh())
    except (LoiCauHinh, kg.LoiCauHinh) as e:
        print(f"chup_next: LỖI CẤU HÌNH: {e}", file=sys.stderr)
        return 2

    if a.liet_ke:
        for c in ds:
            cat = c.phan_tu or "khung nhìn"
            print(
                f"{c.ten:22} slide {','.join(c.slide) or '-':10} {c.tuyen:34} {cat:12} "
                f"{c.khung[0]}x{c.khung[1]} @{c.dsf:g} → {c.khung[0] * c.dsf:.0f}x{c.khung[1] * c.dsf:.0f}"
                + (" (bấm)" if c.co_bam else "")
            )
        return 0

    try:
        gia, canh_bao = kg.gia_tri_cho_giu(a.api, a.ma_phong or "")
    except kg.LoiCauHinh as e:
        print(f"chup_next: LỖI CẤU HÌNH: {e}", file=sys.stderr)
        return 2
    if not a.ma_phong:
        gia.pop("ma_phong", None)
    else:
        for cb in canh_bao:
            print(f"CẢNH BÁO cấu hình: {cb}")

    phong: ThongTinPhong | None = None
    if a.ma_phong and any(c.co_bam and "{ma_phong}" in c.tuyen and not a.phong_gia for c in ds):
        phong = doc_phong(a.api, a.ma_phong)
        if phong.xac_dinh:
            ket = "được bấm" if phong.an_toan else "KHÔNG được bấm (phiên được tính)"
            print(
                f"phòng {a.ma_phong}: {phong.ly_do}; {ket}"
                + (" · THỬ NỘI BỘ" if phong.thu_noi_bo else "")
            )
        else:
            print(f"phòng {a.ma_phong}: không xác định ({phong.ly_do})")

    ra.mkdir(parents=True, exist_ok=True)
    ban_ghi: list[dict[str, Any]] = []
    from playwright.sync_api import sync_playwright  # noqa: PLC0415

    with sync_playwright() as p:
        trinh = p.chromium.launch()
        try:
            for c in ds:
                gia_phong = dung_phong_gia(c, a.phong_gia)
                tuyen, thieu = kg.mo_rong_tuyen(tuyen_phong_gia(c) if gia_phong else c.tuyen, gia)
                ly_do = None if gia_phong else chan_phong_thu_noi_bo(c, phong, a.cho_phep_phong_thu_noi_bo)
                if tuyen is None or ly_do:
                    ly_do = ly_do or f"thiếu {', '.join(thieu)}" + (
                        " (truyền --ma-phong)" if "ma_phong" in thieu else ""
                    )
                    ban_ghi.append(
                        {"ten": c.ten, "slide": c.slide, "tuyen": c.tuyen, "bo_qua": ly_do}
                    )
                    print(f"BỎ   {c.ten}: {ly_do}")
                    continue
                g = chup_mot(trinh, a.base, c, tuyen, ra, a.chuyen_dong, phong_gia=gia_phong)
                ban_ghi.append(g)
                if "loi" in g:
                    print(f"HỎNG {c.ten}: {g['loi']}  [{tuyen}]")
                else:
                    w, h = g["kich_thuoc"]
                    print(
                        f"OK   {c.ten}.png {w}×{h} px  ({c.khung[0]}x{c.khung[1]} @{c.dsf:g}, "
                        f"{c.phan_tu or 'khung nhìn'})  [{tuyen}]"
                        + (f"  {g['canh_bao']}" if "canh_bao" in g else "")
                    )
        finally:
            trinh.close()

    tep_kk = ra / "chup.json"
    cu: dict[str, Any] = {}
    if tep_kk.is_file():
        try:
            cu = {
                x["ten"]: x for x in json.loads(tep_kk.read_text(encoding="utf-8")).get("canh", [])
            }
        except (json.JSONDecodeError, KeyError, TypeError):
            cu = {}
    luc = datetime.now().isoformat(timespec="seconds")
    for g in ban_ghi:
        if "tep" in g:
            cu[g["ten"]] = {**g, "luc": luc}
    tep_kk.write_text(
        json.dumps(
            {
                "cap_nhat": luc,
                "base": a.base,
                "api": a.api,
                "git": _git(GOC),
                "canh": sorted(cu.values(), key=lambda x: x["ten"]),
                "luot_cuoi": ban_ghi,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    n_ok = sum(1 for g in ban_ghi if "tep" in g)
    n_hong = sum(1 for g in ban_ghi if "loi" in g)
    n_bo = sum(1 for g in ban_ghi if "bo_qua" in g)
    print(f"chup_next: {n_ok} ảnh · {n_hong} hỏng · {n_bo} bỏ qua → {ra}")
    return 1 if n_hong else 0


if __name__ == "__main__":
    raise SystemExit(main())

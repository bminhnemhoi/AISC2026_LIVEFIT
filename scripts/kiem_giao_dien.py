"""Kiểm giao diện LiveLift trên máy chủ Next đang chạy (đơn vị U0, kế hoạch bản 3.1 mục 3, 4, 13).

Vì sao có tệp này: giao diện 2.0 có luật hình cứng (không nghiêng phần tử chứa nút, nút cao 44 px và nút chính
48 px, màn cấp 1 không phải cuộn ở 1280×720, không chữ tiếng Anh hay chữ cấm trên màn). Luật chỉ có nghĩa khi có
máy đo được, chạy được sau mỗi lần ghép. Tệp này mở từng tuyến ở từng khung bằng Playwright (Chromium), đo trong
trang, rồi phân loại ở Python (phần phân loại là hàm thuần, có test trong tests/test_kiem_giao_dien.py).

Không tự bật máy chủ nào: dùng máy chủ dev chung (API :8000, Next :3130). Mặc định chỉ ĐỌC: không bấm đồng ý ở
phòng xem, nên không ghi sự kiện nào vào phòng thử nội bộ.

Chạy (Python của lõi có playwright):

    D:\\AISC2026\\livelift\\.venv\\Scripts\\python scripts\\kiem_giao_dien.py
    ...  --base http://127.0.0.1:3130 --api http://127.0.0.1:8000 --ma-phong ijfCUXSD
    ...  --tuyen /phien,/phien/{phien_live} --khung 1280x720,390x844 --nhan sau-ghep-u4
    ...  --khong-anh --nghiem

Tuyến mặc định: /gioi-thieu, /phien, /phien/{phien_live}, /phien/{phien_live}/nguoi-dan,
/phien/{phien_doi}/tong-ket, /xem/{ma_phong}. Chỗ giữ {phien_live}, {phien_doi}, {phien_lab} lấy từ
GET {api}/sessions; {ma_phong} lấy từ --ma-phong, biến LIVELIFT_MA_PHONG, hoặc mặc định của phiên thử nội bộ.

Mức:
  ĐỎ   tràn ngang · phần tử bị nghiêng mà chứa nút (hoặc chính nó là nút) · nút chính [data-nut-chinh] thấp
       hơn 48 px · chữ cấm hiển thị (cả document.title, aria-label, title, alt, placeholder) · vùng
       [data-vung-chinh] vượt màn đầu ở khung rộng ≥ 1024 px · tuyến trả lỗi (HTTP ≥ 400, không mở được, lỗi JS
       chưa bắt, hộp lỗi hoặc huy hiệu lỗi của Next, trang lỗi) · nhãn công bố (D-015): khung
       [data-nguoi-dan-ai] đang hiện thiếu nhãn con [data-nhan-cong-bo="NGUOI_DAN_AI"] đang hiện, chữ khác canon,
       chữ dưới 12 px hay bị che; <video>/<iframe>/<img> có src chứa "nguoi-dan-ai" nằm ngoài [data-nguoi-dan-ai]
  VÀNG phần tử tương tác thấp hơn 44 px (liên kết nằm trong câu được miễn; --nghiem nâng thành ĐỎ) · hình
       trang trí nghiêng quá 2° hoặc không có aria-hidden · chưa gắn [data-vung-chinh] · vùng chính vượt màn đầu
       ở khung điện thoại · dòng chữ tiếng Anh · tương phản chữ dưới 4,5:1 (chữ lớn 3:1) · console.error · chữ
       cấm chỉ cấm theo ngữ cảnh (A/B) và số cũ (4,5%, 18 khối) có thể trùng số dữ liệu
  DEV  lỗi console chỉ có ở next dev (CSP chặn thẻ <style> của lớp phủ next-devtools, eval của React Refresh,
       HMR): in một dòng mỗi tuyến@khung, không tính

Chữ cấm: CHU_CAM_HIEN (trong tệp) cộng mọi `thuat_ngu[].cam`, `tu_cam[].mau`, `chinh_ta.cam` của
docs/canon/thuat-ngu.yaml, so khớp theo ranh giới từ; miễn trừ ghi ở MIEN_TRU_CHU (mỗi dòng một lý do).

Đầu ra: in tuyến@khung [loại] mô tả; ảnh toàn trang và ảnh khung đầu vào
AISC26_Vong2/_tam/anh-ui/<nhãn>/ (bỏ bằng --khong-anh) kèm ket-qua.json. Mã thoát: 0 không có ĐỎ, 1 có ĐỎ,
2 không tới được máy chủ hoặc tham số sai.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

GOC = Path(__file__).resolve().parents[1]

KHUNG_MAC_DINH = ("1280x720", "1280x633", "390x844")
TUYEN_MAC_DINH = (
    "/gioi-thieu",
    "/phien",
    "/phien/{phien_live}",
    "/phien/{phien_live}/nguoi-dan",
    "/phien/{phien_doi}/tong-ket",
    "/xem/{ma_phong}",
)
MA_PHONG_MAC_DINH = "ijfCUXSD"
"""Phòng thử nội bộ gieo lúc 12:22 19/10 (đổi khi gieo lại: truyền --ma-phong hoặc LIVELIFT_MA_PHONG)."""

NUT_TOI_THIEU = 44.0
NUT_CHINH_TOI_THIEU = 48.0
NGHIENG_TRANG_TRI_TOI_DA = 2.0
DUNG_SAI_GOC = 0.05
"""Độ: dưới mức này coi như không nghiêng (sai số làm tròn của ma trận)."""
KHUNG_RONG = 1024
"""Khung từ độ rộng này trở lên: vùng chính vượt màn đầu là ĐỎ; hẹp hơn (điện thoại) là VÀNG."""

DO = "ĐỎ"
VANG = "VÀNG"

CHU_CAM_HIEN: tuple[tuple[str, str, int], ...] = (
    ("SIMULATED", r"(?<!\w)simulated(?!\w)", re.IGNORECASE),
    ("Click", r"(?<!\w)click(?:s|ed|ing)?(?!\w)", re.IGNORECASE),
    ("CTOR", r"(?<!\w)ctor(?!\w)", re.IGNORECASE),
    ("NULL", r"(?<!\w)null(?!\w)", re.IGNORECASE),
    ("undefined", r"(?<!\w)undefined(?!\w)", 0),
    ("NaN", r"(?<!\w)NaN(?!\w)", 0),
    ("[object Object]", r"\[object Object\]", 0),
    ("Loading", r"(?<!\w)loading(?!\w)", re.IGNORECASE),
    ("Failed to fetch", r"failed\s+to\s+fetch", re.IGNORECASE),
    ("Not Found", r"not\s+found", re.IGNORECASE),
    ("—", "—", 0),
    ("khúc", r"(?<!\w)khúc(?!\w)", re.IGNORECASE),
    ("khoá lịch", r"(?<!\w)kh(?:oá|óa)\s+lịch(?!\w)", re.IGNORECASE),
    # kế hoạch bản 3.1 mục 3 (soát đợt 1 mục 5): có cả khi không đọc được canon
    ("KTC", r"(?<!\w)KTC(?!\w)", 0),
    ("Thí nghiệm có bốc thăm", r"(?<!\w)thí\s+nghiệm\s+có\s+bốc\s+thăm(?!\w)", re.IGNORECASE),
    ("Ghim theo gợi ý", r"(?<!\w)ghim\s+theo\s+gợi\s+ý(?!\w)", re.IGNORECASE),
    ("CHƯA ĐỦ (kết luận)", r"(?<!\w)CHƯA\s+ĐỦ(?!\w)(?!\s+KHỐI(?!\w))", 0),
)
"""Chữ không được lên màn (kế hoạch bản 3.1 mục 3). Cộng thêm CHU_CAM_CANON đọc từ thuat-ngu.yaml và
--them-chu-cam. 'KTC': trên giao diện viết đủ 'khoảng tin cậy' (canon thuat_ngu[khoảng tin cậy].ghi_chu).
'CHƯA ĐỦ' viết hoa đứng một mình là nhãn kết luận cũ (nay là ĐO THÊM); 'CHƯA ĐỦ KHỐI' là tên phiên mẫu,
chữ thường 'chưa đủ bằng chứng' là câu canon của ĐO THÊM: cả hai không bắt."""

CANON_THUAT_NGU = GOC / "docs" / "canon" / "thuat-ngu.yaml"
CHU_NHAN_AI_MAC_DINH = "NGƯỜI DẪN AI · GIỌNG TỔNG HỢP"
"""Chữ nhãn công bố NGUOI_DAN_AI khi không đọc được canon (canon nhan_cong_bo là nguồn)."""
CO_CHU_NHAN_AI_TOI_THIEU = 12.0


@dataclass(frozen=True)
class LuatChu:
    """Một mẫu chữ cấm trên màn."""

    nhan: str
    mau: str
    co: int = re.IGNORECASE
    muc: str = DO
    chi_trong_ngoac: bool = False
    """Canon cho phép cụm đứng trong ngoặc (burn-in, hiệu ứng lưu)."""
    co_so: bool = False
    """Mẫu số cũ (4,5%, 0,271, 18 khối): trên màn có thể trùng số dữ liệu chạy, nên chỉ VÀNG."""


MIEN_TRU_CHU: tuple[tuple[str, str, str], ...] = (
    # (chữ khớp viết thường, cụm lành bao quanh, lý do)
    (
        "lát",
        r"lát\s+nữa|(?:một|chốc|giây)\s+lát|lát\s+(?:sau|cắt)",
        "nghĩa thời gian hoặc miếng cắt, không phải tên khối",
    ),
    (
        "khúc",
        r"ca\s+khúc|khúc\s+(?:mắc|khuỷu|xạ|ruột|côn\s+cầu)",
        "nghĩa khác (bài hát, vướng mắc...), không phải tên khối",
    ),
    ("hóa", r"thanh\s+hóa", "địa danh giữ cách viết chính thức"),
)
"""Miễn trừ của chữ cấm (mỗi dòng một lý do). Ngoài bảng này còn ba luật miễn:
  * cụm nằm trong URL (LIVEFIT trong đường dẫn kho mã GitHub);
  * cụm canon ghi 'chỉ được đứng trong ngoặc' (burn-in, hiệu ứng lưu) nằm trong ngoặc đơn;
  * 'CHƯA ĐỦ KHỐI' (tên phiên mẫu) và chữ thường 'chưa đủ ...' (mẫu CHƯA ĐỦ phân biệt hoa thường).
Hạ xuống VÀNG (không miễn): cụm canon ghi 'chỉ dùng khi' (A/B), và mẫu số cũ của tu_cam (4,5%, 0,271,
18 khối) vì số dữ liệu chạy có thể trùng; kiem_dong_bo.py bắt các số này trong chữ tĩnh ở mức LỖI."""

URL_RE = re.compile(r"(?:https?://|www\.|github\.com/)\S+", re.IGNORECASE)


def mau_cum(cum: str) -> str:
    """Biểu thức cho một cụm nguyên văn: đúng ranh giới từ (chữ có dấu tiếng Việt là chữ của từ), khoảng trắng co
    giãn (giống kiem_dong_bo.mau_cum)."""
    cum = unicodedata.normalize("NFC", cum)
    than = r"\s+".join(re.escape(t) for t in cum.split())
    dau = r"(?<!\w)" if re.match(r"\w", cum) else ""
    cuoi = r"(?!\w)" if re.search(r"\w$", cum) else ""
    return dau + than + cuoi


def _bao_ranh_gioi(mau: str) -> str:
    """Mẫu thô của tu_cam ('4,5%', '18 khối', 'đột phá|toàn diện'): thêm ranh giới từ ở đầu (và ở cuối
    khi mẫu kết thúc bằng chữ/số) để '14,5%' hay '118 khối' không khớp."""
    if mau.strip() == "—":
        return mau
    dau = r"(?<!\w)" if re.match(r"[\w(]", mau) else ""
    cuoi = r"(?!\w)" if re.search(r"[\w)]$", mau) else ""
    return f"{dau}(?:{mau}){cuoi}"


def nap_chu_cam_canon(p: Path | None = None) -> tuple[tuple[LuatChu, ...], str, str | None]:
    """Đọc thuat-ngu.yaml: (luật chữ cấm, chữ nhãn NGUOI_DAN_AI, cảnh báo nếu không đọc được).

    Luật: mọi `thuat_ngu[].cam`, `tu_cam[].mau`, `chinh_ta.cam`. Không đọc được canon thì trả () và chữ
    nhãn mặc định, kèm cảnh báo (CHU_CAM_HIEN vẫn chạy)."""
    p = p or CANON_THUAT_NGU
    try:
        import yaml  # noqa: PLC0415 - chỉ cần khi có canon

        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except (ImportError, OSError) as e:
        return (), CHU_NHAN_AI_MAC_DINH, f"không đọc được canon {p}: {e}"
    except Exception as e:  # noqa: BLE001 - yaml.YAMLError và dữ liệu sai kiểu
        return (), CHU_NHAN_AI_MAC_DINH, f"canon {p} hỏng: {e}"
    luat: list[LuatChu] = []
    for t in data.get("thuat_ngu") or []:
        ghi_chu = str(t.get("ghi_chu") or "")
        for c in t.get("cam") or []:
            luat.append(
                LuatChu(
                    nhan=f"canon: {c}",
                    mau=mau_cum(str(c)),
                    muc=VANG if "chỉ dùng khi" in ghi_chu and str(c) in ghi_chu else DO,
                    chi_trong_ngoac="chỉ được đứng trong ngoặc" in ghi_chu and str(c) in ghi_chu,
                )
            )
    for t in data.get("tu_cam") or []:
        mau = unicodedata.normalize("NFC", str(t.get("mau") or ""))
        if not mau.strip():
            continue
        luat.append(
            LuatChu(
                nhan=f"canon tu_cam: {mau}",
                mau=_bao_ranh_gioi(mau),
                co_so=bool(re.search(r"\d", re.sub(r"\{[\d,]*\}", "", mau))),
            )
        )
    ct = data.get("chinh_ta") or {}
    for sai, dung in zip(ct.get("cam") or [], ct.get("dung") or [], strict=False):
        luat.append(LuatChu(nhan=f"chính tả: {sai} → {dung}", mau=mau_cum(str(sai))))
    hop_le = []
    for lu in luat:
        try:
            re.compile(lu.mau, lu.co)
        except re.error:
            continue
        hop_le.append(lu)
    chu_ai = CHU_NHAN_AI_MAC_DINH
    for n in data.get("nhan_cong_bo") or []:
        if n.get("id") == "NGUOI_DAN_AI" and n.get("hien_thi"):
            chu_ai = unicodedata.normalize("NFC", str(n["hien_thi"]))
    return tuple(hop_le), chu_ai, None


CHU_CAM_CANON, CHU_NHAN_AI, CANH_BAO_CANON = nap_chu_cam_canon()
"""Nạp một lần lúc nhập mô-đun; cảnh báo (nếu có) được in ở đầu lượt chạy."""


TRANG_LOI_RE = re.compile(
    r"Operational Workspace Degraded|Application error|Unhandled Runtime Error|This page could not be found"
    r"|Internal Server Error|Build Error|Runtime Error",
)

CHU_VIET_RE = re.compile(
    "[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", re.IGNORECASE
)
TU_LATIN_RE = re.compile(r"[A-Za-z][A-Za-z'’]+")
TU_DUOC_GIU = frozenset(
    w.lower()
    for w in (
        "LiveLift Live Desk TikTok Shopee Facebook YouTube Lazada GMV API QR SHA AI OK ID demo lab autopilot "
        "switchback URL http https www github com AISC UIT TDTU Next FastAPI PostgreSQL WebSocket video mp4 pdf "
        "email app shop online livestream LIVE Seller Center Studio faster whisper Claude Code Douyin Kuaishou "
        "Luopan Statsig DataTester KuaiLive Shence Kalodata Chanmama Sapo Pancake AA AB CSV JSON SQL Docker "
        "Open Platform cotton basic tote canvas inox set ml kg cm mm px CUPED MDE PII NLP"
    ).split()
)
"""Tên riêng và từ mượn đã nhận trên giao diện tiếng Việt: không tính là câu tiếng Anh."""
TU_TIENG_ANH_UI = frozenset(
    "home sessions session products settings dashboard login logout signin signup submit cancel save delete "
    "edit search back previous close retry help overview insights integrations simulator workspace error "
    "warning view report recap legacy shortcuts theme language skip menu".split()
)
"""Từ giao diện tiếng Anh hay sót lại khi Việt hoá (một từ đứng riêng vẫn bắt)."""


@dataclass(frozen=True)
class Phat:
    """Một chỗ vi phạm ở một tuyến, một khung."""

    muc: str
    loai: str
    tuyen: str
    khung: str
    mo_ta: str

    def dong_in(self) -> str:
        return f"{self.muc:4} {self.tuyen} @{self.khung} [{self.loai}] {self.mo_ta}"


class LoiCauHinh(Exception):
    """Không tới được máy chủ, tham số sai: thoát 2."""


# ------------------------------------------------------------------ hàm thuần (có test)
def doc_khung(s: str) -> tuple[int, int]:
    m = re.fullmatch(r"\s*(\d{3,4})\s*[x×]\s*(\d{3,4})\s*", s)
    if not m:
        raise LoiCauHinh(f"khung '{s}' sai dạng, cần RỘNGxCAO như 1280x720")
    return int(m.group(1)), int(m.group(2))


def ten_khung(k: tuple[int, int]) -> str:
    return f"{k[0]}x{k[1]}"


def _so(s: str) -> list[float]:
    """Các số trong chuỗi; với 'matrix3d(...)' chỉ lấy phần trong ngoặc (bỏ số 3 của tên hàm)."""
    if "(" in s:
        s = s[s.index("(") + 1 :]
    return [float(x) for x in re.findall(r"-?\d*\.?\d+(?:e[-+]?\d+)?", s)]


def goc_nghieng(transform: str | None, rotate: str | None = None) -> float:
    """Độ nghiêng trong mặt phẳng (xoay hoặc xô lệch), lớn nhất theo trị tuyệt đối, tính bằng độ.

    Lật gương (scaleX(-1), rotateY(180deg)) và xoay quanh trục X/Y không làm chữ nghiêng nên không tính;
    xoay 180° trong mặt phẳng (chữ lộn ngược) thì tính."""
    goc = 0.0
    t = (transform or "none").strip()
    if t != "none":
        so = _so(t)
        if t.startswith("matrix3d(") and len(so) >= 16:
            a, b, c, d = so[0], so[1], so[4], so[5]
        elif t.startswith("matrix(") and len(so) >= 4:
            a, b, c, d = so[:4]
        else:
            a, b, c, d = 1.0, 0.0, 0.0, 1.0
        goc = max(goc, _goc_ma_tran(a, b, c, d))
    r = (rotate or "none").strip()
    if r not in ("none", ""):
        so = _so(r)
        truc = re.findall(r"\b([xyz])\b", r)
        if so:
            don_vi = re.search(r"(deg|rad|turn|grad)", r)
            v = so[-1]
            if don_vi:
                v = {"deg": v, "rad": math.degrees(v), "turn": v * 360.0, "grad": v * 0.9}[
                    don_vi.group(1)
                ]
            # rotate: "x 10deg" hay "0 1 0 10deg" là xoay quanh trục khác Z: không nghiêng trong mặt phẳng
            quanh_z = (not truc or truc == ["z"]) and (
                len(so) == 1 or (len(so) == 4 and so[0] == 0 and so[1] == 0)
            )
            if quanh_z:
                goc = max(goc, _goc_chuan(v))
    return goc


def _goc_chuan(v: float) -> float:
    v = math.fmod(abs(v), 360.0)
    return min(v, 360.0 - v)


def _goc_ma_tran(a: float, b: float, c: float, d: float) -> float:
    """Phân rã phần tuyến tính 2D (CSS unmatrix): trả max(|xoay|, |xô lệch|) theo độ."""
    det = a * d - b * c
    if det < 0:  # lật gương: bỏ lật theo trục x trước khi đo
        a, c = -a, -c
    sx = math.hypot(a, b)
    if sx < 1e-9:
        return 0.0
    a1, b1 = a / sx, b / sx
    xo = a1 * c + b1 * d
    c2, d2 = c - a1 * xo, d - b1 * xo
    sy = math.hypot(c2, d2)
    xo_lech = math.degrees(math.atan(xo / sy)) if sy > 1e-9 else 0.0
    xoay = math.degrees(math.atan2(b1, a1))
    return max(_goc_chuan(xoay), abs(xo_lech))


def tat_ca_luat_chu(them: tuple[tuple[str, str, int], ...] = ()) -> tuple[LuatChu, ...]:
    """CHU_CAM_HIEN, rồi luật canon, rồi --them-chu-cam (thứ tự quyết định nhãn khi hai luật trùng chỗ)."""
    return (
        tuple(LuatChu(n, m, c) for n, m, c in CHU_CAM_HIEN)
        + CHU_CAM_CANON
        + tuple(LuatChu(n, m, c) for n, m, c in them)
    )


def tim_chu_cam_muc(
    chu: str, them: tuple[tuple[str, str, int], ...] = (), luat: tuple[LuatChu, ...] | None = None
) -> list[tuple[str, str, str, str]]:
    """(mức, nhãn luật, chữ khớp, ngữ cảnh ngắn) cho mỗi chỗ chữ cấm. Hai luật khớp chồng lên nhau ('khúc' và
    'khúc 5 phút', '—' của mã và của canon) chỉ báo một lần, theo luật đứng trước."""
    chu = unicodedata.normalize("NFC", chu or "")
    ra: list[tuple[str, str, str, str]] = []
    da: set[tuple[int, int]] = set()
    for lu in luat if luat is not None else tat_ca_luat_chu(them):
        try:
            mau = re.compile(unicodedata.normalize("NFC", lu.mau), lu.co)
        except re.error:
            continue
        for m in mau.finditer(chu):
            s, e = m.start(), m.end()
            if e <= s or any(s < e2 and s2 < e for s2, e2 in da) or _mien(lu, chu, s, e, m.group()):
                continue
            da.add((s, e))
            muc = lu.muc
            if lu.co_so:
                muc = VANG
            ra.append((muc, lu.nhan, m.group(), _ngu_canh(chu, s, e)))
    return ra


def tim_chu_cam(
    chu: str, them: tuple[tuple[str, str, int], ...] = ()
) -> list[tuple[str, str, str]]:
    """(nhãn luật, chữ khớp, ngữ cảnh ngắn) cho mỗi chỗ chữ cấm trong chữ hiển thị (mọi mức)."""
    return [(n, k, ng) for _, n, k, ng in tim_chu_cam_muc(chu, them)]


def _mien(lu: LuatChu, chu: str, s: int, e: int, khop: str) -> bool:
    """Chỗ khớp thuộc MIEN_TRU_CHU, nằm trong URL, hoặc trong ngoặc khi canon cho phép."""
    k = khop.lower()
    for tu, lanh, _ly_do in MIEN_TRU_CHU:
        if k == tu and _trong(re.compile(lanh, re.IGNORECASE), chu, s, e):
            return True
    if any(m.start() <= s and e <= m.end() for m in URL_RE.finditer(chu)):
        return True
    return lu.chi_trong_ngoac and _trong_ngoac(chu, s, e)


def _trong_ngoac(chu: str, s: int, e: int) -> bool:
    dau = chu.rfind("\n", 0, s) + 1
    cuoi = chu.find("\n", e)
    truoc, sau = chu[dau:s], chu[e : cuoi if cuoi >= 0 else len(chu)]
    return truoc.count("(") > truoc.count(")") and ")" in sau


def _trong(re_lanh: re.Pattern[str], chu: str, s: int, e: int) -> bool:
    for m in re_lanh.finditer(chu, max(0, s - 24), min(len(chu), e + 24)):
        if m.start() <= s and e <= m.end():
            return True
    return False


def _ngu_canh(chu: str, s: int, e: int, rong: int = 30) -> str:
    return re.sub(r"\s+", " ", chu[max(0, s - rong) : e + rong]).strip()


def tim_tieng_anh(chu: str, toi_thieu: int = 3) -> list[str]:
    """Chữ tiếng Anh trên màn. Hai dạng: (1) dòng không có dấu tiếng Việt và có từ `toi_thieu` từ Latin trở
    lên ngoài TU_DUOC_GIU (trả nguyên dòng); (2) từ giao diện tiếng Anh hay gặp (TU_TIENG_ANH_UI: Home,
    Sessions, Retry...) đứng ở bất kỳ dòng nào (trả «từ» trong «dòng»)."""
    ra = []
    for dong in unicodedata.normalize("NFC", chu or "").splitlines():
        dong = dong.strip()
        if not dong:
            continue
        if not CHU_VIET_RE.search(dong):
            tu = [w for w in TU_LATIN_RE.findall(dong) if w.lower().strip("'’") not in TU_DUOC_GIU]
            if len(tu) >= toi_thieu:
                ra.append(f"«{dong[:80]}»")
                continue
        for w in TU_LATIN_RE.findall(dong):
            if w.lower() in TU_TIENG_ANH_UI:
                ra.append(f"«{w}»" if w == dong else f"«{w}» trong «{dong[:60]}»")
    return ra


def doc_mau(s: str | None) -> tuple[float, float, float, float] | None:
    """rgb()/rgba() của getComputedStyle → (r, g, b, a); dạng khác (oklch, color()) → None."""
    if not s:
        return None
    m = re.fullmatch(r"\s*rgba?\(([^)]*)\)\s*", s)
    if not m:
        return None
    so = [x for x in re.split(r"[\s,/]+", m.group(1).strip()) if x]
    try:
        r, g, b = (float(x) for x in so[:3])
        a = (
            float(so[3].rstrip("%")) / (100.0 if so[3].endswith("%") else 1.0)
            if len(so) > 3
            else 1.0
        )
    except (ValueError, IndexError):
        return None
    return r, g, b, a


def _do_sang(r: float, g: float, b: float) -> float:
    def kenh(c: float) -> float:
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * kenh(r) + 0.7152 * kenh(g) + 0.0722 * kenh(b)


def ty_le_tuong_phan(mau: str, nen: str) -> float | None:
    """Tỷ lệ tương phản WCAG 2.x của chữ `mau` trên nền đặc `nen` (chữ trong suốt một phần thì trộn với nền)."""
    c, n = doc_mau(mau), doc_mau(nen)
    if c is None or n is None or n[3] < 0.999:
        return None
    r, g, b, a = c
    r, g, b = (a * x + (1 - a) * y for x, y in zip((r, g, b), n[:3], strict=True))
    l1, l2 = _do_sang(r, g, b), _do_sang(*n[:3])
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def chu_lon(co_chu_px: float, dam: int) -> bool:
    """Chữ lớn theo WCAG: ≥ 24 px, hoặc ≥ 18,66 px khi đậm (≥ 700)."""
    return co_chu_px >= 24.0 or (co_chu_px >= 18.66 and dam >= 700)


def chon_phien(ds: list[dict[str, Any]]) -> dict[str, str]:
    """Id cho các chỗ giữ của tuyến mặc định, từ danh sách GET /sessions.

    phien_live: phiên đang phát không phải phòng xem (platform khác 'lab'), mới nhất.
    phien_doi:  phiên đã kết thúc có 'ĐỔI' trong tiêu đề (bộ phiên mẫu), ưu tiên phiên mẫu; tương tự
                phien_do_them ('ĐO THÊM') và phien_chua_du ('CHƯA ĐỦ').
    phien_lab:  phiên phòng xem đang mở."""

    def moi(s: dict[str, Any]) -> str:
        return str(s.get("start_ts") or s.get("created_at") or "")

    ra: dict[str, str] = {}
    live = sorted(
        (s for s in ds if s.get("status") == "live" and s.get("platform") != "lab"),
        key=moi,
        reverse=True,
    )
    if live:
        ra["phien_live"] = live[0]["session_id"]
    for khoa, mau in (
        ("phien_doi", r"(?<!\w)ĐỔI(?!\w)"),
        ("phien_do_them", r"(?<!\w)ĐO THÊM(?!\w)"),
        ("phien_chua_du", r"(?<!\w)CHƯA ĐỦ(?!\w)"),
    ):
        hop = [
            s
            for s in ds
            if s.get("status") == "ended"
            and re.search(mau, unicodedata.normalize("NFC", s.get("title") or ""))
        ]
        hop.sort(key=lambda s: (not s.get("is_demo"), moi(s)))
        if hop:
            ra[khoa] = hop[0]["session_id"]
    lab = sorted(
        (s for s in ds if s.get("status") == "live" and s.get("platform") == "lab"),
        key=moi,
        reverse=True,
    )
    if lab:
        ra["phien_lab"] = lab[0]["session_id"]
    return ra


CHO_GIU_RE = re.compile(r"\{([a-z_]+)\}")
MSYS_RE = re.compile(r"^[A-Za-z]:[/\\].*?[/\\]Git[/\\](.*)$")


def chuan_tuyen(t: str) -> str:
    """Tuyến bắt đầu bằng '/'. Git Bash (MSYS) đổi '/phien' thành 'C:/Program Files/Git/phien': đổi lại."""
    t = t.strip()
    m = MSYS_RE.match(t)
    if m:
        t = m.group(1).replace("\\", "/")
    return t if t.startswith("/") else "/" + t


MSYS_O_DIA_RE = re.compile(r"^/([A-Za-z])(?:/(.*))?$")


def chuan_duong_dan(p: str | Path) -> Path:
    """Đường dẫn kiểu Git Bash '/d/AISC2026/...' → 'D:/AISC2026/...' (trên Windows); khác thì giữ."""
    s = str(p).replace("\\", "/")
    m = MSYS_O_DIA_RE.match(s)
    if m and os.name == "nt":
        return Path(f"{m.group(1).upper()}:/{m.group(2) or ''}")
    return Path(p)


def mo_rong_tuyen(tuyen: str, gia_tri: dict[str, str]) -> tuple[str | None, list[str]]:
    """Thay {phien_live}... bằng id; trả (tuyến, các chỗ giữ còn thiếu). Thiếu thì tuyến là None."""
    thieu = [k for k in CHO_GIU_RE.findall(tuyen) if not gia_tri.get(k)]
    if thieu:
        return None, thieu
    return CHO_GIU_RE.sub(lambda m: gia_tri[m.group(1)], tuyen), []


def ten_tep(tuyen: str) -> str:
    """Tên tệp ảnh cho một tuyến: /phien/c79068d1-8671-.../nguoi-dan → phien_c79068d1_nguoi-dan."""
    duong = tuyen.split("?", 1)[0].strip("/")
    if not duong:
        return "goc"
    phan = []
    for p in duong.split("/"):
        if re.fullmatch(r"[0-9a-f]{8}-[0-9a-f-]{27}", p):
            p = p[:8]
        phan.append(re.sub(r"[^\w.-]+", "-", p))
    return "_".join(phan)


def phan_tich(
    do: dict[str, Any],
    tuyen: str,
    khung: tuple[int, int],
    nghiem: bool = False,
    them_chu_cam: tuple[tuple[str, str, int], ...] = (),
) -> list[Phat]:
    """Phân loại số đo trong trang (kết quả của DO_JS) thành các chỗ vi phạm."""
    kh = ten_khung(khung)
    ra: list[Phat] = []

    def bao(muc: str, loai: str, mo_ta: str) -> None:
        ra.append(Phat(muc, loai, tuyen, kh, mo_ta))

    # tràn ngang
    tr = do.get("tran") or {}
    if tr.get("sw", 0) > tr.get("cw", 0) + 1:
        thu = "; ".join(
            f"{t['mo_ta']} (phải {t['right']:.0f})" for t in (tr.get("thu_pham") or [])[:4]
        )
        bao(
            DO,
            "tran-ngang",
            f"trang rộng {tr['sw']} px > khung {tr['cw']} px" + (f": {thu}" if thu else ""),
        )

    # nút thấp
    thap: Counter[tuple[str, int]] = Counter()
    for el in do.get("tuong_tac") or []:
        h = float(el.get("h") or 0)
        if el.get("nut_chinh") and h < NUT_CHINH_TOI_THIEU:
            bao(DO, "nut-chinh-thap", f"{el['mo_ta']} cao {h:.0f} px < {NUT_CHINH_TOI_THIEU:.0f}")
        elif h < NUT_TOI_THIEU and not el.get("noi_dong"):
            thap[(el["mo_ta"], round(h))] += 1
    for (mo_ta, h), n in sorted(thap.items(), key=lambda x: x[0][1]):
        bao(
            DO if nghiem else VANG,
            "nut-thap",
            f"{mo_ta} cao {h} px < {NUT_TOI_THIEU:.0f}" + (f" (×{n})" if n > 1 else ""),
        )

    # nghiêng
    for el in do.get("nghieng") or []:
        g = goc_nghieng(el.get("transform"), el.get("rotate"))
        if g < DUNG_SAI_GOC:
            continue
        if el.get("la_tuong_tac") or el.get("chua_tuong_tac"):
            vai = (
                "là phần tử tương tác"
                if el.get("la_tuong_tac")
                else f"chứa {el['chua_tuong_tac']} phần tử tương tác"
            )
            bao(DO, "nghieng-chua-nut", f"{el['mo_ta']} nghiêng {g:.1f}° và {vai}")
        elif not el.get("aria_hidden") or g > NGHIENG_TRANG_TRI_TOI_DA:
            ly_do = (
                "không có aria-hidden"
                if not el.get("aria_hidden")
                else f"quá {NGHIENG_TRANG_TRI_TOI_DA:.0f}°"
            )
            bao(VANG, "nghieng-trang-tri", f"{el['mo_ta']} nghiêng {g:.1f}° ({ly_do})")

    # chữ cấm: chữ hiển thị, tiêu đề tab, thuộc tính đọc được
    nguon_chu = [("chữ", do.get("chu") or ""), ("tiêu đề tab", do.get("tieu_de") or "")]
    nguon_chu += [
        (f"{t['thuoc_tinh']} của {t['mo_ta']}", t["chu"]) for t in do.get("thuoc_tinh") or []
    ]
    da: set[tuple[str, str]] = set()
    luat = tat_ca_luat_chu(them_chu_cam)
    for noi, chu in nguon_chu:
        for muc, nhan, khop, ngu in tim_chu_cam_muc(chu, luat=luat):
            if (nhan, ngu) in da:
                continue
            da.add((nhan, ngu))
            bao(muc, "chu-cam", f"«{khop}» ({nhan}) trong {noi}: …{ngu}…")
    for dong in dict.fromkeys(tim_tieng_anh(do.get("chu") or "")):
        bao(VANG, "tieng-anh", dong)

    # vùng chính trên màn đầu
    vung = [v for v in do.get("vung_chinh") or [] if v.get("hien", True)]
    cao = float(do.get("cao_man") or khung[1])
    if not vung:
        bao(VANG, "thieu-vung-chinh", "chưa gắn [data-vung-chinh]")
    for v in vung:
        if float(v["bottom"]) > cao + 1:
            muc = DO if khung[0] >= KHUNG_RONG else VANG
            bao(
                muc,
                "vung-chinh",
                f"{v['mo_ta']} đáy {float(v['bottom']):.0f} px > màn đầu {cao:.0f} px",
            )

    # tương phản
    kem: Counter[str] = Counter()
    for t in do.get("chu_mau") or []:
        tl = ty_le_tuong_phan(t.get("mau"), t.get("nen"))
        if tl is None:
            continue
        nguong = 3.0 if chu_lon(float(t.get("co") or 16), int(t.get("dam") or 400)) else 4.5
        if tl < nguong:
            kem[f"{t['mo_ta']} {tl:.2f}:1 < {nguong:g}:1 ({t.get('mau')} trên {t.get('nen')})"] += 1
    for mo_ta, n in kem.most_common(15):
        bao(VANG, "tuong-phan", mo_ta + (f" (×{n})" if n > 1 else ""))

    # nhãn công bố NGƯỜI DẪN AI (D-015): mọi khung người dẫn AI đang hiện phải mang nhãn hiện, đúng chữ, đủ cỡ
    for k in do.get("nguoi_dan_ai") or []:
        for loi in kiem_nhan_ai(k):
            bao(DO, "nhan-ai", f"{k.get('mo_ta', '[data-nguoi-dan-ai]')}: {loi}")
    for v in do.get("media_ai") or []:
        if not v.get("trong_khung"):
            bao(
                DO,
                "nhan-ai",
                f"{v.get('mo_ta')} phát video người dẫn AI ({v.get('src', '')[:60]}) "
                "nhưng không nằm trong [data-nguoi-dan-ai] (không có nhãn công bố)",
            )

    # lỗi trang
    if do.get("next_loi"):
        bao(DO, "loi-next", str(do["next_loi"]))
    m = TRANG_LOI_RE.search(do.get("chu") or "")
    if m:
        bao(DO, "trang-loi", f"trang hiện «{m.group()}»")
    return ra


def kiem_nhan_ai(k: dict[str, Any], chu_dung: str | None = None) -> list[str]:
    """Lỗi của một khung [data-nguoi-dan-ai] đang hiện (số đo của DO_JS); rỗng là đạt.

    Đạt khi: có ít nhất một nhãn con [data-nhan-cong-bo="NGUOI_DAN_AI"] đang hiện, chữ của nhãn chứa đúng chữ
    canon, chữ nhỏ nhất trong nhãn ≥ 12 px, và tâm nhãn không bị phần tử khác che."""
    chu_dung = unicodedata.normalize("NFC", chu_dung or CHU_NHAN_AI)
    ds = k.get("nhan") or []
    if not ds:
        return ['không có nhãn con [data-nhan-cong-bo="NGUOI_DAN_AI"]']
    hien = [n for n in ds if n.get("hien")]
    if not hien:
        return [f"nhãn NGƯỜI DẪN AI bị ẩn ({ds[0].get('ly_do_an') or 'không hiện'})"]
    loi_tot_nhat: list[str] | None = None
    for n in hien:
        loi: list[str] = []
        chu = re.sub(r"\s+", " ", unicodedata.normalize("NFC", n.get("chu") or "")).strip()
        if chu_dung not in chu:
            loi.append(f"chữ nhãn «{chu[:60]}» khác «{chu_dung}»")
        co = n.get("co")
        if co is None or float(co) < CO_CHU_NHAN_AI_TOI_THIEU:
            loi.append(f"chữ nhãn {float(co or 0):.1f} px < {CO_CHU_NHAN_AI_TOI_THIEU:.0f} px")
        if n.get("che"):
            loi.append(f"nhãn bị che bởi {n['che']}")
        if not loi:
            return []
        if loi_tot_nhat is None or len(loi) < len(loi_tot_nhat):
            loi_tot_nhat = loi
    return loi_tot_nhat or []


DEV_CONG_CU_RE = re.compile(
    r"next[-_]devtools|node_modules_next_dist|/node_modules/next/|react[-_]refresh|webpack[-_]hmr|"
    r"turbopack[-_]hmr|hmr[-_]client|__nextjs",
    re.IGNORECASE,
)
"""URL mã của công cụ chỉ chạy ở next dev (lớp phủ lỗi, nút N, React Refresh, HMR)."""
CSP_RE = re.compile(
    r"violates the following Content Security Policy|Refused to (?:apply|evaluate|execute|load)|unsafe-eval",
    re.IGNORECASE,
)
HMR_RE = re.compile(
    r"\[HMR\]|\[Fast Refresh\]|webpack-hmr|turbopack-hmr|_next/webpack-hmr", re.IGNORECASE
)
CHI_DEV = "DEV"
"""Mức của lỗi console chỉ có ở next dev: in riêng, không tính ĐỎ hay VÀNG."""


def la_loi_chi_o_dev(chu: str, url: str | None, dev: bool) -> bool:
    """Lỗi console chỉ có ở next dev (soát đợt 1 mục 6). Chỉ khi trang chạy next dev (`dev`), và:
    lỗi CSP (style nội tuyến, eval) phát ra từ mã của chính Next/React dev (lớp phủ next-devtools chèn thẻ
    <style>, React Refresh dùng eval), hoặc lỗi kết nối HMR. Lỗi CSP từ mã của ứng dụng vẫn tính."""
    if not dev:
        return False
    chu = chu or ""
    if HMR_RE.search(chu):
        return True
    return bool(CSP_RE.search(chu) and DEV_CONG_CU_RE.search(url or ""))


def phan_loai_console(
    loi_js: list[str],
    console: list[tuple[str, str]],
    tuyen: str,
    khung: tuple[int, int],
    dev: bool,
) -> list[Phat]:
    """Lỗi JS chưa bắt (ĐỎ) và console.error (VÀNG); phần chỉ có ở next dev gom thành một dòng mức DEV.

    `console`: (chữ, url nguồn). Lỗi JS chưa bắt khớp HMR/CSP-eval ở dev cũng gom vào DEV."""
    kh = ten_khung(khung)
    ra: list[Phat] = []
    dev_dem: Counter[str] = Counter()
    for e in dict.fromkeys(loi_js):
        if dev and (HMR_RE.search(e) or re.search(r"unsafe-eval|EvalError", e)):
            dev_dem["lỗi JS eval/HMR của next dev"] += 1
            continue
        ra.append(Phat(DO, "loi-js", tuyen, kh, e))
    nhom: Counter[str] = Counter()
    for chu, url in console:
        dong = (chu or "").splitlines()[0] if chu else ""
        if la_loi_chi_o_dev(dong, url, dev):
            dev_dem[_rut_gon_dev(dong)] += 1
            continue
        khoa = dong[:90]
        if "Failed to load resource" in dong and url:
            khoa = f"{dong[:90]} [{_duong(url)}]"
        nhom[khoa] += 1
    for c, n in nhom.most_common(5):
        ra.append(Phat(VANG, "console", tuyen, kh, c + (f" (×{n})" if n > 1 else "")))
    if dev_dem:
        mo_ta = " · ".join(f"{k} ×{n}" for k, n in dev_dem.most_common(3))
        ra.append(Phat(CHI_DEV, "console-dev", tuyen, kh, f"chỉ ở dev (không tính): {mo_ta}"))
    return ra


def _rut_gon_dev(dong: str) -> str:
    if "inline style" in dong:
        return "CSP chặn thẻ <style> của lớp phủ Next dev"
    if "eval" in dong.lower():
        return "CSP chặn eval của React Refresh/Next dev"
    if HMR_RE.search(dong):
        return "kết nối HMR của Next dev"
    return dong[:60]


def _duong(url: str) -> str:
    m = re.match(r"^[a-z]+://[^/]+(/[^?#]*)", url or "", re.IGNORECASE)
    return (m.group(1) if m else url or "")[:80]


def ma_thoat(phat: list[Phat]) -> int:
    return 1 if any(p.muc == DO for p in phat) else 0


def bang_dem(phat: list[Phat]) -> list[str]:
    ra = []
    for muc in (DO, VANG):
        dem = Counter(p.loai for p in phat if p.muc == muc)
        ra.append(f"{muc}: " + (" · ".join(f"{k} {v}" for k, v in sorted(dem.items())) or "0"))
    theo_khung = Counter((p.khung, p.muc) for p in phat)
    khung = sorted({p.khung for p in phat})
    if khung:
        ra.append(
            "theo khung: "
            + " · ".join(
                f"{k} {theo_khung[(k, DO)]} đỏ/{theo_khung[(k, VANG)]} vàng" for k in khung
            )
        )
    n_do = sum(1 for p in phat if p.muc == DO)
    n_vang = sum(1 for p in phat if p.muc == VANG)
    n_dev = sum(1 for p in phat if p.muc == CHI_DEV)
    ra.append(
        f"kiem_giao_dien: {n_do} đỏ · {n_vang} vàng"
        + (f" · {n_dev} tuyến@khung có lỗi chỉ ở dev (không tính)" if n_dev else "")
    )
    return ra


# ------------------------------------------------------------------ đo trong trang
DO_JS = r"""
() => {
  window.scrollTo(0, 0);
  const de = document.documentElement;
  const cw = de.clientWidth, vh = window.innerHeight;
  const SEL = 'button, a[href], [role=button], [role=link], [role=tab], [role=menuitem], [role=switch], ' +
              '[role=checkbox], [role=radio], input:not([type=hidden]), select, textarea, summary';
  const moTa = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cn = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    const cls = cn.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    for (const a of ['data-chup', 'data-vung-chinh', 'data-nut-chinh', 'data-testid', 'aria-label', 'name', 'href']) {
      const v = el.getAttribute(a);
      if (v !== null) { s += '[' + a + (v ? '="' + v.slice(0, 40) + '"' : '') + ']'; break; }
    }
    const t = (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (t) s += ' «' + t + '»';
    return s;
  };
  const hien = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
    if (cs.clip && cs.clip.indexOf('rect(0') === 0) return false;
    return true;
  };

  // tràn ngang
  const tran = { sw: de.scrollWidth, cw: cw, thu_pham: [] };
  if (de.scrollWidth > cw + 1) {
    for (const el of document.body.querySelectorAll('*')) {
      if (el.ownerSVGElement) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > cw + 1 || r.left < -1) {
        const p = el.parentElement, pr = p ? p.getBoundingClientRect() : null;
        if (!pr || (pr.right <= cw + 1 && pr.left >= -1)) tran.thu_pham.push({ mo_ta: moTa(el), right: r.right, left: r.left });
      }
      if (tran.thu_pham.length >= 8) break;
    }
  }

  // phần tử tương tác
  const tuongTac = [];
  const tatCaTT = [...document.querySelectorAll(SEL)];
  for (const el of tatCaTT) {
    if (!hien(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    let h = r.height, w = r.width;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (el.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio')) {
      const lab = el.closest('label') || (el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null);
      if (lab) { const lr = lab.getBoundingClientRect(); h = Math.max(h, lr.height); w = Math.max(w, lr.width); }
    }
    let noiDong = false;
    if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement) {
      // liên kết nằm trong câu (WCAG 2.5.8 miễn): chữ thường bao quanh nó có từ 3 từ trở lên
      let quanh = '';
      for (const n of el.parentElement.childNodes) if (n.nodeType === 3) quanh += ' ' + n.textContent;
      noiDong = (quanh.match(/[\p{L}]{2,}/gu) || []).length >= 3;
    }
    const boc = el.closest('[data-nut-chinh]');
    const nutChinh = el.hasAttribute('data-nut-chinh') || (!!boc && boc.querySelectorAll(SEL).length === 1);
    tuongTac.push({ mo_ta: moTa(el), w: w, h: h, nut_chinh: nutChinh, noi_dong: noiDong });
    if (tuongTac.length >= 1500) break;
  }

  // phần tử có biến đổi (xoay, xô lệch); Python tính góc
  const nghieng = [];
  for (const el of [document.body, ...document.body.querySelectorAll('*')]) {
    if (el.ownerSVGElement) continue;
    const cs = getComputedStyle(el);
    const t = cs.transform, ro = cs.rotate;
    const coT = t && t !== 'none' && !/^matrix\(1, 0, 0, 1,/.test(t);
    const coR = ro && ro !== 'none' && ro !== '0deg';
    if (!coT && !coR) continue;
    if (!hien(el)) continue;
    const con = [...el.querySelectorAll(SEL)].filter(hien).length;
    nghieng.push({ mo_ta: moTa(el), transform: t, rotate: ro, la_tuong_tac: el.matches(SEL),
                   chua_tuong_tac: con, aria_hidden: !!el.closest('[aria-hidden="true"]') });
    if (nghieng.length >= 400) break;
  }

  // vùng chính
  const vung = [...document.querySelectorAll('[data-vung-chinh]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { mo_ta: moTa(el), top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, hien: hien(el) };
  });

  // thuộc tính đọc được
  const thuocTinh = [];
  for (const el of document.querySelectorAll('[placeholder], [aria-label], [title], img[alt]')) {
    if (el.ownerSVGElement && el.tagName.toLowerCase() !== 'svg') continue;
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) {
      const v = el.getAttribute(a);
      if (v) thuocTinh.push({ mo_ta: moTa(el), thuoc_tinh: a, chu: v });
    }
    if (thuocTinh.length >= 800) break;
  }

  // màu chữ và nền đặc gần nhất (bỏ qua khi có ảnh nền hay dải màu ở giữa)
  const nenCua = (el) => {
    for (let q = el; q; q = q.parentElement) {
      const cs = getComputedStyle(q);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const b = cs.backgroundColor;
      if (b && b !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(b)) {
        const m = /rgba\([^)]*,\s*([\d.]+)\)$/.exec(b);
        if (m && parseFloat(m[1]) < 0.999) return null;
        return b;
      }
    }
    return 'rgb(255, 255, 255)';
  };
  const chuMau = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.ownerSVGElement || el.closest('[aria-hidden="true"]')) continue;
    let coChu = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { coChu = true; break; }
    if (!coChu || !hien(el)) continue;
    const cs = getComputedStyle(el);
    const nen = nenCua(el);
    if (!nen) continue;
    chuMau.push({ mo_ta: moTa(el), mau: cs.color, nen: nen, co: parseFloat(cs.fontSize), dam: parseInt(cs.fontWeight, 10) || 400 });
    if (chuMau.length >= 800) break;
  }

  // nhãn công bố NGƯỜI DẪN AI (D-015): khung [data-nguoi-dan-ai] đang hiện → nhãn con hiện, chữ, cỡ, có bị che
  const anVi = (el) => {
    if (!el.isConnected) return 'không gắn vào trang';
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return 'kích thước 0';
    let op = 1;
    for (let q = el; q && q.nodeType === 1; q = q.parentElement) {
      const cs = getComputedStyle(q);
      if (cs.display === 'none') return 'display: none';
      op *= parseFloat(cs.opacity);
      if (cs.clipPath && cs.clipPath !== 'none' && /inset\(\s*50%|circle\(\s*0/.test(cs.clipPath)) return 'clip-path che hết';
    }
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return 'visibility: hidden';
    if (op < 0.35) return 'gần trong suốt (opacity ' + op.toFixed(2) + ')';
    if (cs.clip && cs.clip.indexOf('rect(0') === 0) return 'clip che hết';
    return null;
  };
  const coChuNhoNhat = (el) => {
    let nho = null;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim() || !n.parentElement) continue;
      const v = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (nho === null || v < nho) nho = v;
    }
    return nho;
  };
  const sx0 = window.scrollX, sy0 = window.scrollY;
  const nguoiDanAI = [];
  for (const k of document.querySelectorAll('[data-nguoi-dan-ai]')) {
    if (!hien(k) || anVi(k)) continue;
    const ds = [];
    for (const n of k.querySelectorAll('[data-nhan-cong-bo="NGUOI_DAN_AI"]')) {
      const lyDo = anVi(n);
      const muc = { hien: !lyDo, ly_do_an: lyDo, chu: (n.innerText || n.textContent || ''), co: coChuNhoNhat(n), che: null };
      if (!lyDo) {
        let r = n.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) {
          n.scrollIntoView({ block: 'center', inline: 'center' });
          r = n.getBoundingClientRect();
        }
        const pe = n.style.getPropertyValue('pointer-events'), peUuTien = n.style.getPropertyPriority('pointer-events');
        n.style.setProperty('pointer-events', 'auto', 'important');
        const tren = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (pe) n.style.setProperty('pointer-events', pe, peUuTien); else n.style.removeProperty('pointer-events');
        if (tren && tren !== n && !n.contains(tren)) muc.che = moTa(tren);
      }
      ds.push(muc);
    }
    nguoiDanAI.push({ mo_ta: moTa(k), nhan: ds });
  }
  window.scrollTo(sx0, sy0);
  const mediaAI = [];
  for (const el of document.querySelectorAll('video, iframe, video source, img')) {
    const nguon = [el.getAttribute('src') || '', el.currentSrc || '', el.getAttribute('poster') || ''].join(' ');
    if (!/nguoi-dan-ai/i.test(nguon)) continue;
    const media = el.tagName === 'SOURCE' ? el.closest('video') || el : el;
    mediaAI.push({ mo_ta: moTa(media), src: (el.getAttribute('src') || el.currentSrc || '').slice(0, 120),
                   trong_khung: !!media.closest('[data-nguoi-dan-ai]') });
  }
  const dev = !!document.querySelector('nextjs-portal') ||
              [...document.scripts].some((x) => /next[-_]devtools|react[-_]refresh/i.test(x.src || ''));

  // lỗi của Next (lớp phủ khi chạy dev)
  let nextLoi = null;
  for (const el of document.querySelectorAll('nextjs-portal')) {
    const sr = el.shadowRoot;
    if (!sr) continue;
    if (sr.querySelector('[data-nextjs-dialog], [data-nextjs-dialog-overlay]')) nextLoi = 'hộp lỗi của Next đang mở';
    else if (sr.querySelector('[data-next-badge][data-error="true"]')) nextLoi = 'huy hiệu Next báo lỗi chạy';
  }

  return { tran: tran, tuong_tac: tuongTac, nghieng: nghieng, vung_chinh: vung, thuoc_tinh: thuocTinh,
           chu_mau: chuMau, chu: document.body.innerText, tieu_de: document.title, next_loi: nextLoi,
           cao_man: vh, rong_man: cw, nguoi_dan_ai: nguoiDanAI, media_ai: mediaAI, dev: dev };
}
"""


# ------------------------------------------------------------------ chạy
def _get_json(url: str, timeout: float = 8.0) -> Any:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - máy chủ dev cục bộ
        return json.loads(r.read().decode("utf-8"))


def _ma_http(url: str, timeout: float = 8.0) -> int:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def _url_nguon(m: Any) -> str:
    """URL mã phát ra dòng console (Playwright ConsoleMessage.location)."""
    try:
        loc = m.location
        return str((loc or {}).get("url") or "")
    except Exception:  # noqa: BLE001 - bản Playwright cũ
        return ""


def thu_muc_anh_mac_dinh() -> Path:
    for p in GOC.parents:
        if (p / "AISC26_Vong2").is_dir():
            return p / "AISC26_Vong2" / "_tam" / "anh-ui"
    return GOC / "_tam" / "anh-ui"


def gia_tri_cho_giu(api: str, ma_phong: str) -> tuple[dict[str, str], list[str]]:
    """Id phiên từ API và mã phòng; trả kèm các cảnh báo cấu hình."""
    canh_bao: list[str] = []
    try:
        ds = _get_json(api.rstrip("/") + "/sessions")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        raise LoiCauHinh(f"không đọc được {api}/sessions: {e}") from e
    gia = chon_phien(ds if isinstance(ds, list) else [])
    gia["ma_phong"] = ma_phong
    try:
        ma = _ma_http(f"{api.rstrip('/')}/xem-api/{ma_phong}/trang-thai")
        if ma >= 400:
            canh_bao.append(
                f"mã phòng {ma_phong}: API trả {ma} (phòng đã đổi mã? truyền --ma-phong)"
            )
    except (urllib.error.URLError, TimeoutError) as e:
        canh_bao.append(f"không kiểm được mã phòng {ma_phong}: {e}")
    return gia, canh_bao


def kiem_mot(
    trinh: Any,
    base: str,
    tuyen: str,
    khung: tuple[int, int],
    *,
    ra: Path | None,
    cho_ms: int,
    giam_chuyen_dong: bool,
    nghiem: bool,
    them_chu_cam: tuple[tuple[str, str, int], ...],
) -> list[Phat]:
    kh = ten_khung(khung)
    dien_thoai = khung[0] < 600
    ctx = trinh.new_context(
        viewport={"width": khung[0], "height": khung[1]},
        device_scale_factor=1,
        is_mobile=dien_thoai,
        has_touch=dien_thoai,
        locale="vi-VN",
        color_scheme="light",
        reduced_motion="reduce" if giam_chuyen_dong else "no-preference",
    )
    trang = ctx.new_page()
    loi_js: list[str] = []
    console: list[tuple[str, str]] = []
    trang.on("pageerror", lambda e: loi_js.append((str(e).splitlines() or [""])[0][:200]))
    trang.on(
        "console",
        lambda m: (
            m.type == "error"
            and console.append(((m.text.splitlines() or [""])[0][:200], _url_nguon(m)))
        ),
    )
    phat: list[Phat] = []
    try:
        try:
            dap = trang.goto(base.rstrip("/") + tuyen, wait_until="load", timeout=120_000)
        except Exception as e:  # noqa: BLE001 - mọi lỗi mở trang đều là lỗi tuyến
            return [
                Phat(DO, "tuyen-loi", tuyen, kh, f"không mở được: {str(e).splitlines()[0][:200]}")
            ]
        if dap is not None and dap.status >= 400:
            phat.append(Phat(DO, "tuyen-loi", tuyen, kh, f"HTTP {dap.status}"))
        try:
            trang.wait_for_load_state("networkidle", timeout=8_000)
        except Exception:  # noqa: BLE001 - trang hỏi định kỳ thì không bao giờ rảnh mạng
            pass
        trang.evaluate("() => (document.fonts ? document.fonts.ready.then(() => true) : true)")
        trang.wait_for_timeout(cho_ms)
        do = trang.evaluate(DO_JS)
        phat += phan_tich(do, tuyen, khung, nghiem=nghiem, them_chu_cam=them_chu_cam)
        phat += phan_loai_console(loi_js, console, tuyen, khung, dev=bool(do.get("dev")))
        if ra is not None:
            ra.mkdir(parents=True, exist_ok=True)
            goc_ten = f"{ten_tep(tuyen)}__{kh}"
            trang.screenshot(path=str(ra / f"{goc_ten}__dau.png"))
            trang.screenshot(path=str(ra / f"{goc_ten}__toan.png"), full_page=True)
    finally:
        ctx.close()
    return phat


def _tach(ds: list[str] | None, mac_dinh: tuple[str, ...]) -> list[str]:
    if not ds:
        return list(mac_dinh)
    return [x.strip() for d in ds for x in d.split(",") if x.strip()]


def main(argv: list[str] | None = None) -> int:
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    ap.add_argument("--base", default="http://127.0.0.1:3130", help="Next đang chạy")
    ap.add_argument("--api", default="http://127.0.0.1:8000", help="lõi API (để lấy id phiên)")
    ap.add_argument(
        "--tuyen",
        action="append",
        help="tuyến, cách nhau dấu phẩy; có chỗ giữ {phien_live}, "
        "{phien_doi}, {phien_lab}, {ma_phong}",
    )
    ap.add_argument(
        "--khung",
        action="append",
        help="RỘNGxCAO, cách nhau dấu phẩy (mặc định 1280x720,1280x633,390x844)",
    )
    ap.add_argument("--ma-phong", default=os.environ.get("LIVELIFT_MA_PHONG", MA_PHONG_MAC_DINH))
    ap.add_argument(
        "--nhan", default=None, help="tên thư mục ảnh của lượt này (mặc định kiem-MMDD-HHMM)"
    )
    ap.add_argument(
        "--ra",
        type=chuan_duong_dan,
        default=None,
        help="thư mục gốc ảnh (mặc định AISC26_Vong2/_tam/anh-ui)",
    )
    ap.add_argument("--khong-anh", action="store_true", help="không lưu ảnh")
    ap.add_argument("--nghiem", action="store_true", help="nút thấp hơn 44 px cũng là ĐỎ")
    ap.add_argument(
        "--giam-chuyen-dong", action="store_true", help="đặt prefers-reduced-motion: reduce"
    )
    ap.add_argument(
        "--cho-ms", type=int, default=1200, help="chờ thêm sau khi tải (hoạt hình, số đếm lên)"
    )
    ap.add_argument(
        "--them-chu-cam",
        action="append",
        default=[],
        help="thêm biểu thức chữ cấm (không phân biệt hoa thường)",
    )
    ap.add_argument(
        "--toi-da",
        type=int,
        default=12,
        help="số dòng in tối đa mỗi loại ở mỗi tuyến@khung (đủ trong JSON)",
    )
    a = ap.parse_args(argv)

    try:
        khung = [doc_khung(k) for k in _tach(a.khung, KHUNG_MAC_DINH)]
        gia, canh_bao = gia_tri_cho_giu(a.api, a.ma_phong)
    except LoiCauHinh as e:
        print(f"kiem_giao_dien: LỖI CẤU HÌNH: {e}", file=sys.stderr)
        return 2
    try:
        if _ma_http(a.base.rstrip("/") + "/", timeout=60) >= 500:
            print(f"kiem_giao_dien: CẢNH BÁO: {a.base}/ trả lỗi máy chủ", file=sys.stderr)
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"kiem_giao_dien: LỖI CẤU HÌNH: không tới được {a.base}: {e}", file=sys.stderr)
        return 2
    if CANH_BAO_CANON:
        canh_bao.append(CANH_BAO_CANON + " (chỉ kiểm CHU_CAM_HIEN)")
    for c in canh_bao:
        print(f"CẢNH BÁO cấu hình: {c}")

    tuyen: list[str] = []
    phat: list[Phat] = []
    for t in _tach(a.tuyen, TUYEN_MAC_DINH):
        mo, thieu = mo_rong_tuyen(chuan_tuyen(t), gia)
        if mo is None:
            phat.append(
                Phat(
                    VANG,
                    "thieu-du-lieu",
                    t,
                    "-",
                    f"không có giá trị cho {', '.join(thieu)} (API chưa gieo?)",
                )
            )
        else:
            tuyen.append(mo)
    nhan = a.nhan or datetime.now().strftime("kiem-%m%d-%H%M")
    goc_anh = None if a.khong_anh else (a.ra or thu_muc_anh_mac_dinh()) / nhan
    them = tuple((f"thêm: {m}", m, re.IGNORECASE) for m in a.them_chu_cam)

    from playwright.sync_api import sync_playwright  # noqa: PLC0415 - chỉ cần khi chạy thật

    with sync_playwright() as p:
        trinh = p.chromium.launch()
        try:
            for t in tuyen:
                for k in khung:
                    mot = kiem_mot(
                        trinh,
                        a.base,
                        t,
                        k,
                        ra=goc_anh,
                        cho_ms=a.cho_ms,
                        giam_chuyen_dong=a.giam_chuyen_dong,
                        nghiem=a.nghiem,
                        them_chu_cam=them,
                    )
                    phat += mot
                    dem = Counter(x.loai for x in mot)
                    da_in: Counter[str] = Counter()
                    for x in sorted(mot, key=lambda x: (x.muc != DO, x.loai)):
                        da_in[x.loai] += 1
                        if da_in[x.loai] <= a.toi_da:
                            print(x.dong_in())
                        elif da_in[x.loai] == a.toi_da + 1:
                            print(
                                f"     … còn {dem[x.loai] - a.toi_da} [{x.loai}] ở {t} @{ten_khung(k)} (xem JSON)"
                            )
        finally:
            trinh.close()
    for x in phat:
        if x.loai == "thieu-du-lieu":
            print(x.dong_in())
    for dong in bang_dem(phat):
        print(dong)
    if goc_anh is not None:
        goc_anh.mkdir(parents=True, exist_ok=True)
        (goc_anh / "ket-qua.json").write_text(
            json.dumps(
                {
                    "luc": datetime.now().isoformat(timespec="seconds"),
                    "base": a.base,
                    "tuyen": tuyen,
                    "khung": [ten_khung(k) for k in khung],
                    "phat": [asdict(x) for x in phat],
                },
                ensure_ascii=False,
                indent=1,
            ),
            encoding="utf-8",
        )
        print(f"ảnh và ket-qua.json: {goc_anh}")
    return ma_thoat(phat)


if __name__ == "__main__":
    raise SystemExit(main())

"""Tổng quan nhiều phiên cho màn ``/tong-quan`` (kế hoạch bản 3.1, mục 4 và 5; đơn vị N2).

``GET /tong-quan/thong-ke?env=all|real|demo`` chỉ ĐỌC, trả năm phần:

1. ``dem_theo_nhan``: số phiên theo từng nhãn nguồn (THẬT, THỬ NỘI BỘ, DÀN DỰNG,
   MÔ PHỎNG, QUAN SÁT), tách riêng, đủ năm ô kể cả khi bằng 0 (THẬT 0 là sự thật
   cần nói ra). Cố ý KHÔNG có trường tổng cộng qua các nhãn: cộng phiên máy sinh
   với phiên thật thành một con số là đúng điều luật nhãn cấm. Phiên phân tích
   video có thật (phát lại YouTube, ``analysis_only``) là QUAN SÁT, không bao giờ
   đếm vào MÔ PHỎNG.
2. ``phien_dang_live``: phiên đang phát, kèm số khối đã chạy. Không có ước lượng
   nào, kể cả với phiên MÔ PHỎNG: màn tổng quan không phải chỗ nhìn giữa phiên.
3. ``rung``: hàng biểu đồ rừng cho phiên đã xong. Kết luận ĐỌC LẠI từ đúng đường
   báo cáo sau phiên (:func:`reports._bao_cao_ket_qua`, cùng hàm mà
   ``/sessions/{id}/bao-cao`` và bộ demo vàng gọi), không tính lại ở đây. Phiên
   còn khoá theo tiền đăng ký §7 chỉ có trạng thái "Đang khoá", không một con số.
4. ``gop``: kết quả gộp dẫn lại từ :func:`reports.experiment_summary`, MỖI NHÃN
   MỘT HÀNG trong từng kho (mẫu §8.2 của kho thật có thể có cả THẬT lẫn DÀN DỰNG;
   mỗi nhãn được gộp riêng nên một hình thoi không bao giờ trộn hai nhãn), cùng
   luật khoá. Kho chưa có phiên nào của nhãn đó thì ghi "Chưa có phiên", kể cả khi
   khoá §7 đang bật: khoá chỉ có nghĩa khi có kết quả để giấu.
5. ``nguon_du_lieu``: câu nguồn dữ liệu (kế hoạch mục 4) và mức sẵn sàng của từng
   nền tảng (chỉ tên và trạng thái, không có tên biến khoá).

Đường nằm ở ``/tong-quan/...``, không ở ``/sessions/...``: một đường tĩnh dưới
``/sessions/`` sẽ bị route ``/sessions/{session_id}`` nuốt mất.

Bộ nhớ đệm: phần đắt (rừng và gộp) được giữ :data:`HAN_BO_DEM_S` giây theo khoá
(kho, ``env``, dấu của mọi phiên, trạng thái khoá §7, trần hàng rừng). Phiên nào
đổi trạng thái, kết thúc, đổi tên hay có phiên mới thì dấu đổi và bảng được tính
lại ngay; phần rẻ (đếm theo nhãn, phiên đang live, nguồn dữ liệu) luôn tính mới.
Hai lần gọi cùng lúc không tính chồng: lần sau chờ lần trước rồi dùng lại kết quả.

Mức bảo vệ: đây là đường GET. Cổng ``require_write_auth`` (auth.py) gắn ở cấp ứng
dụng chỉ chặn POST/PUT/PATCH/DELETE, nên route đọc không khai báo mức nào, giống
mọi route GET khác (``/sessions``, ``/experiment/summary``, ``/platforms``).

Nhãn nguồn của một phiên (:func:`ma_nhan_phien`) theo luật của giao diện
(``sourceLabel`` trong ``next/src/lib/livelift-api/desk.ts`` và ``maNhanPhien``
trong ``PhienList.tsx``), thêm một nhánh QUAN SÁT: phiên ``replay`` không phải dữ
liệu mẫu. Giao diện phải thêm đúng nhánh đó (trước nhánh MÔ PHỎNG) để ô đếm ở đây
và ở ``/phien`` không lệch nhau.
"""

from __future__ import annotations

import logging
import math
import re
import threading
import time
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from livelift.analysis.narrate import trang_thai_ket_luan
from livelift.api import service
from livelift.api.ingest_jobs import muc_san_sang_nen_tang
from livelift.api.routes import reports
from livelift.api.service import StoreDep
from livelift.api.store import StoreUnavailableError
from livelift.config import get_settings

log = logging.getLogger("livelift.api.tong_quan")

router = APIRouter()

DUONG_THONG_KE = "/tong-quan/thong-ke"

MaNhan = Literal["THAT", "THU_NOI_BO", "DAN_DUNG", "MO_PHONG", "QUAN_SAT"]
MaKetLuan = Literal["DOI", "GIU", "DO_THEM"]
TrangThai = Literal["dang_khoa", "quan_sat", "co_uoc_luong", "chua_uoc_luong", "khong_doc_duoc"]

THU_TU_NHAN: tuple[MaNhan, ...] = ("THAT", "THU_NOI_BO", "DAN_DUNG", "MO_PHONG", "QUAN_SAT")
"""Thứ tự ô đếm: bốn ô đầu cùng thứ tự ``THU_TU_NHAN`` của ``PhienList.tsx``, QUAN SÁT
đứng cuối (giao diện thêm ô thứ năm ở cuối)."""

NHAN_NGUON: dict[str, str] = {
    "THAT": "THẬT",
    "THU_NOI_BO": "THỬ NỘI BỘ",
    "DAN_DUNG": "DÀN DỰNG",
    "MO_PHONG": "MÔ PHỎNG",
    "QUAN_SAT": "QUAN SÁT",
}
"""Chữ hiện của năm nhãn nguồn, chép từ ``nhan_nguon[].hien_thi`` của
``docs/canon/thuat-ngu.yaml`` (test so khớp với yaml)."""

CHU_KET_LUAN: dict[str, str] = {"DOI": "ĐỔI", "GIU": "GIỮ", "DO_THEM": "ĐO THÊM"}
"""Chữ của ba kết luận, chép từ ``ket_luan[].chu`` của ``thuat-ngu.yaml`` (test so khớp)."""

_MA_THEO_TRANG_THAI: dict[str, str] = {"duong": "DOI", "am": "GIU", "null": "DO_THEM"}
"""Trạng thái của :func:`narrate.trang_thai_ket_luan` sang mã kết luận canon."""

CHU_DANG_KHOA = "Đang khoá"
LY_DO_KHOA = "Kết quả còn khoá theo tiền đăng ký, chưa tới ngày mở."
"""Câu cố định cho hàng khoá: không chép lý do của máy chủ vì câu đó có ngày mở khoá,
mà hàng khoá phải không mang một con số nào."""
CHU_QUAN_SAT = "Quan sát, không bốc thăm"
LY_DO_QUAN_SAT = "Phiên quan sát không có lịch bốc thăm nên không có ước lượng."
CHU_CHUA_CO_PHIEN = "Chưa có phiên"
LY_DO_CHUA_CO_PHIEN = "Chưa có phiên {nhan} nào đã xong trong mẫu gộp."
"""Câu cho hàng gộp 0 phiên (điền chữ nhãn). Không có kết luận nào, kể cả ĐO THÊM."""
CHU_KHONG_DOC_DUOC = "Không đọc được"
LY_DO_KHONG_DOC_DUOC = (
    "Máy chủ không đọc được kết quả của phiên này; mở tổng kết của phiên để xem lý do."
)

NGUON_DU_LIEU = (
    "TikTok LIVE không có API bình luận cho bên ngoài; TikTok Shop có số liệu theo phút, "
    "bộ nối chưa chạy với khoá thật"
)
"""Câu nguồn dữ liệu, nguyên văn kế hoạch bản 3.1 mục 4 (thẻ "Nguồn dữ liệu" của /tong-quan)."""

TRAN_HANG_RUNG = 40
"""Số hàng rừng tối đa (phiên xong gần nhất trước). Số phiên bị bỏ bớt được trả trong
``rung_bo_bot``, không giấu. Mỗi hàng chạy lại đúng đường báo cáo của một phiên: đo
19/10 trên kho bộ nhớ với 40 phiên mô phỏng 90 phút đã xong, một lần tính đủ mất
khoảng 4 s (rừng khoảng 2 s, bản gộp khoảng 2 s), nên mới có :data:`HAN_BO_DEM_S`."""

HAN_BO_DEM_S = 15.0
"""Số giây giữ phần đắt (rừng, gộp) trong bộ nhớ đệm. Dấu phiên bắt mọi thay đổi ở
cấp phiên; thời hạn ngắn này chặn phần còn lại (sự kiện đến trễ của phiên vừa xong).
Màn tổng quan nên hỏi thưa hơn (khoảng 60 s một lần, không gọi chồng)."""

TRAN_MUC_BO_DEM = 16
"""Số mục đệm tối đa (mỗi mục là một tổ hợp kho, env, dấu phiên)."""


# ---------------------------------------------------------------------------
# Hợp đồng trả về
# ---------------------------------------------------------------------------


class NhanPhien(BaseModel):
    ma: MaNhan
    hien_thi: str


class DemNhan(BaseModel):
    """Số phiên của MỘT nhãn nguồn. Không có trường nào cộng qua nhiều nhãn."""

    ma: MaNhan
    hien_thi: str
    so_phien: int
    dang_live: int
    da_xong: int
    chua_phat: int
    """Phiên đã tạo hoặc đã niêm phong lịch nhưng chưa lên sóng (planned, scheduled)."""
    da_huy: int


class PhienDangLive(BaseModel):
    """Một phiên đang phát. Cố ý không có trường ước lượng, khoảng tin cậy hay nhánh BẬT/TẮT."""

    session_id: str
    tieu_de: str | None = None
    nhan: NhanPhien
    platform: str
    bat_dau: datetime | None = None
    so_khoi_da_chay: int
    """Số khối đo đã chạy hết tính tới lúc trả lời (khối kết thúc trước thời điểm hiện tại)."""
    so_khoi_ke_hoach: int


class HangRung(BaseModel):
    """Một hàng biểu đồ rừng (một phiên đã xong).

    ``dang_khoa``, ``quan_sat``, ``khong_doc_duoc``: mọi trường số để trống.
    ``chua_uoc_luong``: chỉ có số khối, kèm lý do của máy chủ; kết luận là ĐO THÊM như ở ``/phien``.
    ``co_uoc_luong``: đủ ước lượng, khoảng tin cậy 95% và kết luận ĐỔI / GIỮ / ĐO THÊM.
    """

    session_id: str
    tieu_de: str | None = None
    nhan: NhanPhien
    ket_thuc: datetime | None = None
    trang_thai: TrangThai
    trang_thai_hien_thi: str
    ket_luan: MaKetLuan | None = None
    ly_do: str | None = None
    estimate: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    p_value: float | None = None
    n_draws: int | None = None
    n_blocks: int | None = None
    n_on: int | None = None
    n_off: int | None = None


class HangGop(BaseModel):
    """Kết quả gộp của MỘT nhãn nguồn trong MỘT kho: một hình thoi, một nhãn.

    Mẫu gộp §8.2 của kho thật (``/experiment/summary?env=real``) có thể có cả phiên
    THẬT lẫn phiên DÀN DỰNG (phòng xem không chạy thử); kho mẫu có thể có cả MÔ
    PHỎNG lẫn phòng xem do khách tạo. Mỗi nhãn được gộp riêng bằng đúng
    :func:`reports.experiment_summary` trên các phiên của nhãn đó, nên không ước
    lượng nào trộn hai nhãn. Khi mẫu của kho chỉ có một nhãn, hàng đó trùng khớp
    ``/experiment/summary?env=...``.

    ``nhan_trong_gop``: số phiên của nhãn này trong mẫu gộp (luật §8.2), rỗng khi
    0. ``n_sessions``: số phiên có khối đo được mà phép gộp thật sự dùng (trường
    của ``experiment_summary``), nên có thể nhỏ hơn số trong ``nhan_trong_gop``.
    """

    env: Literal["real", "demo"]
    ma_nhan: MaNhan
    nhan: str
    nhan_trong_gop: dict[str, int] = Field(default_factory=dict)
    trang_thai: TrangThai
    trang_thai_hien_thi: str
    ket_luan: MaKetLuan | None = None
    ly_do: str | None = None
    n_sessions: int | None = None
    n_blocks: int | None = None
    n_on: int | None = None
    n_off: int | None = None
    estimate: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    p_value: float | None = None
    n_draws: int | None = None


class NenTangTomTat(BaseModel):
    platform: str
    ten: str
    san_sang: bool
    che_do: str


class NguonDuLieu(BaseModel):
    cau: str
    nen_tang: list[NenTangTomTat] = Field(default_factory=list)


class TongQuanThongKe(BaseModel):
    env: Literal["all", "real", "demo"]
    luc: datetime
    tinh_luc: datetime
    """Lúc rừng và gộp được tính (có thể sớm hơn ``luc`` tối đa :data:`HAN_BO_DEM_S`
    giây khi trả từ bộ nhớ đệm). Đếm theo nhãn và phiên đang live luôn tính lúc ``luc``."""
    dem_theo_nhan: list[DemNhan]
    phien_dang_live: list[PhienDangLive]
    rung: list[HangRung]
    rung_bo_bot: int = 0
    """Số phiên đã xong không vẽ vì vượt :data:`TRAN_HANG_RUNG`."""
    gop: list[HangGop]
    nguon_du_lieu: NguonDuLieu


# ---------------------------------------------------------------------------
# Nhãn và bộ lọc
# ---------------------------------------------------------------------------


def ma_nhan_phien(session: dict[str, Any]) -> MaNhan:
    """Mã nhãn nguồn canon của một phiên, cùng luật với giao diện.

    * phân tích video có thật (``replay`` không phải dữ liệu mẫu, hoặc
      ``analysis_only``): QUAN SÁT. Dữ liệu có thật nhưng không bốc thăm
      (``thuat-ngu.yaml``), nên không bao giờ là MÔ PHỎNG; mẫu gộp §8.2 đã loại
      ``analysis_only`` nên nhãn này không vào kết quả gộp nào.
    * ``lab`` (phòng xem): DÀN DỰNG; nếu là buổi nhóm tự thử (``dry_run``, không
      phải dữ liệu mẫu) thì THỬ NỘI BỘ.
    * dữ liệu mẫu (``is_demo``) hoặc nền tảng ``sim``/``replay``: MÔ PHỎNG.
    * phiên tập dượt trên nền tảng thật (``dry_run``): THỬ NỘI BỘ.
    * còn lại: THẬT.
    """
    platform = session.get("platform")
    is_demo = bool(session.get("is_demo"))
    dry_run = bool(session.get("dry_run"))
    if not is_demo and (platform == "replay" or service.is_analysis_only(session)):
        return "QUAN_SAT"
    if platform == "lab":
        return "THU_NOI_BO" if dry_run and not is_demo else "DAN_DUNG"
    if is_demo or platform in ("sim", "replay"):
        return "MO_PHONG"
    if dry_run:
        return "THU_NOI_BO"
    return "THAT"


def _nhan(session: dict[str, Any]) -> NhanPhien:
    ma = ma_nhan_phien(session)
    return NhanPhien(ma=ma, hien_thi=NHAN_NGUON[ma])


def _thuoc_env(session: dict[str, Any], env: str) -> bool:
    """``real``: không phải dữ liệu mẫu; ``demo``: chỉ dữ liệu mẫu; ``all``: mọi phiên.

    Cùng ranh giới ``is_demo`` mà ``/experiment/summary`` dùng để tách hai kho.
    """
    if env == "real":
        return not session.get("is_demo")
    if env == "demo":
        return bool(session.get("is_demo"))
    return True


_GACH_DAI = re.compile(r"\s*\u2014\s*")
"""Dấu gạch dài U+2014 (viết bằng mã để tệp nguồn không chứa chính ký tự bị cấm)."""


_THAY_CHU: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile("\u2265\\s*"), "từ "),  # dấu lớn hơn hoặc bằng
    (re.compile("\u2264\\s*"), "tối đa "),  # dấu nhỏ hơn hoặc bằng
    (re.compile("l\u0169y"), "lu\u1ef9"),  # chính tả kiểu khoá, hoá: luỹ
)
"""Ký hiệu toán và chính tả lệch trong câu của reports.py (thuộc U5): đổi sang lời
thường ngay ở đây để chữ ra màn tổng quan sạch, dù U5 đã sửa nguồn hay chưa."""


def _lam_sach(text: str | None) -> str | None:
    """Câu của máy chủ ra màn công khai: bỏ dấu gạch dài, đổi ký hiệu sang lời thường."""
    if text is None:
        return None
    text = _GACH_DAI.sub(", ", text)
    for mau, thay_bang in _THAY_CHU:
        text = mau.sub(thay_bang, text)
    return text.strip()


def _huu_han(x: Any) -> bool:
    return x is not None and math.isfinite(float(x))


# ---------------------------------------------------------------------------
# Năm phần của bảng tổng quan
# ---------------------------------------------------------------------------


def _dem_theo_nhan(sessions: list[dict[str, Any]]) -> list[DemNhan]:
    dem = {
        ma: {"so_phien": 0, "dang_live": 0, "da_xong": 0, "chua_phat": 0, "da_huy": 0}
        for ma in THU_TU_NHAN
    }
    for s in sessions:
        d = dem[ma_nhan_phien(s)]
        d["so_phien"] += 1
        status = s.get("status")
        if status == "live":
            d["dang_live"] += 1
        elif status == "ended":
            d["da_xong"] += 1
        elif status == "cancelled":
            d["da_huy"] += 1
        else:
            d["chua_phat"] += 1
    return [DemNhan(ma=ma, hien_thi=NHAN_NGUON[ma], **dem[ma]) for ma in THU_TU_NHAN]


def _phien_dang_live(sessions: list[dict[str, Any]], store, now: datetime) -> list[PhienDangLive]:
    """Phiên đang phát. Chỉ đọc mốc thời gian của khối, không đọc nhánh BẬT/TẮT."""
    out: list[PhienDangLive] = []
    for s in sessions:
        if s.get("status") != "live":
            continue
        khoi_do = [b for b in store.get_blocks(s["session_id"]) if not b.get("is_washout")]
        da_qua = service.elapsed_seconds(s, now)
        out.append(
            PhienDangLive(
                session_id=s["session_id"],
                tieu_de=s.get("title"),
                nhan=_nhan(s),
                platform=str(s.get("platform") or "khong_ro"),
                bat_dau=s.get("start_ts"),
                so_khoi_da_chay=sum(1 for b in khoi_do if b["end_offset_s"] <= da_qua),
                so_khoi_ke_hoach=len(khoi_do),
            )
        )
    out.sort(key=lambda p: p.bat_dau.timestamp() if p.bat_dau else 0.0, reverse=True)
    return out


def _hang_rung(session: dict[str, Any], store) -> HangRung:
    """Một hàng rừng từ đúng kết quả của báo cáo sau phiên (``/bao-cao``)."""
    chung = {
        "session_id": session["session_id"],
        "tieu_de": session.get("title"),
        "nhan": _nhan(session),
        "ket_thuc": session.get("end_ts"),
    }
    sid = session["session_id"]
    # Cùng điều kiện "phiên quan sát" với session_bao_cao: không có lịch bốc thăm
    # thì không có đại lượng thí nghiệm nào để vẽ.
    if service.is_analysis_only(session) or not store.get_blocks(sid):
        return HangRung(
            **chung, trang_thai="quan_sat", trang_thai_hien_thi=CHU_QUAN_SAT, ly_do=LY_DO_QUAN_SAT
        )
    kq = reports._bao_cao_ket_qua(session, store)
    if kq.khoa:
        return HangRung(
            **chung, trang_thai="dang_khoa", trang_thai_hien_thi=CHU_DANG_KHOA, ly_do=LY_DO_KHOA
        )
    trang_thai = trang_thai_ket_luan(kq.estimable, kq.ci_low, kq.ci_high)
    co_so = trang_thai != "thieu" and all(_huu_han(v) for v in (kq.estimate, kq.ci_low, kq.ci_high))
    if not co_so:
        return HangRung(
            **chung,
            trang_thai="chua_uoc_luong",
            trang_thai_hien_thi=CHU_KET_LUAN["DO_THEM"],
            ket_luan="DO_THEM",
            ly_do=_lam_sach(kq.message),
            n_blocks=kq.n_blocks,
            n_on=kq.n_on,
            n_off=kq.n_off,
        )
    ma = _MA_THEO_TRANG_THAI[trang_thai]
    return HangRung(
        **chung,
        trang_thai="co_uoc_luong",
        trang_thai_hien_thi=CHU_KET_LUAN[ma],
        ket_luan=ma,
        estimate=kq.estimate,
        ci_low=kq.ci_low,
        ci_high=kq.ci_high,
        p_value=kq.p_value,
        n_draws=kq.n_draws,
        n_blocks=kq.n_blocks,
        n_on=kq.n_on,
        n_off=kq.n_off,
    )


def _rung(sessions: list[dict[str, Any]], store) -> tuple[list[HangRung], int]:
    xong = [s for s in sessions if s.get("status") == "ended"]
    xong.sort(key=lambda s: s["end_ts"].timestamp() if s.get("end_ts") else 0.0, reverse=True)
    hang: list[HangRung] = []
    for s in xong[:TRAN_HANG_RUNG]:
        try:
            hang.append(_hang_rung(s, store))
        except StoreUnavailableError:
            raise  # kho chết: để main.py trả 503 có nghĩa, không giả một hàng
        except Exception as exc:  # noqa: BLE001 - một phiên hỏng không được làm sập cả bảng
            log.warning(
                "Tổng quan: không đọc được kết quả phiên %s (%s)",
                s["session_id"],
                type(exc).__name__,
            )
            hang.append(
                HangRung(
                    session_id=s["session_id"],
                    tieu_de=s.get("title"),
                    nhan=_nhan(s),
                    ket_thuc=s.get("end_ts"),
                    trang_thai="khong_doc_duoc",
                    trang_thai_hien_thi=CHU_KHONG_DOC_DUOC,
                    ly_do=LY_DO_KHONG_DOC_DUOC,
                )
            )
    return hang, max(0, len(xong) - TRAN_HANG_RUNG)


NHAN_MAC_DINH_GOP: dict[str, MaNhan] = {"real": "THAT", "demo": "MO_PHONG"}
"""Nhãn luôn có hàng gộp của mỗi kho, kể cả khi 0 phiên (THẬT 0 là sự thật cần nói ra)."""


class _KhoMotNhan:
    """Kho nhìn qua bộ lọc: ``list_sessions`` chỉ trả các phiên của MỘT nhãn trong mẫu gộp.

    Để :func:`reports.experiment_summary` gộp đúng một nhãn mà tổng quan không chép
    lại dòng phân tích nào: mọi phương thức khác (khối, lượt nhấp, bình luận...) đi
    thẳng xuống kho thật.
    """

    def __init__(self, store: Any, sessions: list[dict[str, Any]]) -> None:
        self._store = store
        self._sessions = sessions

    def list_sessions(self) -> list[dict[str, Any]]:
        return [dict(s) for s in self._sessions]

    def __getattr__(self, name: str) -> Any:
        return getattr(self._store, name)


def _mau_gop_theo_nhan(
    all_sessions: list[dict[str, Any]], env: Literal["real", "demo"]
) -> dict[MaNhan, list[dict[str, Any]]]:
    """Mẫu gộp §8.2 của một kho, chia theo nhãn. Luôn có nhãn mặc định của kho.

    Thứ tự: nhãn mặc định trước, các nhãn khác theo :data:`THU_TU_NHAN`. QUAN SÁT
    (``analysis_only``) và THỬ NỘI BỘ (``dry_run``) không bao giờ có mặt: luật §8.2
    đã loại cả hai.
    """
    demo = env == "demo"
    theo_nhan: dict[MaNhan, list[dict[str, Any]]] = {}
    for s in all_sessions:
        if reports._in_analysis_sample(s, demo=demo):
            theo_nhan.setdefault(ma_nhan_phien(s), []).append(s)
    mac_dinh = NHAN_MAC_DINH_GOP[env]
    thu_tu = [mac_dinh] + [ma for ma in THU_TU_NHAN if ma != mac_dinh and ma in theo_nhan]
    return {ma: theo_nhan.get(ma, []) for ma in thu_tu}


def _hang_gop(
    env: Literal["real", "demo"], ma: MaNhan, phien: list[dict[str, Any]], store
) -> HangGop:
    """Hàng gộp của một nhãn trong một kho. ``phien``: đúng các phiên của nhãn đó trong mẫu §8.2."""
    demo = env == "demo"
    nhan = NHAN_NGUON[ma]
    chung = {
        "env": env,
        "ma_nhan": ma,
        "nhan": nhan,
        "nhan_trong_gop": {ma: len(phien)} if phien else {},
    }

    # 0 phiên: nói đúng là chưa có phiên, kể cả khi khoá §7 bật. Số phiên là số vận
    # hành (§7 cho phép), và ghi "Đang khoá" khi không có gì để khoá sẽ ngầm báo có
    # kết quả thật đang bị giấu. Không có kết luận nào, kể cả ĐO THÊM.
    if not phien:
        return HangGop(
            **chung,
            trang_thai="chua_uoc_luong",
            trang_thai_hien_thi=CHU_CHUA_CO_PHIEN,
            ly_do=LY_DO_CHUA_CO_PHIEN.format(nhan=nhan),
            n_sessions=0,
            n_blocks=0,
            n_on=0,
            n_off=0,
        )

    # Khoá §7 chỉ canh kho thật (bản gộp demo được miễn, như experiment_summary).
    # Kiểm TRƯỚC khi gọi: trong lúc khoá, hàng gộp thật không mang một con số nào.
    if not demo and reports._results_freeze_reason(service.now_utc()) is not None:
        return HangGop(
            **chung, trang_thai="dang_khoa", trang_thai_hien_thi=CHU_DANG_KHOA, ly_do=LY_DO_KHOA
        )
    try:
        s = reports.experiment_summary(_KhoMotNhan(store, phien), env=env)
    except StoreUnavailableError:
        raise
    except Exception as exc:  # noqa: BLE001 - bản gộp hỏng không được làm sập cả bảng
        log.warning(
            "Tổng quan: không đọc được bản gộp env=%s nhãn=%s (%s)", env, ma, type(exc).__name__
        )
        return HangGop(
            **chung,
            trang_thai="khong_doc_duoc",
            trang_thai_hien_thi=CHU_KHONG_DOC_DUOC,
            ly_do=LY_DO_KHONG_DOC_DUOC,
        )
    so_dem = {"n_sessions": s.n_sessions, "n_blocks": s.n_blocks, "n_on": s.n_on, "n_off": s.n_off}
    trang_thai = trang_thai_ket_luan(s.estimable, s.ci_low, s.ci_high)
    if trang_thai == "thieu" or not all(_huu_han(v) for v in (s.estimate, s.ci_low, s.ci_high)):
        # Có phiên trong mẫu nhưng chưa đủ khối (hoặc khoảng tin cậy không xác định):
        # ĐO THÊM như hàng rừng, kèm lý do của máy chủ đã làm sạch.
        return HangGop(
            **chung,
            **so_dem,
            trang_thai="chua_uoc_luong",
            trang_thai_hien_thi=CHU_KET_LUAN["DO_THEM"],
            ket_luan="DO_THEM",
            ly_do=_lam_sach(s.message),
        )
    ma_kl = _MA_THEO_TRANG_THAI[trang_thai]
    return HangGop(
        **chung,
        **so_dem,
        trang_thai="co_uoc_luong",
        trang_thai_hien_thi=CHU_KET_LUAN[ma_kl],
        ket_luan=ma_kl,
        estimate=s.estimate,
        ci_low=s.ci_low,
        ci_high=s.ci_high,
        p_value=s.p_value,
        n_draws=s.n_draws,
    )


def _gop(
    all_sessions: list[dict[str, Any]], store, env: Literal["all", "real", "demo"]
) -> list[HangGop]:
    kho: tuple[Literal["real", "demo"], ...] = (
        ("real", "demo") if env == "all" else ("demo",) if env == "demo" else ("real",)
    )
    return [
        _hang_gop(k, ma, phien, store)
        for k in kho
        for ma, phien in _mau_gop_theo_nhan(all_sessions, k).items()
    ]


# ---------------------------------------------------------------------------
# Bộ nhớ đệm cho phần đắt (rừng, gộp)
# ---------------------------------------------------------------------------


_BO_DEM: dict[tuple[Any, ...], tuple[float, datetime, list[HangRung], int, list[HangGop]]] = {}
_KHOA_BO_DEM = threading.Lock()
"""Canh từ điển đệm (đọc, ghi, dọn)."""
_KHOA_TINH = threading.Lock()
"""Một lần tính tại một thời điểm: lần gọi thứ hai chờ rồi đọc đệm, không tính chồng."""


def xoa_bo_dem() -> None:
    """Xoá bộ nhớ đệm (test, hoặc khi cần ép tính lại)."""
    with _KHOA_BO_DEM:
        _BO_DEM.clear()


def _dau_phien(sessions: list[dict[str, Any]]) -> tuple[tuple[str, ...], ...]:
    """Dấu của mọi phiên: đổi khi có phiên mới, phiên đổi trạng thái, mốc giờ, tên,
    cờ nguồn hay lịch. So khớp nguyên dạng (không băm) nên không thể trùng nhầm."""
    return tuple(
        sorted(
            tuple(
                str(x)
                for x in (
                    s.get("session_id"),
                    s.get("status"),
                    s.get("start_ts"),
                    s.get("end_ts"),
                    s.get("platform"),
                    bool(s.get("is_demo")),
                    bool(s.get("dry_run")),
                    s.get("title"),
                    service.session_design_hash(s),
                    service.is_analysis_only(s),
                )
            )
            for s in sessions
        )
    )


def _doc_bo_dem(khoa: tuple[Any, ...], bay_gio: float):
    with _KHOA_BO_DEM:
        muc = _BO_DEM.get(khoa)
        if muc is not None and bay_gio - muc[0] < HAN_BO_DEM_S:
            return muc
        return None


def _ghi_bo_dem(khoa: tuple[Any, ...], muc) -> None:
    with _KHOA_BO_DEM:
        for k in [k for k, v in _BO_DEM.items() if muc[0] - v[0] >= HAN_BO_DEM_S]:
            del _BO_DEM[k]
        while len(_BO_DEM) >= TRAN_MUC_BO_DEM:
            del _BO_DEM[min(_BO_DEM, key=lambda k: _BO_DEM[k][0])]
        _BO_DEM[khoa] = muc


def _phan_dat(
    all_sessions: list[dict[str, Any]],
    sessions: list[dict[str, Any]],
    store,
    env: Literal["all", "real", "demo"],
    now: datetime,
) -> tuple[datetime, list[HangRung], int, list[HangGop]]:
    """Rừng và gộp, qua bộ nhớ đệm :data:`HAN_BO_DEM_S` giây."""
    khoa = (
        id(store),
        env,
        _dau_phien(all_sessions),
        reports._results_freeze_reason(now),
        TRAN_HANG_RUNG,
    )
    muc = _doc_bo_dem(khoa, time.monotonic())
    if muc is None:
        with _KHOA_TINH:
            muc = _doc_bo_dem(khoa, time.monotonic())  # lần gọi trước có thể vừa tính xong
            if muc is None:
                rung, bo_bot = _rung(sessions, store)
                gop = _gop(all_sessions, store, env)
                muc = (time.monotonic(), now, rung, bo_bot, gop)
                _ghi_bo_dem(khoa, muc)
    _, tinh_luc, rung, bo_bot, gop = muc
    return tinh_luc, list(rung), bo_bot, list(gop)


def _nguon_du_lieu() -> NguonDuLieu:
    nen_tang = [
        NenTangTomTat(
            platform=str(p["platform"]),
            ten=str(p["ten"]),
            san_sang=bool(p["ready"]),
            che_do=str(p["mode"]),
        )
        for p in muc_san_sang_nen_tang(get_settings())
    ]
    return NguonDuLieu(cau=NGUON_DU_LIEU, nen_tang=nen_tang)


@router.get(DUONG_THONG_KE, response_model=TongQuanThongKe)
def tong_quan_thong_ke(
    store: StoreDep, env: Literal["all", "real", "demo"] = "all"
) -> TongQuanThongKe:
    """Bảng tổng quan nhiều phiên: đếm theo nhãn, phiên đang live, rừng, gộp, nguồn dữ liệu.

    ``env``: ``all`` (mặc định) mọi phiên, mỗi nhãn một ô; ``real`` bỏ dữ liệu mẫu;
    ``demo`` chỉ dữ liệu mẫu. Hàng gộp: mỗi kho luôn có hàng của nhãn mặc định
    (THẬT cho kho thật, MÔ PHỎNG cho kho mẫu), thêm một hàng cho mỗi nhãn khác có
    phiên trong mẫu gộp; ``all`` cho cả hai kho.
    """
    now = service.now_utc()
    all_sessions = store.list_sessions()
    sessions = [s for s in all_sessions if _thuoc_env(s, env)]
    tinh_luc, rung, bo_bot, gop = _phan_dat(all_sessions, sessions, store, env, now)
    return TongQuanThongKe(
        env=env,
        luc=now,
        tinh_luc=tinh_luc,
        dem_theo_nhan=_dem_theo_nhan(sessions),
        phien_dang_live=_phien_dang_live(sessions, store, now),
        rung=rung,
        rung_bo_bot=bo_bot,
        gop=gop,
        nguon_du_lieu=_nguon_du_lieu(),
    )

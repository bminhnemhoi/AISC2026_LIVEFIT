"""Tóm tắt 3 câu: máy soạn câu TẤT ĐỊNH cho màn kết quả (AI-LAYER lớp 0, S2).

Ba câu tiếng Việt cho mỗi bản kết quả: (1) KẾT LUẬN đúng trạng thái,
(2) BẰNG CHỨNG chính, (3) VIỆC NÊN LÀM tiếp. Toàn bộ là template có kiểm
soát, KHÔNG gọi LLM, không mô hình sinh: mọi con số trong câu đều chép từ
tham số đầu vào (chính là các trường của ``ExperimentSummary`` /
``KetQuaThiNghiem`` / ``BaoCaoTongQuan``), phép tính duy nhất được phép là
định dạng (làm tròn, %, phút) và hiệu số so với NGƯỠNG THIẾT KẾ đã tiền đăng
ký (cần thêm mấy phiên/khối). Mỗi câu mang ``refs`` (đường dẫn JSON của
từng con số) để UI hover ra nguồn (triết lý không-bịa-số ngay trên văn xuôi).

Điều kiện bắt buộc từ phản biện khoa học (ưu tiên #6): CẢ BA trạng thái
DƯƠNG / NULL / CHƯA ĐỦ ĐIỀU KIỆN được soạn công phu ngang nhau; câu NULL
phải nói rõ "chưa đủ bằng chứng là một kết quả hợp lệ", không được viết như
một lời xin lỗi. Khoá §7 (``RESULTS_FREEZE_UNTIL``) đứng TRÊN mọi template:
khi ``khoa=True`` không câu nào được chứa ước lượng, khoảng tin cậy hay p:
chỉ số vận hành.

Huy hiệu bằng chứng (spec AI-LAYER N2): ``thi_nghiem`` CHỈ dành cho câu mà
con số đến từ analyze_outer trên thiết kế ước lượng được; gọi với
``estimable=False`` thì không một câu nào được mang huy hiệu đó (có test
chốt chặn trong ``tests/test_narrate.py``).

Ngôn từ (kế hoạch 3.1, mục 3): không dấu gạch dài, không viết tắt (viết đủ
"khoảng tin cậy 95%"), dùng "kiểm định ngẫu nhiên hoá" thay tên cũ,
câu ngắn, từ đơn giản. Câu kết luận ĐỔI / GIỮ / ĐO THÊM chép NGUYÊN VĂN khoá
``ket_luan`` của ``docs/canon/thuat-ngu.yaml`` (``KET_LUAN_CANON``; test so khớp
với yaml để hai nơi không lệch).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

__all__ = [
    "BADGE_QUAN_SAT",
    "BADGE_THIEU_DU_LIEU",
    "BADGE_THI_NGHIEM",
    "CHUA_DU_KHOI_CANON",
    "DON_VI",
    "KET_LUAN_CANON",
    "Cau",
    "tom_tat_gop",
    "tom_tat_phien",
    "trang_thai_ket_luan",
]

BADGE_THI_NGHIEM = "thi_nghiem"
"""Con số trong câu đến từ estimator tiền đăng ký (analyze_outer), có khoảng tin cậy."""

BADGE_QUAN_SAT = "quan_sat"
"""Số đếm/mô tả vận hành, không suy diễn nhân quả."""

BADGE_THIEU_DU_LIEU = "thieu_du_lieu"
"""Tuyên bố thiếu kèm con số cần thêm: không hạ ngưỡng, không nội suy."""

#: Đơn vị của biến kết quả chính (tiền đăng ký §4.1): một chỗ, mọi câu dùng chung.
DON_VI = "lượt nhấp hợp lệ / 1.000 giây·người xem"
"""Chữ canon của Tỷ lệ nhấp (dòng cùng chữ trong ``thuat-ngu.yaml``)."""

#: Câu ĐO THÊM khi phiên chưa đủ khối: chép nguyên văn ``loi_thuong.chua_du_khoi`` của
#: ``docs/canon/thuat-ngu.yaml`` (cùng chữ với ``LOI_THUONG.chuaDuKhoi`` của giao diện;
#: test so khớp).
CHUA_DU_KHOI_CANON = (
    "Mới đo được vài khối, chưa đủ để so khối BẬT với khối TẮT. "
    "Chạy phiên từ 90 phút trở lên rồi gộp lại."
)

#: Dấu trừ của giao diện (U+2212), cùng ký tự với thước khoảng tin cậy và ô số.
_DAU_TRU = "\u2212"

#: Câu thường của ba kết luận, chép nguyên văn ``ket_luan[].cau`` trong
#: ``docs/canon/thuat-ngu.yaml`` (test_narrate so khớp với yaml).
KET_LUAN_CANON: dict[str, str] = {
    "DOI": (
        "Cả khoảng tin cậy nằm trên 0: ghim theo lịch của LiveLift tạo thêm lượt nhấp "
        "so với cách làm thường lệ, nên đổi sang."
    ),
    "GIU": (
        "Cả khoảng tin cậy nằm dưới 0: cách ghim của LiveLift kém hơn cách làm thường lệ, "
        "nên giữ cách cũ."
    ),
    "DO_THEM": (
        "Khoảng tin cậy còn chứa 0: chưa đủ bằng chứng theo hướng nào, nên chạy thêm "
        "phiên rồi gộp lại."
    ),
}


@dataclass(frozen=True)
class Cau:
    """Một câu tóm tắt: văn bản + huy hiệu bằng chứng + nguồn của từng số."""

    text: str
    badge: str
    refs: tuple[str, ...] = ()


def trang_thai_ket_luan(estimable: bool, ci_low: float | None, ci_high: float | None) -> str:
    """Phân loại kết quả vào đúng một trạng thái kết luận.

    ``duong``/``am``: khoảng tin cậy 95% loại 0 (về phía dương/âm); ``null``:
    ước lượng được nhưng khoảng tin cậy còn chứa 0; ``thieu``: thiết kế không
    ước lượng được.
    Cùng một luật với máy sinh demo vàng (routes/demo._trang_thai_ket_qua).
    """
    if not estimable:
        return "thieu"
    if ci_low is not None and ci_low > 0:
        return "duong"
    if ci_high is not None and ci_high < 0:
        return "am"
    return "null"


def _so(x: float, spec: str) -> str:
    """Số thập phân kiểu Việt Nam: dấu PHẨY thập phân (cùng quy ước với giao diện).

    "+1.224" đọc theo tiếng Việt là một nghìn hai trăm hai mươi tư, trong khi máy
    muốn nói một phẩy hai hai bốn; câu tóm tắt từng nói ngược với thẻ số ngay
    phía trên nó (soát 15/10/2026). Mọi số thập phân trong câu đi qua hàm này.
    """
    return format(x, spec).replace(".", ",").replace("-", _DAU_TRU)


def _nghin(n: int) -> str:
    """Số nguyên kiểu Việt Nam: dấu CHẤM ngăn nghìn ("1.000 lần vẽ lại", không "1000")."""
    return f"{n:,}".replace(",", ".")


def _p_text(p_value: float | None, n_draws: int | None) -> str:
    """p-value với SÀN trung thực: kiểm định ngẫu nhiên hoá không nói được p nhỏ
    hơn 1/(số lần bốc thăm lại + 1); in sàn thay vì một con số chính-xác-giả (cùng luật với
    ``formatP`` phía web)."""
    if p_value is None:
        return "p chưa công bố"
    floor = 1.0 / (n_draws + 1) if n_draws else None
    if floor is not None and p_value <= floor * 1.001:
        return f"p < {_so(floor, '.3f')}"
    # 3 chữ số như thẻ số ngay phía trên (fmtNum(p, 3)): câu và thẻ không được lệch nhau.
    return f"p = {_so(p_value, '.3f')}"


def _ktc(ci_low: float | None, ci_high: float | None) -> str:
    """Khoảng tin cậy viết bằng lời, đứng thành câu riêng: không viết tắt, không ngoặc vuông."""
    lo = "chưa có" if ci_low is None else _so(ci_low, "+.3f")
    hi = "chưa có" if ci_high is None else _so(ci_high, "+.3f")
    return f"Khoảng tin cậy 95% từ {lo} đến {hi}"


def _cham(text: str) -> str:
    """Bảo đảm câu kết thúc bằng dấu chấm: lý do máy chủ có câu có, câu không."""
    t = text.strip()
    return t if t.endswith((".", "!", "?", "…")) else t + "."


def _cau_ket_luan(
    st: str,
    estimate: float | None,
    ci_low: float | None,
    ci_high: float | None,
    ref_goc: str,
) -> Cau:
    """Câu 1 cho trạng thái ước lượng được (duong/am/null), dùng chung cho
    bản gộp và bản từng phiên: số đo trước, rồi câu canon ĐỔI / GIỮ / ĐO THÊM.
    Không thêm câu trấn an nào sau câu canon (soát đợt 2: một bộ câu, D8)."""
    refs = (f"{ref_goc}estimate", f"{ref_goc}ci_low", f"{ref_goc}ci_high")
    ktc = _ktc(ci_low, ci_high)
    if st == "duong":
        return Cau(
            text=(
                f"Khối BẬT hơn khối TẮT {_so(abs(estimate or 0.0), '.3f')} {DON_VI}. "
                f"{ktc}. {KET_LUAN_CANON['DOI']}"
            ),
            badge=BADGE_THI_NGHIEM,
            refs=refs,
        )
    if st == "am":
        return Cau(
            text=(
                f"Khối BẬT kém khối TẮT {_so(abs(estimate or 0.0), '.3f')} {DON_VI}. "
                f"{ktc}. {KET_LUAN_CANON['GIU']}"
            ),
            badge=BADGE_THI_NGHIEM,
            refs=refs,
        )
    return Cau(
        text=(
            f"Chênh lệch BẬT trừ TẮT: {_so(estimate, '+.3f')} {DON_VI}. "
            f"{ktc}. {KET_LUAN_CANON['DO_THEM']}"
        ),
        badge=BADGE_THI_NGHIEM,
        refs=refs,
    )


def _cau_bang_chung(
    n_blocks: int,
    n_on: int,
    n_off: int,
    p_value: float | None,
    n_draws: int | None,
    ref_goc: str,
    n_sessions: int | None = None,
    hien_p: bool = True,
) -> Cau:
    """Câu bằng chứng. ``hien_p=False`` (bản từng phiên, kế hoạch mục 3): p chỉ nằm ở
    "Chi tiết cho người kiểm", câu trên màn chính chỉ nói máy đã bốc thăm lại bao nhiêu lần."""
    pham_vi = f" từ {n_sessions} phiên" if n_sessions is not None else ""
    if not hien_p:
        ve_lai = (
            f" Máy bốc thăm lại lịch {_nghin(n_draws)} lần để kiểm tra; giá trị p nằm ở "
            "phần Chi tiết cho người kiểm."
            if n_draws
            else ""
        )
        return Cau(
            text=f"Bằng chứng: {n_blocks} khối đo được ({n_on} BẬT, {n_off} TẮT){pham_vi}.{ve_lai}",
            badge=BADGE_THI_NGHIEM,
            refs=(f"{ref_goc}n_blocks", f"{ref_goc}n_on", f"{ref_goc}n_off", f"{ref_goc}n_draws"),
        )
    ve_lai = f"kiểm định ngẫu nhiên hoá {_nghin(n_draws)} lần bốc thăm lại cho " if n_draws else ""
    return Cau(
        text=(
            f"Bằng chứng: {n_blocks} khối đo được ({n_on} BẬT / {n_off} TẮT)"
            f"{pham_vi}; {ve_lai}{_p_text(p_value, n_draws)}."
        ),
        badge=BADGE_THI_NGHIEM,
        refs=(
            f"{ref_goc}n_blocks",
            f"{ref_goc}n_on",
            f"{ref_goc}n_off",
            f"{ref_goc}p_value",
            f"{ref_goc}n_draws",
        ),
    )


# ---------------------------------------------------------------------------
# Bản GỘP: /experiment/summary
# ---------------------------------------------------------------------------


def tom_tat_gop(
    *,
    estimable: bool,
    n_sessions: int,
    n_blocks: int,
    n_on: int,
    n_off: int,
    khoa: bool = False,
    ly_do_khoa: str | None = None,
    estimate: float | None = None,
    ci_low: float | None = None,
    ci_high: float | None = None,
    p_value: float | None = None,
    n_draws: int | None = None,
    valid_clicks: int | None = None,
    measured_cv: float | None = None,
    measured_compliance: float | None = None,
    power_table: Sequence[dict[str, Any]] = (),
    message: str | None = None,
    nguong_phien: int = 2,
    nguong_khoi: int = 8,
) -> list[Cau]:
    """Ba câu cho bản gộp mọi phiên. Luôn trả về ĐÚNG 3 câu.

    ``khoa=True`` (tiền đăng ký §7): các tham số suy diễn bị bỏ qua kể cả khi
    được truyền; không câu nào chứa ước lượng, khoảng tin cậy hay p trong cửa sổ khoá.
    """
    nhap = f", {valid_clicks} lượt nhấp hợp lệ" if valid_clicks is not None else ""

    if khoa:
        return [
            Cau(
                text=_cham(
                    "Chưa công bố được kết luận: "
                    + (ly_do_khoa or "ước lượng hiệu ứng đang bị khoá theo tiền đăng ký §7")
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=("message",),
            ),
            Cau(
                text=(
                    f"Số liệu vận hành đã gom: {n_sessions} phiên, {n_blocks} khối "
                    f"đo được ({n_on} BẬT / {n_off} TẮT){nhap}."
                ),
                badge=BADGE_QUAN_SAT,
                refs=("n_sessions", "n_blocks", "n_on", "n_off", "valid_clicks"),
            ),
            Cau(
                text=(
                    "Việc nên làm: tiếp tục chạy phiên theo lịch đã bốc thăm. Tới ngày "
                    f"mở khoá, máy tính kết quả một lần trên cả {n_blocks} khối đã gom, "
                    "không ai nhìn trộm giữa chừng."
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=("n_blocks",),
            ),
        ]

    if not estimable:
        thieu_gi: list[str] = []
        if n_sessions < nguong_phien:
            thieu_gi.append(f"thêm {nguong_phien - n_sessions} phiên")
        if n_blocks < nguong_khoi:
            thieu_gi.append(f"thêm {nguong_khoi - n_blocks} khối đo được")
        if thieu_gi:
            viec = (
                "Việc nên làm: chạy thêm phiên có lịch bốc thăm trước giờ phát. Cần "
                + " và ".join(thieu_gi)
                + f" để đủ ngưỡng ước lượng ({nguong_phien} phiên, {nguong_khoi} khối)."
            )
        else:
            viec = (
                "Việc nên làm: chạy thêm phiên có lịch bốc thăm trước giờ phát để mỗi "
                "nhánh BẬT/TẮT có thêm khối đo được. Cách chia hiện tại chưa kiểm định được."
            )
        return [
            Cau(
                text=_cham(
                    "Thiết kế chưa đủ điều kiện để ước lượng tác động: "
                    + (
                        message
                        or (
                            f"chưa đạt ngưỡng tối thiểu {nguong_phien} phiên "
                            f"và {nguong_khoi} khối đo được"
                        )
                    )
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=("message", "estimable"),
            ),
            Cau(
                text=(
                    f"Hiện trạng đo được: {n_sessions} phiên trong mẫu, {n_blocks} khối "
                    f"({n_on} BẬT / {n_off} TẮT){nhap}."
                ),
                badge=BADGE_QUAN_SAT,
                refs=("n_sessions", "n_blocks", "n_on", "n_off", "valid_clicks"),
            ),
            Cau(text=viec, badge=BADGE_THIEU_DU_LIEU, refs=("n_sessions", "n_blocks")),
        ]

    st = trang_thai_ket_luan(True, ci_low, ci_high)
    cau1 = _cau_ket_luan(st, estimate, ci_low, ci_high, ref_goc="")
    cau2 = _cau_bang_chung(
        n_blocks, n_on, n_off, p_value, n_draws, ref_goc="", n_sessions=n_sessions
    )

    if st in ("duong", "am"):
        if measured_compliance is not None:
            duoi = (
                f"; tuân thủ đo được {measured_compliance * 100:.0f}%, giữ đúng thao "
                "tác ở khối BẬT để kết quả không bị pha loãng"
            )
            refs3: tuple[str, ...] = ("measured_compliance",)
        elif measured_cv is not None:
            duoi = (
                f"; hệ số biến thiên đo được {_so(measured_cv, '.2f')}, thêm khối sẽ thu hẹp "
                "khoảng tin cậy"
            )
            refs3 = ("measured_cv",)
        else:
            duoi = ""
            refs3 = ("n_blocks",)
        cau3 = Cau(
            text=(
                "Việc nên làm: giữ nguyên cách đo và cách chạy ở phiên tới, gom "
                f"thêm khối để thu hẹp khoảng tin cậy{duoi}."
            ),
            badge=BADGE_QUAN_SAT,
            refs=refs3,
        )
    else:  # null: câu "cần thêm bao nhiêu" giải từ bảng lực với CV ĐO ĐƯỢC
        row = next(iter(power_table), None)
        if row is not None and int(row.get("n_sessions", 0)) > n_sessions:
            them = int(row["n_sessions"]) - n_sessions
            cau3 = Cau(
                text=(
                    f"Việc nên làm: gom thêm khoảng {them} phiên (đủ {row['n_sessions']} "
                    f"phiên, mỗi phiên khoảng {row['blocks_per_session']} khối đo) để thấy "
                    f"được hiệu quả cỡ {row['mde_relative'] * 100:.0f}% với hệ số biến thiên "
                    f"đo được {_so(row['cv'], '.2f')}. Nếu vẫn chưa rõ, hiệu quả thật (nếu có) "
                    "nhỏ hơn mức đó."
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=(
                    "power_table[0].n_sessions",
                    "power_table[0].blocks_per_session",
                    "power_table[0].mde_relative",
                    "power_table[0].cv",
                    "n_sessions",
                ),
            )
        else:
            cau3 = Cau(
                text=(
                    "Việc nên làm: gom thêm khối với cùng cách đo. Nếu vẫn chưa rõ, "
                    "hiệu quả thật (nếu có) nhỏ hơn mức mà "
                    f"{n_blocks} khối hiện tại thấy được."
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=("n_blocks",),
            )
    return [cau1, cau2, cau3]


# ---------------------------------------------------------------------------
# Bản TỪNG PHIÊN: /sessions/{id}/bao-cao
# ---------------------------------------------------------------------------

#: Tiền tố đường dẫn JSON của khối nhân quả trong BaoCaoOut.
_KQ = "ket_qua_thi_nghiem."


def tom_tat_phien(
    *,
    loai_phien: str,
    tong_binh_luan: int,
    luot_nhap_hop_le: int | None = None,
    thoi_luong_s: float | None = None,
    khoa: bool = False,
    ly_do_khoa: str | None = None,
    estimable: bool = False,
    estimate: float | None = None,
    ci_low: float | None = None,
    ci_high: float | None = None,
    p_value: float | None = None,
    n_draws: int | None = None,
    n_blocks: int = 0,
    n_on: int = 0,
    n_off: int = 0,
    message: str | None = None,
    nguong_khoi: int = 4,
    viec_nen_lam: str | None = None,
) -> list[Cau]:
    """Ba câu cho báo cáo MỘT phiên. Luôn trả về ĐÚNG 3 câu.

    ``loai_phien="quan_sat"``: không có lịch gán ⇒ không câu nào nhân quả và
    không câu nào mang huy hiệu ``thi_nghiem``; nói thẳng đó là thiết kế,
    không phải thiếu sót của buổi live.

    ``viec_nen_lam`` (kiểm toán 25/09/2026): khi máy chủ biết CHÍNH XÁC vì sao
    chưa ước lượng được (chỉ số chính THIẾU link đo, khoảng tin cậy không xác định), câu
    "việc nên làm" mặc định ("kéo dài thời lượng") là lời khuyên sai; máy chủ
    truyền câu đúng vào đây. Chỉ dùng ở nhánh chưa ước lượng được và nhánh khoá
    (phiên đã huỷ: "tiếp tục chạy phiên theo lịch" là lời khuyên sai).
    """
    mo_ta_phan = [f"{tong_binh_luan} bình luận"]
    refs_mo_ta = ["tong_quan.tong_binh_luan"]
    if luot_nhap_hop_le is not None:
        mo_ta_phan.append(f"{luot_nhap_hop_le} lượt nhấp hợp lệ")
        refs_mo_ta.append("tong_quan.luot_nhap_hop_le")
    else:
        mo_ta_phan.append("lượt nhấp qua link đo: THIẾU nguồn")
        refs_mo_ta.append("tong_quan.thieu.luot_nhap")
    if thoi_luong_s is not None:
        mo_ta_phan.append(f"thời lượng {thoi_luong_s / 60:.0f} phút")
        refs_mo_ta.append("tong_quan.thoi_luong_s")
    mo_ta = ", ".join(mo_ta_phan)

    if loai_phien == "quan_sat":
        return [
            Cau(
                text=(
                    "Phiên quan sát: phiên này không bốc thăm BẬT/TẮT, nên chưa đo được "
                    "ghim có tác dụng hay không."
                ),
                badge=BADGE_QUAN_SAT,
                refs=("loai_phien",),
            ),
            Cau(text=f"Số đếm của phiên: {mo_ta}.", badge=BADGE_QUAN_SAT, refs=tuple(refs_mo_ta)),
            Cau(
                text=(
                    "Việc nên làm: lần sau chạy phiên có bốc thăm BẬT/TẮT trước giờ phát; "
                    f"cần ít nhất {nguong_khoi} khối đo được mới so được."
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=("loai_phien",),
            ),
        ]

    if khoa:
        # Lời thường trên màn tổng kết; lý do kỹ thuật (ly_do_khoa) nằm ở "Chi tiết cho người kiểm".
        return [
            Cau(
                text=(
                    "Chưa có kết luận: kết quả còn khoá để không ai nhìn trộm giữa chừng. "
                    "Lý do cụ thể nằm ở phần Chi tiết cho người kiểm."
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=(f"{_KQ}ly_do_khoa",),
            ),
            Cau(
                text=(
                    f"Số đếm của phiên: {n_blocks} khối đo được ({n_on} BẬT, {n_off} TẮT), {mo_ta}."
                ),
                badge=BADGE_QUAN_SAT,
                refs=(f"{_KQ}n_blocks", f"{_KQ}n_on", f"{_KQ}n_off", *refs_mo_ta),
            ),
            Cau(
                text=(
                    _cham("Việc nên làm: " + viec_nen_lam)
                    if viec_nen_lam
                    else (
                        "Việc nên làm: cứ chạy tiếp theo lịch. Khi kết quả mở khoá, máy mới "
                        f"so {n_blocks} khối đo được của phiên này giữa BẬT và TẮT."
                    )
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=(f"{_KQ}ly_do_khoa",) if viec_nen_lam else (f"{_KQ}n_blocks",),
            ),
        ]

    if not estimable:
        # Chưa đủ khối: đúng câu canon loi_thuong.chua_du_khoi. Lý do khác (thiếu link đo,
        # một nhánh trống…): chép lý do của máy chủ, không nói "vài khối" khi đã đủ khối.
        cau1 = (
            CHUA_DU_KHOI_CANON
            if n_blocks < nguong_khoi
            else _cham(
                "Chưa so được khối BẬT với khối TẮT: " + (message or "lý do ở phần chi tiết")
            )
        )
        return [
            Cau(
                text=cau1,
                badge=BADGE_THIEU_DU_LIEU,
                refs=(f"{_KQ}message", f"{_KQ}estimable"),
            ),
            Cau(
                text=(
                    f"Số đếm của phiên: {n_blocks} khối đo được ({n_on} BẬT, {n_off} TẮT), {mo_ta}."
                ),
                badge=BADGE_QUAN_SAT,
                refs=(f"{_KQ}n_blocks", f"{_KQ}n_on", f"{_KQ}n_off", *refs_mo_ta),
            ),
            Cau(
                text=(
                    _cham("Việc nên làm: " + viec_nen_lam)
                    if viec_nen_lam
                    else (
                        "Việc nên làm: phiên tới chạy từ 90 phút trở lên; cần ít nhất "
                        f"{nguong_khoi} khối đo được (mỗi khối 5 phút là BẬT hoặc TẮT) mới so được."
                    )
                ),
                badge=BADGE_THIEU_DU_LIEU,
                refs=(f"{_KQ}message",) if viec_nen_lam else (f"{_KQ}n_blocks",),
            ),
        ]

    st = trang_thai_ket_luan(True, ci_low, ci_high)
    cau1 = _cau_ket_luan(st, estimate, ci_low, ci_high, ref_goc=_KQ)
    cau2 = _cau_bang_chung(n_blocks, n_on, n_off, p_value, n_draws, ref_goc=_KQ, hien_p=False)
    if st in ("duong", "am"):
        cau3 = Cau(
            text=(
                "Việc nên làm: lặp lại đúng cách đo này ở phiên tới. "
                f"{n_blocks} khối này chỉ từ một buổi live; muốn chốt phải gộp nhiều "
                "phiên đo cùng cách."
            ),
            badge=BADGE_THIEU_DU_LIEU,
            refs=(f"{_KQ}n_blocks",),
        )
    else:
        cau3 = Cau(
            text=(
                "Việc nên làm: gom thêm phiên cùng cách đo rồi đọc kết quả gộp. "
                f"Một phiên {n_blocks} khối chỉ thấy được tác dụng rất lớn; gộp rồi vẫn "
                "chưa rõ thì tác dụng của ghim, nếu có, là nhỏ."
            ),
            badge=BADGE_THIEU_DU_LIEU,
            refs=(f"{_KQ}n_blocks",),
        )
    return [cau1, cau2, cau3]

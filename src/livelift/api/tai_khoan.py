"""Tài khoản người dùng ở lõi API (D-017): băm mật khẩu, token đăng nhập, hạn mức, quyền.

Ai gọi được
-----------
Chỉ máy chủ Next (có token lõi ``INGEST_TOKEN``) gọi được ``/auth/*`` và
``/quan-tri/*``. Trình duyệt không bao giờ có token lõi: nó chỉ có cookie
HttpOnly ``ll_tk`` do Next đặt, và Next gửi token ĐĂNG NHẬP trong cookie ấy cho
lõi qua header :data:`HEADER_TAI_KHOAN`. Lõi tự tra token đó ra tài khoản; không
bao giờ tin một tên tài khoản hay một vai do bên gọi tự khai.

Cổng ghi chung của ứng dụng (:func:`livelift.api.auth.require_write_auth`) chỉ
chặn POST/PUT/PATCH/DELETE. Vì ``GET /auth/toi`` và ``GET /quan-tri/*`` cũng
không được mở cho trình duyệt, router tài khoản gắn thêm :func:`can_token_loi`
cho MỌI phương thức. Quy ước "``INGEST_TOKEN`` rỗng ⇒ mở" (chế độ phát triển
cục bộ, kiểm thử) giữ nguyên như cổng ghi.

Mật khẩu
--------
``hashlib.scrypt``, muối ngẫu nhiên 16 byte, tham số ghi ngay trong chuỗi băm
(``scrypt$n=32768,r=8,p=1$<muối>$<băm>``) để đổi tham số sau này không làm hỏng
mật khẩu cũ. So sánh bằng ``hmac.compare_digest``. Mỗi phép băm tốn ~32 MB RAM
và vài chục mili giây, nên :data:`SO_PHEP_BAM_TOI_DA` = 2 phép chạy cùng lúc;
quá hàng đợi thì trả 503 thay vì làm nghẽn cả tiến trình. Tên không tồn tại
vẫn đi qua một phép băm giả để thời gian trả lời không lộ tên nào có thật.

Token đăng nhập
---------------
``secrets.token_urlsafe(32)``; kho chỉ lưu SHA-256 của nó, có hạn
(:attr:`CauHinhTaiKhoan.livelift_tk_han_gio`), thu hồi khi đăng xuất hoặc khi
tài khoản bị khoá.

Hạn mức
-------
Đếm lần SAI theo tên đăng nhập và theo địa chỉ gọi, cửa sổ trượt
(:class:`DemLanSai`). Một tên sai đủ :attr:`~CauHinhTaiKhoan.livelift_tk_sai_toi_da`
lần (mặc định 5) thì lần thứ 6 nhận 429, kể cả khi lần đó đúng mật khẩu: không
thế thì kẻ dò mật khẩu chỉ cần chờ lần đoán trúng. Một địa chỉ có ngưỡng riêng,
rộng hơn (:attr:`~CauHinhTaiKhoan.livelift_tk_sai_toi_da_ip`, mặc định 20), để
một người gõ nhầm không khoá cả một mạng.

Chống gọi song song: mỗi lần thử GIỮ CHỖ một lần sai TRƯỚC khi băm
(:meth:`DemLanSai.giu_cho`, kiểm và ghi trong cùng một lần lấy khoá). Đúng mật
khẩu thì trả chỗ; sai thì chỗ đã giữ thành lần sai. Nhờ vậy N yêu cầu tới cùng
lúc cũng chỉ có đúng ``livelift_tk_sai_toi_da`` phép băm sai lọt qua cho một tên.

Địa chỉ dùng để đếm (:func:`dia_chi_han_muc`) chỉ tin ``X-Forwarded-For`` khi
kết nối đến từ proxy tin cậy CỦA RIÊNG đường tài khoản
(:attr:`~CauHinhTaiKhoan.livelift_tk_proxy_tin_cay`, mặc định chỉ loopback, hẹp
hơn ``TRUSTED_PROXY_CIDRS`` chung). Next chạy cùng máy với lõi (máy demo) thì
mọi trình duyệt đến lõi từ 127.0.0.1: khi đó địa chỉ lấy từ ``X-Forwarded-For``
do Next ghi; không có header ấy, hoặc header chỉ chứa loopback (trình duyệt mở
ngay trên máy demo), thì KHÔNG đếm theo địa chỉ, chỉ đếm theo tên. Không thế thì
5 lần gõ sai của bất kỳ ai sẽ khoá đăng nhập của cả máy.

Đăng ký thì đúng là "đếm lượt gọi", nên dùng lại
:class:`~livelift.api.auth.GioiHanTanSuat`
(:attr:`~CauHinhTaiKhoan.livelift_tk_dang_ky_moi_gio` mỗi địa chỉ; yêu cầu không
rõ địa chỉ đi chung một xô có trần gấp :data:`HE_SO_XO_CHUNG_DANG_KY` lần).

Cờ tắt
------
``LIVELIFT_AUTH=0`` (biến môi trường hoặc ``.env``, khởi động lại API): mọi
``/auth/*`` và ``/quan-tri/*`` trả 404 và biến khỏi ``/openapi.json``
(:func:`auth_bat`).
"""

from __future__ import annotations

import base64
import binascii
import contextlib
import hashlib
import hmac
import ipaddress
import logging
import math
import re
import secrets
import threading
import time
import unicodedata
from collections import deque
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, Request
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from livelift.api.auth import LOI_THIEU_XAC_THUC, GioiHanTanSuat, mang_proxy_tin_cay
from livelift.config import get_settings
from livelift.dbops.tai_khoan import (
    BANG_KHONG_THEO_PHIEN,
    BANG_THEO_PHIEN,
    VAI,
    KhoTaiKhoan,
    KhoTaiKhoanBoNho,
    KhoTaiKhoanPostgres,
    TaiKhoanDanhRiengBiChiemError,
    gieo_tai_khoan_mac_dinh,
)

logger = logging.getLogger("livelift.api.tai_khoan")

HEADER_TAI_KHOAN = "X-LL-Tai-Khoan"
"""Header mang token ĐĂNG NHẬP của người dùng (Next đọc từ cookie ``ll_tk``)."""

NHAN_CHUA_XAC_MINH = "DÀN DỰNG · CHƯA XÁC MINH"
"""Nhãn canon (thuat-ngu.yaml) cho phiên do giám khảo hoặc tài khoản chưa xác minh tạo."""


# ---------------------------------------------------------------------------
# Cấu hình
# ---------------------------------------------------------------------------


class CauHinhTaiKhoan(BaseSettings):
    """Đọc từ biến môi trường hoặc ``.env`` (như :class:`livelift.config.Settings`).

    Tách khỏi ``config.py`` để gói tài khoản tự đủ; tên biến giữ tiền tố
    ``LIVELIFT_``. Mật khẩu gieo là ``SecretStr``: in nhầm cấu hình ra log cũng chỉ
    thấy ``**********``.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    livelift_auth: bool = True
    livelift_mk_quan_tri: SecretStr = SecretStr("")
    livelift_mk_giam_khao: SecretStr = SecretStr("")
    # Hạn một lần đăng nhập. Next đặt Max-Age của cookie theo ``han_giay`` lõi trả về.
    livelift_tk_han_gio: float = 168.0
    # Một TÊN sai bấy nhiêu lần trong cửa sổ thì lần kế tiếp bị 429.
    livelift_tk_sai_toi_da: int = 5
    # Một ĐỊA CHỈ sai bấy nhiêu lần (gộp mọi tên) thì lần kế tiếp bị 429. Rộng hơn
    # ngưỡng theo tên để một người gõ nhầm không khoá cả mạng của họ. 0 = tắt.
    livelift_tk_sai_toi_da_ip: int = 20
    livelift_tk_cua_so_s: float = 900.0
    # Trần đăng ký theo địa chỉ gọi, mỗi giờ. 0 = tắt.
    livelift_tk_dang_ky_moi_gio: int = 10
    # Proxy tin cậy CỦA ĐƯỜNG TÀI KHOẢN: chỉ kết nối từ đây mới được đọc
    # X-Forwarded-For. Mặc định chỉ loopback (Next cùng máy), hẹp hơn
    # TRUSTED_PROXY_CIDRS chung (vốn tin cả 10/8, 172.16/12, 192.168/16: một máy
    # trong LAN đó tự chọn được địa chỉ của mình). Next chạy trong Docker thì đặt
    # dải mạng Docker của Next vào đây.
    livelift_tk_proxy_tin_cay: str = "127.0.0.0/8,::1/128"


@lru_cache
def cau_hinh_tai_khoan() -> CauHinhTaiKhoan:
    return CauHinhTaiKhoan()


def auth_bat() -> bool:
    """``False`` khi ``LIVELIFT_AUTH=0``: mọi ``/auth/*`` và ``/quan-tri/*`` là 404."""
    return bool(cau_hinh_tai_khoan().livelift_auth)


def gio_hien_tai() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# Tên đăng nhập và mật khẩu
# ---------------------------------------------------------------------------

TEN_RE = re.compile(r"^[a-z0-9._-]{3,32}$")
MAT_KHAU_TOI_THIEU = 10
MAT_KHAU_TOI_DA = 256

LOI_TEN = (
    "Tên đăng nhập dài từ 3 đến 32 ký tự, chỉ gồm chữ thường không dấu (a-z), số (0-9), "
    "dấu chấm, gạch dưới hoặc gạch ngang."
)
LOI_MAT_KHAU_NGAN = f"Mật khẩu cần ít nhất {MAT_KHAU_TOI_THIEU} ký tự."
LOI_MAT_KHAU_DAI = f"Mật khẩu dài tối đa {MAT_KHAU_TOI_DA} ký tự."


def chuan_hoa_ten(ten: str) -> str:
    """Bỏ khoảng trắng hai đầu, về chữ thường. Đăng ký và đăng nhập dùng chung."""
    return (ten or "").strip().lower()


def ten_hop_le(ten: str) -> bool:
    return bool(TEN_RE.fullmatch(ten))


def chuan_hoa_mat_khau(mk: str) -> str:
    """NFC: cùng một chữ có dấu gõ từ hai bộ gõ khác nhau phải ra cùng một mật khẩu."""
    return unicodedata.normalize("NFC", mk or "")


SCRYPT_N = 2**15
SCRYPT_R = 8
SCRYPT_P = 1
DO_DAI_MUOI = 16
DO_DAI_BAM = 32
SO_PHEP_BAM_TOI_DA = 2
HAN_CHO_BAM_S = 10.0
TRAN_BO_NHO_BAM = 64 * 1024 * 1024
"""Trần RAM của MỘT phép scrypt (64 MiB). Tham số mặc định cần ~32 MiB."""


def bo_nho_scrypt(n: int, r: int, p: int) -> int:
    """Số byte OpenSSL đòi cho một phép scrypt: 128·r·(n + p + 2)."""
    return 128 * r * (n + p + 2)


_CUA_BAM = threading.BoundedSemaphore(SO_PHEP_BAM_TOI_DA)
"""Tối đa :data:`SO_PHEP_BAM_TOI_DA` phép scrypt cùng lúc trong cả tiến trình."""


class MayBanError(RuntimeError):
    """Hàng đợi băm mật khẩu đầy quá :data:`HAN_CHO_BAM_S` giây."""


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _scrypt(mk: bytes, muoi: bytes, n: int, r: int, p: int, dklen: int) -> bytes:
    if not _CUA_BAM.acquire(timeout=HAN_CHO_BAM_S):
        raise MayBanError("hàng đợi băm mật khẩu đầy")
    try:
        # OpenSSL cần 128·r·(n+p+2) byte; mặc định 32 MiB của hashlib thiếu vài KB
        # với n=2^15, r=8, nên đặt trần rõ ràng. Không bao giờ quá TRAN_BO_NHO_BAM.
        return hashlib.scrypt(
            mk,
            salt=muoi,
            n=n,
            r=r,
            p=p,
            maxmem=min(TRAN_BO_NHO_BAM, bo_nho_scrypt(n, r, p) + 1024 * 1024),
            dklen=dklen,
        )
    finally:
        _CUA_BAM.release()


def bam_mat_khau(mat_khau: str) -> str:
    """Chuỗi băm tự mang tham số: ``scrypt$n=..,r=..,p=..$<muối>$<băm>``."""
    muoi = secrets.token_bytes(DO_DAI_MUOI)
    bam = _scrypt(
        chuan_hoa_mat_khau(mat_khau).encode("utf-8"),
        muoi,
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        DO_DAI_BAM,
    )
    return f"scrypt$n={SCRYPT_N},r={SCRYPT_R},p={SCRYPT_P}${_b64(muoi)}${_b64(bam)}"


_BAM_RE = re.compile(r"^scrypt\$n=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$")


def kiem_mat_khau(mat_khau: str, chuoi_bam: str) -> bool:
    """Đúng mật khẩu? So sánh thời gian hằng. Chuỗi băm hỏng ⇒ ``False``."""
    m = _BAM_RE.fullmatch(chuoi_bam or "")
    if not m:
        return False
    n, r, p = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # Chặn tham số vô lý (dòng hỏng hay bị sửa tay) trước khi xin RAM: mỗi phép
    # băm tối đa TRAN_BO_NHO_BAM (64 MiB), không bao giờ cả GB.
    if not (2**10 <= n <= 2**17 and n & (n - 1) == 0 and 1 <= r <= 16 and 1 <= p <= 4):
        return False
    if bo_nho_scrypt(n, r, p) > TRAN_BO_NHO_BAM:
        return False
    try:
        muoi = base64.b64decode(m.group(4), validate=True)
        bam = base64.b64decode(m.group(5), validate=True)
    except (binascii.Error, ValueError):
        return False
    if not bam:
        return False
    tinh = _scrypt(chuan_hoa_mat_khau(mat_khau).encode("utf-8"), muoi, n, r, p, len(bam))
    return hmac.compare_digest(tinh, bam)


_BAM_GIA: str | None = None
_KHOA_BAM_GIA = threading.Lock()


def _bam_gia() -> str:
    """Một chuỗi băm thật của một mật khẩu không ai biết, cho tên không tồn tại."""
    global _BAM_GIA
    if _BAM_GIA is None:
        with _KHOA_BAM_GIA:
            if _BAM_GIA is None:
                _BAM_GIA = bam_mat_khau(secrets.token_urlsafe(24))
    return _BAM_GIA


def sinh_mat_khau() -> str:
    """Mật khẩu ngẫu nhiên 24 ký tự cho tài khoản gieo khi cấu hình không đưa."""
    return secrets.token_urlsafe(18)


# ---------------------------------------------------------------------------
# Token đăng nhập
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")


def sinh_token() -> str:
    return secrets.token_urlsafe(32)


def bam_token(token: str) -> str:
    """SHA-256 hex: thứ DUY NHẤT của token được lưu."""
    return hashlib.sha256(token.encode("ascii")).hexdigest()


# ---------------------------------------------------------------------------
# Đếm lần sai (cửa sổ trượt)
# ---------------------------------------------------------------------------


Khoa = tuple[str, str]


class DemLanSai:
    """Đếm lần đăng nhập SAI theo khoá, cửa sổ trượt, an toàn đa luồng.

    Đường đăng nhập dùng :meth:`giu_cho` (kiểm và ghi NGUYÊN TỬ, trước khi băm) và
    :meth:`tra_cho` (đúng mật khẩu, hoặc chưa xét được mật khẩu). ``cho_bao_lau``
    chỉ HỎI, ``ghi_sai`` chỉ GHI: hai hàm rời nhau thì giữa chúng có khe cho yêu
    cầu song song lọt qua, nên đường đăng nhập không dùng cặp đó.
    """

    def __init__(self, so_khoa_toi_da: int = 20_000) -> None:
        self._lich: dict[tuple[str, str], deque[float]] = {}
        self._khoa = threading.Lock()
        self._so_khoa_toi_da = so_khoa_toi_da

    def _cat(self, lich: deque[float], cua_so_s: float, now: float) -> None:
        han = now - cua_so_s
        while lich and lich[0] <= han:
            lich.popleft()

    def cho_bao_lau(self, khoa: tuple[str, str], toi_da: int, cua_so_s: float, now: float) -> int:
        """0 = được thử; > 0 = số giây phải chờ."""
        if toi_da <= 0:
            return 0
        with self._khoa:
            lich = self._lich.get(khoa)
            if not lich:
                return 0
            self._cat(lich, cua_so_s, now)
            if len(lich) >= toi_da:
                return max(1, math.ceil(lich[0] + cua_so_s - now))
            return 0

    def _don_neu_day(self, cua_so_s: float, now: float) -> None:
        if len(self._lich) >= self._so_khoa_toi_da:
            cu = [k for k, v in self._lich.items() if not v or now - v[-1] > cua_so_s]
            for k in cu:
                del self._lich[k]

    def giu_cho(
        self, cac_khoa: Sequence[tuple[Khoa, int]], cua_so_s: float, now: float | None = None
    ) -> tuple[int, float]:
        """Kiểm mọi khoá rồi, nếu được thử, ghi NGAY một lần sai tạm cho từng khoá.

        ``cac_khoa``: các cặp ``(khoa, toi_da)``; ``toi_da <= 0`` = không đếm khoá đó.
        Trả ``(cho, moc)``: ``cho > 0`` là số giây phải chờ (không ghi gì); ``cho == 0``
        thì đã giữ chỗ ở mốc ``moc``, gỡ bằng :meth:`tra_cho`. Kiểm và ghi trong cùng
        MỘT lần lấy khoá, nên N luồng cùng lúc không thể cùng thấy "còn lượt".
        """
        with self._khoa:
            moc = time.monotonic() if now is None else now
            cho = 0
            for khoa, toi_da in cac_khoa:
                if toi_da <= 0:
                    continue
                lich = self._lich.get(khoa)
                if not lich:
                    continue
                self._cat(lich, cua_so_s, moc)
                if len(lich) >= toi_da:
                    cho = max(cho, max(1, math.ceil(lich[0] + cua_so_s - moc)))
            if cho:
                return cho, moc
            self._don_neu_day(cua_so_s, moc)
            for khoa, toi_da in cac_khoa:
                if toi_da <= 0:
                    continue
                self._lich.setdefault(khoa, deque()).append(moc)
            return 0, moc

    def tra_cho(self, cac_khoa: Sequence[Khoa], moc: float) -> None:
        """Gỡ đúng một lần sai tạm ở mốc ``moc`` của từng khoá (đã trôi khỏi cửa sổ thì thôi)."""
        with self._khoa:
            for khoa in cac_khoa:
                lich = self._lich.get(khoa)
                if lich is None:
                    continue
                with contextlib.suppress(ValueError):
                    lich.remove(moc)
                if not lich:
                    del self._lich[khoa]

    def ghi_sai(self, khoa: tuple[str, str], cua_so_s: float, now: float, giu_toi_da: int) -> None:
        with self._khoa:
            self._don_neu_day(cua_so_s, now)
            lich = self._lich.setdefault(khoa, deque())
            self._cat(lich, cua_so_s, now)
            lich.append(now)
            while len(lich) > max(1, giu_toi_da):
                lich.popleft()

    def xoa(self, khoa: tuple[str, str]) -> None:
        with self._khoa:
            self._lich.pop(khoa, None)


_KHOA_DOI_TUONG_APP = threading.Lock()


def _doi_tuong_app(request: Request, ten: str, lop: type) -> Any:
    """Bộ đếm dùng chung của ứng dụng, dựng lười DƯỚI KHOÁ: đợt yêu cầu song song
    đầu tiên không được dựng vài bộ rồi ghi đè nhau (lần sai ghi vào bộ bị đè là mất)."""
    state = request.app.state
    obj = getattr(state, ten, None)
    if isinstance(obj, lop):
        return obj
    with _KHOA_DOI_TUONG_APP:
        obj = getattr(state, ten, None)
        if not isinstance(obj, lop):
            obj = lop()
            setattr(state, ten, obj)
    return obj


def _ip(chuoi: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        ip = ipaddress.ip_address(chuoi.strip())
    except ValueError:
        return None
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped  # ::ffff:127.0.0.1 (máy chủ nghe hai chồng giao thức)
    return ip


def la_proxy_tai_khoan(dia_chi: str) -> bool:
    """``dia_chi`` thuộc :attr:`CauHinhTaiKhoan.livelift_tk_proxy_tin_cay`?"""
    ip = _ip(dia_chi)
    if ip is None:
        return False
    mang = mang_proxy_tin_cay(cau_hinh_tai_khoan().livelift_tk_proxy_tin_cay)
    return any(ip in m for m in mang)


def dia_chi_han_muc(request: Request) -> str | None:
    """Địa chỉ dùng để đếm hạn mức của đường tài khoản; ``None`` = không đếm theo địa chỉ.

    * Kết nối KHÔNG đến từ proxy tin cậy của đường tài khoản (mặc định chỉ
      loopback): dùng chính địa chỉ đó; ``X-Forwarded-For`` do bên gọi viết, bỏ qua.
    * Kết nối từ loopback (Next cùng máy, như máy demo): đọc ``X-Forwarded-For``
      do Next ghi, từ PHẢI sang TRÁI, lấy địa chỉ đầu tiên không phải proxy tin
      cậy. Phần bên trái do trình duyệt tự viết được, nên chỉ chạm tới khi mọi
      chặng bên phải đều là loopback.
    * Loopback mà không có ``X-Forwarded-For``, hoặc header chỉ chứa loopback
      (trình duyệt mở ngay trên máy chạy Next): ``None``. Khi đó đăng nhập chỉ
      khoá theo TÊN, không khoá chung cả máy; đăng ký đi xô chung có trần rộng.

    Không dùng :func:`livelift.api.auth.dia_chi_goi`: hàm đó tin cả dải mạng riêng
    (``TRUSTED_PROXY_CIDRS``) và trả về chính 127.0.0.1 khi thiếu header.
    """
    client = request.client
    truc_tiep = (client.host if client else "") or ""
    if not truc_tiep:
        return None
    if not la_proxy_tai_khoan(truc_tiep):
        return truc_tiep[:64]
    xff = ",".join(request.headers.getlist("x-forwarded-for"))
    for dia_chi in reversed([p.strip() for p in xff.split(",") if p.strip()]):
        if not la_proxy_tai_khoan(dia_chi):
            return dia_chi[:64]
    return None


def _cau_cho(cho: int) -> str:
    return f"{math.ceil(cho / 60)} phút" if cho >= 60 else f"{cho} giây"


def _loi_429(chi_tiet: str, cho: int) -> HTTPException:
    return HTTPException(status_code=429, detail=chi_tiet, headers={"Retry-After": str(cho)})


# ---------------------------------------------------------------------------
# Kho tài khoản của ứng dụng
# ---------------------------------------------------------------------------

_KHOA_DUNG_KHO = threading.Lock()


def dung_kho_tai_khoan(store: Any) -> KhoTaiKhoan:
    """Kho tài khoản đi theo kho phiên: PostgreSQL thì dùng chung pool, còn lại bộ nhớ."""
    if getattr(store, "backend", None) == "postgres" and hasattr(store, "_connection"):
        return KhoTaiKhoanPostgres.tu_kho(store)
    return KhoTaiKhoanBoNho()


def _tu_gieo(app_state: Any, kho: KhoTaiKhoan) -> None:
    """Tạo tài khoản quản trị/giám khảo nếu cấu hình CÓ mật khẩu. Không sinh, không in.

    Kho bộ nhớ mất sạch khi khởi động lại; không có bước này thì sau mỗi lần khởi
    động không còn ai vào được trang quản trị. Hỏng (kho chết, chưa migrate) thì
    thử lại ở yêu cầu sau, không làm hỏng yêu cầu hiện tại.
    """
    if getattr(app_state, "kho_tai_khoan_da_gieo", False):
        return
    try:
        gieo_tai_khoan_mac_dinh(kho, sinh_khi_thieu=False, in_ra=None)
    except TaiKhoanDanhRiengBiChiemError as exc:
        # Không nhận tài khoản bị chiếm, không thử lại mỗi yêu cầu: người vận hành phải
        # dọn bảng tai_khoan rồi khởi động lại (thông điệp nói rõ, không có mật khẩu).
        logger.error("%s", exc)
        app_state.kho_tai_khoan_da_gieo = True
        return
    except Exception as exc:  # noqa: BLE001 - gieo tự động là việc phụ
        logger.warning("Chưa tự gieo được tài khoản mặc định: %s", type(exc).__name__)
        return
    app_state.kho_tai_khoan_da_gieo = True


def kho_tai_khoan(request: Request) -> KhoTaiKhoan:
    """Dependency: kho tài khoản của ứng dụng, dựng lười ở yêu cầu đầu tiên."""
    state = request.app.state
    kho = getattr(state, "kho_tai_khoan", None)
    if kho is None:
        with _KHOA_DUNG_KHO:
            kho = getattr(state, "kho_tai_khoan", None)
            if kho is None:
                kho = dung_kho_tai_khoan(getattr(state, "store", None))
                state.kho_tai_khoan = kho
    _tu_gieo(state, kho)
    return kho


KhoTkDep = Annotated[KhoTaiKhoan, Depends(kho_tai_khoan)]


# ---------------------------------------------------------------------------
# Cổng của router tài khoản
# ---------------------------------------------------------------------------


def kiem_auth_bat() -> None:
    """``LIVELIFT_AUTH=0`` ⇒ 404 (lớp thứ hai; lớp đầu là :class:`RouteTaiKhoan`)."""
    if not auth_bat():
        raise HTTPException(status_code=404, detail="Not Found")


def can_token_loi(request: Request) -> None:
    """MỌI phương thức (kể cả GET) cần token lõi khi ``INGEST_TOKEN`` được đặt."""
    token = get_settings().ingest_token
    if not token:
        return
    gui = request.headers.get("authorization", "").encode("utf-8", "replace")
    if not hmac.compare_digest(gui, f"Bearer {token}".encode()):
        logger.warning("Từ chối %s %s: thiếu token lõi", request.method, request.url.path)
        raise HTTPException(status_code=401, detail=LOI_THIEU_XAC_THUC)


LOI_CHUA_DANG_NHAP = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại."
LOI_CHI_QUAN_TRI = "Chỉ tài khoản quản trị được dùng chức năng này."


def tra_phien_dang_nhap(kho: KhoTaiKhoan, token: str | None) -> dict[str, Any] | None:
    """Token đăng nhập ⇒ ``{"tai_khoan", "dang_nhap"}`` nếu còn hiệu lực, ngược lại ``None``."""
    if not token or not _TOKEN_RE.fullmatch(token):
        return None
    kq = kho.tra_dang_nhap(bam_token(token))
    if kq is None:
        return None
    dn, tk = kq["dang_nhap"], kq["tai_khoan"]
    if dn.get("thu_hoi") is not None or dn["het_han"] <= gio_hien_tai() or tk.get("khoa"):
        return None
    return kq


TokenTaiKhoan = Annotated[str | None, Header(alias=HEADER_TAI_KHOAN)]
"""Tham số header cho route: khai ở route (không phải dependency) để FastAPI kiểm
thân yêu cầu TRƯỚC khi hỏi danh tính. Thứ tự đó chỉ đổi mã lỗi của một yêu cầu
vốn đã sai (422 thay vì 401), không mở thêm gì: token lõi đã được kiểm ở cổng."""


def yeu_cau_dang_nhap(kho: KhoTaiKhoan, token: str | None) -> dict[str, Any]:
    """Người đang gọi (qua Next). Token thiếu, sai, hết hạn, đã thu hồi hay tài khoản
    bị khoá ⇒ 401 với cùng một câu (không nói lý do nào cụ thể)."""
    kq = tra_phien_dang_nhap(kho, (token or "").strip())
    if kq is None:
        raise HTTPException(status_code=401, detail=LOI_CHUA_DANG_NHAP)
    return kq


def yeu_cau_quan_tri(kho: KhoTaiKhoan, token: str | None) -> dict[str, Any]:
    """Như :func:`yeu_cau_dang_nhap`, thêm: vai khác ``quan-tri`` ⇒ 403."""
    phien = yeu_cau_dang_nhap(kho, token)
    if phien["tai_khoan"]["vai"] != "quan-tri":
        raise HTTPException(status_code=403, detail=LOI_CHI_QUAN_TRI)
    return phien


# ---------------------------------------------------------------------------
# Biểu diễn ra ngoài
# ---------------------------------------------------------------------------


def che_do(tk: dict[str, Any]) -> str:
    """Đường Next đi cho tài khoản này (kế hoạch mục 5).

    ``that``: quản trị, người bán đã xác minh (Next gắn token lõi). ``demo``: người
    bán chưa xác minh, kể cả giám khảo (Next đi đường demo, phiên mang nhãn
    :data:`NHAN_CHUA_XAC_MINH`). ``chi-xem``: chỉ đọc (Next trả 403 cho đường ghi).
    """
    if tk["vai"] == "chi-xem":
        return "chi-xem"
    if tk["vai"] == "quan-tri" or tk.get("da_xac_minh"):
        return "that"
    return "demo"


def cong_khai(tk: dict[str, Any]) -> dict[str, Any]:
    """Dòng tài khoản an toàn để trả ra: KHÔNG có ``mat_khau_bam``."""
    cd = che_do(tk)
    return {
        "id": str(tk["id"]),
        "ten_dang_nhap": tk["ten_dang_nhap"],
        "vai": tk["vai"],
        "da_xac_minh": bool(tk.get("da_xac_minh")),
        "khoa": bool(tk.get("khoa")),
        "tao_luc": tk["tao_luc"],
        "che_do": cd,
        "nhan": NHAN_CHUA_XAC_MINH if cd == "demo" else None,
    }


# ---------------------------------------------------------------------------
# Nghiệp vụ
# ---------------------------------------------------------------------------


def _mo_phien(kho: KhoTaiKhoan, tk: dict[str, Any]) -> dict[str, Any]:
    token = sinh_token()
    bay_gio = gio_hien_tai()
    han = timedelta(hours=max(0.01, cau_hinh_tai_khoan().livelift_tk_han_gio))
    dn = kho.tao_dang_nhap(
        tai_khoan_id=str(tk["id"]),
        token_bam=bam_token(token),
        tao_luc=bay_gio,
        het_han=bay_gio + han,
    )
    return {
        "token": token,
        "het_han": dn["het_han"],
        "han_giay": int(han.total_seconds()),
        "tai_khoan": cong_khai(tk),
    }


def _bam_hoac_503(fn: Any, *args: Any) -> Any:
    try:
        return fn(*args)
    except MayBanError as exc:
        raise HTTPException(
            status_code=503,
            detail="Máy chủ đang bận xử lý đăng nhập. Thử lại sau vài giây.",
            headers={"Retry-After": "5"},
        ) from exc


TEN_DANH_RIENG: frozenset[str] = frozenset({"quan-tri", "giam-khao", "root"})
"""Tên không ai đăng ký được: hai tài khoản gieo sẵn (D-017, D-023) và vài tên dễ nhầm."""
TIEN_TO_DANH_RIENG: tuple[str, ...] = ("quan-tri", "admin", "livelift")
"""Tên bắt đầu bằng các tiền tố này cũng dành riêng (``quan-tri2``, ``admin-shop``...)."""
LOI_TEN_DANH_RIENG = "Tên đăng nhập này dành riêng cho đội LiveLift. Hãy chọn tên khác."
HE_SO_XO_CHUNG_DANG_KY = 5
"""Yêu cầu đăng ký không rõ địa chỉ (xem :func:`dia_chi_han_muc`) đi chung một xô có
trần gấp bấy nhiêu lần trần theo địa chỉ: máy demo không bị chặn sau vài lượt
đăng ký, mà một vòng lặp gọi qua Next không ghi X-Forwarded-For vẫn có trần."""


def ten_danh_rieng(ten: str) -> bool:
    """``ten`` (đã chuẩn hoá) là tên dành riêng?"""
    return ten in TEN_DANH_RIENG or ten.startswith(TIEN_TO_DANH_RIENG)


def dang_ky(request: Request, kho: KhoTaiKhoan, ten: str, mat_khau: str) -> dict[str, Any]:
    """Tạo tài khoản ``nguoi-ban`` CHƯA xác minh rồi mở phiên đăng nhập luôn.

    Tên dành riêng (:func:`ten_danh_rieng`) bị chặn 409: không thế thì ai đi qua
    Next cũng chiếm được ``quan-tri`` / ``giam-khao`` trước lệnh gieo.
    """
    from livelift.dbops.tai_khoan import TenDaTonTaiError

    ten = chuan_hoa_ten(ten)
    if not ten_hop_le(ten):
        raise HTTPException(status_code=422, detail=LOI_TEN)
    if ten_danh_rieng(ten):
        raise HTTPException(status_code=409, detail=LOI_TEN_DANH_RIENG)
    mk = chuan_hoa_mat_khau(mat_khau)
    if len(mk) < MAT_KHAU_TOI_THIEU:
        raise HTTPException(status_code=422, detail=LOI_MAT_KHAU_NGAN)
    if len(mk) > MAT_KHAU_TOI_DA:
        raise HTTPException(status_code=422, detail=LOI_MAT_KHAU_DAI)

    cfg = cau_hinh_tai_khoan()
    bo_dem = _doi_tuong_app(request, "gioi_han_dang_ky", GioiHanTanSuat)
    dia_chi = dia_chi_han_muc(request)
    tran = cfg.livelift_tk_dang_ky_moi_gio
    if dia_chi is None:
        khoa_dk, tran = ("xo-chung", "dang_ky"), tran * HE_SO_XO_CHUNG_DANG_KY
    else:
        khoa_dk = (dia_chi, "dang_ky")
    cho = bo_dem.xin_luot(khoa_dk, tran, 3600.0, time.monotonic())
    if cho:
        raise _loi_429(
            f"Địa chỉ này đã đăng ký quá nhiều tài khoản trong một giờ. Chờ {_cau_cho(cho)} "
            "rồi thử lại.",
            cho,
        )
    if kho.tim_theo_ten(ten) is not None:
        raise HTTPException(status_code=409, detail="Tên đăng nhập này đã có người dùng.")
    chuoi_bam = _bam_hoac_503(bam_mat_khau, mk)
    try:
        tk = kho.tao_tai_khoan(
            ten_dang_nhap=ten,
            mat_khau_bam=chuoi_bam,
            vai="nguoi-ban",
            da_xac_minh=False,
            tao_luc=gio_hien_tai(),
        )
    except TenDaTonTaiError as exc:  # hai người cùng đăng ký một tên cùng lúc
        raise HTTPException(status_code=409, detail="Tên đăng nhập này đã có người dùng.") from exc
    return _mo_phien(kho, tk)


LOI_SAI_THONG_TIN = "Sai tên đăng nhập hoặc mật khẩu."
LOI_BI_KHOA = "Tài khoản này đang bị khoá. Liên hệ đội LiveLift để mở lại."


GIU_DANG_NHAP_CU = timedelta(days=1)
"""Dòng ``dang_nhap`` hết hạn hoặc bị thu hồi quá lâu thế này thì bị dọn."""
NHIP_DON_DANG_NHAP_S = 600.0
"""Dọn tối đa một lần mỗi 10 phút cho mỗi ứng dụng, không phải mỗi lần đăng nhập."""


def _don_dang_nhap_cu(request: Request, kho: KhoTaiKhoan) -> None:
    """Xoá dòng đăng nhập đã chết (việc phụ: hỏng thì ghi log, không làm hỏng đăng nhập)."""
    state = request.app.state
    now = time.monotonic()
    with _KHOA_DOI_TUONG_APP:
        lan_truoc = getattr(state, "lan_don_dang_nhap", None)
        if lan_truoc is not None and now - lan_truoc < NHIP_DON_DANG_NHAP_S:
            return
        state.lan_don_dang_nhap = now
    try:
        kho.don_dang_nhap(gio_hien_tai() - GIU_DANG_NHAP_CU)
    except Exception as exc:  # noqa: BLE001 - dọn là việc phụ
        logger.warning("Chưa dọn được dòng đăng nhập cũ: %s", type(exc).__name__)


def dang_nhap(request: Request, kho: KhoTaiKhoan, ten: str, mat_khau: str) -> dict[str, Any]:
    """Giữ chỗ một lần sai TRƯỚC khi băm (nguyên tử); đúng mật khẩu thì trả chỗ.

    Khoá theo tên luôn đếm; khoá theo địa chỉ chỉ đếm khi :func:`dia_chi_han_muc`
    biết địa chỉ (không đếm chung cả máy demo).
    """
    cfg = cau_hinh_tai_khoan()
    ten = chuan_hoa_ten(ten)
    dem = _doi_tuong_app(request, "dem_sai_dang_nhap", DemLanSai)
    dia_chi = dia_chi_han_muc(request)
    khoa_ten: Khoa = ("ten", ten[:64])
    cac_khoa: list[tuple[Khoa, int]] = [(khoa_ten, cfg.livelift_tk_sai_toi_da)]
    if dia_chi is not None:
        cac_khoa.append((("ip", dia_chi), cfg.livelift_tk_sai_toi_da_ip))
    cho, moc = dem.giu_cho(cac_khoa, cfg.livelift_tk_cua_so_s)
    if cho:
        logger.warning("Chặn đăng nhập %s giây: sai quá nhiều lần", cho)
        raise _loi_429(f"Đăng nhập sai quá nhiều lần. Chờ {_cau_cho(cho)} rồi thử lại.", cho)

    khoa_da_giu = [k for k, _ in cac_khoa]
    try:
        tk = kho.tim_theo_ten(ten) if ten_hop_le(ten) else None
        mk = (mat_khau or "")[: MAT_KHAU_TOI_DA * 4]
        dung = _bam_hoac_503(kiem_mat_khau, mk, tk["mat_khau_bam"] if tk else _bam_gia())
    except BaseException:
        # Chưa xét được mật khẩu (máy bận 503, kho chết): không tính là một lần sai.
        dem.tra_cho(khoa_da_giu, moc)
        raise
    if tk is None or not dung:
        # Chỗ đã giữ thành lần sai thật, không ghi thêm.
        raise HTTPException(status_code=401, detail=LOI_SAI_THONG_TIN)
    dem.tra_cho(khoa_da_giu, moc)
    if tk.get("khoa"):
        raise HTTPException(status_code=403, detail=LOI_BI_KHOA)
    dem.xoa(khoa_ten)
    _don_dang_nhap_cu(request, kho)
    return _mo_phien(kho, tk)


def dang_xuat(kho: KhoTaiKhoan, token: str | None) -> bool:
    """Thu hồi token. Token lạ hay đã thu hồi ⇒ ``False`` (không lỗi: đăng xuất là idempotent)."""
    token = (token or "").strip()
    if not _TOKEN_RE.fullmatch(token):
        return False
    return kho.thu_hoi(bam_token(token), gio_hien_tai())


def liet_ke_tai_khoan(kho: KhoTaiKhoan) -> list[dict[str, Any]]:
    con_han = kho.dem_dang_nhap_con_han(gio_hien_tai())
    return [
        {**cong_khai(tk), "dang_nhap_con_han": con_han.get(str(tk["id"]), 0)}
        for tk in kho.liet_ke()
    ]


def sua_tai_khoan(
    kho: KhoTaiKhoan,
    quan_tri: dict[str, Any],
    tai_khoan_id: str,
    *,
    vai: str | None = None,
    da_xac_minh: bool | None = None,
    khoa: bool | None = None,
) -> dict[str, Any]:
    """Đổi vai / xác minh / khoá một tài khoản; mỗi thay đổi một dòng nhật ký quản trị."""
    if vai is None and da_xac_minh is None and khoa is None:
        raise HTTPException(
            status_code=422, detail="Cần ít nhất một thay đổi: vai, da_xac_minh hoặc khoa."
        )
    if vai is not None and vai not in VAI:
        raise HTTPException(status_code=422, detail=f"Vai phải là một trong {', '.join(VAI)}.")
    tk = kho.tim_theo_id(tai_khoan_id)
    if tk is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    la_chinh_minh = str(tk["id"]) == str(quan_tri["id"])
    if la_chinh_minh and (khoa is True or (vai is not None and vai != "quan-tri")):
        raise HTTPException(
            status_code=409,
            detail="Không tự khoá hay tự bỏ vai quản trị của chính mình. Nhờ một quản trị khác.",
        )

    sua: dict[str, Any] = {}
    viec: list[tuple[str, dict[str, Any]]] = []
    if vai is not None and vai != tk["vai"]:
        sua["vai"] = vai
        viec.append(("doi_vai", {"vai_cu": tk["vai"], "vai_moi": vai}))
    if da_xac_minh is not None and bool(da_xac_minh) != bool(tk["da_xac_minh"]):
        sua["da_xac_minh"] = bool(da_xac_minh)
        viec.append(("xac_minh" if da_xac_minh else "bo_xac_minh", {}))
    if khoa is not None and bool(khoa) != bool(tk["khoa"]):
        sua["khoa"] = bool(khoa)
        viec.append(("khoa" if khoa else "mo_khoa", {}))
    if not sua:
        return {"tai_khoan": cong_khai(tk), "thay_doi": []}

    moi = kho.cap_nhat(str(tk["id"]), sua)
    if moi is None:  # bị xoá giữa chừng
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    luc = gio_hien_tai()
    if sua.get("khoa") is True:
        n = kho.thu_hoi_cua_tai_khoan(str(tk["id"]), luc)
        viec = [(v, {**ct, "thu_hoi_dang_nhap": n} if v == "khoa" else ct) for v, ct in viec]
    for ten_viec, chi_tiet in viec:
        kho.ghi_nhat_ky(
            ai=str(quan_tri["id"]),
            viec=ten_viec,
            doi_tuong=str(tk["id"]),
            chi_tiet=chi_tiet,
            luc=luc,
        )
    return {"tai_khoan": cong_khai(moi), "thay_doi": [v for v, _ in viec]}


# ---------------------------------------------------------------------------
# /quan-tri/du-lieu
# ---------------------------------------------------------------------------

GHI_CHU_THAT = (
    "THẬT ở đây nghĩa là is_demo=false: không phải dữ liệu mẫu do máy sinh. Nhóm này gồm cả "
    "phiên chạy thử (dry_run) và phòng xem dàn dựng (platform lab), xem phien_khong_demo; "
    "nó KHÔNG có nghĩa là phiên với người bán thật."
)


def _migration_trong_ma() -> list[int]:
    from importlib import resources

    ra: set[int] = set()
    for entry in resources.files("livelift.migrations").iterdir():
        m = re.match(r"^(\d{4})_.+\.up\.sql$", entry.name)
        if m:
            ra.add(int(m.group(1)))
    return sorted(ra)


def _sao_luu_gan_nhat() -> dict[str, Any] | None:
    """Bản dump mới nhất trong ``backups/`` (docker/backup.sh), nếu tìm thấy."""
    thu_muc = Path("backups")
    try:
        tep = [p for p in thu_muc.glob("*.dump*") if p.is_file()]
    except OSError:
        return None
    if not tep:
        return None
    moi = max(tep, key=lambda p: p.stat().st_mtime)
    st = moi.stat()
    return {
        "tep": moi.name,
        "luc": datetime.fromtimestamp(st.st_mtime, tz=UTC),
        "kich_thuoc_mb": round(st.st_size / 1_048_576, 2),
    }


_DEM_BO_NHO: dict[str, tuple[str, str | None]] = {
    # bảng -> (phương thức đọc theo phiên, khoá trong InMemoryStore.counts() để tính
    # số dòng không gắn phiên nào)
    "experiment_block": ("get_blocks", None),
    "assignment_event": ("list_assignment_events", "assignment_events"),
    "exposure_event": ("list_exposure_events", "exposure_events"),
    "intervention_log": ("list_interventions", "interventions"),
    "session_tick": ("list_ticks", "ticks"),
    "comment_event": ("list_comments", "comments"),
    "reaction_event": ("list_reactions", "reactions"),
    "shortlink": ("count_shortlinks", "shortlinks"),
    "click_event": ("list_clicks", "clicks"),
    "order_event": ("list_orders", "orders"),
    "lab_event": ("list_lab_events", "lab_events"),
}


def _thong_ke_bo_nho(store: Any) -> dict[str, Any]:
    phien = store.list_sessions()
    bang: dict[str, Any] = {
        "live_session": {
            "that": sum(1 for s in phien if not s.get("is_demo")),
            "demo": sum(1 for s in phien if s.get("is_demo")),
        }
    }
    khong_demo = [s for s in phien if not s.get("is_demo")]
    tong_kho = store.counts() if hasattr(store, "counts") else {}
    for ten_bang in BANG_THEO_PHIEN:
        ham, khoa_tong = _DEM_BO_NHO[ten_bang]
        that = demo = 0
        for s in phien:
            kq = getattr(store, ham)(s["session_id"])
            n = kq if isinstance(kq, int) else len(kq)
            if s.get("is_demo"):
                demo += n
            else:
                that += n
        dong: dict[str, Any] = {"that": that, "demo": demo, "khong_gan_phien": None}
        if khoa_tong and khoa_tong in tong_kho:
            dong["khong_gan_phien"] = max(0, int(tong_kho[khoa_tong]) - that - demo)
        bang[ten_bang] = dong
    bang["product"] = {"tong": len(store.list_products())}
    for ten_bang in BANG_KHONG_THEO_PHIEN:
        bang.setdefault(ten_bang, {"tong": None})
    return {
        "bang": bang,
        "phien_khong_demo": {
            "chay_thu": sum(1 for s in khong_demo if s.get("dry_run")),
            "phong_xem": sum(1 for s in khong_demo if s.get("platform") == "lab"),
            "may_sinh": sum(1 for s in khong_demo if s.get("platform") == "sim"),
        },
        "migration": {"da_ap": None, "moi_nhat": None},
    }


def thong_ke_du_lieu(store: Any, kho: KhoTaiKhoan) -> dict[str, Any]:
    """Toàn cảnh kho cho tab Dữ liệu của trang quản trị. Chỉ đọc."""
    from livelift.api.store import durability_info

    ben = durability_info(store)
    if isinstance(kho, KhoTaiKhoanPostgres):
        tk_bang = kho.thong_ke_bang()
    else:
        tk_bang = _thong_ke_bo_nho(store)

    trong_ma = _migration_trong_ma()
    da_ap = tk_bang["migration"]["da_ap"]
    migration = {
        "trong_ma": trong_ma[-1] if trong_ma else None,
        "da_ap": da_ap,
        "moi_nhat": tk_bang["migration"]["moi_nhat"],
        "con_thieu": sorted(set(trong_ma) - set(da_ap)) if da_ap is not None else None,
        "ghi_chu": (
            None
            if da_ap is not None
            else "Kho bộ nhớ không dùng migration; lược đồ đi theo mã đang chạy."
        ),
    }

    tai_khoan = kho.liet_ke()
    con_han = kho.dem_dang_nhap_con_han(gio_hien_tai())
    if ben["storage_mode"] == "postgres":
        sao_luu: dict[str, Any] = {"loai": "pg_dump", "gan_nhat": _sao_luu_gan_nhat()}
    else:
        snap = ben.get("snapshot") or {}
        sao_luu = {
            "loai": "anh_chup" if snap else None,
            "gan_nhat": (
                {"tep": Path(snap["path"]).name, "luc": snap.get("last_saved_at")} if snap else None
            ),
        }
    return {
        "kho": {
            "backend": getattr(store, "backend", "unknown"),
            "che_do_luu": ben["storage_mode"],
            "ben_vung": bool(ben["durable"]),
            "canh_bao": ben.get("storage_warning"),
        },
        "kho_tai_khoan": {
            "backend": kho.backend,
            "ghi_chu": (
                None
                if kho.backend == "postgres"
                else "Tài khoản nằm trong RAM: khởi động lại API là mất, trừ hai tài khoản "
                "gieo từ LIVELIFT_MK_QUAN_TRI / LIVELIFT_MK_GIAM_KHAO."
            ),
        },
        "migration": migration,
        "bang": tk_bang["bang"],
        "phien_khong_demo": tk_bang["phien_khong_demo"],
        "ghi_chu_that": GHI_CHU_THAT,
        "tai_khoan": {
            "tong": len(tai_khoan),
            "theo_vai": {v: sum(1 for t in tai_khoan if t["vai"] == v) for v in VAI},
            "chua_xac_minh": sum(
                1 for t in tai_khoan if t["vai"] == "nguoi-ban" and not t["da_xac_minh"]
            ),
            "bi_khoa": sum(1 for t in tai_khoan if t["khoa"]),
            "dang_nhap_con_han": sum(con_han.values()),
        },
        "nhat_ky_quan_tri": kho.dem_nhat_ky(),
        "sao_luu": sao_luu,
        "luc": gio_hien_tai(),
    }

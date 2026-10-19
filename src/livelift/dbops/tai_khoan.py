"""Kho tài khoản (D-017, migration 0011): giao diện chung, bản bộ nhớ, bản PostgreSQL.

Ba bảng của migration 0011 (``tai_khoan``, ``dang_nhap``, ``nhat_ky_quan_tri``)
đi qua MỘT giao diện :class:`KhoTaiKhoan`, giống cách :class:`livelift.api.store.Store`
che hai kho phiên:

* :class:`KhoTaiKhoanBoNho` — dùng khi API chạy ``STORE_BACKEND=memory`` (mặc định,
  kiểm thử, máy demo không Docker). Mất khi tiến trình khởi động lại, đúng như kho
  phiên bộ nhớ; ``/quan-tri/du-lieu`` nói rõ điều đó.
* :class:`KhoTaiKhoanPostgres` — dùng khi API chạy ``STORE_BACKEND=postgres``. Đi
  chung pool, chung hạn giờ và chung cách dịch lỗi "kho chết ⇒ 503" của
  :class:`~livelift.api.store.PostgresStore` (:meth:`KhoTaiKhoanPostgres.tu_kho`),
  nên tài khoản không mở thêm một pool thứ hai. Script (gieo dữ liệu) dùng
  :meth:`KhoTaiKhoanPostgres.tu_url`.

Tệp này chỉ LƯU và ĐỌC. Băm mật khẩu, sinh token, hạn mức và quyền nằm ở
:mod:`livelift.api.tai_khoan`. Kho không bao giờ thấy token gốc (chỉ SHA-256 của
nó) hay mật khẩu gốc (chỉ chuỗi scrypt).

Gieo tài khoản quản trị và giám khảo: :func:`gieo_tai_khoan_demo` (PostgreSQL theo
URL, cho ``scripts/gieo_demo_db.py``) và :func:`gieo_tai_khoan_mac_dinh` (kho bất
kỳ). Mật khẩu lấy từ ``LIVELIFT_MK_QUAN_TRI`` / ``LIVELIFT_MK_GIAM_KHAO`` (biến môi
trường hoặc ``.env``); thiếu thì tài khoản đó bị BỎ QUA. Chỉ lệnh gieo chạy trực
tiếp với cờ ``--in-mat-khau`` mới sinh mật khẩu ngẫu nhiên và in ĐÚNG MỘT LẦN ra
stderr; đường script (``gieo_tai_khoan_demo``) không bao giờ in mật khẩu.
Không có mật khẩu nào viết cứng trong mã (``tests/test_tai_khoan.py`` quét).

Tên ``quan-tri`` / ``giam-khao`` đã có mà KHÔNG do lệnh gieo tạo (không có dòng
``gieo_tai_khoan`` trong nhật ký quản trị) thì lệnh gieo không nhận nó là của mình:
báo :class:`TaiKhoanDanhRiengBiChiemError`.

    python -m livelift.dbops.tai_khoan gieo [--database-url URL] [--in-mat-khau]
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import logging
import sys
import threading
import uuid
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Any, Literal, Protocol

logger = logging.getLogger("livelift.dbops.tai_khoan")

Vai = Literal["quan-tri", "nguoi-ban", "chi-xem"]
VAI: tuple[str, ...] = ("quan-tri", "nguoi-ban", "chi-xem")

VIEC_GIEO = "gieo_tai_khoan"
"""``nhat_ky_quan_tri.viec`` của lệnh gieo: dấu để nhận ra tài khoản do chính nó tạo."""

TEN_QUAN_TRI = "quan-tri"
TEN_GIAM_KHAO = "giam-khao"
"""Tên của hai tài khoản gieo sẵn. Giám khảo là người bán CHƯA xác minh (D-017,
D-023): mọi phiên họ tạo đi đường demo, không vào số nào."""

KHOA_CAM_TRONG_NHAT_KY: frozenset[str] = frozenset(
    {
        "mat_khau",
        "mat_khau_bam",
        "token",
        "token_bam",
        "email",
        "so_dien_thoai",
        "sdt",
        "ip",
        "dia_chi",
        "dia_chi_ip",
    }
)
"""Khoá không được xuất hiện ở tầng trên cùng của ``nhat_ky_quan_tri.chi_tiet``.
Cùng danh sách với ràng buộc CHECK của migration 0011: bản bộ nhớ chặn y hệt
bản PostgreSQL, để test trên bộ nhớ nói đúng điều cơ sở dữ liệu sẽ làm."""


class TenDaTonTaiError(Exception):
    """Tên đăng nhập đã có người dùng (khoá UNIQUE)."""


class ChiTietCoPiiError(ValueError):
    """``chi_tiet`` của nhật ký quản trị mang một khoá bị cấm."""


class TaiKhoanDanhRiengBiChiemError(RuntimeError):
    """Tên gieo sẵn (``quan-tri`` / ``giam-khao``) đã bị một tài khoản khác chiếm.

    ``ket`` là kết quả gieo (đã tạo gì, bỏ qua gì), ``xung_dot`` là các tên bị chiếm.
    Thông điệp không chứa mật khẩu.
    """

    def __init__(self, xung_dot: list[str], ket: dict[str, Any]) -> None:
        self.xung_dot = list(xung_dot)
        self.ket = ket
        super().__init__(
            "Tên dành riêng đã bị tài khoản khác chiếm (không do lệnh gieo tạo): "
            + ", ".join(self.xung_dot)
            + ". Lệnh gieo KHÔNG nhận các tài khoản này. Xoá hoặc đổi tên chúng trong "
            "bảng tai_khoan rồi chạy lại lệnh gieo."
        )


def _kiem_chi_tiet(chi_tiet: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(chi_tiet, dict):
        raise ChiTietCoPiiError("chi_tiet phải là một đối tượng JSON")
    cam = sorted(KHOA_CAM_TRONG_NHAT_KY & set(chi_tiet))
    if cam:
        raise ChiTietCoPiiError(f"chi_tiet không được chứa {cam}")
    return chi_tiet


# ---------------------------------------------------------------------------
# Giao diện chung
# ---------------------------------------------------------------------------


class KhoTaiKhoan(Protocol):
    """Mọi hàm trả ``dict`` thuần (id là chuỗi, thời điểm là ``datetime`` có múi giờ).

    Dòng tài khoản trả về CÓ ``mat_khau_bam`` (để kiểm mật khẩu); tầng API tự gỡ nó
    trước khi trả ra ngoài (:func:`livelift.api.tai_khoan.cong_khai`).
    """

    backend: str

    def tao_tai_khoan(
        self,
        *,
        ten_dang_nhap: str,
        mat_khau_bam: str,
        vai: str,
        da_xac_minh: bool,
        tao_luc: datetime,
    ) -> dict[str, Any]: ...
    def tim_theo_ten(self, ten_dang_nhap: str) -> dict[str, Any] | None: ...
    def tim_theo_id(self, tai_khoan_id: str) -> dict[str, Any] | None: ...
    def liet_ke(self) -> list[dict[str, Any]]: ...
    def cap_nhat(self, tai_khoan_id: str, fields: dict[str, Any]) -> dict[str, Any] | None: ...

    def tao_dang_nhap(
        self, *, tai_khoan_id: str, token_bam: str, tao_luc: datetime, het_han: datetime
    ) -> dict[str, Any]: ...
    def tra_dang_nhap(self, token_bam: str) -> dict[str, Any] | None: ...
    def thu_hoi(self, token_bam: str, luc: datetime) -> bool: ...
    def thu_hoi_cua_tai_khoan(self, tai_khoan_id: str, luc: datetime) -> int: ...
    def dem_dang_nhap_con_han(self, luc: datetime) -> dict[str, int]: ...
    def don_dang_nhap(self, truoc: datetime) -> int: ...

    def ghi_nhat_ky(
        self,
        *,
        ai: str | None,
        viec: str,
        doi_tuong: str | None,
        chi_tiet: dict[str, Any],
        luc: datetime,
    ) -> dict[str, Any]: ...
    def liet_ke_nhat_ky(self, gioi_han: int = 50) -> list[dict[str, Any]]: ...
    def dem_nhat_ky(self) -> int: ...
    def co_nhat_ky(self, viec: str, doi_tuong: str) -> bool: ...


_COT_SUA_DUOC = frozenset({"vai", "da_xac_minh", "khoa", "mat_khau_bam"})
"""Cột ``cap_nhat`` được đổi. Tên đăng nhập, id và ``tao_luc`` bất biến."""


def _loc_cot(fields: dict[str, Any]) -> dict[str, Any]:
    la = set(fields) - _COT_SUA_DUOC
    if la:
        raise ValueError(f"không sửa được cột {sorted(la)}")
    if "vai" in fields and fields["vai"] not in VAI:
        raise ValueError(f"vai không hợp lệ: {fields['vai']!r}")
    return dict(fields)


# ---------------------------------------------------------------------------
# Bản bộ nhớ
# ---------------------------------------------------------------------------


class KhoTaiKhoanBoNho:
    """Kho tài khoản trong RAM, an toàn khi nhiều luồng gọi (một khoá cho cả kho)."""

    backend = "memory"

    def __init__(self) -> None:
        self._khoa = threading.RLock()
        self._tai_khoan: dict[str, dict[str, Any]] = {}
        self._theo_ten: dict[str, str] = {}
        self._dang_nhap: dict[str, dict[str, Any]] = {}  # token_bam -> dòng
        self._nhat_ky: list[dict[str, Any]] = []

    def tao_tai_khoan(
        self,
        *,
        ten_dang_nhap: str,
        mat_khau_bam: str,
        vai: str,
        da_xac_minh: bool,
        tao_luc: datetime,
    ) -> dict[str, Any]:
        if vai not in VAI:
            raise ValueError(f"vai không hợp lệ: {vai!r}")
        with self._khoa:
            if ten_dang_nhap in self._theo_ten:
                raise TenDaTonTaiError(ten_dang_nhap)
            row: dict[str, Any] = {
                "id": str(uuid.uuid4()),
                "ten_dang_nhap": ten_dang_nhap,
                "mat_khau_bam": mat_khau_bam,
                "vai": vai,
                "da_xac_minh": bool(da_xac_minh),
                "tao_luc": tao_luc,
                "khoa": False,
            }
            self._tai_khoan[row["id"]] = row
            self._theo_ten[ten_dang_nhap] = row["id"]
            return dict(row)

    def tim_theo_ten(self, ten_dang_nhap: str) -> dict[str, Any] | None:
        with self._khoa:
            tid = self._theo_ten.get(ten_dang_nhap)
            return dict(self._tai_khoan[tid]) if tid else None

    def tim_theo_id(self, tai_khoan_id: str) -> dict[str, Any] | None:
        with self._khoa:
            row = self._tai_khoan.get(str(tai_khoan_id))
            return dict(row) if row else None

    def liet_ke(self) -> list[dict[str, Any]]:
        with self._khoa:
            return sorted(
                (dict(r) for r in self._tai_khoan.values()),
                key=lambda r: (r["tao_luc"], r["ten_dang_nhap"]),
            )

    def cap_nhat(self, tai_khoan_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        sua = _loc_cot(fields)
        with self._khoa:
            row = self._tai_khoan.get(str(tai_khoan_id))
            if row is None:
                return None
            row.update(sua)
            return dict(row)

    def tao_dang_nhap(
        self, *, tai_khoan_id: str, token_bam: str, tao_luc: datetime, het_han: datetime
    ) -> dict[str, Any]:
        with self._khoa:
            if str(tai_khoan_id) not in self._tai_khoan:
                raise KeyError(tai_khoan_id)
            if token_bam in self._dang_nhap:  # khoá UNIQUE: 2^256, nhưng vẫn giữ hợp đồng
                raise ValueError("token_bam trùng")
            row = {
                "id": str(uuid.uuid4()),
                "tai_khoan_id": str(tai_khoan_id),
                "token_bam": token_bam,
                "tao_luc": tao_luc,
                "het_han": het_han,
                "thu_hoi": None,
            }
            self._dang_nhap[token_bam] = row
            return dict(row)

    def tra_dang_nhap(self, token_bam: str) -> dict[str, Any] | None:
        with self._khoa:
            dn = self._dang_nhap.get(token_bam)
            if dn is None:
                return None
            tk = self._tai_khoan.get(dn["tai_khoan_id"])
            if tk is None:
                return None
            return {"dang_nhap": dict(dn), "tai_khoan": dict(tk)}

    def thu_hoi(self, token_bam: str, luc: datetime) -> bool:
        with self._khoa:
            dn = self._dang_nhap.get(token_bam)
            if dn is None or dn["thu_hoi"] is not None:
                return False
            dn["thu_hoi"] = luc
            return True

    def thu_hoi_cua_tai_khoan(self, tai_khoan_id: str, luc: datetime) -> int:
        n = 0
        with self._khoa:
            for dn in self._dang_nhap.values():
                if dn["tai_khoan_id"] == str(tai_khoan_id) and dn["thu_hoi"] is None:
                    dn["thu_hoi"] = luc
                    n += 1
        return n

    def dem_dang_nhap_con_han(self, luc: datetime) -> dict[str, int]:
        with self._khoa:
            ket: dict[str, int] = {}
            for dn in self._dang_nhap.values():
                if dn["thu_hoi"] is None and dn["het_han"] > luc:
                    ket[dn["tai_khoan_id"]] = ket.get(dn["tai_khoan_id"], 0) + 1
            return ket

    def don_dang_nhap(self, truoc: datetime) -> int:
        """Xoá dòng hết hạn trước ``truoc`` hoặc bị thu hồi trước ``truoc``."""
        with self._khoa:
            chet = [
                k
                for k, dn in self._dang_nhap.items()
                if dn["het_han"] < truoc or (dn["thu_hoi"] is not None and dn["thu_hoi"] < truoc)
            ]
            for k in chet:
                del self._dang_nhap[k]
            return len(chet)

    def ghi_nhat_ky(
        self,
        *,
        ai: str | None,
        viec: str,
        doi_tuong: str | None,
        chi_tiet: dict[str, Any],
        luc: datetime,
    ) -> dict[str, Any]:
        row = {
            "id": str(uuid.uuid4()),
            "ai": str(ai) if ai else None,
            "viec": viec,
            "doi_tuong": doi_tuong,
            "luc": luc,
            "chi_tiet": copy.deepcopy(_kiem_chi_tiet(chi_tiet)),
        }
        with self._khoa:
            self._nhat_ky.append(row)
        return dict(row)

    def liet_ke_nhat_ky(self, gioi_han: int = 50) -> list[dict[str, Any]]:
        with self._khoa:
            return [dict(r) for r in reversed(self._nhat_ky[-max(0, gioi_han) :])]

    def dem_nhat_ky(self) -> int:
        with self._khoa:
            return len(self._nhat_ky)

    def co_nhat_ky(self, viec: str, doi_tuong: str) -> bool:
        with self._khoa:
            return any(r["viec"] == viec and r["doi_tuong"] == doi_tuong for r in self._nhat_ky)


# ---------------------------------------------------------------------------
# Bản PostgreSQL
# ---------------------------------------------------------------------------

LOI_CHUA_MIGRATE = (
    "Cơ sở dữ liệu chưa có bảng tài khoản (migration 0011). Chạy `livelift-migrate up` "
    "(hoặc python -m livelift.dbops.migrate up) rồi thử lại."
)

KetNoi = Callable[[], contextlib.AbstractContextManager[Any]]
"""Hàm trả một context manager cấp kết nối psycopg có ``row_factory=dict_row``,
tự commit khi khối kết thúc êm (đúng hành vi ``ConnectionPool.connection``)."""


def _chuan_hoa(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in row.items()}


_COT_TK = "id, ten_dang_nhap, mat_khau_bam, vai, da_xac_minh, tao_luc, khoa"


class KhoTaiKhoanPostgres:
    """Ba bảng của migration 0011 trên PostgreSQL."""

    backend = "postgres"

    def __init__(self, ket_noi: KetNoi) -> None:
        self._ket_noi_goc = ket_noi
        try:
            from psycopg.types.json import Jsonb
        except ImportError as exc:  # pragma: no cover - phụ thuộc môi trường
            raise RuntimeError("Kho tài khoản PostgreSQL cần 'psycopg[binary,pool]'") from exc
        self._jsonb = Jsonb

    @classmethod
    def tu_kho(cls, store: Any) -> KhoTaiKhoanPostgres:
        """Đi chung pool với ``PostgresStore`` của API: chung hạn giờ, chung 503."""
        return cls(store._connection)  # noqa: SLF001 - cố ý dùng chung pool, không mở pool mới

    @classmethod
    def tu_url(cls, database_url: str, *, connect_timeout_s: int = 5) -> KhoTaiKhoanPostgres:
        """Một kết nối cho mỗi lời gọi. Cho script (gieo dữ liệu), không cho API."""

        @contextlib.contextmanager
        def _mo() -> Iterator[Any]:
            import psycopg
            from psycopg.rows import dict_row

            from livelift.api.store import STORE_DOWN_DETAIL, StoreUnavailableError

            try:
                conn = psycopg.connect(
                    database_url, row_factory=dict_row, connect_timeout=connect_timeout_s
                )
            except psycopg.OperationalError as exc:
                raise StoreUnavailableError(STORE_DOWN_DETAIL, cause_text=str(exc).strip()) from exc
            with conn:  # commit khi êm, rollback khi lỗi, rồi đóng
                yield conn

        return cls(_mo)

    @contextlib.contextmanager
    def _ket_noi(self) -> Iterator[Any]:
        """Kết nối + dịch "chưa có bảng" sang câu tiếng Việt nói phải làm gì (503)."""
        import psycopg

        from livelift.api.store import StoreUnavailableError

        try:
            with self._ket_noi_goc() as conn:
                yield conn
        except psycopg.errors.UndefinedTable as exc:
            raise StoreUnavailableError(LOI_CHUA_MIGRATE, cause_text=str(exc).strip()) from exc

    def _mot(self, sql: str, params: tuple = ()) -> dict[str, Any] | None:
        with self._ket_noi() as conn:
            return _chuan_hoa(conn.execute(sql, params).fetchone())

    def _nhieu(self, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
        with self._ket_noi() as conn:
            return [_chuan_hoa(r) for r in conn.execute(sql, params).fetchall()]  # type: ignore[misc]

    # -- tài khoản -----------------------------------------------------------
    def tao_tai_khoan(
        self,
        *,
        ten_dang_nhap: str,
        mat_khau_bam: str,
        vai: str,
        da_xac_minh: bool,
        tao_luc: datetime,
    ) -> dict[str, Any]:
        import psycopg

        if vai not in VAI:
            raise ValueError(f"vai không hợp lệ: {vai!r}")
        try:
            row = self._mot(
                """
                INSERT INTO tai_khoan (ten_dang_nhap, mat_khau_bam, vai, da_xac_minh, tao_luc)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, ten_dang_nhap, mat_khau_bam, vai, da_xac_minh, tao_luc, khoa
                """,
                (ten_dang_nhap, mat_khau_bam, vai, bool(da_xac_minh), tao_luc),
            )
        except psycopg.errors.UniqueViolation as exc:
            raise TenDaTonTaiError(ten_dang_nhap) from exc
        assert row is not None
        return row

    def tim_theo_ten(self, ten_dang_nhap: str) -> dict[str, Any] | None:
        return self._mot(
            "SELECT id, ten_dang_nhap, mat_khau_bam, vai, da_xac_minh, tao_luc, khoa "
            "FROM tai_khoan WHERE ten_dang_nhap = %s",
            (ten_dang_nhap,),
        )

    def tim_theo_id(self, tai_khoan_id: str) -> dict[str, Any] | None:
        try:
            uuid.UUID(str(tai_khoan_id))
        except ValueError:
            return None
        return self._mot(
            "SELECT id, ten_dang_nhap, mat_khau_bam, vai, da_xac_minh, tao_luc, khoa "
            "FROM tai_khoan WHERE id = %s",
            (str(tai_khoan_id),),
        )

    def liet_ke(self) -> list[dict[str, Any]]:
        return self._nhieu(
            "SELECT id, ten_dang_nhap, mat_khau_bam, vai, da_xac_minh, tao_luc, khoa "
            "FROM tai_khoan ORDER BY tao_luc, ten_dang_nhap"
        )

    def cap_nhat(self, tai_khoan_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        sua = _loc_cot(fields)
        if not sua:
            return self.tim_theo_id(tai_khoan_id)
        try:
            uuid.UUID(str(tai_khoan_id))
        except ValueError:
            return None
        # Tên cột lấy từ tập cho phép cố định (_COT_SUA_DUOC), không bao giờ từ người gọi.
        gan = ", ".join(f"{cot} = %s" for cot in sua)
        return self._mot(
            f"UPDATE tai_khoan SET {gan} WHERE id = %s RETURNING {_COT_TK}",  # noqa: S608
            (*sua.values(), str(tai_khoan_id)),
        )

    # -- đăng nhập -----------------------------------------------------------
    def tao_dang_nhap(
        self, *, tai_khoan_id: str, token_bam: str, tao_luc: datetime, het_han: datetime
    ) -> dict[str, Any]:
        row = self._mot(
            """
            INSERT INTO dang_nhap (tai_khoan_id, token_bam, tao_luc, het_han)
            VALUES (%s, %s, %s, %s)
            RETURNING id, tai_khoan_id, token_bam, tao_luc, het_han, thu_hoi
            """,
            (str(tai_khoan_id), token_bam, tao_luc, het_han),
        )
        assert row is not None
        return row

    def tra_dang_nhap(self, token_bam: str) -> dict[str, Any] | None:
        row = self._mot(
            """
            SELECT d.id AS dn_id, d.tai_khoan_id AS dn_tai_khoan_id, d.token_bam AS dn_token_bam,
                   d.tao_luc AS dn_tao_luc, d.het_han AS dn_het_han, d.thu_hoi AS dn_thu_hoi,
                   t.id, t.ten_dang_nhap, t.mat_khau_bam, t.vai, t.da_xac_minh, t.tao_luc, t.khoa
            FROM dang_nhap d JOIN tai_khoan t ON t.id = d.tai_khoan_id
            WHERE d.token_bam = %s
            """,
            (token_bam,),
        )
        if row is None:
            return None
        dn = {k[3:]: v for k, v in row.items() if k.startswith("dn_")}
        tk = {k: v for k, v in row.items() if not k.startswith("dn_")}
        return {"dang_nhap": dn, "tai_khoan": tk}

    def thu_hoi(self, token_bam: str, luc: datetime) -> bool:
        row = self._mot(
            "UPDATE dang_nhap SET thu_hoi = %s WHERE token_bam = %s AND thu_hoi IS NULL "
            "RETURNING id",
            (luc, token_bam),
        )
        return row is not None

    def thu_hoi_cua_tai_khoan(self, tai_khoan_id: str, luc: datetime) -> int:
        rows = self._nhieu(
            "UPDATE dang_nhap SET thu_hoi = %s WHERE tai_khoan_id = %s AND thu_hoi IS NULL "
            "RETURNING id",
            (luc, str(tai_khoan_id)),
        )
        return len(rows)

    def dem_dang_nhap_con_han(self, luc: datetime) -> dict[str, int]:
        rows = self._nhieu(
            "SELECT tai_khoan_id, count(*) AS n FROM dang_nhap "
            "WHERE thu_hoi IS NULL AND het_han > %s GROUP BY tai_khoan_id",
            (luc,),
        )
        return {r["tai_khoan_id"]: int(r["n"]) for r in rows}

    def don_dang_nhap(self, truoc: datetime) -> int:
        """Xoá dòng hết hạn trước ``truoc`` hoặc bị thu hồi trước ``truoc``."""
        rows = self._nhieu(
            "DELETE FROM dang_nhap WHERE het_han < %s OR thu_hoi < %s RETURNING id",
            (truoc, truoc),
        )
        return len(rows)

    # -- nhật ký quản trị ----------------------------------------------------
    def ghi_nhat_ky(
        self,
        *,
        ai: str | None,
        viec: str,
        doi_tuong: str | None,
        chi_tiet: dict[str, Any],
        luc: datetime,
    ) -> dict[str, Any]:
        row = self._mot(
            """
            INSERT INTO nhat_ky_quan_tri (ai, viec, doi_tuong, luc, chi_tiet)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, ai, viec, doi_tuong, luc, chi_tiet
            """,
            (str(ai) if ai else None, viec, doi_tuong, luc, self._jsonb(_kiem_chi_tiet(chi_tiet))),
        )
        assert row is not None
        return row

    def liet_ke_nhat_ky(self, gioi_han: int = 50) -> list[dict[str, Any]]:
        return self._nhieu(
            "SELECT id, ai, viec, doi_tuong, luc, chi_tiet FROM nhat_ky_quan_tri "
            "ORDER BY luc DESC LIMIT %s",
            (max(0, int(gioi_han)),),
        )

    def dem_nhat_ky(self) -> int:
        row = self._mot("SELECT count(*) AS n FROM nhat_ky_quan_tri")
        return int(row["n"]) if row else 0

    def co_nhat_ky(self, viec: str, doi_tuong: str) -> bool:
        row = self._mot(
            "SELECT 1 AS co FROM nhat_ky_quan_tri WHERE viec = %s AND doi_tuong = %s LIMIT 1",
            (viec, doi_tuong),
        )
        return row is not None

    # -- thống kê cho /quan-tri/du-lieu ------------------------------------
    def thong_ke_bang(self) -> dict[str, Any]:
        """Số dòng theo bảng, THẬT (``is_demo=false``) và demo tách riêng."""
        return thong_ke_bang_postgres(self._ket_noi)


# ---------------------------------------------------------------------------
# Thống kê kho PostgreSQL (đọc, không ghi)
# ---------------------------------------------------------------------------

BANG_THEO_PHIEN: tuple[str, ...] = (
    "experiment_block",
    "assignment_event",
    "exposure_event",
    "intervention_log",
    "session_tick",
    "comment_event",
    "reaction_event",
    "shortlink",
    "click_event",
    "order_event",
    "lab_event",
)
"""Bảng gắn với một phiên qua ``session_id``: đếm tách THẬT / demo theo
``live_session.is_demo`` của phiên đó. Danh sách cố định trong mã: tên bảng
không bao giờ đến từ người gọi."""

BANG_KHONG_THEO_PHIEN: tuple[str, ...] = ("product", "analysis_run")
"""Bảng dùng chung, không thuộc phiên nào: chỉ có tổng."""


def thong_ke_bang_postgres(ket_noi: KetNoi) -> dict[str, Any]:
    """Đếm dòng từng bảng. Một giao dịch, chỉ đọc."""
    ket: dict[str, Any] = {"bang": {}, "phien_khong_demo": {}, "migration": {}}
    with ket_noi() as conn:
        s = conn.execute(
            """
            SELECT count(*) FILTER (WHERE NOT is_demo) AS that,
                   count(*) FILTER (WHERE is_demo)     AS demo,
                   count(*) FILTER (WHERE NOT is_demo AND dry_run)            AS chay_thu,
                   count(*) FILTER (WHERE NOT is_demo AND platform = 'lab')   AS phong_xem,
                   count(*) FILTER (WHERE NOT is_demo AND platform = 'sim')   AS may_sinh
            FROM live_session
            """
        ).fetchone()
        ket["bang"]["live_session"] = {"that": int(s["that"]), "demo": int(s["demo"])}
        ket["phien_khong_demo"] = {
            "chay_thu": int(s["chay_thu"]),
            "phong_xem": int(s["phong_xem"]),
            "may_sinh": int(s["may_sinh"]),
        }
        for bang in BANG_THEO_PHIEN:
            r = conn.execute(
                f"""
                SELECT count(*) FILTER (WHERE s.is_demo IS FALSE) AS that,
                       count(*) FILTER (WHERE s.is_demo IS TRUE)  AS demo,
                       count(*) FILTER (WHERE s.session_id IS NULL) AS khong_gan_phien
                FROM {bang} t LEFT JOIN live_session s ON s.session_id = t.session_id
                """  # noqa: S608 - tên bảng từ hằng BANG_THEO_PHIEN
            ).fetchone()
            ket["bang"][bang] = {
                "that": int(r["that"]),
                "demo": int(r["demo"]),
                "khong_gan_phien": int(r["khong_gan_phien"]),
            }
        for bang in BANG_KHONG_THEO_PHIEN:
            r = conn.execute(f"SELECT count(*) AS n FROM {bang}").fetchone()  # noqa: S608
            ket["bang"][bang] = {"tong": int(r["n"])}
        rows = conn.execute(
            "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"
        ).fetchall()
        ket["migration"] = {
            "da_ap": [int(r["version"]) for r in rows],
            "moi_nhat": (
                {
                    "version": int(rows[-1]["version"]),
                    "name": rows[-1]["name"],
                    "applied_at": rows[-1]["applied_at"],
                }
                if rows
                else None
            ),
        }
    return ket


# ---------------------------------------------------------------------------
# Gieo tài khoản quản trị và giám khảo
# ---------------------------------------------------------------------------


def gieo_tai_khoan_mac_dinh(
    kho: KhoTaiKhoan,
    *,
    mk_quan_tri: str | None = None,
    mk_giam_khao: str | None = None,
    sinh_khi_thieu: bool = True,
    in_ra: Callable[[str], Any] | None = None,
) -> dict[str, Any]:
    """Tạo ``quan-tri`` (quản trị, đã xác minh) và ``giam-khao`` (người bán CHƯA xác
    minh) nếu chưa có. Chạy lại không tạo bản trùng và KHÔNG đổi mật khẩu đã có.

    Mật khẩu: tham số, rồi ``LIVELIFT_MK_QUAN_TRI`` / ``LIVELIFT_MK_GIAM_KHAO`` (biến
    môi trường hoặc ``.env``). Thiếu cả hai thì CHỈ sinh ngẫu nhiên khi
    ``sinh_khi_thieu`` VÀ có ``in_ra`` (mật khẩu in đúng một lần qua ``in_ra``);
    không có ``in_ra`` (mặc định) thì tài khoản đó bị bỏ qua, vì một mật khẩu sinh
    ra mà không ai thấy là một tài khoản không ai vào được. Mật khẩu lấy từ cấu
    hình thì không bao giờ được in.

    Tên đã có: chỉ coi là ``da_co`` khi chính lệnh gieo đã tạo nó (có dòng
    ``gieo_tai_khoan`` trong nhật ký quản trị). Tên do người khác tạo (đăng ký
    trước khi có chặn tên dành riêng) thì ghi vào ``xung_dot``, ghi log lỗi, và
    sau khi xử lý xong mọi tên thì ném :class:`TaiKhoanDanhRiengBiChiemError`.

    Trả ``{"tao_moi", "da_co", "bo_qua", "xung_dot", "nguon_mat_khau"}``; không có
    mật khẩu nào trong giá trị trả về.
    """
    from livelift.api.tai_khoan import bam_mat_khau, cau_hinh_tai_khoan, sinh_mat_khau
    from livelift.api.tai_khoan import gio_hien_tai as _bay_gio

    cfg = cau_hinh_tai_khoan()
    tu_cau_hinh = {
        TEN_QUAN_TRI: cfg.livelift_mk_quan_tri.get_secret_value(),
        TEN_GIAM_KHAO: cfg.livelift_mk_giam_khao.get_secret_value(),
    }
    tu_tham_so = {TEN_QUAN_TRI: mk_quan_tri, TEN_GIAM_KHAO: mk_giam_khao}
    mau: dict[str, dict[str, Any]] = {
        TEN_QUAN_TRI: {"vai": "quan-tri", "da_xac_minh": True, "bien": "LIVELIFT_MK_QUAN_TRI"},
        TEN_GIAM_KHAO: {"vai": "nguoi-ban", "da_xac_minh": False, "bien": "LIVELIFT_MK_GIAM_KHAO"},
    }
    ket: dict[str, Any] = {
        "tao_moi": [],
        "da_co": [],
        "bo_qua": [],
        "xung_dot": [],
        "nguon_mat_khau": {},
    }
    for ten, m in mau.items():
        if kho.tim_theo_ten(ten) is not None:
            if kho.co_nhat_ky(VIEC_GIEO, ten):
                ket["da_co"].append(ten)
            else:
                logger.error(
                    "Tên dành riêng '%s' đã bị một tài khoản không do lệnh gieo tạo chiếm.", ten
                )
                ket["xung_dot"].append(ten)
            continue
        mk = tu_tham_so[ten] or tu_cau_hinh[ten]
        nguon = "tham_so" if tu_tham_so[ten] else (m["bien"] if mk else None)
        if not mk:
            if not (sinh_khi_thieu and in_ra is not None):
                ket["bo_qua"].append(ten)
                continue
            mk, nguon = sinh_mat_khau(), "sinh_ngau_nhien"
        try:
            kho.tao_tai_khoan(
                ten_dang_nhap=ten,
                mat_khau_bam=bam_mat_khau(mk),
                vai=m["vai"],
                da_xac_minh=m["da_xac_minh"],
                tao_luc=_bay_gio(),
            )
        except TenDaTonTaiError:  # một tiến trình khác vừa tạo xong (hoặc vừa chiếm)
            if kho.co_nhat_ky(VIEC_GIEO, ten):
                ket["da_co"].append(ten)
            else:
                ket["xung_dot"].append(ten)
            continue
        ket["tao_moi"].append(ten)
        ket["nguon_mat_khau"][ten] = nguon
        kho.ghi_nhat_ky(
            ai=None,
            viec=VIEC_GIEO,
            doi_tuong=ten,
            chi_tiet={"vai": m["vai"], "da_xac_minh": m["da_xac_minh"], "nguon": nguon},
            luc=_bay_gio(),
        )
        if nguon == "sinh_ngau_nhien" and in_ra is not None:
            in_ra(
                f"[tai-khoan] Đã tạo '{ten}' ({m['vai']}). Mật khẩu sinh ngẫu nhiên, chỉ in "
                f"MỘT lần, hãy lưu ngay: {mk}"
            )
    if ket["xung_dot"]:
        raise TaiKhoanDanhRiengBiChiemError(ket["xung_dot"], ket)
    return ket


def gieo_tai_khoan_demo(
    database_url: str, *, in_ra: Callable[[str], Any] | None = None
) -> dict[str, Any]:
    """Gieo hai tài khoản vào PostgreSQL theo ``database_url`` (``scripts/gieo_demo_db.py``).

    Mặc định KHÔNG in và KHÔNG sinh mật khẩu: thiếu ``LIVELIFT_MK_*`` thì tài khoản đó
    nằm trong ``bo_qua``. Chỉ lệnh ``gieo --in-mat-khau`` truyền ``in_ra``.
    """
    return gieo_tai_khoan_mac_dinh(KhoTaiKhoanPostgres.tu_url(database_url), in_ra=in_ra)


def _in_stderr(dong: str) -> None:
    print(dong, file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    from livelift.console import configure as _configure_console

    _configure_console()
    p = argparse.ArgumentParser(
        prog="python -m livelift.dbops.tai_khoan",
        description="Gieo tài khoản quản trị và giám khảo vào PostgreSQL (D-017).",
    )
    p.add_argument("lenh", choices=["gieo"])
    p.add_argument("--database-url", default=None)
    p.add_argument(
        "--in-mat-khau",
        action="store_true",
        help="thiếu LIVELIFT_MK_* thì sinh mật khẩu ngẫu nhiên và in MỘT lần ra stderr",
    )
    args = p.parse_args(argv)
    from livelift.config import get_settings

    url = args.database_url or get_settings().database_url
    try:
        ket = gieo_tai_khoan_demo(url, in_ra=_in_stderr if args.in_mat_khau else None)
    except TaiKhoanDanhRiengBiChiemError as exc:
        print(f"LỖI: {exc}", file=sys.stderr)
        return 2
    print(
        f"tạo mới: {ket['tao_moi'] or 'không'} · đã có: {ket['da_co'] or 'không'}"
        f" · nguồn mật khẩu: {ket['nguon_mat_khau'] or '-'}"
    )
    if ket["bo_qua"]:
        print(
            f"bỏ qua (thiếu mật khẩu): {ket['bo_qua']}. Đặt LIVELIFT_MK_QUAN_TRI / "
            "LIVELIFT_MK_GIAM_KHAO rồi chạy lại, hoặc chạy lại với --in-mat-khau."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

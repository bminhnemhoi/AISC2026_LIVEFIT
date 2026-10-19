"""Đăng ký, đăng nhập, quản trị tài khoản (D-017, 19/10/2026).

Hợp đồng (chỉ máy chủ Next gọi, kèm ``Authorization: Bearer <INGEST_TOKEN>``)
------------------------------------------------------------------------------
* ``POST /auth/dang-ky``   ``{ten_dang_nhap, mat_khau}`` ⇒ 201 ``{token, het_han,
  han_giay, tai_khoan}``. Tài khoản mới: vai ``nguoi-ban``, CHƯA xác minh (chế độ
  demo). 409 tên trùng · 422 tên/mật khẩu sai quy tắc · 429 đăng ký quá nhiều.
* ``POST /auth/dang-nhap`` ``{ten_dang_nhap, mat_khau}`` ⇒ 200 như trên. 401 sai
  thông tin · 403 tài khoản bị khoá · 429 sai quá nhiều lần (kèm ``Retry-After``).
* ``POST /auth/dang-xuat`` header ``X-LL-Tai-Khoan: <token>`` ⇒ 200
  ``{da_dang_xuat}``. Gọi lại với token cũ không lỗi.
* ``GET  /auth/toi``       header ``X-LL-Tai-Khoan`` ⇒ 200 ``{tai_khoan, het_han}``;
  401 khi token thiếu, sai, hết hạn hay đã thu hồi.
* ``GET  /quan-tri/tai-khoan`` ⇒ danh sách tài khoản (không có chuỗi băm).
* ``POST /quan-tri/tai-khoan`` ``{tai_khoan_id, vai?, da_xac_minh?, khoa?}`` ⇒ đổi
  vai, xác minh, khoá; mỗi thay đổi một dòng ``nhat_ky_quan_tri``.
* ``GET  /quan-tri/du-lieu`` ⇒ kho đang chạy, migration, số dòng THẬT / demo theo
  bảng, tài khoản, bản sao lưu gần nhất.

``/quan-tri/*`` cần ``X-LL-Tai-Khoan`` của một tài khoản vai ``quan-tri`` (401 nếu
không đăng nhập, 403 nếu vai khác). ``tai_khoan.che_do`` cho Next biết đường đi:
``that`` (gắn token lõi), ``demo`` (đường demo, nhãn "DÀN DỰNG · CHƯA XÁC MINH"),
``chi-xem`` (đường ghi trả 403).

Không token lõi ⇒ 401 (khi ``INGEST_TOKEN`` được đặt). ``LIVELIFT_AUTH=0`` ⇒ mọi
đường ở đây trả 404, kể cả khi không có token.
"""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Match
from starlette.types import Scope

from livelift.api import tai_khoan as tk
from livelift.api.auth import chi_token
from livelift.api.service import StoreDep

_TRUONG_LOI_GIU = ("type", "loc", "msg")
"""Trường được giữ trong mỗi lỗi 422. Bỏ ``input`` (pydantic trả lại NGUYÊN VĂN giá
trị gửi lên, tức mật khẩu rõ) và ``ctx``/``url`` (không cần cho Next)."""


def loi_422_an_toan(loi: Any) -> list[dict[str, Any]]:
    """Danh sách lỗi xác thực đã gỡ mọi giá trị do bên gọi gửi lên."""
    ra: list[dict[str, Any]] = []
    for mot in loi or []:
        if not isinstance(mot, dict):
            continue
        ra.append(
            {k: (list(mot[k]) if k == "loc" else mot[k]) for k in _TRUONG_LOI_GIU if k in mot}
        )
    return ra


class RouteTaiKhoan(APIRoute):
    """Route tắt được bằng ``LIVELIFT_AUTH=0``: khi tắt nó không khớp đường nào và
    không hiện trong ``/openapi.json``.

    Làm ở tầng KHỚP ĐƯỜNG chứ không ở dependency: dependency chạy SAU cổng ghi
    của ứng dụng, nên một POST không token sẽ nhận 401 (lộ ra rằng đường này tồn
    tại) thay vì 404. :func:`livelift.api.tai_khoan.kiem_auth_bat` vẫn đứng ở
    dependency làm lớp thứ hai.

    Lỗi 422 của thân yêu cầu đi qua :func:`loi_422_an_toan`: handler mặc định của
    FastAPI trả lại trường ``input``, tức mật khẩu rõ khi thân thiếu tên đăng nhập.
    """

    @property  # type: ignore[override]
    def include_in_schema(self) -> bool:
        return bool(getattr(self, "_trong_schema", True)) and tk.auth_bat()

    @include_in_schema.setter
    def include_in_schema(self, gia_tri: bool) -> None:
        self._trong_schema = bool(gia_tri)

    def matches(self, scope: Scope) -> tuple[Match, Scope]:
        if scope.get("type") == "http" and not tk.auth_bat():
            return Match.NONE, {}
        return super().matches(scope)

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        goc = super().get_route_handler()

        async def xu_ly(request: Request) -> Response:
            try:
                return await goc(request)
            except RequestValidationError as exc:
                return JSONResponse(
                    status_code=422, content={"detail": loi_422_an_toan(exc.errors())}
                )

        return xu_ly


router = APIRouter(
    route_class=RouteTaiKhoan,
    dependencies=[Depends(tk.kiem_auth_bat), Depends(tk.can_token_loi)],
)


# ---------------------------------------------------------------------------
# Lược đồ
# ---------------------------------------------------------------------------


class DangNhapIn(BaseModel):
    # Quy tắc tên và độ dài mật khẩu kiểm trong nghiệp vụ để câu lỗi là tiếng Việt;
    # ở đây chỉ chặn thân yêu cầu vô lý.
    ten_dang_nhap: str = Field(min_length=1, max_length=64)
    mat_khau: str = Field(min_length=1, max_length=1024)


class TaiKhoanOut(BaseModel):
    id: str
    ten_dang_nhap: str
    vai: Literal["quan-tri", "nguoi-ban", "chi-xem"]
    da_xac_minh: bool
    khoa: bool
    tao_luc: datetime
    che_do: Literal["that", "demo", "chi-xem"]
    nhan: str | None = None


class TaiKhoanQuanTriOut(TaiKhoanOut):
    dang_nhap_con_han: int = 0


class PhienDangNhapOut(BaseModel):
    token: str = Field(description="Token đăng nhập. Next cất vào cookie HttpOnly ll_tk.")
    het_han: datetime
    han_giay: int
    tai_khoan: TaiKhoanOut


class ToiOut(BaseModel):
    tai_khoan: TaiKhoanOut
    het_han: datetime


class DangXuatOut(BaseModel):
    da_dang_xuat: bool


class SuaTaiKhoanIn(BaseModel):
    tai_khoan_id: str = Field(min_length=1, max_length=64)
    vai: Literal["quan-tri", "nguoi-ban", "chi-xem"] | None = None
    da_xac_minh: bool | None = None
    khoa: bool | None = None


class SuaTaiKhoanOut(BaseModel):
    tai_khoan: TaiKhoanOut
    thay_doi: list[str]


class DanhSachTaiKhoanOut(BaseModel):
    tai_khoan: list[TaiKhoanQuanTriOut]


# ---------------------------------------------------------------------------
# /auth/*
# ---------------------------------------------------------------------------


@chi_token
@router.post("/auth/dang-ky", response_model=PhienDangNhapOut, status_code=201)
def dang_ky(body: DangNhapIn, request: Request, kho: tk.KhoTkDep) -> dict[str, Any]:
    return tk.dang_ky(request, kho, body.ten_dang_nhap, body.mat_khau)


@chi_token
@router.post("/auth/dang-nhap", response_model=PhienDangNhapOut)
def dang_nhap(body: DangNhapIn, request: Request, kho: tk.KhoTkDep) -> dict[str, Any]:
    return tk.dang_nhap(request, kho, body.ten_dang_nhap, body.mat_khau)


@chi_token
@router.post("/auth/dang-xuat", response_model=DangXuatOut)
def dang_xuat(kho: tk.KhoTkDep, x_ll_tai_khoan: tk.TokenTaiKhoan = None) -> dict[str, Any]:
    return {"da_dang_xuat": tk.dang_xuat(kho, x_ll_tai_khoan)}


@router.get("/auth/toi", response_model=ToiOut)
def toi(kho: tk.KhoTkDep, x_ll_tai_khoan: tk.TokenTaiKhoan = None) -> dict[str, Any]:
    phien = tk.yeu_cau_dang_nhap(kho, x_ll_tai_khoan)
    return {
        "tai_khoan": tk.cong_khai(phien["tai_khoan"]),
        "het_han": phien["dang_nhap"]["het_han"],
    }


# ---------------------------------------------------------------------------
# /quan-tri/*
# ---------------------------------------------------------------------------


@router.get("/quan-tri/tai-khoan", response_model=DanhSachTaiKhoanOut)
def danh_sach_tai_khoan(
    kho: tk.KhoTkDep, x_ll_tai_khoan: tk.TokenTaiKhoan = None
) -> dict[str, Any]:
    tk.yeu_cau_quan_tri(kho, x_ll_tai_khoan)
    return {"tai_khoan": tk.liet_ke_tai_khoan(kho)}


@chi_token
@router.post("/quan-tri/tai-khoan", response_model=SuaTaiKhoanOut)
def sua_tai_khoan(
    body: SuaTaiKhoanIn, kho: tk.KhoTkDep, x_ll_tai_khoan: tk.TokenTaiKhoan = None
) -> dict[str, Any]:
    qt = tk.yeu_cau_quan_tri(kho, x_ll_tai_khoan)
    return tk.sua_tai_khoan(
        kho,
        qt["tai_khoan"],
        body.tai_khoan_id,
        vai=body.vai,
        da_xac_minh=body.da_xac_minh,
        khoa=body.khoa,
    )


@router.get("/quan-tri/du-lieu")
def du_lieu(
    kho: tk.KhoTkDep, store: StoreDep, x_ll_tai_khoan: tk.TokenTaiKhoan = None
) -> dict[str, Any]:
    tk.yeu_cau_quan_tri(kho, x_ll_tai_khoan)
    return tk.thong_ke_du_lieu(store, kho)

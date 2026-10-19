#!/usr/bin/env python3
"""Bật kho bền vững (PostgreSQL) bằng MỘT lệnh, và nói rõ khi không bật được.

Vì sao có tệp này: đường Postgres đã tồn tại từ lâu nhưng phải gõ đúng ba việc
rời rạc (dựng container, chạy migrate, đặt **hai** biến môi trường khác nhau),
và biến quyết định lại không phải cái ai cũng đoán: ``DATABASE_URL`` chỉ nói
*ở đâu*, còn ``STORE_BACKEND`` mới quyết định *có dùng hay không* (sự cố
25/08/2026: API chạy trong Docker vẫn báo ``store_backend=memory`` dù đã có
``DATABASE_URL``). Bỏ sót một bước thì hệ thống vẫn chạy ngon lành và vẫn giữ
toàn bộ dữ liệu trong RAM, đúng cái bẫy đã làm mất 13 phiên live thật ngày
11/09/2026.

Bản 19/10/2026 (D-019) làm thêm:

* tự mở Docker Desktop khi máy chủ Docker chưa chạy, chờ ``docker info`` tối đa
  180 giây (``--khong-bat-docker`` để tắt việc này);
* chọn cổng: ``LIVELIFT_DB_PORT`` nếu đã đặt, không thì 5432; 5432 bận (dò bằng
  socket và ``docker ps``) thì dùng 5433. Cổng đi vào ``docker-compose.yml`` qua
  ``${LIVELIFT_DB_PORT:-5432}``;
* chưa có ``POSTGRES_PASSWORD`` thì sinh ngẫu nhiên và ghi vào ``.env``; không
  bao giờ in mật khẩu (``DATABASE_URL`` in ra đều đã che);
* mọi lệnh Docker chỉ nhắm dự án ``-p livelift``. Không ``down -v``, không
  ``prune``, không dừng hay xoá container nào. Container của dự án khác chỉ được
  liệt kê để báo người vận hành;
* in danh sách container của dự án livelift có ``restart: unless-stopped``
  (chúng tự chạy lại mỗi lần Docker Desktop khởi động);
* ``--kiem``: chỉ kiểm, không bật gì, không ghi gì;
* ổ C còn dưới 8 GB thì dừng trước khi bật Docker (ảnh đĩa của Docker Desktop
  nằm trên ổ C);
* ``--volume-thu``: dựng db trên volume riêng ``livelift_pgdata_thu`` (tệp compose
  phụ chỉ đổi chỗ gắn dữ liệu của ``db`` và tắt restart tự động) để thử migrate
  up → down → up mà không chạm dữ liệu trong ``livelift_pgdata``. ``down`` xoá bảng:
  đừng bao giờ chạy nó trên volume thật. Test ``pytest -m db`` tự xác minh bằng
  ``docker inspect`` rằng db đang gắn volume thử, không xác minh được thì bỏ qua;
* ``--ve-volume-that``: xong việc thử thì dựng lại container ``livelift-db-1`` trên
  volume thật ``livelift_pgdata`` mà KHÔNG khởi động nó (``up --no-start``), để ai
  bấm Start trong Docker Desktop cũng không lên nhầm dữ liệu thử. Không xoá volume
  nào. Bật lại trên volume thật: chạy script này không cờ (mật khẩu trong ``.env``
  phải là mật khẩu đã khởi tạo ``livelift_pgdata``, xem dưới);
* volume ``livelift_pgdata`` đã có mà ``.env`` chưa có ``POSTGRES_PASSWORD`` thì
  DỪNG, không sinh mật khẩu mới (Postgres chỉ đọc mật khẩu ở lần khởi tạo đầu, mật
  khẩu mới chắc chắn lệch): chép ``POSTGRES_PASSWORD`` từ ``.env`` của cây chính;
* ``--kiem`` và cuối mỗi lần bật đều in volume đang gắn; gắn volume thử thì ``--kiem``
  báo CHƯA sẵn sàng.

Chạy:

    .venv/Scripts/python scripts/bat_postgres.py
    .venv/Scripts/python scripts/bat_postgres.py --kiem
    .venv/Scripts/python scripts/bat_postgres.py --volume-thu      # thử migrate
    .venv/Scripts/python scripts/bat_postgres.py --ve-volume-that  # xong thử

Mã thoát: 0 = kho bền vững đã sẵn sàng · 2 = không có Docker (script in sẵn
đường lui an toàn: kho memory + ảnh chụp) · 1 = có Docker nhưng dựng hỏng, hoặc
``--kiem`` thấy kho chưa sẵn sàng.
"""

from __future__ import annotations

import argparse
import codecs
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, urlsplit

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from livelift.console import configure  # noqa: E402

#: Tên dự án compose. Mọi lệnh Docker của script này đều mang ``-p livelift``
#: (D-019). Test quét mã nguồn để giữ luật này.
DU_AN = "livelift"
CONTAINER_DB = f"{DU_AN}-db-1"
TEP_ENV = REPO_ROOT / ".env"
DOCKER_DESKTOP_EXE = Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")

CONG_MAC_DINH = 5432
CONG_DU_PHONG = 5433
CHO_DOCKER_S = 180
HEALTHY_TIMEOUT_S = 180
O_C_TOI_THIEU_GB = 8.0

#: Volume của lần dựng thử (``--volume-thu``), đặt tên trong dự án livelift.
VOLUME_THU = "pgdata_thu"
VOLUME_THAT = "pgdata"
#: Tên volume Docker thật sự (compose thêm tiền tố dự án).
TEN_VOLUME_THU = f"{DU_AN}_{VOLUME_THU}"
TEN_VOLUME_THAT = f"{DU_AN}_{VOLUME_THAT}"
#: Container trên volume thử không tự chạy lại khi Docker Desktop khởi động.
COMPOSE_THU = f"""services:
  db:
    restart: "no"
    volumes:
      - {VOLUME_THU}:/var/lib/postgresql/data
volumes:
  {VOLUME_THU}:
"""

#: Tệp compose phụ đang dùng (chỉ khi ``--volume-thu``). Mọi lệnh compose của
#: một lần chạy phải mang cùng bộ tệp, nếu không compose dựng lại container.
_COMPOSE_PHU: Path | None = None

#: Mật khẩu mẫu của ``.env.example``. Gặp nó thì cảnh báo, không tự thay: volume
#: ``pgdata`` có thể đã khởi tạo bằng đúng mật khẩu này.
MAT_KHAU_MAU = "change-me-strong-password"


# ---------------------------------------------------------------------------
# Hàm thuần: .env, che mật khẩu, chọn cổng
# ---------------------------------------------------------------------------


def doc_env(path: Path) -> dict[str, str]:
    """Đọc ``KEY=VALUE`` từ tệp ``.env`` (bỏ dòng chú thích, bỏ ngoặc bao)."""
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        out[key.strip()] = value
    return out


def ghi_bien_env(path: Path, key: str, value: str) -> None:
    """Đặt ``key=value`` trong ``.env``: thay dòng cũ nếu có, không thì thêm cuối tệp.

    Giữ nguyên mọi dòng khác (kể cả chú thích) và kiểu xuống dòng của tệp. Không
    in gì: giá trị có thể là mật khẩu.
    """
    # read_bytes: read_text đổi \r\n thành \n nên không còn nhận ra kiểu xuống dòng của tệp
    raw = path.read_bytes() if path.is_file() else b""
    co_bom = raw.startswith(codecs.BOM_UTF8)
    text = raw.decode("utf-8-sig")
    nl = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines()
    mau = re.compile(rf"^\s*(export\s+)?{re.escape(key)}\s*=")
    moi = f"{key}={value}"
    da_thay = False
    out: list[str] = []
    for line in lines:
        if mau.match(line):
            if not da_thay:
                out.append(moi)
                da_thay = True
            # dòng trùng khoá phía sau bị bỏ: một khoá chỉ có một giá trị
            continue
        out.append(line)
    if not da_thay:
        out.append(moi)
    du_lieu = (codecs.BOM_UTF8 if co_bom else b"") + (nl.join(out) + nl).encode("utf-8")
    # Ghi tệp tạm cạnh .env rồi thay một lần: .env còn giữ INGEST_TOKEN và khoá nền
    # tảng, bị ngắt giữa chừng thì tệp cũ vẫn nguyên, không bị cụt.
    fd, tam = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tam")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(du_lieu)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tam, path)
    except BaseException:
        Path(tam).unlink(missing_ok=True)
        raise


def lay_bien(key: str, env_tep: dict[str, str]) -> tuple[str | None, str]:
    """Giá trị của ``key`` theo thứ tự ưu tiên của docker compose và pydantic:
    biến môi trường của tiến trình trước, ``.env`` sau. Trả (giá trị, nguồn)."""
    if os.environ.get(key):
        return os.environ[key], "môi trường"
    if env_tep.get(key):
        return env_tep[key], ".env"
    return None, ""


def tao_mat_khau() -> str:
    """Mật khẩu ngẫu nhiên an toàn cho URL (không có ký tự cần thoát)."""
    return secrets.token_urlsafe(24)


def che_mat_khau(url: str) -> str:
    """``postgresql://u:pw@h:p/db`` → ``postgresql://u:***@h:p/db``.

    Mật khẩu chép tay có thể chứa ``@`` chưa mã hoá: che tới dấu ``@`` CUỐI CÙNG
    của cụm không khoảng trắng (máy chủ luôn đứng sau dấu ``@`` cuối).
    """
    return re.sub(r"(://[^:/@\s]+:)\S*@", r"\1***@", url)


def dung_database_url(user: str, mat_khau: str, cong: int, db: str) -> str:
    u, pw = quote(user, safe=""), quote(mat_khau, safe="")
    return f"postgresql://{u}:{pw}@127.0.0.1:{cong}/{db}"


def la_may_nay(url: str) -> bool:
    try:
        host = urlsplit(url).hostname or ""
    except ValueError:
        return False
    return host in ("127.0.0.1", "localhost", "::1")


def cong_dang_nghe(cong: int, host: str = "127.0.0.1", timeout: float = 0.5) -> bool:
    """Có tiến trình nào đang nghe ở ``host:cong`` không (thử kết nối TCP)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex((host, cong)) == 0


def phan_tich_docker_ps(dong: str) -> dict[int, str]:
    """Từ các dòng ``tên|cổng`` của ``docker ps`` → {cổng máy: tên container}."""
    out: dict[int, str] = {}
    for line in dong.splitlines():
        if "|" not in line:
            continue
        ten, _, cong = line.partition("|")
        for m in re.finditer(r"(?:[\d.]+|\[[^\]]*\]|::):(\d+)->", cong):
            out[int(m.group(1))] = ten.strip()
    return out


def chon_cong(cau_hinh: int | None, ai_giu: Callable[[int], str | None]) -> tuple[int | None, str]:
    """Chọn cổng máy cho dịch vụ db.

    ``ai_giu(cong)`` trả ``None`` khi cổng trống, ``CONTAINER_DB`` khi chính db
    của livelift đang giữ (dùng lại được), hoặc mô tả kẻ đang giữ.

    * Đã đặt ``LIVELIFT_DB_PORT``: dùng đúng cổng đó, bị kẻ khác giữ thì báo lỗi
      (không tự đổi cổng người vận hành đã chọn).
    * Chưa đặt: 5432, bận thì 5433, cả hai bận thì báo lỗi.
    """
    if cau_hinh is not None:
        giu = ai_giu(cau_hinh)
        if giu is None or giu == CONTAINER_DB:
            return cau_hinh, f"LIVELIFT_DB_PORT={cau_hinh}"
        return None, f"cổng {cau_hinh} (LIVELIFT_DB_PORT) đang bị {giu} giữ"
    ly_do: list[str] = []
    for cong in (CONG_MAC_DINH, CONG_DU_PHONG):
        giu = ai_giu(cong)
        if giu is None:
            them = f" ({'; '.join(ly_do)})" if ly_do else ""
            return cong, f"cổng {cong} trống{them}"
        if giu == CONTAINER_DB:
            return cong, f"db livelift đang chạy sẵn ở cổng {cong}"
        ly_do.append(f"{cong} bận bởi {giu}")
    return None, "; ".join(ly_do)


#: ``docker inspect --format`` in ra một JSON: volume gắn vào, trạng thái, cổng máy.
FORMAT_INSPECT_DB = (
    '{"mounts":{{json .Mounts}},"status":{{json .State.Status}},'
    '"ports":{{json .HostConfig.PortBindings}}}'
)


@dataclass(frozen=True)
class TinhTrangDb:
    """Container db như ``docker inspect`` thấy (chỉ đọc)."""

    volumes: tuple[str, ...]
    trang_thai: str
    #: (HostIp, HostPort) gắn vào cổng 5432/tcp của container
    cong_may: tuple[tuple[str, int], ...]


def phan_tich_inspect_db(text: str) -> TinhTrangDb | None:
    """Kết quả ``docker inspect --format FORMAT_INSPECT_DB`` → :class:`TinhTrangDb`."""
    try:
        d = json.loads(text.strip().splitlines()[0])
    except (ValueError, IndexError):
        return None
    if not isinstance(d, dict):
        return None
    vols = tuple(
        str(m.get("Name"))
        for m in d.get("mounts") or []
        if isinstance(m, dict) and m.get("Type") == "volume" and m.get("Name")
    )
    cong: list[tuple[str, int]] = []
    for b in (d.get("ports") or {}).get("5432/tcp") or []:
        try:
            cong.append((str(b.get("HostIp") or ""), int(b.get("HostPort"))))
        except (TypeError, ValueError, AttributeError):
            continue
    return TinhTrangDb(vols, str(d.get("status") or ""), tuple(cong))


def loai_volume(tt: TinhTrangDb | None) -> tuple[str, str]:
    """('that'|'thu'|'khac'|'khong', mô tả) cho volume đang gắn vào container db."""
    if tt is None:
        return "khong", f"chưa có container {CONTAINER_DB}"
    ten = ", ".join(tt.volumes) or "không gắn volume nào"
    if TEN_VOLUME_THU in tt.volumes:
        return "thu", f"{ten} (volume THỬ)"
    if TEN_VOLUME_THAT in tt.volumes:
        return "that", f"{ten} (volume thật)"
    return "khac", ten


def xac_minh_volume_thu(tt: TinhTrangDb | None, url: str | None) -> tuple[bool, str]:
    """Bằng chứng rằng ``url`` đang trỏ vào db dựng trên VOLUME THỬ.

    Dùng trước mọi việc xoá bảng (``migrate_down`` của ``pytest -m db``). Đòi đủ:
    container đang chạy, gắn ``livelift_pgdata_thu`` và KHÔNG gắn ``livelift_pgdata``,
    ``url`` trỏ máy này đúng cổng máy mà container đang mở cho 5432/tcp. Thiếu một
    điều là ``False`` kèm lý do.
    """
    if not url:
        return False, "chưa có DATABASE_URL"
    if tt is None:
        return False, f"không đọc được 'docker inspect {CONTAINER_DB}'"
    if tt.trang_thai != "running":
        return False, f"{CONTAINER_DB} không chạy (trạng thái {tt.trang_thai or '?'})"
    if TEN_VOLUME_THAT in tt.volumes:
        return False, f"{CONTAINER_DB} đang gắn volume THẬT {TEN_VOLUME_THAT}"
    if TEN_VOLUME_THU not in tt.volumes:
        return False, f"{CONTAINER_DB} không gắn {TEN_VOLUME_THU} (gắn: {list(tt.volumes)})"
    try:
        parts = urlsplit(url)
        host, cong_url = parts.hostname or "", parts.port or 5432
    except ValueError:
        return False, "DATABASE_URL không đọc được"
    if host not in ("127.0.0.1", "localhost"):
        return False, f"DATABASE_URL trỏ máy {host!r}, không phải container trên máy này"
    for host_ip, cong in tt.cong_may:
        if cong != cong_url:
            continue
        if host_ip == "127.0.0.1" and host == "127.0.0.1":
            break
        if host_ip in ("", "0.0.0.0"):  # noqa: S104 - chỉ so chuỗi, không mở cổng
            break
    else:
        mo = [f"{h or '*'}:{c}" for h, c in tt.cong_may] or ["không mở cổng nào"]
        return False, (
            f"DATABASE_URL trỏ {host}:{cong_url} nhưng {CONTAINER_DB} mở {', '.join(mo)}"
        )
    return True, f"{CONTAINER_DB} đang chạy trên {TEN_VOLUME_THU}, cổng {host}:{cong_url}"


def lenh_compose(*args: str) -> list[str]:
    """Mọi lệnh compose đi qua đây để luôn mang ``-p livelift``."""
    tep: list[str] = []
    if _COMPOSE_PHU is not None:
        tep = ["-f", str(REPO_ROOT / "docker-compose.yml"), "-f", str(_COMPOSE_PHU)]
    return ["docker", "compose", "-p", DU_AN, *tep, *args]


def tao_compose_thu() -> Path:
    """Ghi tệp compose phụ của ``--volume-thu`` vào thư mục tạm, trả đường dẫn."""
    p = Path(tempfile.gettempdir()) / "livelift-compose-volume-thu.yml"
    p.write_text(COMPOSE_THU, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# Lệnh ngoài
# ---------------------------------------------------------------------------


def _run(
    cmd: list[str],
    timeout: int = 300,
    env: dict[str, str] | None = None,
    input_text: str | None = None,
) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(  # noqa: S603 - lệnh cố định trong tệp này
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            env=env,
            input=input_text,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        return subprocess.CompletedProcess(cmd, 124, "", str(exc))


def _docker_ready() -> tuple[bool, str]:
    if shutil.which("docker") is None:
        return False, "không tìm thấy lệnh 'docker' trong PATH, Docker chưa được cài."
    probe = _run(["docker", "info", "--format", "{{.ServerVersion}}"], timeout=60)
    if probe.returncode != 0 or not probe.stdout.strip():
        return False, (
            "có lệnh 'docker' nhưng máy chủ Docker chưa chạy. Trên Windows: mở "
            "Docker Desktop và đợi biểu tượng chuyển xanh, rồi chạy lại script này."
        )
    return True, probe.stdout.strip()


def _mo_docker_desktop() -> bool:
    """Mở Docker Desktop (tiến trình tách rời). True nếu đã gọi được tệp chạy."""
    exe = Path(os.environ.get("DOCKER_DESKTOP_EXE") or DOCKER_DESKTOP_EXE)
    if os.name != "nt" or not exe.is_file():
        return False
    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
        subprocess, "CREATE_NEW_PROCESS_GROUP", 0
    )
    try:
        subprocess.Popen(  # noqa: S603 - đường dẫn cố định hoặc do người vận hành đặt
            [str(exe)], creationflags=flags, close_fds=True
        )
    except OSError:
        return False
    return True


def _cho_docker(timeout_s: float, buoc_s: float = 3.0) -> tuple[bool, str]:
    han = time.monotonic() + timeout_s
    detail = ""
    while time.monotonic() < han:
        ok, detail = _docker_ready()
        if ok:
            return True, detail
        time.sleep(buoc_s)
    return False, detail


def o_c_con_trong_gb() -> float | None:
    """Dung lượng trống của ổ C (GB). None khi không phải Windows."""
    if os.name != "nt":
        return None
    try:
        return shutil.disk_usage("C:\\").free / 1024**3
    except OSError:
        return None


def _ai_giu_cong_factory(docker_chay: bool) -> Callable[[int], str | None]:
    theo_docker: dict[int, str] = {}
    if docker_chay:
        ps = _run(["docker", "ps", "--format", "{{.Names}}|{{.Ports}}"], timeout=30)
        if ps.returncode == 0:
            theo_docker = phan_tich_docker_ps(ps.stdout)

    def ai_giu(cong: int) -> str | None:
        if cong in theo_docker:
            return theo_docker[cong]
        if cong_dang_nghe(cong):
            return "một tiến trình ngoài Docker"
        return None

    return ai_giu


def container_livelift() -> list[tuple[str, str, str]]:
    """(tên, chính sách restart, trạng thái) của mọi container dự án livelift."""
    ds = _run(
        [
            "docker",
            "ps",
            "-a",
            "--filter",
            f"label=com.docker.compose.project={DU_AN}",
            "--format",
            "{{.Names}}",
        ],
        timeout=30,
    )
    ten = [t.strip() for t in ds.stdout.splitlines() if t.strip()] if ds.returncode == 0 else []
    if not ten:
        return []
    info = _run(
        [
            "docker",
            "inspect",
            "--format",
            "{{.Name}}|{{.HostConfig.RestartPolicy.Name}}|{{.State.Status}}",
            *ten,
        ],
        timeout=30,
    )
    out: list[tuple[str, str, str]] = []
    for line in info.stdout.splitlines():
        parts = line.strip().lstrip("/").split("|")
        if len(parts) == 3:
            out.append((parts[0], parts[1], parts[2]))
    return out


def container_du_an_khac() -> list[str]:
    """Container ĐANG CHẠY không thuộc livelift. Chỉ đọc để báo, không đụng tới."""
    ps = _run(
        [
            "docker",
            "ps",
            "--format",
            '{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Ports}}',
        ],
        timeout=30,
    )
    out: list[str] = []
    for line in ps.stdout.splitlines() if ps.returncode == 0 else []:
        parts = line.split("|", 2)
        if len(parts) == 3 and parts[1] != DU_AN:
            du_an = f" (dự án {parts[1]})" if parts[1] else ""
            cong = f" cổng {parts[2]}" if parts[2] else ""
            out.append(f"{parts[0]}{du_an}{cong}")
    return out


def _in_container_tu_khoi_dong() -> None:
    ds = container_livelift()
    tu_chay = [c for c in ds if c[1] in ("unless-stopped", "always")]
    print()
    if tu_chay:
        print("  Báo M: container dự án livelift đặt restart tự động. Docker Desktop khởi động")
        print("  là chúng chạy lại, trừ cái đã bị dừng tay")
        print("  ('docker compose -p livelift stop <dịch vụ>'):")
        for ten, pol, st in tu_chay:
            print(f"    - {ten:<22} restart={pol:<15} trạng thái={st}")
    else:
        print("  Không có container nào của dự án livelift đặt restart tự động.")
    khac = container_du_an_khac()
    if khac:
        print("  Container của dự án KHÁC đang chạy (script không đụng tới, chỉ báo):")
        for c in khac:
            print(f"    - {c}")


def doc_tinh_trang_db(container: str = CONTAINER_DB) -> TinhTrangDb | None:
    """``docker inspect`` CHỈ ĐỌC container db. None khi không có container hay Docker."""
    res = _run(["docker", "inspect", "--format", FORMAT_INSPECT_DB, container], timeout=30)
    if res.returncode != 0:
        return None
    return phan_tich_inspect_db(res.stdout)


def volume_ton_tai(ten: str) -> bool | None:
    """``docker volume inspect`` CHỈ ĐỌC. True/False, None khi không trả lời được."""
    res = _run(["docker", "volume", "inspect", "--format", "{{.Name}}", ten], timeout=30)
    if res.returncode == 0:
        return True
    if "no such volume" in (res.stderr or res.stdout).lower():
        return False
    return None


def cay_chinh() -> Path | None:
    """Thư mục cây làm việc chính của repo (nơi có ``.env`` gốc). None khi không rõ."""
    res = _run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], timeout=15)
    if res.returncode != 0 or not res.stdout.strip():
        return None
    return Path(res.stdout.strip()).parent


def _in_volume_dang_gan(container: str) -> str:
    """In một dòng 'volume đang gắn', trả loại ('that'|'thu'|'khac'|'khong')."""
    loai, mo_ta = loai_volume(doc_tinh_trang_db(container))
    dau = {"that": "✓", "thu": "✗", "khac": "!", "khong": "!"}[loai]
    print(f"  {dau} Volume dữ liệu của {container}: {mo_ta}")
    if loai == "thu":
        print("    Container đang ở volume THỬ: bật lên là chạy trên dữ liệu thử, không phải")
        print("    dữ liệu thật. Xong việc thử: bat_postgres.py --ve-volume-that; bật trên")
        print("    volume thật: chạy lại bat_postgres.py không có --volume-thu.")
    return loai


def _wait_healthy(container: str, timeout_s: int) -> bool:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        probe = _run(
            ["docker", "inspect", "--format", "{{.State.Health.Status}}", container], timeout=30
        )
        if probe.stdout.strip() == "healthy":
            return True
        time.sleep(2)
    return False


def _thu_ket_noi(url: str) -> tuple[str, str]:
    """Kết nối thử. Trả ('ok'|'sai_mat_khau'|'loi', chi tiết đã che mật khẩu)."""
    try:
        import psycopg
    except ImportError:
        return "loi", "thiếu psycopg (pip install -e '.[server]')"
    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            conn.execute("SELECT 1")
    except psycopg.OperationalError as exc:
        msg = che_mat_khau(str(exc).strip().splitlines()[0] if str(exc).strip() else repr(exc))
        if "password authentication failed" in str(exc):
            return "sai_mat_khau", msg
        return "loi", msg
    return "ok", ""


def _trang_thai_migration(url: str) -> tuple[list[int], list[int]] | None:
    """(đã áp, còn thiếu) — CHỈ ĐỌC, không tạo bảng. None khi không đọc được."""
    try:
        import psycopg

        from livelift.dbops.migrate import load_migrations
    except ImportError:
        return None
    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            try:
                rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
            except psycopg.errors.UndefinedTable:
                rows = []
    except psycopg.Error:
        return None
    da_ap = sorted(r[0] for r in rows)
    thieu = [m.version for m in load_migrations() if m.version not in set(da_ap)]
    return da_ap, thieu


def _migrate_up(url: str) -> tuple[bool, str]:
    """Chạy migrate TRONG tiến trình này, từ mã của chính cây làm việc này.

    Không gọi ``livelift-migrate``: trong worktree, lệnh ấy (cài editable từ cây
    chính) nạp migration của cây chính, không phải của nhánh đang dựng.
    """
    try:
        import psycopg

        from livelift.dbops.migrate import load_migrations, migrate_up
    except ImportError as exc:
        return False, f"thiếu thư viện: {exc}"
    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            applied = migrate_up(conn, load_migrations())
    except Exception as exc:  # noqa: BLE001 - báo nguyên nhân, đã che mật khẩu
        return False, che_mat_khau(str(exc))[:1500]
    return True, (f"đã áp {applied}" if applied else "không có migration mới")


def _dong_bo_mat_khau(user: str, db: str, mat_khau: str) -> tuple[bool, str]:
    """Đặt lại mật khẩu của ``user`` trong container db cho khớp ``.env``.

    Đi qua socket nội bộ của container (pg_hba của ảnh postgres tin kết nối
    local), SQL gửi qua stdin nên mật khẩu không nằm trên dòng lệnh.
    """
    sql = f"ALTER ROLE \"{user}\" PASSWORD '{mat_khau.replace(chr(39), chr(39) * 2)}';\n"
    res = _run(
        lenh_compose("exec", "-T", "db", "psql", "--set=ON_ERROR_STOP=1", "-U", user, "-d", db),
        timeout=60,
        input_text=sql,
    )
    if res.returncode != 0:
        return False, (res.stderr or res.stdout).strip()[:500]
    return True, ""


def _fallback_notice() -> None:
    try:
        from livelift.config import get_settings

        s = get_settings()
        interval_s, path = s.store_snapshot_interval_s, s.store_snapshot_path
    except Exception:  # noqa: BLE001 - lời khuyên vẫn phải in được
        interval_s, path = 30.0, "data/snapshot/livelift-store.json"
    print()
    print("  ĐƯỜNG LUI AN TOÀN: kho memory + ảnh chụp định kỳ:")
    print("    Không có Postgres thì KHÔNG được chạy kho memory trần. Ảnh chụp đang")
    print(f"    bật sẵn theo mặc định: ghi {path} mỗi {interval_s:.0f} giây, tự nạp lại")
    print("    khi khởi động. Khởi động lại chỉ mất tối đa chu kỳ đó, không mất cả phiên.")
    print("    Kiểm tra bằng:  curl -s http://127.0.0.1:8000/health   → storage_mode")
    print("    Đọc thêm: docs/luu-tru-du-lieu.md")


# ---------------------------------------------------------------------------
# Luồng chính
# ---------------------------------------------------------------------------


def _doc_cong(gia_tri: str | None) -> int | None:
    if not gia_tri:
        return None
    try:
        cong = int(gia_tri)
    except ValueError:
        return None
    return cong if 1 <= cong <= 65535 else None


def _in_bien_api(url: str) -> None:
    print()
    print("  Kho đã sẵn sàng. API phải chạy với HAI biến (thiếu STORE_BACKEND là vẫn chạy RAM,")
    print("  sự cố 25/08/2026):")
    print()
    print("    STORE_BACKEND=postgres")
    print(f"    DATABASE_URL={che_mat_khau(url)}")
    print()
    print("  DATABASE_URL đầy đủ (có mật khẩu) đã nằm trong .env của repo; pydantic tự đọc khi")
    print("  chạy từ thư mục repo. Chỉ cần thêm STORE_BACKEND, và PYTHONPATH để nạp mã của")
    print("  CHÍNH cây này (venv cài editable từ cây chính thì không có nó sẽ nạp mã cây chính):")
    src = REPO_ROOT / "src"
    py = sys.executable
    print(f'    PowerShell:  $env:STORE_BACKEND = "postgres"; $env:PYTHONPATH = "{src}"')
    print(f'    Bash:        export STORE_BACKEND=postgres PYTHONPATH="{src.as_posix()}"')
    print(f"    rồi (ở {REPO_ROOT}):")
    print(f'                 "{py}" -m uvicorn livelift.api.main:app --port 8000')
    print()
    print("  Xác nhận (đừng tin, hãy đo):")
    print("    curl -s http://127.0.0.1:8000/health    → store_backend=postgres, durable=true")
    print(f'    "{py}" scripts/kiem_chung_ben_vung.py --backend postgres')


def kiem(args: argparse.Namespace) -> int:
    """``--kiem``: chỉ đọc. Không mở Docker, không ghi .env, không dựng gì."""
    print("== Kiểm kho bền vững (PostgreSQL), chế độ chỉ đọc ==")
    env_tep = doc_env(TEP_ENV)
    con = o_c_con_trong_gb()
    if con is not None:
        dau = "✓" if con >= O_C_TOI_THIEU_GB else "✗"
        print(f"  {dau} Ổ C còn {con:.1f} GB (ngưỡng {O_C_TOI_THIEU_GB:.0f} GB)")
    ready, detail = _docker_ready()
    print(f"  {'✓' if ready else '✗'} Docker: {detail}")
    cong_cfg_raw, nguon_cong = lay_bien("LIVELIFT_DB_PORT", env_tep)
    cong, ly_do = chon_cong(_doc_cong(cong_cfg_raw), _ai_giu_cong_factory(ready))
    print(f"  {'✓' if cong else '✗'} Cổng db: {cong if cong else 'không có'} ({ly_do})")
    pw, nguon_pw = lay_bien("POSTGRES_PASSWORD", env_tep)
    print(
        f"  {'✓' if pw else '✗'} POSTGRES_PASSWORD: {'có (' + nguon_pw + ')' if pw else 'CHƯA có'}"
    )
    url, nguon_url = lay_bien("DATABASE_URL", env_tep)
    if url:
        print(f"  ✓ DATABASE_URL ({nguon_url}): {che_mat_khau(url)}")
    else:
        print("  ✗ DATABASE_URL chưa đặt")
    sb, nguon_sb = lay_bien("STORE_BACKEND", env_tep)
    print(
        f"  {'✓' if sb == 'postgres' else '!'} STORE_BACKEND: "
        f"{sb + ' (' + nguon_sb + ')' if sb else 'chưa đặt (API sẽ chạy kho memory)'}"
    )
    if not ready:
        _fallback_notice()
        return 2
    trang_thai = _run(
        [
            "docker",
            "inspect",
            "--format",
            "{{.State.Status}}/{{.State.Health.Status}}",
            CONTAINER_DB,
        ],
        timeout=30,
    )
    st = trang_thai.stdout.strip() if trang_thai.returncode == 0 else "chưa có container"
    print(f"  {'✓' if st == 'running/healthy' else '✗'} {CONTAINER_DB}: {st}")
    san_sang = st == "running/healthy"
    if _in_volume_dang_gan(CONTAINER_DB) == "thu":
        san_sang = False
    if san_sang and url:
        kq, chi_tiet = _thu_ket_noi(url)
        if kq == "ok":
            mig = _trang_thai_migration(url)
            if mig is None:
                print("  ✗ Không đọc được trạng thái migration")
                san_sang = False
            else:
                da_ap, thieu = mig
                print(f"  {'✓' if not thieu else '✗'} Migration: đã áp {da_ap}, còn thiếu {thieu}")
                san_sang = not thieu
        else:
            print(f"  ✗ Kết nối DATABASE_URL hỏng: {chi_tiet}")
            san_sang = False
    elif san_sang:
        san_sang = False
    _in_container_tu_khoi_dong()
    print()
    print(
        "  KẾT LUẬN:",
        "kho bền vững SẴN SÀNG" if san_sang else "CHƯA sẵn sàng (chạy không có --kiem)",
    )
    return 0 if san_sang else 1


def bat(args: argparse.Namespace) -> int:
    global _COMPOSE_PHU
    print("== Bật kho bền vững (PostgreSQL) ==")

    con = o_c_con_trong_gb()
    if con is not None and con < O_C_TOI_THIEU_GB:
        print(f"  ✗ Ổ C chỉ còn {con:.1f} GB (< {O_C_TOI_THIEU_GB:.0f} GB). Dừng lại theo D-019:")
        print("    ảnh đĩa của Docker Desktop nằm trên ổ C. Dọn ổ C rồi chạy lại.")
        return 1

    ready, detail = _docker_ready()
    if not ready and shutil.which("docker") is not None and not args.khong_bat_docker:
        print("  … Máy chủ Docker chưa chạy, đang mở Docker Desktop")
        if _mo_docker_desktop():
            print(f"    chờ 'docker info' tối đa {args.cho_docker_s:.0f} giây")
            ready, detail = _cho_docker(args.cho_docker_s)
        else:
            detail = f"không mở được Docker Desktop ({DOCKER_DESKTOP_EXE})"
    if not ready:
        print(f"  ✗ Docker KHÔNG dùng được: {detail}")
        _fallback_notice()
        return 2
    print(f"  ✓ Docker đang chạy (máy chủ {detail})")

    env_tep = doc_env(TEP_ENV)

    # --- mật khẩu: kiểm TRƯỚC khi ghi bất cứ gì vào .env ---------------------
    ten_volume = TEN_VOLUME_THU if args.volume_thu else TEN_VOLUME_THAT
    if not lay_bien("POSTGRES_PASSWORD", env_tep)[0]:
        co_volume = volume_ton_tai(ten_volume)
        if co_volume is not False:
            _in_huong_dan_thieu_mat_khau(ten_volume, co_volume, args.volume_thu)
            return 1

    # --- cổng ------------------------------------------------------------
    cong_cfg_raw, _ = lay_bien("LIVELIFT_DB_PORT", env_tep)
    if cong_cfg_raw and _doc_cong(cong_cfg_raw) is None:
        print(f"  ✗ LIVELIFT_DB_PORT không phải số cổng hợp lệ: {cong_cfg_raw!r}")
        return 1
    cong, ly_do = chon_cong(_doc_cong(cong_cfg_raw), _ai_giu_cong_factory(True))
    if cong is None:
        print(f"  ✗ Không có cổng trống cho db: {ly_do}")
        print("    Đặt LIVELIFT_DB_PORT=<cổng trống> trong .env rồi chạy lại.")
        return 1
    print(f"  ✓ Cổng db: 127.0.0.1:{cong} ({ly_do})")
    if not env_tep.get("LIVELIFT_DB_PORT") and not os.environ.get("LIVELIFT_DB_PORT"):
        # Ghi lại để lần 'docker compose -p livelift up' sau (kể cả gõ tay) không
        # dựng lại container sang cổng khác.
        ghi_bien_env(TEP_ENV, "LIVELIFT_DB_PORT", str(cong))
        print(f"  ✓ Đã ghi LIVELIFT_DB_PORT={cong} vào .env")

    # --- mật khẩu --------------------------------------------------------
    user = lay_bien("POSTGRES_USER", env_tep)[0] or "livelift"
    db = lay_bien("POSTGRES_DB", env_tep)[0] or "livelift"
    mat_khau, nguon_pw = lay_bien("POSTGRES_PASSWORD", env_tep)
    if not mat_khau:
        # chỉ tới được đây khi volume CHƯA tồn tại: Postgres sẽ khởi tạo bằng mật khẩu này
        mat_khau = tao_mat_khau()
        ghi_bien_env(TEP_ENV, "POSTGRES_PASSWORD", mat_khau)
        print(f"  ✓ Volume {ten_volume} chưa có: đã sinh POSTGRES_PASSWORD ngẫu nhiên, ghi .env")
        print("    (không in ra)")
    else:
        print(f"  ✓ POSTGRES_PASSWORD đã có ({nguon_pw}, không in ra)")
        if mat_khau == MAT_KHAU_MAU:
            print("    ! Đây là mật khẩu mẫu của .env.example. Nên đổi trước khi đưa máy ra ngoài.")

    # --- DATABASE_URL ----------------------------------------------------
    url = dung_database_url(user, mat_khau, cong, db)
    url_cu, nguon_url = lay_bien("DATABASE_URL", env_tep)
    if url_cu is None:
        ghi_bien_env(TEP_ENV, "DATABASE_URL", url)
        print(f"  ✓ Đã ghi DATABASE_URL vào .env: {che_mat_khau(url)}")
    elif url_cu != url:
        if nguon_url == ".env" and la_may_nay(url_cu):
            ghi_bien_env(TEP_ENV, "DATABASE_URL", url)
            print(f"  ✓ Đã cập nhật DATABASE_URL trong .env cho khớp db: {che_mat_khau(url)}")
        else:
            print(f"  ! DATABASE_URL ({nguon_url}) = {che_mat_khau(url_cu)} KHÁC db vừa dựng.")
            print(f"    Script migrate trên {che_mat_khau(url)}; API vẫn đọc giá trị cũ.")

    # --- dựng db ---------------------------------------------------------
    if args.volume_thu:
        _COMPOSE_PHU = tao_compose_thu()
        print(f"  ! Dựng db trên volume THỬ {TEN_VOLUME_THU}, không chạm {TEN_VOLUME_THAT}.")
        print("    Container thử đặt restart=no: Docker Desktop khởi động lại không tự bật nó.")
    env_con = dict(os.environ)
    env_con["LIVELIFT_DB_PORT"] = str(cong)
    env_con["POSTGRES_PASSWORD"] = mat_khau
    up = _run(lenh_compose("up", "-d", "db"), timeout=900, env=env_con)
    if up.returncode != 0:
        print("  ✗ 'docker compose -p livelift up -d db' thất bại:")
        print(che_mat_khau((up.stderr or up.stdout).strip())[:1500])
        return 1
    print("  ✓ Đã dựng dịch vụ 'db' (docker compose -p livelift up -d db)")

    if not _wait_healthy(args.container, HEALTHY_TIMEOUT_S):
        print(f"  ✗ Container {args.container} không đạt healthy sau {HEALTHY_TIMEOUT_S}s")
        print("    Xem nhật ký:  docker compose -p livelift logs db --tail 50")
        return 1
    print(f"  ✓ {args.container} healthy, cổng 127.0.0.1:{cong}")

    kq, chi_tiet = _thu_ket_noi(url)
    if kq == "sai_mat_khau" and args.dong_bo_mat_khau:
        ok, loi = _dong_bo_mat_khau(user, db, mat_khau)
        if not ok:
            print(f"  ✗ Không đặt lại được mật khẩu trong container: {che_mat_khau(loi)}")
            return 1
        print("  ✓ Đã đặt lại mật khẩu của user trong db cho khớp .env")
        kq, chi_tiet = _thu_ket_noi(url)
    if kq == "sai_mat_khau":
        print("  ✗ db từ chối mật khẩu trong .env. Volume pgdata của dự án livelift đã được")
        print("    khởi tạo từ trước bằng mật khẩu khác (Postgres chỉ đọc POSTGRES_PASSWORD")
        print("    lần đầu). Script KHÔNG xoá volume. Chọn một trong hai:")
        print("      - đặt POSTGRES_PASSWORD trong .env bằng mật khẩu cũ rồi chạy lại")
        print("        (DATABASE_URL trỏ 127.0.0.1 trong .env tự cập nhật theo);")
        print("      - chạy lại với --dong-bo-mat-khau để đặt mật khẩu của db theo .env")
        print("        (mọi cây làm việc khác dùng chung volume phải đổi .env theo).")
        return 1
    if kq != "ok":
        print(f"  ✗ Không kết nối được db: {chi_tiet}")
        return 1
    print("  ✓ Kết nối db bằng DATABASE_URL được")

    if not args.skip_migrate:
        ok, chi_tiet = _migrate_up(url)
        if not ok:
            print("  ✗ Chạy migrate thất bại:")
            print(chi_tiet)
            return 1
        print(f"  ✓ Migrate xong: {chi_tiet}")

    _in_bien_api(url)
    _in_container_tu_khoi_dong()
    print()
    loai = _in_volume_dang_gan(args.container)
    if args.volume_thu or loai == "thu":
        print()
        print(f"  !!! {args.container} ĐANG Ở VOLUME THỬ {TEN_VOLUME_THU}. Chỉ dùng để thử migrate")
        print("      (pytest -m db). Đừng chạy demo trên nó. Xong việc thử, chạy:")
        print("        bat_postgres.py --ve-volume-that")
        print(f"      (dựng lại container trên {TEN_VOLUME_THAT}, KHÔNG khởi động, không xoá")
        print("      volume nào; cả hai volume còn nguyên).")
    return 0


def _in_huong_dan_thieu_mat_khau(ten_volume: str, co_volume: bool | None, thu: bool) -> None:
    if co_volume is None:
        print(f"  ✗ .env chưa có POSTGRES_PASSWORD và không kiểm được volume {ten_volume} có chưa")
        print("    ('docker volume inspect' không trả lời). Không sinh mật khẩu, không ghi .env.")
    else:
        print(f"  ✗ .env chưa có POSTGRES_PASSWORD nhưng volume {ten_volume} ĐÃ CÓ dữ liệu.")
        print("    Postgres chỉ đọc mật khẩu ở lần khởi tạo đầu, mật khẩu sinh mới chắc chắn")
        print("    lệch. Script dừng, KHÔNG sinh mật khẩu, KHÔNG ghi .env.")
    goc = cay_chinh()
    print("    Cách sửa, chọn một:")
    if goc is not None and goc.resolve() != REPO_ROOT.resolve() and not thu:
        print(f"      - chép dòng POSTGRES_PASSWORD từ {goc / '.env'} (cây chính)")
        print(f"        sang {TEP_ENV} rồi chạy lại (đừng in mật khẩu ra màn hình);")
    else:
        print(f"      - đặt POSTGRES_PASSWORD trong {TEP_ENV} bằng mật khẩu đã khởi tạo")
        print(f"        {ten_volume} (người dựng volume này giữ nó) rồi chạy lại;")
    if not thu:
        print(f"      - hoặc chạy với --volume-thu để dựng db trên volume thử {TEN_VOLUME_THU}.")


def ve_volume_that(args: argparse.Namespace) -> int:
    """``--ve-volume-that``: dựng lại container db trên volume thật, KHÔNG khởi động."""
    print("== Đưa db về volume thật (không khởi động) ==")
    ready, detail = _docker_ready()
    if not ready:
        print(f"  ✗ Docker KHÔNG dùng được: {detail}")
        return 2
    tt = doc_tinh_trang_db(args.container)
    loai, mo_ta = loai_volume(tt)
    if loai != "thu":
        print(f"  ✓ {args.container}: {mo_ta}. Không ở volume thử, không làm gì.")
        return 0
    print(f"  ! {args.container} đang gắn {mo_ta}, trạng thái {tt.trang_thai if tt else '?'}")
    # Tệp compose gốc, không tệp phụ: compose thấy cấu hình khác nên dựng lại container
    # trên volume pgdata. --no-start: không bật Postgres, không đụng dữ liệu nào.
    up = _run(lenh_compose("up", "--no-start", "db"), timeout=600)
    if up.returncode != 0:
        print("  ✗ 'docker compose -p livelift up --no-start db' thất bại:")
        print(che_mat_khau((up.stderr or up.stdout).strip())[:1500])
        return 1
    tt2 = doc_tinh_trang_db(args.container)
    loai2, mo_ta2 = loai_volume(tt2)
    if loai2 != "that":
        print(f"  ✗ Sau khi dựng lại, {args.container} vẫn gắn: {mo_ta2}")
        return 1
    print(f"  ✓ {args.container} gắn {mo_ta2}, trạng thái {tt2.trang_thai if tt2 else '?'}")
    print(f"    (chưa chạy). Volume {TEN_VOLUME_THU} vẫn còn, không xoá.")
    print("  Bật trên volume thật: .env phải có POSTGRES_PASSWORD đã khởi tạo")
    print(f"  {TEN_VOLUME_THAT} (chép từ .env cây chính), rồi chạy bat_postgres.py không cờ.")
    return 0


def main(argv: list[str] | None = None) -> int:
    configure()
    parser = argparse.ArgumentParser(description="Bật PostgreSQL cho LiveLift (dự án -p livelift)")
    parser.add_argument("--container", default=CONTAINER_DB, help="tên container cơ sở dữ liệu")
    parser.add_argument("--skip-migrate", action="store_true")
    parser.add_argument("--kiem", action="store_true", help="chỉ kiểm, không bật hay ghi gì")
    parser.add_argument(
        "--khong-bat-docker",
        action="store_true",
        help="không tự mở Docker Desktop khi máy chủ Docker chưa chạy",
    )
    parser.add_argument(
        "--cho-docker-s",
        type=float,
        default=CHO_DOCKER_S,
        help=f"thời gian chờ 'docker info' sau khi mở Docker Desktop (mặc định {CHO_DOCKER_S})",
    )
    parser.add_argument(
        "--volume-thu",
        action="store_true",
        help=f"dựng db trên volume riêng {DU_AN}_{VOLUME_THU} (thử migrate, không chạm dữ liệu)",
    )
    parser.add_argument(
        "--ve-volume-that",
        action="store_true",
        help=f"xong việc thử: dựng lại container db trên {DU_AN}_{VOLUME_THAT}, KHÔNG khởi động",
    )
    parser.add_argument(
        "--dong-bo-mat-khau",
        action="store_true",
        help="db từ chối mật khẩu trong .env thì đặt lại mật khẩu của db theo .env",
    )
    args = parser.parse_args(argv)
    if args.kiem:
        return kiem(args)
    if args.ve_volume_that:
        return ve_volume_that(args)
    return bat(args)


if __name__ == "__main__":
    raise SystemExit(main())

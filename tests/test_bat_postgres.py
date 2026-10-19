"""``scripts/bat_postgres.py`` (D-019, 19/10/2026): một lệnh bật PostgreSQL mà không phá máy.

Script chạm Docker và ``.env`` trên máy người vận hành, nên test giữ các luật sau:

1. mọi lệnh Docker chỉ nhắm dự án ``-p livelift``; trong mã không có ``down``,
   ``prune``, ``rm``, ``kill``, ``stop`` (quét cây cú pháp, không tin lời chú thích);
2. ``--kiem`` không mở Docker Desktop, không dựng gì, không ghi ``.env``;
3. mật khẩu sinh ngẫu nhiên, ghi vào ``.env`` và KHÔNG BAO GIỜ xuất hiện trên màn
   hình (``DATABASE_URL`` in ra đều đã che);
4. 5432 bận thì dùng 5433, cổng chọn được đi vào cả ``.env`` lẫn lệnh compose;
5. dòng ``STORE_BACKEND=postgres`` luôn được in khi kho sẵn sàng (sự cố 25/08).

Một test mang ``pytest.mark.db`` chạy migrate up → down → up trên PostgreSQL thật,
CHỈ khi ``LIVELIFT_DB_THU=1`` VÀ ``docker inspect`` (chỉ đọc) xác minh được
``livelift-db-1`` đang chạy trên volume ``livelift_pgdata_thu`` đúng cổng của
``DATABASE_URL`` (``down`` xoá bảng; volume thử dựng bằng ``bat_postgres.py
--volume-thu``, xong thì ``--ve-volume-that``). Không xác minh được thì SKIP.

6. volume ``livelift_pgdata`` đã có mà ``.env`` thiếu mật khẩu thì dừng, không sinh
   mật khẩu, không ghi ``.env``; ``--kiem`` báo volume đang gắn, gặp volume thử là
   CHƯA sẵn sàng.
"""

from __future__ import annotations

import ast
import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest

GOC = Path(__file__).resolve().parents[1]
SCRIPT = GOC / "scripts" / "bat_postgres.py"


@pytest.fixture(scope="module")
def bp():
    spec = importlib.util.spec_from_file_location("bat_postgres", SCRIPT)
    assert spec is not None
    assert spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    try:
        spec.loader.exec_module(mod)
        yield mod
    finally:
        sys.modules.pop(spec.name, None)


# ---------------------------------------------------------------------------
# Hàm thuần
# ---------------------------------------------------------------------------


def test_ghi_bien_env_thay_dong_cu_giu_dong_khac_va_kieu_xuong_dong(bp, tmp_path):
    env = tmp_path / ".env"
    env.write_bytes(
        b"# chu thich\r\nPOSTGRES_USER=livelift\r\nPOSTGRES_PASSWORD=cu\r\n"
        b"OTHER=1\r\nPOSTGRES_PASSWORD=trung\r\n"
    )
    bp.ghi_bien_env(env, "POSTGRES_PASSWORD", "moi")
    raw = env.read_bytes()
    assert b"\r\n" in raw
    assert raw.replace(b"\r\n", b"").count(b"\n") == 0
    assert bp.doc_env(env) == {
        "POSTGRES_USER": "livelift",
        "POSTGRES_PASSWORD": "moi",
        "OTHER": "1",
    }
    text = raw.decode()
    assert text.startswith("# chu thich")
    assert text.count("POSTGRES_PASSWORD=") == 1
    # chạy lại không đổi gì
    bp.ghi_bien_env(env, "POSTGRES_PASSWORD", "moi")
    assert env.read_bytes() == raw


def test_ghi_bien_env_tao_tep_khi_chua_co(bp, tmp_path):
    env = tmp_path / ".env"
    bp.ghi_bien_env(env, "LIVELIFT_DB_PORT", "5433")
    assert bp.doc_env(env) == {"LIVELIFT_DB_PORT": "5433"}


def test_doc_env_bo_ngoac_va_export(bp, tmp_path):
    env = tmp_path / ".env"
    env.write_text("export A='x y'\nB=\"z\"\n# C=1\n\nD\n", encoding="utf-8")
    assert bp.doc_env(env) == {"A": "x y", "B": "z"}


@pytest.mark.parametrize(
    ("url", "ra"),
    [
        (
            "postgresql://livelift:bi-mat_123@127.0.0.1:5433/livelift",
            "postgresql://livelift:***@127.0.0.1:5433/livelift",
        ),
        ("postgresql://u:p%40ss@db:5432/x", "postgresql://u:***@db:5432/x"),
        ("postgresql://127.0.0.1:5432/x", "postgresql://127.0.0.1:5432/x"),
        # mật khẩu chép tay có '@' ':' '/' '#' chưa mã hoá: không lộ mảnh nào
        (
            "postgresql://livelift:a@b:c/d#e@127.0.0.1:5432/livelift",
            "postgresql://livelift:***@127.0.0.1:5432/livelift",
        ),
        (
            "lỗi kết nối postgresql://u:x@y@127.0.0.1:5432/db, thử lại",
            "lỗi kết nối postgresql://u:***@127.0.0.1:5432/db, thử lại",
        ),
    ],
)
def test_che_mat_khau(bp, url, ra):
    assert bp.che_mat_khau(url) == ra


def test_dung_database_url_ma_hoa_ky_tu_dac_biet(bp):
    from urllib.parse import unquote, urlsplit

    pw = "a@b:c/d#e%f"
    url = bp.dung_database_url("live lift", pw, 5433, "livelift")
    parts = urlsplit(url)
    assert parts.hostname == "127.0.0.1"
    assert parts.port == 5433
    assert unquote(parts.password or "") == pw
    assert unquote(parts.username or "") == "live lift"
    assert pw not in bp.che_mat_khau(url)
    assert "a%40b" not in bp.che_mat_khau(url)


# ---------------------------------------------------------------------------
# Xác minh volume thử (chốt chặn của test db) và volume đang gắn
# ---------------------------------------------------------------------------


def _inspect(vols, status="running", ports=(("127.0.0.1", "5432"),)) -> str:
    import json

    return json.dumps(
        {
            "mounts": [{"Type": "volume", "Name": v, "Destination": "/d"} for v in vols]
            + [{"Type": "bind", "Source": "C:/x", "Destination": "/b"}],
            "status": status,
            "ports": {"5432/tcp": [{"HostIp": h, "HostPort": p} for h, p in ports]},
        }
    )


URL_THU = "postgresql://livelift:pw@127.0.0.1:5432/livelift"


def test_phan_tich_inspect_db(bp):
    tt = bp.phan_tich_inspect_db(_inspect(["livelift_pgdata_thu"]) + "\n")
    assert tt.volumes == ("livelift_pgdata_thu",)  # bind mount không tính
    assert tt.trang_thai == "running"
    assert tt.cong_may == (("127.0.0.1", 5432),)
    assert bp.phan_tich_inspect_db("") is None
    assert bp.phan_tich_inspect_db("Error: No such object") is None
    # container đã dừng: docker vẫn trả PortBindings đã cấu hình
    tt = bp.phan_tich_inspect_db('{"mounts":[],"status":"exited","ports":null}')
    assert tt.cong_may == ()
    assert tt.trang_thai == "exited"


def test_xac_minh_volume_thu_dat_khi_du_bang_chung(bp):
    tt = bp.phan_tich_inspect_db(_inspect(["livelift_pgdata_thu"]))
    ok, ly_do = bp.xac_minh_volume_thu(tt, URL_THU)
    assert ok, ly_do
    tt = bp.phan_tich_inspect_db(_inspect(["livelift_pgdata_thu"], ports=(("0.0.0.0", "5433"),)))
    assert bp.xac_minh_volume_thu(tt, "postgresql://u:p@localhost:5433/x")[0]


@pytest.mark.parametrize(
    ("vols", "status", "ports", "url", "can_co"),
    [
        (["livelift_pgdata"], "running", (("127.0.0.1", "5432"),), URL_THU, "THẬT"),
        (
            ["livelift_pgdata_thu", "livelift_pgdata"],
            "running",
            (("127.0.0.1", "5432"),),
            URL_THU,
            "THẬT",
        ),
        (["livelift_pgdata_thu"], "exited", (("127.0.0.1", "5432"),), URL_THU, "không chạy"),
        (["khac_data"], "running", (("127.0.0.1", "5432"),), URL_THU, "không gắn"),
        # cổng lệch: URL trỏ một Postgres khác trên máy, không phải container thử
        (["livelift_pgdata_thu"], "running", (("127.0.0.1", "5433"),), URL_THU, "mở"),
        (
            ["livelift_pgdata_thu"],
            "running",
            (("127.0.0.1", "5432"),),
            "postgresql://u:p@db.xa:5432/livelift",
            "db.xa",
        ),
        # 'localhost' có thể đi ::1 tới một Postgres khác; container chỉ mở 127.0.0.1
        (
            ["livelift_pgdata_thu"],
            "running",
            (("127.0.0.1", "5432"),),
            "postgresql://u:p@localhost:5432/livelift",
            "mở",
        ),
        (["livelift_pgdata_thu"], "running", (("127.0.0.1", "5432"),), None, "DATABASE_URL"),
        (["livelift_pgdata_thu"], "running", (("127.0.0.1", "5432"),), "", "DATABASE_URL"),
    ],
)
def test_xac_minh_volume_thu_tu_choi(bp, vols, status, ports, url, can_co):
    tt = bp.phan_tich_inspect_db(_inspect(vols, status, ports))
    ok, ly_do = bp.xac_minh_volume_thu(tt, url)
    assert not ok
    assert can_co in ly_do


def test_xac_minh_volume_thu_khong_co_container(bp):
    ok, ly_do = bp.xac_minh_volume_thu(None, URL_THU)
    assert not ok
    assert "docker inspect" in ly_do


def test_loai_volume(bp):
    assert bp.loai_volume(None)[0] == "khong"
    assert bp.loai_volume(bp.phan_tich_inspect_db(_inspect(["livelift_pgdata"])))[0] == "that"
    loai, mo_ta = bp.loai_volume(bp.phan_tich_inspect_db(_inspect(["livelift_pgdata_thu"])))
    assert loai == "thu"
    assert "THỬ" in mo_ta


def test_test_db_skip_khi_khong_xac_minh_duoc(bp, monkeypatch):
    """Biến LIVELIFT_DB_THU sót trong shell + db đang ở volume thật: test db phải SKIP,
    không chạm tới migrate_down."""
    monkeypatch.setenv("LIVELIFT_DB_THU", "1")
    monkeypatch.setenv("DATABASE_URL", URL_THU)
    monkeypatch.setattr(
        bp, "doc_tinh_trang_db", lambda *_a: bp.phan_tich_inspect_db(_inspect(["livelift_pgdata"]))
    )
    import livelift.dbops.migrate as mig

    def cam(*_a, **_k):
        raise AssertionError("migrate_down không được chạy khi chưa xác minh volume thử")

    monkeypatch.setattr(mig, "migrate_down", cam)
    with pytest.raises(pytest.skip.Exception, match="volume THẬT"):
        test_migrate_len_xuong_len_tren_postgres_that(bp)  # mark.db chỉ gắn nhãn, gọi thẳng được


def test_mat_khau_ngau_nhien_khong_viet_cung(bp):
    a, b = bp.tao_mat_khau(), bp.tao_mat_khau()
    assert a != b
    assert len(a) >= 24
    assert all(c.isalnum() or c in "-_" for c in a)
    assert a != bp.MAT_KHAU_MAU


def test_phan_tich_docker_ps(bp):
    ps = (
        "khac-pg|0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp\n"
        "livelift-db-1|127.0.0.1:5433->5432/tcp\n"
        "khong-cong|\n"
        "redis|6379/tcp\n"
    )
    assert bp.phan_tich_docker_ps(ps) == {5432: "khac-pg", 5433: "livelift-db-1"}


@pytest.mark.parametrize(
    ("cau_hinh", "giu", "cong"),
    [
        (None, {}, 5432),
        (None, {5432: "khac-pg"}, 5433),
        (None, {5432: "livelift-db-1"}, 5432),
        (None, {5432: "khac-pg", 5433: "livelift-db-1"}, 5433),
        (None, {5432: "khac-pg", 5433: "mot tien trinh"}, None),
        (6000, {}, 6000),
        (6000, {6000: "livelift-db-1"}, 6000),
        (6000, {6000: "khac"}, None),
        (5432, {5432: "khac-pg"}, None),  # cổng người vận hành chọn: không tự đổi
    ],
)
def test_chon_cong(bp, cau_hinh, giu, cong):
    chon, ly_do = bp.chon_cong(cau_hinh, giu.get)
    assert chon == cong, ly_do
    assert ly_do


def test_compose_cong_db_doc_tu_bien(bp):
    text = (GOC / "docker-compose.yml").read_text(encoding="utf-8")
    assert '- "127.0.0.1:${LIVELIFT_DB_PORT:-5432}:5432"' in text
    assert '"127.0.0.1:5432:5432"' not in text


# ---------------------------------------------------------------------------
# Luật Docker: quét cây cú pháp
# ---------------------------------------------------------------------------


def _hang_chuoi(tree: ast.AST) -> list[str]:
    return [
        n.value for n in ast.walk(tree) if isinstance(n, ast.Constant) and isinstance(n.value, str)
    ]


def test_moi_lenh_compose_di_qua_lenh_compose_va_mang_p_livelift(bp):
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.List):
            vals = [e.value for e in node.elts if isinstance(e, ast.Constant)]
            if "compose" in vals:
                assert vals[:3] == ["docker", "compose", "-p"]
                assert isinstance(node.elts[3], ast.Name)
                assert node.elts[3].id == "DU_AN"
    assert bp.DU_AN == "livelift"
    assert bp.lenh_compose("up", "-d", "db")[:4] == ["docker", "compose", "-p", "livelift"]


def test_khong_co_lenh_pha_hoai_trong_ma(bp):
    cam = {"down", "prune", "rm", "kill", "stop", "restart", "-v", "--volumes", "system"}
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    hang = set(_hang_chuoi(tree))
    assert not (hang & cam), hang & cam


def test_lenh_compose_volume_thu_van_mang_p_livelift(bp, monkeypatch, tmp_path):
    phu = tmp_path / "phu.yml"
    monkeypatch.setattr(bp, "_COMPOSE_PHU", phu)
    cmd = bp.lenh_compose("up", "-d", "db")
    assert cmd[:4] == ["docker", "compose", "-p", "livelift"]
    assert cmd[-3:] == ["up", "-d", "db"]
    assert str(phu) in cmd
    assert "pgdata_thu:/var/lib/postgresql/data" in bp.COMPOSE_THU


# ---------------------------------------------------------------------------
# Luồng chính với Docker giả
# ---------------------------------------------------------------------------


class DockerGia:
    """Thay ``_run``: ghi lại mọi lệnh, trả lời theo kịch bản."""

    def __init__(
        self,
        *,
        daemon_len_sau: int = 0,
        ps: str = "",
        volumes: set[str] | None = None,
        loi_volume: bool = False,
        inspect_db: list[str] | None = None,
        trang_thai_db: str = "",
    ) -> None:
        self.lenh: list[list[str]] = []
        self.env_up: dict[str, str] | None = None
        self.lan_info = 0
        self.daemon_len_sau = daemon_len_sau
        self.ps = ps
        self.volumes = volumes or set()
        self.loi_volume = loi_volume
        #: các câu trả lời lần lượt cho 'docker inspect --format FORMAT_INSPECT_DB'
        self.inspect_db = list(inspect_db or [])
        self.trang_thai_db = trang_thai_db

    def __call__(self, cmd, timeout=300, env=None, input_text=None):  # noqa: ARG002
        self.lenh.append(list(cmd))
        if cmd[:2] == ["docker", "info"]:
            self.lan_info += 1
            if self.lan_info > self.daemon_len_sau:
                return subprocess.CompletedProcess(cmd, 0, "29.5.3\n", "")
            return subprocess.CompletedProcess(cmd, 1, "", "daemon chưa chạy")
        if cmd[:2] == ["docker", "ps"]:
            return subprocess.CompletedProcess(cmd, 0, self.ps, "")
        if cmd[:3] == ["docker", "volume", "inspect"]:
            if self.loi_volume:
                return subprocess.CompletedProcess(cmd, 1, "", "error during connect")
            if cmd[-1] in self.volumes:
                return subprocess.CompletedProcess(cmd, 0, cmd[-1] + "\n", "")
            return subprocess.CompletedProcess(cmd, 1, "", f"Error: No such volume: {cmd[-1]}")
        if cmd[:2] == ["docker", "inspect"] and '"mounts"' in cmd[3]:
            if not self.inspect_db:
                return subprocess.CompletedProcess(cmd, 1, "", "Error: No such object")
            out = self.inspect_db[0] if len(self.inspect_db) == 1 else self.inspect_db.pop(0)
            return subprocess.CompletedProcess(cmd, 0, out + "\n", "")
        if cmd[:2] == ["docker", "inspect"] and "State.Health" in cmd[3]:
            return subprocess.CompletedProcess(cmd, 0, self.trang_thai_db, "")
        if "up" in cmd:
            self.env_up = dict(env or {})
            return subprocess.CompletedProcess(cmd, 0, "", "")
        return subprocess.CompletedProcess(cmd, 0, "", "")


@pytest.fixture
def may(bp, monkeypatch, tmp_path):
    """Máy giả: .env tạm, không biến môi trường liên quan, ổ C đủ chỗ, không socket thật."""
    for k in (
        "POSTGRES_PASSWORD",
        "DATABASE_URL",
        "LIVELIFT_DB_PORT",
        "POSTGRES_USER",
        "POSTGRES_DB",
    ):
        monkeypatch.delenv(k, raising=False)
    env = tmp_path / ".env"
    monkeypatch.setattr(bp, "TEP_ENV", env)
    monkeypatch.setattr(bp, "_COMPOSE_PHU", None)  # --volume-thu đặt biến toàn cục này
    monkeypatch.setattr(bp.shutil, "which", lambda _n: "docker")
    monkeypatch.setattr(bp, "o_c_con_trong_gb", lambda: 50.0)
    monkeypatch.setattr(bp, "cong_dang_nghe", lambda _c, **_k: False)
    monkeypatch.setattr(bp, "_wait_healthy", lambda _c, _t: True)
    monkeypatch.setattr(bp, "_thu_ket_noi", lambda _u: ("ok", ""))
    monkeypatch.setattr(bp, "_migrate_up", lambda _u: (True, "đã áp [1, 2]"))
    monkeypatch.setattr(
        bp, "container_livelift", lambda: [("livelift-db-1", "unless-stopped", "running")]
    )
    monkeypatch.setattr(bp, "container_du_an_khac", lambda: [])
    monkeypatch.setattr(bp.time, "sleep", lambda _s: None)
    mo: list[int] = []

    def _mo() -> bool:
        mo.append(1)
        return True

    monkeypatch.setattr(bp, "_mo_docker_desktop", _mo)
    return env, mo


def test_kiem_khong_bat_khong_ghi(bp, may, monkeypatch, capsys):
    env, mo = may
    gia = DockerGia(daemon_len_sau=99)  # daemon tắt
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main(["--kiem"]) == 2
    assert mo == []
    assert not env.exists()
    assert not any("compose" in c for c in gia.lenh)
    out = capsys.readouterr().out
    assert "ĐƯỜNG LUI" in out


def test_kiem_khi_docker_chay_van_khong_dung_gi(bp, may, monkeypatch):
    env, mo = may
    gia = DockerGia()
    monkeypatch.setattr(bp, "_run", gia)
    rc = bp.main(["--kiem"])
    assert rc in (0, 1)
    assert mo == []
    assert not env.exists()
    for c in gia.lenh:
        assert "compose" not in c
        assert c[:2] in (["docker", "info"], ["docker", "ps"], ["docker", "inspect"])


def test_khong_bat_docker_tra_2_va_khong_mo_desktop(bp, may, monkeypatch):
    env, mo = may
    monkeypatch.setattr(bp, "_run", DockerGia(daemon_len_sau=99))
    assert bp.main(["--khong-bat-docker"]) == 2
    assert mo == []
    assert not env.exists()


def test_tu_mo_docker_sinh_mat_khau_khong_in_ra(bp, may, monkeypatch, capsys):
    env, mo = may
    gia = DockerGia(daemon_len_sau=3)
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main([]) == 0
    assert mo == [1]
    vals = bp.doc_env(env)
    pw = vals["POSTGRES_PASSWORD"]
    assert len(pw) >= 24
    assert vals["LIVELIFT_DB_PORT"] == "5432"
    assert vals["DATABASE_URL"] == f"postgresql://livelift:{pw}@127.0.0.1:5432/livelift"
    out = capsys.readouterr().out
    assert pw not in out
    assert "STORE_BACKEND=postgres" in out
    assert "DATABASE_URL=postgresql://livelift:***@127.0.0.1:5432/livelift" in out
    assert "restart=unless-stopped" in out
    up = [c for c in gia.lenh if "up" in c]
    assert up == [["docker", "compose", "-p", "livelift", "up", "-d", "db"]]
    assert gia.env_up is not None
    assert gia.env_up["LIVELIFT_DB_PORT"] == "5432"


def test_5432_ban_thi_dung_5433(bp, may, monkeypatch, capsys):
    env, _ = may
    gia = DockerGia(ps="pg-du-an-khac|0.0.0.0:5432->5432/tcp\n")
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main([]) == 0
    vals = bp.doc_env(env)
    assert vals["LIVELIFT_DB_PORT"] == "5433"
    assert ":5433/" in vals["DATABASE_URL"]
    assert gia.env_up is not None
    assert gia.env_up["LIVELIFT_DB_PORT"] == "5433"
    assert "5432 bận bởi pg-du-an-khac" in capsys.readouterr().out


def test_giu_mat_khau_san_co_trong_env(bp, may, monkeypatch, capsys):
    env, _ = may
    env.write_text("POSTGRES_PASSWORD=da-co-tu-truoc-123\n", encoding="utf-8")
    monkeypatch.setattr(bp, "_run", DockerGia())
    assert bp.main([]) == 0
    assert bp.doc_env(env)["POSTGRES_PASSWORD"] == "da-co-tu-truoc-123"
    assert "da-co-tu-truoc-123" not in capsys.readouterr().out


def test_database_url_may_khac_khong_bi_ghi_de(bp, may, monkeypatch, capsys):
    env, _ = may
    env.write_text(
        "POSTGRES_PASSWORD=pw-abc-123\nDATABASE_URL=postgresql://u:x@db.xa:5432/livelift\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(bp, "_run", DockerGia())
    assert bp.main([]) == 0
    assert bp.doc_env(env)["DATABASE_URL"] == "postgresql://u:x@db.xa:5432/livelift"
    out = capsys.readouterr().out
    assert "KHÁC db vừa dựng" in out
    assert "pw-abc-123" not in out


def test_sai_mat_khau_dung_lai_khong_dong_bo_khi_khong_co_co(bp, may, monkeypatch, capsys):
    _, _ = may
    gia = DockerGia()
    monkeypatch.setattr(bp, "_run", gia)
    monkeypatch.setattr(bp, "_thu_ket_noi", lambda _u: ("sai_mat_khau", "x"))
    assert bp.main([]) == 1
    assert not any("exec" in c for c in gia.lenh)
    assert "KHÔNG xoá volume" in capsys.readouterr().out


def test_dong_bo_mat_khau_gui_sql_qua_stdin(bp, may, monkeypatch, capsys):
    env, _ = may
    gia = DockerGia()
    stdin: list[str] = []

    def run(cmd, timeout=300, env=None, input_text=None):
        if input_text:
            stdin.append(input_text)
        return gia(cmd, timeout, env, input_text)

    monkeypatch.setattr(bp, "_run", run)
    lan = iter([("sai_mat_khau", "x"), ("ok", "")])
    monkeypatch.setattr(bp, "_thu_ket_noi", lambda _u: next(lan))
    assert bp.main(["--dong-bo-mat-khau"]) == 0
    pw = bp.doc_env(env)["POSTGRES_PASSWORD"]
    exec_cmd = [c for c in gia.lenh if "exec" in c]
    assert exec_cmd
    assert exec_cmd[0][:4] == ["docker", "compose", "-p", "livelift"]
    assert all(pw not in part for part in exec_cmd[0])  # mật khẩu không nằm trên dòng lệnh
    assert stdin
    assert pw in stdin[0]
    assert pw not in capsys.readouterr().out


def test_volume_that_da_co_ma_thieu_mat_khau_thi_dung_khong_ghi_env(bp, may, monkeypatch, capsys):
    """Sinh mật khẩu mới cho một volume đã khởi tạo thì chắc chắn lệch (Postgres chỉ đọc
    mật khẩu lần đầu), rồi DATABASE_URL sai bị ghi vào .env. Phải dừng TRƯỚC khi ghi."""
    env, _ = may
    gia = DockerGia(volumes={"livelift_pgdata"})
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main([]) == 1
    assert not env.exists()
    assert not any("compose" in c for c in gia.lenh)
    out = capsys.readouterr().out
    assert "ĐÃ CÓ" in out
    assert "POSTGRES_PASSWORD" in out
    assert "--volume-thu" in out


def test_khong_kiem_duoc_volume_thi_cung_dung(bp, may, monkeypatch):
    env, _ = may
    gia = DockerGia(loi_volume=True)
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main([]) == 1
    assert not env.exists()
    assert not any("compose" in c for c in gia.lenh)


def test_volume_thu_chua_co_thi_sinh_mat_khau_va_nhac_dang_o_volume_thu(
    bp, may, monkeypatch, capsys
):
    env, _ = may
    thu = _inspect(["livelift_pgdata_thu"])
    gia = DockerGia(volumes={"livelift_pgdata"}, inspect_db=[thu])
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main(["--volume-thu"]) == 0
    assert len(bp.doc_env(env)["POSTGRES_PASSWORD"]) >= 24
    vol = [c for c in gia.lenh if c[:3] == ["docker", "volume", "inspect"]]
    assert vol
    assert vol[0][-1] == "livelift_pgdata_thu"
    up = [c for c in gia.lenh if "up" in c]
    assert up[0][:4] == ["docker", "compose", "-p", "livelift"]
    assert "-f" in up[0]
    out = capsys.readouterr().out
    assert "ĐANG Ở VOLUME THỬ" in out
    assert "--ve-volume-that" in out
    assert 'restart: "no"' in bp.COMPOSE_THU


def test_cuoi_lan_bat_in_volume_dang_gan(bp, may, monkeypatch, capsys):
    env, _ = may
    env.write_text("POSTGRES_PASSWORD=pw-abc-123\n", encoding="utf-8")
    gia = DockerGia(volumes={"livelift_pgdata"}, inspect_db=[_inspect(["livelift_pgdata"])])
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main([]) == 0
    out = capsys.readouterr().out
    assert "livelift_pgdata (volume thật)" in out
    assert "VOLUME THỬ" not in out


def _kiem_san(bp, monkeypatch, env, inspect_db: str) -> DockerGia:
    env.write_text(
        "POSTGRES_PASSWORD=pw-abc-123\n"
        "DATABASE_URL=postgresql://livelift:pw-abc-123@127.0.0.1:5432/livelift\n"
        "STORE_BACKEND=postgres\n",
        encoding="utf-8",
    )
    gia = DockerGia(inspect_db=[inspect_db], trang_thai_db="running/healthy\n")
    monkeypatch.setattr(bp, "_run", gia)
    monkeypatch.setattr(bp, "_trang_thai_migration", lambda _u: ([1, 2], []))
    return gia


def test_kiem_bao_volume_that_va_san_sang(bp, may, monkeypatch, capsys):
    env, _ = may
    _kiem_san(bp, monkeypatch, env, _inspect(["livelift_pgdata"]))
    assert bp.main(["--kiem"]) == 0
    out = capsys.readouterr().out
    assert "livelift_pgdata (volume thật)" in out
    assert "SẴN SÀNG" in out
    assert "pw-abc-123" not in out


def test_kiem_gap_volume_thu_thi_chua_san_sang(bp, may, monkeypatch, capsys):
    env, _ = may
    gia = _kiem_san(bp, monkeypatch, env, _inspect(["livelift_pgdata_thu"]))
    truoc = env.read_bytes()
    assert bp.main(["--kiem"]) == 1
    assert env.read_bytes() == truoc
    assert not any("compose" in c for c in gia.lenh)
    out = capsys.readouterr().out
    assert "✗ Volume dữ liệu của livelift-db-1: livelift_pgdata_thu (volume THỬ)" in out
    assert "không có --volume-thu" in out
    assert "CHƯA sẵn sàng" in out


def test_ve_volume_that_dung_lai_khong_khoi_dong(bp, may, monkeypatch, capsys):
    env, _ = may
    gia = DockerGia(
        inspect_db=[
            _inspect(["livelift_pgdata_thu"], status="exited"),
            _inspect(["livelift_pgdata"], status="created"),
        ]
    )
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main(["--ve-volume-that"]) == 0
    compose = [c for c in gia.lenh if "compose" in c]
    assert compose == [["docker", "compose", "-p", "livelift", "up", "--no-start", "db"]]
    out = capsys.readouterr().out
    assert "created" in out
    assert "không xoá" in out
    assert not env.exists()


def test_ve_volume_that_khi_da_o_volume_that_khong_lam_gi(bp, may, monkeypatch):
    _, _ = may
    gia = DockerGia(inspect_db=[_inspect(["livelift_pgdata"])])
    monkeypatch.setattr(bp, "_run", gia)
    assert bp.main(["--ve-volume-that"]) == 0
    assert not any("compose" in c for c in gia.lenh)


def test_ghi_bien_env_giu_bom_va_khong_de_tep_tam(bp, tmp_path):
    env = tmp_path / ".env"
    env.write_bytes(b"\xef\xbb\xbfA=1\nINGEST_TOKEN=x\n")
    bp.ghi_bien_env(env, "A", "2")
    raw = env.read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf")
    assert bp.doc_env(env) == {"A": "2", "INGEST_TOKEN": "x"}
    assert [q.name for q in tmp_path.iterdir()] == [".env"]


def test_o_c_day_thi_dung_truoc_khi_dung_docker(bp, may, monkeypatch):
    env, mo = may
    gia = DockerGia(daemon_len_sau=99)
    monkeypatch.setattr(bp, "_run", gia)
    monkeypatch.setattr(bp, "o_c_con_trong_gb", lambda: 5.0)
    assert bp.main([]) == 1
    assert mo == []
    assert gia.lenh == []
    assert not env.exists()


# ---------------------------------------------------------------------------
# PostgreSQL thật: chỉ trên volume thử
# ---------------------------------------------------------------------------


@pytest.mark.db
def test_migrate_len_xuong_len_tren_postgres_that(bp):
    """up → down (hết) → up trên ``DATABASE_URL``. ``down`` xoá bảng nên test đòi HAI lớp:

    1. ``LIVELIFT_DB_THU=1`` (người chạy khai là đang ở volume thử);
    2. bằng chứng từ ``docker inspect`` (chỉ đọc): ``livelift-db-1`` đang chạy, gắn
       ``livelift_pgdata_thu``, không gắn ``livelift_pgdata``, và ``DATABASE_URL`` trỏ
       đúng cổng máy của container đó. Biến môi trường sót lại trong shell, hay CI
       chạy ``pytest -m db``, không đủ để xoá bảng của volume thật.

    Thiếu một lớp thì SKIP kèm lý do, không bao giờ chạy ``migrate_down``.
    """
    url = os.environ.get("DATABASE_URL")
    if not url or os.environ.get("LIVELIFT_DB_THU") != "1":
        pytest.skip("cần DATABASE_URL và LIVELIFT_DB_THU=1 (db dựng bằng --volume-thu)")
    ok, ly_do = bp.xac_minh_volume_thu(bp.doc_tinh_trang_db(), url)
    if not ok:
        pytest.skip(f"không xác minh được db đang ở volume thử: {ly_do}")
    psycopg = pytest.importorskip("psycopg")
    from livelift.dbops.migrate import applied_versions, load_migrations, migrate_down, migrate_up

    migrations = load_migrations()
    tat_ca = [m.version for m in migrations]
    with psycopg.connect(url, connect_timeout=5) as conn:
        migrate_up(conn, migrations)
        assert applied_versions(conn) == tat_ca
        rolled = migrate_down(conn, migrations, steps=len(tat_ca))
        assert rolled == list(reversed(tat_ca))
        assert applied_versions(conn) == []
        con_lai = conn.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name <> 'schema_migrations'"
        ).fetchall()
        assert con_lai == [], f"down để sót bảng: {con_lai}"
        assert migrate_up(conn, migrations) == tat_ca
        assert applied_versions(conn) == tat_ca

"""Lưới kiểm định LiveRoomSim: cấu trúc ô, độ giàu thiết kế, một ô chạy thật (rút gọn)."""

from __future__ import annotations

import json

import pytest

from livelift.sim import liveroom_grid as grid


def test_grid_has_forty_unique_cells():
    cells = grid.cell_specs()
    assert len(cells) == 40
    assert len({c["id"] for c in cells}) == 40
    assert sum(c["grid"] == "clicks" for c in cells) == 24


@pytest.mark.parametrize(
    ("minutes", "block_min", "patterns", "testable"),
    [
        # incident 15/10/2026: these short designs admit almost no assignments, so three
        # sessions cannot reach an exact p below 0.05 — the grid must not use them
        (40, 5, 2, False),
        (60, 10, 2, False),
        # 4 patterns → 64 assignments → floor 2/64 ≈ 0.031: only the single most
        # extreme assignment pair can ever reject
        (60, 5, 4, True),
    ],
)
def test_short_sessions_are_too_thin_to_test(minutes, block_min, patterns, testable):
    d = grid.design_richness(minutes, block_min, draws=2000)
    assert d["patterns_per_session"] == patterns
    assert (d["exact_p_floor"] < 0.05) is testable


def test_default_session_length_gives_a_testable_five_minute_design():
    d = grid.design_richness(grid.SESSION_MINUTES, 5, draws=2000)
    assert d["blocks_per_session"] >= 20
    assert d["patterns_per_session"] >= 1000
    assert d["exact_p_floor"] < 1e-6


def test_one_cell_runs_end_to_end_and_writes_resumable_json(tmp_path):
    cell = next(c for c in grid.cell_specs() if c["id"] == "clicks_tau0.3_h0_b5_beta0")
    msg = grid._work((cell, 2, str(tmp_path), 90))
    path = grid._out_path(tmp_path, cell, 2, 90)
    assert path.exists(), msg
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["session_minutes"] == 90
    assert data["design"]["patterns_per_session"] > 100
    assert set(data["by_burn_in"]) == {str(b) for b in grid.BURN_INS}
    assert data["by_burn_in"]["60"]["n"] == 2
    # resume: an existing cell is not run again
    assert grid._out_path(tmp_path, cell, 2, 90) in list((tmp_path / "R2-P90").glob("*.json"))

"""Validation grid for the switchback estimator on LiveRoomSim worlds (MÔ PHỎNG).

Two grids, because the order delay cannot move a click:

* **clicks** (the pre-registered outcome): effect τ × carryover half-life ×
  block length × traffic feedback β — 24 cells.
* **orders** (busy room, ×4.9 arrivals, click→order 0.08 as an ASSUMPTION):
  τ × order delay × block length × carryover — 16 cells.

Every replication simulates its sessions ONCE (observed arm plus the two CRN
arms) and re-analyses them at each burn-in in :data:`BURN_INS`, so the burn-in
comparison is paired: same worlds, different analysis window.

Each finished cell is written to its own JSON file as soon as it completes, so
an interrupted run resumes where it stopped (``--resume``, the default).

Regenerate::

    python -m livelift.sim.liveroom_grid --reps 200 --workers 3

then ``python -m livelift.sim.liveroom_grid --summarise`` for the tables and
figures used in ``docs/benchmarks/liveroom-kiem-dinh.md``.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import replace
from pathlib import Path
from typing import Any

import numpy as np

from livelift.analysis.estimators import analyze_outer
from livelift.core.assigner.outer import DesignParams, generate_schedule
from livelift.core.features import block_frame, blocks_to_dicts
from livelift.sim.liveroom import (
    BUSY_ROOM_AUDIENCE_MULT,
    LiveRoomParams,
    simulate_with_orders,
)
from livelift.sim.simulator import SimParams

BURN_INS: tuple[int, ...] = (0, 60, 120, 180)
TAUS: tuple[float, ...] = (0.0, 0.3)
HALFLIVES: tuple[float, ...] = (0.0, 120.0, 300.0)
BLOCKS: tuple[int, ...] = (5, 10)
BETAS: tuple[float, ...] = (0.0, 0.5)
ORDER_DELAYS: tuple[float, ...] = (0.0, 90.0)
ORDER_HALFLIVES: tuple[float, ...] = (0.0, 120.0)
CLICK_TO_ORDER = 0.08  # ASSUMPTION — see liveroom.py

SESSIONS_PER_REP = 3
SESSION_MINUTES = 60
N_DRAWS = 200
ALPHA = 0.05

DEFAULT_OUT = Path("docs/benchmarks/data/liveroom-grid")


def cell_specs() -> list[dict[str, Any]]:
    """All 40 cells, each a plain dict (picklable for the process pool)."""
    cells: list[dict[str, Any]] = []
    for tau in TAUS:
        for h in HALFLIVES:
            for blk in BLOCKS:
                for beta in BETAS:
                    cells.append(
                        {
                            "grid": "clicks",
                            "tau": tau,
                            "halflife_s": h,
                            "block_min": blk,
                            "beta_q": beta,
                            "order_delay_s": None,
                        }
                    )
    for tau in TAUS:
        for delay in ORDER_DELAYS:
            for blk in BLOCKS:
                for h in ORDER_HALFLIVES:
                    cells.append(
                        {
                            "grid": "orders",
                            "tau": tau,
                            "halflife_s": h,
                            "block_min": blk,
                            "beta_q": 0.0,
                            "order_delay_s": delay,
                        }
                    )
    for c in cells:
        c["id"] = cell_id(c)
    return cells


def cell_id(c: dict[str, Any]) -> str:
    base = f"{c['grid']}_tau{c['tau']:g}_h{c['halflife_s']:g}_b{c['block_min']}"
    if c["grid"] == "clicks":
        return base + f"_beta{c['beta_q']:g}"
    return base + f"_d{c['order_delay_s']:g}"


def cell_params(c: dict[str, Any]) -> LiveRoomParams:
    base = SimParams(treatment_effect=c["tau"], carryover_halflife_s=c["halflife_s"])
    if c["grid"] == "clicks":
        return LiveRoomParams(base=base, beta_q=c["beta_q"])
    base = replace(base, base_arrival_per_min=base.base_arrival_per_min * BUSY_ROOM_AUDIENCE_MULT)
    return LiveRoomParams(
        base=base,
        click_to_order=CLICK_TO_ORDER,
        order_delay_median_s=c["order_delay_s"],
    )


def _frame_rows(schedule, events, burn_in: int, outcome: str) -> list[dict[str, Any]]:
    frame = block_frame(schedule, events, burn_in_s=burn_in, outcome_kind=outcome)
    return [r for r in blocks_to_dicts(frame) if r.get("measurable", True)]


def _truth(schedule, on_events, off_events, burn_in: int, outcome: str) -> tuple[float, float]:
    """(block-rate truth, mean all-OFF rate) over blocks measurable in both arms."""
    f_on = block_frame(schedule, on_events, burn_in_s=burn_in, outcome_kind=outcome)
    f_off = block_frame(schedule, off_events, burn_in_s=burn_in, outcome_kind=outcome)
    keep = [
        i for i, (a, b) in enumerate(zip(f_on, f_off, strict=True)) if a.measurable and b.measurable
    ]
    if not keep:
        return 0.0, 0.0
    y_on = sum(f_on[i].y for i in keep) / len(keep)
    y_off = sum(f_off[i].y for i in keep) / len(keep)
    return y_on - y_off, y_off


def run_cell(c: dict[str, Any], reps: int, master_seed: int = 2026) -> dict[str, Any]:
    """Monte-Carlo study of one cell; returns per-burn-in summaries + raw vectors."""
    params = cell_params(c)
    outcome = "click" if c["grid"] == "clicks" else "order"
    design = DesignParams(block_min=c["block_min"])
    seed_rng = random.Random(f"{master_seed}:{c['id']}")
    per_b: dict[int, dict[str, list[float]]] = {
        b: {"est": [], "lo": [], "hi": [], "p": [], "truth": [], "off": []} for b in BURN_INS
    }
    gte_rel: list[float] = []
    started = time.perf_counter()
    for _ in range(reps):
        sessions = []
        gte_d, gte_b = 0.0, 0.0
        for _s in range(SESSIONS_PER_REP):
            seed = seed_rng.randrange(2**60)
            schedule = generate_schedule(SESSION_MINUTES, design, seed)
            obs = simulate_with_orders(schedule, params, seed)
            on = simulate_with_orders(schedule, params, seed, override="all_on")
            off = simulate_with_orders(schedule, params, seed, override="all_off")
            sessions.append((schedule, obs.events, on.events, off.events))
            n_on = sum(1 for e in on.events if e.kind == outcome)
            n_off = sum(1 for e in off.events if e.kind == outcome)
            gte_d += n_on - n_off
            gte_b += n_off
        gte_rel.append(gte_d / gte_b if gte_b else float("nan"))
        analysis_seed = seed_rng.randrange(2**31)
        for b in BURN_INS:
            ys, zs, sess, phases = [], [], [], []
            truths, offs = [], []
            for k, (schedule, ev, ev_on, ev_off) in enumerate(sessions):
                for r in _frame_rows(schedule, ev, b, outcome):
                    ys.append(r["y"])
                    zs.append(r["z"])
                    sess.append(f"s{k}")
                    phases.append(r["phase"])
                t, o = _truth(schedule, ev_on, ev_off, b, outcome)
                truths.append(t)
                offs.append(o)
            res = analyze_outer(
                np.array(ys),
                np.array(zs),
                np.array(sess),
                phases,
                alpha=ALPHA,
                n_draws=N_DRAWS,
                seed=analysis_seed,
            )
            d = per_b[b]
            d["est"].append(float(res.estimate))
            d["lo"].append(float(res.ci_low))
            d["hi"].append(float(res.ci_high))
            d["p"].append(float(res.p_value))
            d["truth"].append(float(np.mean(truths)))
            d["off"].append(float(np.mean(offs)))
    summaries = {str(b): summarise(per_b[b]) for b in BURN_INS}
    return {
        "cell": c,
        "reps": reps,
        "sessions_per_rep": SESSIONS_PER_REP,
        "session_minutes": SESSION_MINUTES,
        "n_draws": N_DRAWS,
        "outcome": outcome,
        "seconds": round(time.perf_counter() - started, 1),
        "gte_total_relative": _finite_mean(gte_rel),
        "by_burn_in": summaries,
        "raw": {str(b): per_b[b] for b in BURN_INS},
    }


def _finite_mean(xs: list[float]) -> float:
    vals = [x for x in xs if math.isfinite(x)]
    return float(np.mean(vals)) if vals else float("nan")


def summarise(d: dict[str, list[float]]) -> dict[str, float]:
    """Bias, RMSE, coverage, rejection rate with Monte-Carlo standard errors.

    Replications whose design could not be tested (NaN estimate/interval) are
    counted as NOT covered and NOT rejected, never silently dropped — the same
    rule as :meth:`livelift.sim.validate.ValidationResult.to_cell`.
    """
    est = np.array(d["est"], dtype=float)
    lo = np.array(d["lo"], dtype=float)
    hi = np.array(d["hi"], dtype=float)
    p = np.array(d["p"], dtype=float)
    truth = np.array(d["truth"], dtype=float)
    off = np.array(d["off"], dtype=float)
    n = len(est)
    ok = np.isfinite(est) & np.isfinite(lo) & np.isfinite(hi)
    covered = ok & (lo <= truth) & (truth <= hi)
    rejected = np.isfinite(p) & (p < ALPHA)
    err = est[ok] - truth[ok]
    mean_truth = float(np.mean(truth)) if n else float("nan")
    mean_est = float(np.mean(est[ok])) if ok.any() else float("nan")
    cov = float(np.mean(covered)) if n else float("nan")
    rej = float(np.mean(rejected)) if n else float("nan")
    mean_off = float(np.mean(off)) if n else float("nan")
    return {
        "n": n,
        "n_estimable": int(ok.sum()),
        "mean_truth": mean_truth,
        "mean_estimate": mean_est,
        "bias": float(np.mean(err)) if err.size else float("nan"),
        "bias_se": float(np.std(err, ddof=1) / math.sqrt(err.size))
        if err.size > 1
        else float("nan"),
        "relative_bias": (mean_est - mean_truth) / abs(mean_truth)
        if abs(mean_truth) > 1e-12
        else float("nan"),
        "rmse": float(math.sqrt(np.mean(err**2))) if err.size else float("nan"),
        "coverage": cov,
        "coverage_se": math.sqrt(cov * (1 - cov) / n) if n else float("nan"),
        "rejection_rate": rej,
        "rejection_se": math.sqrt(rej * (1 - rej) / n) if n else float("nan"),
        "mean_off_rate": mean_off,
        "truth_relative": mean_truth / mean_off if mean_off > 1e-12 else float("nan"),
    }


def _out_path(out_dir: Path, c: dict[str, Any], reps: int) -> Path:
    return out_dir / f"R{reps}" / f"{c['id']}.json"


def _work(args: tuple[dict[str, Any], int, str]) -> str:
    c, reps, out_dir = args
    result = run_cell(c, reps)
    path = _out_path(Path(out_dir), c, reps)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)
    return f"{c['id']} {result['seconds']}s"


def run_grid(reps: int, workers: int, out_dir: Path, only: str | None = None) -> None:
    cells = [c for c in cell_specs() if only is None or only in c["id"]]
    todo = [c for c in cells if not _out_path(out_dir, c, reps).exists()]
    print(
        f"{len(cells)} ô, còn {len(todo)} ô chưa chạy (R={reps}, {workers} tiến trình)", flush=True
    )
    if not todo:
        return
    jobs = [(c, reps, str(out_dir)) for c in todo]
    if workers <= 1:
        for j in jobs:
            print(_work(j), flush=True)
        return
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_work, j) for j in jobs]
        for f in as_completed(futures):
            print(f.result(), flush=True)


def load_results(out_dir: Path, reps: int) -> list[dict[str, Any]]:
    folder = out_dir / f"R{reps}"
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(folder.glob("*.json"))]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Lưới kiểm định LiveRoomSim (MÔ PHỎNG)")
    ap.add_argument("--reps", type=int, default=200)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--only", default=None, help="chỉ chạy các ô có id chứa chuỗi này")
    args = ap.parse_args(argv)
    run_grid(args.reps, args.workers, args.out, args.only)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

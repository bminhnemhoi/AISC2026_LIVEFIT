"""Tables and figures for the LiveRoomSim validation grid (MÔ PHỎNG).

Reads the per-cell JSON files written by :mod:`livelift.sim.liveroom_grid` and
produces, deterministically from those files only:

* ``TONG-HOP.md`` next to the data — every cell × burn-in, with Monte-Carlo SEs;
* two heatmaps under ``docs/benchmarks/img/`` used by
  ``docs/benchmarks/liveroom-kiem-dinh.md`` and the Round-2 deck.

Regenerate::

    python -m livelift.sim.liveroom_grid --summarise --reps 200
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from livelift.sim.liveroom_grid import BURN_INS, SESSION_MINUTES, load_results

FIG_DIR = Path("docs/benchmarks/img")
PRIMARY_BURN_IN = 60
"""The pre-registered burn-in (PREREGISTRATION.md): one minute per block."""


def _fmt(x: float, digits: int = 3) -> str:
    return "—" if x is None or not math.isfinite(x) else f"{x:.{digits}f}"


def _pct(x: float) -> str:
    return "—" if x is None or not math.isfinite(x) else f"{100 * x:.1f}%"


def _row(r: dict[str, Any], b: int) -> dict[str, Any]:
    s = r["by_burn_in"][str(b)]
    c = r["cell"]
    return {
        "id": c["id"],
        "grid": c["grid"],
        "tau": c["tau"],
        "h": c["halflife_s"],
        "block": c["block_min"],
        "beta": c["beta_q"],
        "delay": c["order_delay_s"],
        "burn": b,
        **s,
        "estimable_share": s["n_estimable"] / s["n"] if s["n"] else float("nan"),
        "gte_rel": r.get("gte_total_relative", float("nan")),
        "patterns": (r.get("design") or {}).get("patterns_per_session"),
        "p_floor": (r.get("design") or {}).get("exact_p_floor", float("nan")),
    }


def table_rows(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_row(r, b) for r in results for b in BURN_INS]


def _markdown(rows: list[dict[str, Any]], reps: int, minutes: int) -> str:
    head = (
        f"# Tổng hợp lưới LiveRoomSim (MÔ PHỎNG) — R={reps}, phiên {minutes} phút\n\n"
        "Sinh tự động bởi `python -m livelift.sim.liveroom_grid --summarise`; "
        "không sửa tay. Sai số Monte-Carlo trong ngoặc. Tỷ lệ bác bỏ là **cỡ "
        "kiểm định** khi τ = 0 và **lực** khi τ = 0,3. Lần lặp không kiểm định "
        "được (KTC không bị chặn) tính là KHÔNG phủ và KHÔNG bác bỏ.\n\n"
    )
    cols = (
        "| Ô | burn-in (s) | mẫu gán/phiên | ước lượng được | thật (khối) | lệch | lệch tương đối "
        "| RMSE | độ phủ 95% | bác bỏ | GTE tổng/ thật tương đối |\n"
        "|---|---|---|---|---|---|---|---|---|---|---|\n"
    )
    lines = []
    for r in rows:
        lines.append(
            f"| {r['id']} | {r['burn']} | {r['patterns']} | {_pct(r['estimable_share'])} "
            f"| {_fmt(r['mean_truth'])} | {_fmt(r['bias'], 4)} ({_fmt(r['bias_se'], 4)}) "
            f"| {_fmt(r['relative_bias'])} | {_fmt(r['rmse'])} "
            f"| {_fmt(r['coverage'])} ({_fmt(r['coverage_se'])}) "
            f"| {_fmt(r['rejection_rate'])} ({_fmt(r['rejection_se'])}) "
            f"| {_fmt(r['gte_rel'])} / {_fmt(r['truth_relative'])} |"
        )
    return head + cols + "\n".join(lines) + "\n"


def _pick(rows: list[dict[str, Any]], **where: Any) -> list[dict[str, Any]]:
    return [r for r in rows if all(r[k] == v for k, v in where.items())]


def _heatmaps(rows: list[dict[str, Any]], fig_dir: Path, minutes: int, reps: int) -> list[Path]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    fig_dir.mkdir(parents=True, exist_ok=True)
    out: list[Path] = []
    clicks = [r for r in rows if r["grid"] == "clicks" and r["beta"] == 0.0]
    halflives = sorted({r["h"] for r in clicks})
    blocks = sorted({r["block"] for r in clicks})

    # Figure 1 — relative bias of the block-rate estimate (τ = 0.3) by carryover × burn-in.
    fig, axes = plt.subplots(
        1, len(blocks), figsize=(4.4 * len(blocks), 3.8), squeeze=False, sharey=True,
        layout="constrained",
    )  # fmt: skip
    for k, (ax, blk) in enumerate(zip(axes[0], blocks, strict=True)):
        m = np.full((len(halflives), len(BURN_INS)), np.nan)
        for i, h in enumerate(halflives):
            for j, b in enumerate(BURN_INS):
                hit = _pick(clicks, tau=0.3, h=h, block=blk, burn=b)
                if hit:
                    m[i, j] = 100 * hit[0]["relative_bias"]
        im = ax.imshow(m, cmap="RdBu", vmin=-40, vmax=40, aspect="auto")
        for i in range(m.shape[0]):
            for j in range(m.shape[1]):
                if np.isfinite(m[i, j]):
                    ax.text(
                        j, i, f"{m[i, j]:+.0f}%".replace("-", "−"), ha="center", va="center",
                        fontsize=10, color="white" if abs(m[i, j]) > 25 else "black",
                    )  # fmt: skip
        ax.set_xticks(range(len(BURN_INS)), [f"{b}s" for b in BURN_INS])
        ax.set_yticks(range(len(halflives)), [f"{h:g}s" for h in halflives])
        ax.set_xlabel("Bỏ đầu khối (burn-in)")
        if k == 0:
            ax.set_ylabel("Nửa đời dư âm")
        ax.set_title(f"Khối {blk} phút", fontsize=11)
    fig.colorbar(im, ax=axes[0].tolist(), shrink=0.85, label="Lệch tương đối (%)")
    fig.suptitle(
        f"MÔ PHỎNG · Lệch của ước lượng khi hiệu ứng thật +30% "
        f"(3 phiên × {minutes} phút, R={reps})",
        fontsize=11,
    )
    p1 = fig_dir / "liveroom-lech-du-am.png"
    fig.savefig(p1, dpi=160, bbox_inches="tight")
    plt.close(fig)
    out.append(p1)

    # Figure 2 — rejection rate: size (τ = 0) and power (τ = 0.3) at the pre-registered burn-in.
    fig, axes = plt.subplots(
        1, 2, figsize=(9.2, 3.8), squeeze=False, sharey=True, layout="constrained"
    )
    for ax, tau, title, vmax in (
        (axes[0][0], 0.0, "Dương tính giả (τ = 0, mục tiêu ≤ 5%)", 0.2),
        (axes[0][1], 0.3, "Lực phát hiện (τ = +30%)", 1.0),
    ):
        m = np.full((len(halflives), len(blocks)), np.nan)
        for i, h in enumerate(halflives):
            for j, blk in enumerate(blocks):
                hit = _pick(clicks, tau=tau, h=h, block=blk, burn=PRIMARY_BURN_IN)
                if hit:
                    m[i, j] = hit[0]["rejection_rate"]
        ax.imshow(m, cmap="Greys", vmin=0, vmax=vmax, aspect="auto")
        for i in range(m.shape[0]):
            for j in range(m.shape[1]):
                if np.isfinite(m[i, j]):
                    ax.text(
                        j,
                        i,
                        f"{100 * m[i, j]:.0f}%",
                        ha="center",
                        va="center",
                        fontsize=10,
                        color="white" if m[i, j] > 0.6 * vmax else "black",
                    )
        ax.set_xticks(range(len(blocks)), [f"khối {b} phút" for b in blocks])
        ax.set_yticks(range(len(halflives)), [f"dư âm {h:g}s" for h in halflives])
        ax.set_title(title, fontsize=11)
    fig.suptitle(
        f"MÔ PHỎNG · Kiểm định ngẫu nhiên hóa, burn-in {PRIMARY_BURN_IN}s, "
        f"3 phiên × {minutes} phút, R={reps}",
        fontsize=11,
    )
    p2 = fig_dir / "liveroom-co-va-luc.png"
    fig.savefig(p2, dpi=160, bbox_inches="tight")
    plt.close(fig)
    out.append(p2)
    return out


def write_report(
    out_dir: Path,
    reps: int,
    minutes: int = SESSION_MINUTES,
    fig_dir: Path = FIG_DIR,
) -> str:
    """Write ``TONG-HOP.md`` and the two heatmaps; return a one-line summary."""
    results = load_results(out_dir, reps, minutes)
    if not results:
        raise FileNotFoundError(
            f"không có kết quả trong {out_dir} (R={reps}, phiên {minutes} phút)"
        )
    rows = table_rows(results)
    md_path = out_dir / f"R{reps}-P{minutes}" / "TONG-HOP.md"
    md_path.write_text(_markdown(rows, reps, minutes), encoding="utf-8")
    figs = _heatmaps(rows, fig_dir, minutes, reps)
    return f"{len(results)} ô → {md_path}; hình: {', '.join(str(p) for p in figs)}"

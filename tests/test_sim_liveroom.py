"""LiveRoomSim v1 (``livelift.sim.liveroom``) — MÔ PHỎNG, không phải số đo.

Two properties come before anything a mechanism does:

1. **Every knob off ⇒ the historical simulator, bit for bit.** ``simulate_liveroom``
   re-implements the tick loop of :func:`livelift.sim.simulator.simulate_session`
   (it does NOT delegate to it), so the equivalence is a real check of the RNG
   discipline: the same world/click streams consumed in the same order, no
   extra draw "to keep things aligned". The contract is the same golden digest
   that guards ``simulate_session`` itself (``tests/test_sim_heterogeneity.py``).
2. **Each mechanism, switched on, does what its name says** — measured, with a
   tolerance the test explains.
"""

from __future__ import annotations

import hashlib
import json
import statistics

import pytest

from livelift.core.assigner.outer import ON, DesignParams, generate_schedule
from livelift.core.features import Event, block_frame
from livelift.sim.liveroom import (
    LiveRoomParams,
    _gamma_median_factor,
    gte_total_per_min,
    orders_from_clicks,
    preset_busy_room,
    simulate_liveroom,
    simulate_with_orders,
    true_effect_liveroom,
)
from livelift.sim.simulator import SimOutput, SimParams, simulate_session, true_effect
from tests.test_sim_heterogeneity import GOLDEN_DEFAULT


def _digest_of(out) -> str:
    """Same payload as ``tests/test_sim_heterogeneity._digest`` — copied, not
    re-derived, so a change to either side shows up as a digest mismatch."""
    payload = json.dumps(
        [[e.kind, repr(e.ts_offset_s), e.value, e.product_id] for e in out.events]
        + [out.viewers_trace],
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _schedule(seed: int, minutes: int):
    return generate_schedule(minutes, DesignParams(jitter_s=0), seed=seed)


# ---------------------------------------------------------------------------
# 1. Equivalence with every knob off (written FIRST — the contract)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(("seed", "minutes"), sorted(GOLDEN_DEFAULT))
def test_default_liveroom_reproduces_the_golden_digest(seed, minutes):
    out = simulate_liveroom(_schedule(seed, minutes), LiveRoomParams(), seed)
    assert _digest_of(out) == GOLDEN_DEFAULT[(seed, minutes)]


@pytest.mark.parametrize("override", [None, "all_on", "all_off"])
@pytest.mark.parametrize(
    "base",
    [
        SimParams(),
        SimParams(treatment_effect=0.4),
        SimParams(carryover_halflife_s=120.0),
        SimParams(click_frailty_cv=0.8),
        SimParams(session_click_sigma=0.2, treatment_effect=0.3),
    ],
)
def test_knobs_off_equal_simulate_session_event_for_event(base, override):
    """Not just the digest: the Event lists and viewer traces compare equal,
    for the CRN override arms too and with the historical knobs switched on."""
    schedule = _schedule(11, 45)
    ref = simulate_session(schedule, base, 11, override)
    out = simulate_liveroom(schedule, LiveRoomParams(base=base), 11, override)
    assert out.events == ref.events
    assert out.viewers_trace == ref.viewers_trace


def test_plain_simparams_are_accepted_and_mean_the_same_world():
    schedule = _schedule(3, 30)
    a = simulate_liveroom(schedule, SimParams(treatment_effect=0.2), 3)
    b = simulate_liveroom(schedule, LiveRoomParams(base=SimParams(treatment_effect=0.2)), 3)
    assert a.events == b.events
    assert a.viewers_trace == b.viewers_trace


def test_true_effect_liveroom_equals_historical_truth_with_knobs_off():
    schedule = _schedule(5, 60)
    base = SimParams(treatment_effect=0.3, carryover_halflife_s=60.0)
    assert true_effect_liveroom(schedule, LiveRoomParams(base=base), 5, 60) == true_effect(
        schedule, base, 5, 60
    )


def test_knobs_are_off_by_default():
    p = LiveRoomParams()
    assert (p.bounce_share, p.click_to_order, p.beta_q) == (0.0, 0.0, 0.0)
    assert p.products == ("P1",)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"bounce_share": 1.0},
        {"bounce_share": -0.1},
        {"click_to_order": 1.5},
        {"beta_q": -1.0},
        {"products": ()},
        {"products": ("A", "B"), "focal_product": "C"},
        {"control_pin_policy": "random"},
    ],
)
def test_invalid_knobs_are_refused(kwargs):
    with pytest.raises(ValueError):
        LiveRoomParams(**kwargs)


# ---------------------------------------------------------------------------
# 2. Mechanisms, switched on
# ---------------------------------------------------------------------------


def test_bounce_viewers_add_audience_without_touching_the_engaged_trajectory():
    """Bounces come on their own stream, so the engaged audience is the same
    world: the viewer trace can only grow, tick by tick."""
    schedule = _schedule(7, 60)
    base = simulate_liveroom(schedule, LiveRoomParams(), 7)
    bounced = simulate_liveroom(schedule, LiveRoomParams(bounce_share=0.81), 7)
    assert all(b >= a for a, b in zip(base.viewers_trace, bounced.viewers_trace, strict=True))
    assert sum(bounced.viewers_trace) > sum(base.viewers_trace)


def test_gamma_median_factor_matches_a_large_sample():
    import random

    rng = random.Random(1)
    for shape in (1.0, 2.0, 4.0):
        draws = [rng.gammavariate(shape, 1.0) for _ in range(40_000)]
        assert statistics.median(draws) == pytest.approx(_gamma_median_factor(shape), rel=0.02)


def test_orders_follow_clicks_with_the_requested_median_delay():
    clicks = [Event("click", float(t), product_id="P1") for t in range(0, 3000, 2)]
    out = SimOutput(events=clicks, viewers_trace=[])
    params = LiveRoomParams(click_to_order=1.0, order_delay_median_s=90.0)
    with_orders = orders_from_clicks(out, params, seed=3, session_s=10_000.0)
    orders = [e for e in with_orders.events if e.kind == "order"]
    assert len(orders) == len(clicks)  # conversion 1.0, nothing past the end
    delays = [o.ts_offset_s - c.ts_offset_s for o, c in zip(orders, clicks, strict=True)]
    assert statistics.median(delays) == pytest.approx(90.0, rel=0.08)
    assert min(delays) >= 0.0


def test_orders_after_the_session_end_are_dropped_and_rate_is_respected():
    clicks = [Event("click", float(t)) for t in range(0, 600)]
    out = SimOutput(events=clicks, viewers_trace=[])
    params = LiveRoomParams(click_to_order=0.25, order_delay_median_s=60.0)
    orders = [
        e for e in orders_from_clicks(out, params, 9, session_s=600.0).events if e.kind == "order"
    ]
    assert all(o.ts_offset_s < 600.0 for o in orders)
    assert 0.15 * 600 < len(orders) < 0.25 * 600  # some converted orders fall past the end


def test_orders_knob_off_returns_the_same_object():
    out = simulate_liveroom(_schedule(2, 30), LiveRoomParams(), 2)
    assert orders_from_clicks(out, LiveRoomParams(), 2, 1800.0) is out


def test_order_outcome_reaches_block_frame():
    schedule = _schedule(4, 60)
    params = LiveRoomParams(base=SimParams(treatment_effect=0.3), click_to_order=0.5)
    out = simulate_with_orders(schedule, params, 4)
    frame = block_frame(schedule, out.events, burn_in_s=0, outcome_kind="order")
    n_orders = sum(1 for e in out.events if e.kind == "order")
    assert n_orders > 0
    assert sum(r.clicks_raw for r in frame) <= n_orders
    assert sum(r.clicks_raw for r in frame) > 0


def test_traffic_feedback_keeps_crn_when_there_is_no_effect():
    """With no treatment effect, Q does not depend on the arm, so the all-ON and
    all-OFF worlds are the same world even with feedback switched on."""
    schedule = _schedule(8, 60)
    params = LiveRoomParams(base=SimParams(treatment_effect=0.0), beta_q=1.0)
    on = simulate_liveroom(schedule, params, 8, "all_on")
    off = simulate_liveroom(schedule, params, 8, "all_off")
    assert on.viewers_trace == off.viewers_trace
    assert on.events == off.events


def test_traffic_feedback_brings_more_viewers_to_the_treated_room():
    schedule = _schedule(8, 90)
    params = LiveRoomParams(base=SimParams(treatment_effect=0.5), beta_q=1.0)
    gains = []
    for seed in range(8, 16):
        on = simulate_liveroom(schedule, params, seed, "all_on")
        off = simulate_liveroom(schedule, params, seed, "all_off")
        gains.append(sum(on.viewers_trace) - sum(off.viewers_trace))
    assert statistics.mean(gains) > 0
    assert sum(g > 0 for g in gains) >= 6


def test_gte_total_exceeds_the_rate_view_under_feedback():
    """The count GTE includes the extra traffic; with β=0 it does not."""
    schedule = _schedule(12, 90)
    rel = {}
    for beta in (0.0, 1.0):
        params = LiveRoomParams(base=SimParams(treatment_effect=0.4), beta_q=beta)
        diffs, bases = [], []
        for seed in range(20, 30):
            d, b = gte_total_per_min(schedule, params, seed)
            diffs.append(d)
            bases.append(b)
        rel[beta] = statistics.mean(diffs) / statistics.mean(bases)
    assert rel[1.0] > rel[0.0]


def test_products_pin_focal_in_on_blocks_and_rotate_in_off_blocks():
    schedule = _schedule(6, 60)
    params = LiveRoomParams(
        base=SimParams(treatment_effect=0.3),
        products=("A", "B", "C"),
        focal_product="B",
        pin_share=0.9,
    )
    out = simulate_liveroom(schedule, params, 6)
    pins = [e for e in out.events if e.kind == "pin"]
    assert pins, "several products must emit pin events"
    for blk in schedule.measurement_blocks:
        clicks = [
            e
            for e in out.events
            if e.kind == "click" and blk.start_offset_s <= e.ts_offset_s < blk.end_offset_s
        ]
        if blk.assignment == ON and len(clicks) >= 10:
            share_b = sum(1 for e in clicks if e.product_id == "B") / len(clicks)
            assert share_b > 0.6
    assert {e.product_id for e in out.events if e.kind == "click"} <= {"A", "B", "C"}


def test_single_product_list_draws_nothing_from_the_product_stream():
    schedule = _schedule(6, 30)
    a = simulate_liveroom(schedule, LiveRoomParams(products=("P1",)), 6)
    b = simulate_session(schedule, SimParams(), 6)
    assert a.events == b.events


def test_busy_room_preset_is_busier_and_has_orders():
    schedule = _schedule(9, 60)
    busy = simulate_with_orders(schedule, preset_busy_room(), 9)
    plain = simulate_liveroom(schedule, LiveRoomParams(), 9)
    assert sum(busy.viewers_trace) > 3 * sum(plain.viewers_trace)
    assert any(e.kind == "order" for e in busy.events)

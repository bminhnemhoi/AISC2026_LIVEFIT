"""LiveRoomSim v1 — a richer live room on top of the calibrated simulator.

MÔ PHỎNG. Nothing in this module is a measurement of a real live room. Its job
is to stress-test the switchback pipeline against mechanisms the base simulator
leaves out, so the team can say WHERE the method breaks, not to show that
pinning works. (SimGym, arXiv 2605.19219, found simulated A/B results agree in
direction with real ones only ~77% of the time: a simulator is a test bench for
estimators, not evidence about the world.)

Contract (tests/test_sim_liveroom.py)
-------------------------------------
:func:`simulate_liveroom` RE-IMPLEMENTS the tick loop of
:func:`livelift.sim.simulator.simulate_session` instead of delegating to it.
With every LiveRoom knob at its default the two functions consume the same
world/click streams in the same order and return equal event lists — checked
against the golden digests that guard ``simulate_session`` itself. Each new
mechanism draws from its OWN stream ``random.Random(seed ^ CONST)`` and draws
nothing at all while switched off, the convention of the heterogeneity knobs.

Mechanisms (all default OFF)
----------------------------
a. **Bounce viewers** (``bounce_share``). KuaiLive shop rooms: about 81% of
   entries leave within seconds (median ≈ 5 s) while engaged viewers stay a
   median 3.6 min (docs/benchmarks/kuailive-calibration.md). Bounces arrive on
   an extra stream at ``share/(1-share)`` times the engaged arrival rate, so the
   ENGAGED audience trajectory is untouched and only short, low-exposure visits
   are added. Dwell is lognormal with median ``bounce_median_s``.
b. **Delayed orders** (``click_to_order``, ``order_delay_median_s``). A pure
   post-processing step, :func:`orders_from_clicks`: each click converts with
   probability ``click_to_order`` (ASSUMPTION — no live-commerce click→order
   rate for small Vietnamese sellers is published; 0.08 is the working value)
   after a Gamma delay. Orders landing after the session end are dropped (the
   platform would book them, the session-level analysis cannot see them).
   This is carryover through the OUTCOME: an ON block's clicks become orders
   inside the following block.
c. **Traffic feedback** (``beta_q``). Platforms push more traffic to rooms that
   convert (TikTok calls Show GPM an indicator of traffic quality; Douyin's
   "赛马" pool logic is folklore, not a published rule — so this is a knob, not
   a calibrated fact). Arrival rate ``λ(t) = λ0(t)·exp(β·clip(Q(t-τ)-1, -1, 1))``
   where ``Q`` is an EWMA of realised clicks relative to the no-treatment
   expectation. Implemented by THINNING to keep common random numbers: the
   number of candidate arrivals is drawn at ``λmax = λ0·e^β`` (independent of
   the arm), every candidate draws its dwell, and it is kept iff an independent
   uniform falls below ``λ(t)/λmax``. The CRN arms therefore share every draw
   and differ only through ``Q``.
d. **Several products** (``products``, ``focal_product``). Each click is
   attributed to a product: the pinned one with probability ``pin_share``,
   otherwise uniformly among the rest. ON blocks pin the focal product (the
   option LiveLift is testing); OFF blocks follow ``control_pin_policy``
   (``"rotate"``: the host's own list, one product per block). The outcome the
   estimator sees still counts clicks on ALL products — the net effect a seller
   cares about. Cannibalisation between products is NOT modelled in v1.

Estimands
---------
:func:`true_effect_liveroom` returns the block-rate contrast (the pre-registered
outcome, clicks or orders per 1000 viewer-seconds) and :func:`gte_total_per_min`
the global treatment effect on the TOTAL outcome count per minute. Under
traffic feedback the two diverge: ON also brings more viewers, which a rate
cannot show. Reporting both is the point of mechanism (c).
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field, replace

from livelift.core.assigner.outer import ON, Schedule
from livelift.core.features import Event
from livelift.sim.simulator import (
    _FRAILTY_STREAM,
    SimOutput,
    SimParams,
    _binomial,
    _carryover_exposure,
    _frailty_clicks,
    _phase_curve,
    _poisson,
    session_click_multiplier,
)

_BOUNCE_STREAM = 0xB0C3
"""XOR offset for bounce arrivals and their dwell."""

_THIN_STREAM = 0x7417
"""XOR offset for the thinning uniforms of the traffic-feedback knob."""

_ORDER_STREAM = 0x0D3E
"""XOR offset for click→order conversion and delay draws."""

_PRODUCT_STREAM = 0x9D0C
"""XOR offset for attributing clicks to products."""

CONTROL_PIN_POLICIES: tuple[str, ...] = ("rotate", "none")


@dataclass(frozen=True)
class LiveRoomParams:
    """Parameters of a LiveRoomSim world. Every knob below defaults to OFF.

    ``base`` carries the calibrated :class:`SimParams` (KuaiLive dwell and
    comment rates, the treatment effect, carryover, heterogeneity knobs).
    """

    base: SimParams = field(default_factory=SimParams)
    # (a) bounce viewers
    bounce_share: float = 0.0
    bounce_median_s: float = 5.0
    bounce_sigma: float = 1.0
    # (b) delayed orders — applied by orders_from_clicks()
    click_to_order: float = 0.0
    order_delay_median_s: float = 90.0
    order_delay_shape: float = 2.0
    # (c) traffic feedback
    beta_q: float = 0.0
    tau_q_s: float = 60.0
    q_halflife_s: float = 60.0
    # (d) several products
    products: tuple[str, ...] = ("P1",)
    focal_product: str = "P1"
    control_pin_policy: str = "rotate"
    pin_share: float = 0.6

    def __post_init__(self) -> None:
        if not 0.0 <= self.bounce_share < 1.0:
            raise ValueError(f"bounce_share phải trong [0, 1) (nhận {self.bounce_share})")
        if not 0.0 <= self.click_to_order <= 1.0:
            raise ValueError(f"click_to_order phải trong [0, 1] (nhận {self.click_to_order})")
        if self.beta_q < 0:
            raise ValueError(f"beta_q phải ≥ 0 (nhận {self.beta_q})")
        if self.order_delay_median_s < 0 or self.order_delay_shape <= 0:
            raise ValueError("order_delay_median_s ≥ 0 và order_delay_shape > 0")
        if not self.products:
            raise ValueError("products không được rỗng")
        if self.focal_product not in self.products:
            raise ValueError(f"focal_product {self.focal_product!r} không có trong products")
        if self.control_pin_policy not in CONTROL_PIN_POLICIES:
            raise ValueError(f"control_pin_policy phải thuộc {CONTROL_PIN_POLICIES}")
        if not 0.0 <= self.pin_share <= 1.0:
            raise ValueError(f"pin_share phải trong [0, 1] (nhận {self.pin_share})")


def _as_liveroom(params: LiveRoomParams | SimParams) -> LiveRoomParams:
    return params if isinstance(params, LiveRoomParams) else LiveRoomParams(base=params)


def _pinned_product(
    t_s: float, schedule: Schedule, params: LiveRoomParams, override: str | None
) -> str | None:
    """Product on the pin at time ``t_s``: focal in ON, the host's choice in OFF."""
    block = None
    for b in schedule.measurement_blocks:
        if b.start_offset_s <= t_s < b.end_offset_s:
            block = b
            break
    if override == "all_on":
        arm_on = True
    elif override == "all_off":
        arm_on = False
    else:
        arm_on = block is not None and block.assignment == ON
    if arm_on:
        return params.focal_product
    if params.control_pin_policy == "none":
        return None
    index = block.index if block is not None else int(t_s // 300)
    return params.products[index % len(params.products)]


def simulate_liveroom(
    schedule: Schedule,
    params: LiveRoomParams | SimParams,
    seed: int,
    override: str | None = None,
) -> SimOutput:
    """Simulate one live room. Same signature and output as ``simulate_session``.

    Delayed orders are NOT added here — call :func:`orders_from_clicks` on the
    result (kept separate so the click stream, the pre-registered outcome, is the
    same object whether or not orders are studied).
    """
    lp = _as_liveroom(params)
    p = lp.base
    cv = p.click_frailty_cv
    sigma = p.session_click_sigma
    if cv < 0:
        raise ValueError(f"click_frailty_cv phải ≥ 0 (nhận {cv})")
    if sigma < 0:
        raise ValueError(f"session_click_sigma phải ≥ 0 (nhận {sigma})")

    # --- the historical streams, consumed in the historical order -----------
    world_rng = random.Random(seed)
    click_rng = random.Random(seed ^ 0x5EED)

    session_s = schedule.session_duration_min * 60
    tick = p.tick_s
    session_shock = math.exp(world_rng.gauss(0.0, p.session_shock_sd))
    session_click_mult = session_click_multiplier(seed, sigma)

    use_frailty = cv > 0
    frailty_rng = random.Random(seed ^ _FRAILTY_STREAM)
    frailty_shape = 1.0 / cv**2 if use_frailty else 0.0
    frailty_scale = cv**2 if use_frailty else 0.0

    # --- LiveRoom streams: created always, drawn from only when a knob is on --
    use_bounce = lp.bounce_share > 0
    use_feedback = lp.beta_q > 0
    use_products = len(lp.products) > 1
    bounce_rng = random.Random(seed ^ _BOUNCE_STREAM)
    thin_rng = random.Random(seed ^ _THIN_STREAM)
    product_rng = random.Random(seed ^ _PRODUCT_STREAM)
    bounce_ratio = lp.bounce_share / (1.0 - lp.bounce_share) if use_bounce else 0.0
    bounce_mu = math.log(max(lp.bounce_median_s, 1e-9))

    events: list[Event] = []
    viewers_trace: list[float] = []
    stays: list[float] = []
    frailties: list[float] = []
    bounce_stays: list[float] = []
    ar_noise = 0.0

    p_click_tick = p.base_click_prob_per_min * tick / 60.0 * session_click_mult
    arrival_tick = p.base_arrival_per_min * tick / 60.0
    hazard = tick / (p.mean_stay_min * 60.0)

    # traffic-feedback state
    q_alpha = 1.0 - 0.5 ** (tick / lp.q_halflife_s) if use_feedback else 0.0
    q_value = 1.0
    q_history: list[float] = []
    lag_ticks = max(0, round(lp.tau_q_s / tick)) if use_feedback else 0

    last_pin: str | None = None
    t = 0
    while t < session_s:
        phase_mult = _phase_curve(t, session_s)
        lam = arrival_tick * phase_mult * session_shock

        if use_feedback:
            q_lag = q_history[-lag_ticks - 1] if len(q_history) > lag_ticks else 1.0
            accept_p = math.exp(lp.beta_q * (max(-1.0, min(1.0, q_lag - 1.0)) - 1.0))
            # λmax = λ·e^β is independent of the arm, so every candidate and its
            # dwell are shared by the CRN arms; only acceptance differs via Q.
            n_cand = _poisson(world_rng, lam * math.exp(lp.beta_q))
            for _ in range(n_cand):
                stay = -math.log(max(world_rng.random(), 1e-12)) / hazard * tick
                frail = (
                    frailty_rng.gammavariate(frailty_shape, frailty_scale) if use_frailty else None
                )
                if thin_rng.random() < accept_p:
                    stays.append(stay)
                    if frail is not None:
                        frailties.append(frail)
        else:
            accept_p = 1.0
            n_arrive = _poisson(world_rng, lam)
            for _ in range(n_arrive):
                stay = -math.log(max(world_rng.random(), 1e-12)) / hazard * tick
                stays.append(stay)
                if use_frailty:
                    frailties.append(frailty_rng.gammavariate(frailty_shape, frailty_scale))

        if use_bounce:
            lam_b = lam * bounce_ratio * (math.exp(lp.beta_q) if use_feedback else 1.0)
            for _ in range(_poisson(bounce_rng, lam_b)):
                dwell = math.exp(bounce_rng.gauss(bounce_mu, lp.bounce_sigma))
                keep = thin_rng.random() < accept_p if use_feedback else True
                if keep:
                    bounce_stays.append(dwell)

        # departures (engaged: historical code path, bounce: own list)
        if use_frailty:
            alive = [(s - tick, u) for s, u in zip(stays, frailties, strict=True) if s - tick > 0]
            stays = [s for s, _ in alive]
            frailties = [u for _, u in alive]
        else:
            stays = [s - tick for s in stays]
            stays = [s for s in stays if s > 0]
        if use_bounce:
            bounce_stays = [s - tick for s in bounce_stays]
            bounce_stays = [s for s in bounce_stays if s > 0]
        n_engaged = len(stays)
        n_viewers = n_engaged + len(bounce_stays)

        ar_noise = p.ar1_rho * ar_noise + world_rng.gauss(0.0, p.ar1_sd)
        noise_mult = math.exp(ar_noise - p.ar1_sd**2 / (2 * (1 - p.ar1_rho**2 + 1e-9)))

        exposure = _carryover_exposure(t, schedule, p.carryover_halflife_s, override)
        lift = 1.0 + p.treatment_effect * exposure
        p_raw = p_click_tick * noise_mult * lift
        p_click = min(p_raw, 1.0)

        if use_frailty:
            pool = frailties + [1.0] * len(bounce_stays) if use_bounce else frailties
            n_clicks = _frailty_clicks(click_rng, p_raw, pool)
        else:
            n_clicks = _binomial(click_rng, n_viewers, p_click)

        if use_products:
            pinned = _pinned_product(t, schedule, lp, override)
            if pinned != last_pin:
                if pinned is not None:
                    events.append(Event("pin", float(t), product_id=pinned))
                last_pin = pinned
        for _ in range(n_clicks):
            ts = t + click_rng.random() * tick
            product = "P1"
            if use_products:
                product = _attribute(product_rng, lp, pinned)
            events.append(Event("click", ts, product_id=product))

        n_comments = _poisson(click_rng, n_viewers * p.comment_rate_per_viewer_min * tick / 60.0)
        for _ in range(n_comments):
            events.append(Event("comment", t + click_rng.random() * tick))
        n_likes = _poisson(click_rng, n_viewers * p.like_rate_per_viewer_min * tick / 60.0)
        for _ in range(n_likes):
            events.append(Event("like", t + click_rng.random() * tick))

        events.append(Event("viewer_count", t, value=float(n_viewers)))
        viewers_trace.append(float(n_viewers))

        if use_feedback:
            # Q: realised clicks over the clicks expected WITHOUT treatment for
            # the viewers present (mean noise is 1 by construction), smoothed.
            expected = n_viewers * min(p_click_tick, 1.0)
            ratio = n_clicks / expected if expected > 1e-9 else 1.0
            q_value = (1.0 - q_alpha) * q_value + q_alpha * ratio
            q_history.append(q_value)
        t += tick

    return SimOutput(events=events, viewers_trace=viewers_trace)


def _attribute(rng: random.Random, lp: LiveRoomParams, pinned: str | None) -> str:
    others = [x for x in lp.products if x != pinned]
    if pinned is not None and (not others or rng.random() < lp.pin_share):
        return pinned
    return others[int(rng.random() * len(others))] if others else lp.products[0]


def _gamma_median_factor(shape: float) -> float:
    """median / scale of a Gamma(shape) (Choi's approximation, exact enough ≥ 1)."""
    if shape >= 1.0:
        return shape - 1.0 / 3.0 + 8.0 / (405.0 * shape)
    return shape * math.log(2.0) ** (1.0 / shape)  # rough, small-shape fallback


def orders_from_clicks(
    out: SimOutput,
    params: LiveRoomParams | SimParams,
    seed: int,
    session_s: float,
) -> SimOutput:
    """Return ``out`` with delayed ``"order"`` events appended.

    Each click converts with probability ``click_to_order`` after a Gamma delay
    with median ``order_delay_median_s``. Draws come from a dedicated stream
    and happen only when ``click_to_order > 0``; with the knob off the input is
    returned unchanged.
    """
    lp = _as_liveroom(params)
    if lp.click_to_order <= 0:
        return out
    rng = random.Random(seed ^ _ORDER_STREAM)
    shape = lp.order_delay_shape
    scale = (
        lp.order_delay_median_s / _gamma_median_factor(shape) if lp.order_delay_median_s else 0.0
    )
    orders: list[Event] = []
    for e in out.events:
        if e.kind != "click":
            continue
        if rng.random() >= lp.click_to_order:
            continue
        delay = rng.gammavariate(shape, scale) if scale > 0 else 0.0
        ts = e.ts_offset_s + delay
        if ts < session_s:
            orders.append(Event("order", ts, product_id=e.product_id))
    return SimOutput(events=out.events + orders, viewers_trace=out.viewers_trace)


def simulate_with_orders(
    schedule: Schedule,
    params: LiveRoomParams | SimParams,
    seed: int,
    override: str | None = None,
) -> SimOutput:
    """:func:`simulate_liveroom` followed by :func:`orders_from_clicks`."""
    out = simulate_liveroom(schedule, params, seed, override)
    return orders_from_clicks(out, params, seed, schedule.session_duration_min * 60)


def true_effect_liveroom(
    schedule: Schedule,
    params: LiveRoomParams | SimParams,
    seed: int,
    burn_in_s: int = 60,
    outcome_kind: str = "click",
) -> float:
    """Block-rate ground truth by common random numbers (all-ON minus all-OFF),
    over the blocks the estimator would keep — same rule as
    :func:`livelift.sim.simulator.true_effect`."""
    from livelift.core.features import block_frame

    on = simulate_with_orders(schedule, params, seed, override="all_on")
    off = simulate_with_orders(schedule, params, seed, override="all_off")
    f_on = block_frame(schedule, on.events, burn_in_s=burn_in_s, outcome_kind=outcome_kind)
    f_off = block_frame(schedule, off.events, burn_in_s=burn_in_s, outcome_kind=outcome_kind)
    keep = [
        i for i, (a, b) in enumerate(zip(f_on, f_off, strict=True)) if a.measurable and b.measurable
    ]
    if not keep:
        return 0.0
    return sum(f_on[i].y for i in keep) / len(keep) - sum(f_off[i].y for i in keep) / len(keep)


def gte_total_per_min(
    schedule: Schedule,
    params: LiveRoomParams | SimParams,
    seed: int,
    outcome_kind: str = "click",
) -> tuple[float, float]:
    """(total-per-minute difference all-ON minus all-OFF, all-OFF total per
    minute): the global treatment effect on the COUNT, which includes the extra
    viewers traffic feedback brings in and a rate cannot show."""
    minutes = schedule.session_duration_min
    on = simulate_with_orders(schedule, params, seed, override="all_on")
    off = simulate_with_orders(schedule, params, seed, override="all_off")
    n_on = sum(1 for e in on.events if e.kind == outcome_kind and e.is_valid)
    n_off = sum(1 for e in off.events if e.kind == outcome_kind and e.is_valid)
    return (n_on - n_off) / minutes, n_off / minutes


# --- presets (all MÔ PHỎNG) --------------------------------------------------

DEMO_PRODUCTS: tuple[str, ...] = ("P-SAP", "P-BINH", "P-AO", "P-NON", "P-KEP")


def preset_clean(effect: float = 0.3) -> LiveRoomParams:
    """No interference: the world the switchback estimator is built for."""
    return LiveRoomParams(base=SimParams(treatment_effect=effect))


def preset_carryover(effect: float = 0.3) -> LiveRoomParams:
    """Effects linger 2 minutes and half the clicks' orders arrive ~90 s later."""
    return LiveRoomParams(
        base=SimParams(treatment_effect=effect, carryover_halflife_s=120.0),
        click_to_order=0.08,
        order_delay_median_s=90.0,
    )


def preset_feedback(effect: float = 0.3) -> LiveRoomParams:
    """The platform sends more viewers to a room that converts (β = 0.5)."""
    return LiveRoomParams(base=SimParams(treatment_effect=effect), beta_q=0.5)


BUSY_ROOM_AUDIENCE_MULT = 4.9
"""Audience multiplier of the "busy room" scenario in docs/benchmarks/order-mde.md."""


def preset_busy_room(effect: float = 0.3) -> LiveRoomParams:
    """A busier room (×4.9 arrivals) with five products, bounces and orders —
    the setting in which order counts carry any statistical power at all."""
    base = SimParams(treatment_effect=effect)
    base = replace(base, base_arrival_per_min=base.base_arrival_per_min * BUSY_ROOM_AUDIENCE_MULT)
    return LiveRoomParams(
        base=base,
        bounce_share=0.81,
        click_to_order=0.08,
        order_delay_median_s=90.0,
        products=DEMO_PRODUCTS,
        focal_product=DEMO_PRODUCTS[1],
    )

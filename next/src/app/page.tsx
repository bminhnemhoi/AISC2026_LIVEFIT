"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import type { Session } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { Button, EnvironmentBadge } from "@/components/ui";
import { RoomStatusPanel } from "@/components/ops/ConnectionStatus";
import { SegmentTile } from "@/components/ops/SegmentTile";
import { Signal } from "@/components/ops/StatusChips";
import { FirstRunHero, IdleCard, LoopGuideStrip, TruthPanel } from "@/components/onboarding/HomeOnboarding";
import { deriveLoopGuide } from "@/components/onboarding/loop";
import {
  baselinePlan,
  buildReview,
  currentPlan,
  formatClock,
  formatDay,
  formatDuration,
  proposeChanges,
} from "@/lib/domain";
import { useSessions } from "@/lib/store/hooks";

const byRecency = (a: Session, b: Session): number =>
  (a.environment === b.environment ? 0 : a.environment === "REAL" ? -1 : 1) || b.updatedAtMs - a.updatedAtMs;

function firstProduct(session: Session) {
  const seg = baselinePlan(session).segments.find((s) => s.productId);
  return seg ? (session.products.find((p) => p.id === seg.productId) ?? null) : null;
}

export default function HomePage(): React.ReactElement {
  const { hydrated, sessions, remote } = useSessions();
  // The room could not be asked at all: say why, rather than showing an empty home or first-time setup.
  const roomProblem = remote.active && remote.snapshot === null && remote.problem !== null;

  const { active, prepared, ended } = useMemo(
    () => ({
      active: sessions.filter((s) => s.lifecycle === "active").sort(byRecency),
      prepared: sessions.filter((s) => s.lifecycle === "planned").sort(byRecency),
      ended: sessions.filter((s) => s.lifecycle === "ended").sort(byRecency),
    }),
    [sessions]
  );
  const lead = active[0] ?? null;
  const guide = useMemo(() => deriveLoopGuide(sessions), [sessions]);
  // Rehearsals ship with the app, so "first run" means the operator has no REAL show of their own yet.
  const hasOwnShows = sessions.some((s) => s.environment === "REAL");
  const sampleReview = ended.find((s) => s.environment === "SIMULATED") ?? null;
  // The guide ranks the operator's own shows ahead of rehearsals, so the next move follows their loop.
  const currentStep = guide.steps.find((s) => s.id === guide.current);
  const idleNext = currentStep?.href && guide.current !== "create" ? { href: currentStep.href, label: currentStep.action } : null;
  const leadSegment = lead
    ? currentPlan(lead).segments.find((s) => s.id === lead.runtime.currentSegmentId) ?? null
    : null;

  return (
    <StandardShell activeSessionId={lead?.id ?? null} activeSessionTitle={lead?.title ?? null}>
      <div className="flex-1 overflow-y-auto w-full max-w-[1160px] mx-auto px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-[720px]">
            <h1 className="text-[34px] leading-[1.2] font-medium tracking-[-0.6px] text-[#F5F7FC]">Your LIVE desk</h1>
            <p className="text-[16px] leading-6 text-[#B7C1CE] mt-1.5">The operating desk for a TikTok Shop LIVE: plan it, run it, review it, and carry what you learn into the next.</p>
          </div>
          {/* The idle and first-run cards below carry their own Create LIVE; a second one beside the title is noise. */}
          {!(hydrated && !lead && !roomProblem) && (
            <Link href="/live/new" className="shrink-0">
              <Button variant="secondary" icon="ri-add-line">Create LIVE</Button>
            </Link>
          )}
        </div>

        {!hydrated ? (
          <div className="mt-8 rounded-[12px] bg-[#13161C] p-8 text-[#9AA5B5]" role="status">
            Loading your shows…
          </div>
        ) : roomProblem && !lead ? (
          <div className="mt-8">
            <RoomStatusPanel />
          </div>
        ) : lead ? (
          <div className="mt-8 rounded-[12px] bg-[#1B1F27] p-6 lg:p-7" data-testid="active-live-card">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] font-semibold tracking-[1.7px] text-[#DFFF00] uppercase">Active LIVE</span>
              <span className="inline-flex items-center gap-2 text-[15px] font-medium text-[#DFFF00]">
                <i className="ri-record-circle-line" aria-hidden="true" />
                {lead.environment} · Tracking active
              </span>
            </div>
            <div className="flex items-center justify-between gap-6 mt-5 flex-wrap md:flex-nowrap">
              <div className="flex gap-4 items-center min-w-0">
                <SegmentTile
                  segment={leadSegment ?? { kind: "opening", title: lead.title }}
                  product={leadSegment?.productId ? (lead.products.find((p) => p.id === leadSegment.productId) ?? null) : null}
                  size={72}
                  active
                />
                <div className="min-w-0">
                  <h2 className="text-[24px] font-medium tracking-[-0.6px] text-[#F5F7FC] truncate">{lead.title}</h2>
                  <p className="text-[15px] text-[#C8CDD6] mt-1">
                    {leadSegment ? `Current segment · ${leadSegment.title}` : "Between segments"}
                    {lead.runtime.startedAtMs !== null && ` · started ${formatClock(lead.runtime.startedAtMs, lead.timezone, true)}`}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] text-[#B7C1CE]">{lead.operator.name} is Lead</p>
                {active.length > 1 && <p className="text-[13px] text-[#9AA5B5]">+{active.length - 1} other active show{active.length === 2 ? "" : "s"}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-[#262C38] flex-wrap">
              <p className="text-[15px] text-[#C8CDD6]">Manual operation available · Realtime unavailable</p>
              <Link href={`/live/${lead.id}/operate`}>
                <Button variant="primary" size="lg" icon="ri-arrow-right-line" data-testid="continue-live-btn">
                  Continue LIVE
                </Button>
              </Link>
            </div>
          </div>
        ) : hasOwnShows ? (
          <IdleCard next={idleNext} />
        ) : (
          <FirstRunHero reviewHref={sampleReview ? `/live/${sampleReview.id}/review` : null} />
        )}

        {hydrated && <LoopGuideStrip guide={guide} compact={hasOwnShows} showCurrent={!(roomProblem && !lead)} />}

        {hydrated && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
            <div>
              {/* Same 44px header row as "Finish the review" (its All sessions link sets that height), so both lists start level. */}
              <div className="flex items-center min-h-[44px] mb-2">
                <h2 className="text-[22px] font-medium tracking-[-0.5px] text-[#F5F7FC]">Prepared for next</h2>
              </div>
              {prepared.length > 0 ? (
                <ul className="divide-y divide-[#232935]" data-testid="prepared-list">
                  {prepared.slice(0, 6).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 py-4">
                      <div className="flex gap-3.5 items-center min-w-0">
                        <SegmentTile segment={{ kind: "opening", title: s.title }} product={firstProduct(s)} size={50} />
                        <div className="min-w-0">
                          <h3 className="text-[18px] font-medium text-[#F5F7FC] truncate">{s.title}</h3>
                          <p className="text-[14px] text-[#B7C1CE] mt-0.5 tabular-nums">
                            {formatDay(baselinePlan(s).plannedStartMs, s.timezone)} · {formatClock(baselinePlan(s).plannedStartMs, s.timezone)} · {s.timezone}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <EnvironmentBadge environment={s.environment} size="sm" />
                            <Signal tone="muted" icon="ri-time-line">Prepared</Signal>
                          </div>
                        </div>
                      </div>
                      <Link href={`/live/${s.id}/prepare`} className="shrink-0">
                        <Button variant="ghost" size="sm" icon="ri-arrow-right-line">Open Prepare</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[15px] text-[#9AA5B5] py-4" data-testid="prepared-empty">
                  Nothing prepared yet. A LIVE you create waits here until you start it.{" "}
                  <Link href="/live/new" className="underline underline-offset-4 text-[#CAD0DA] hover:text-[#DFFF00]">Create a LIVE</Link>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 mb-2">
                <h2 className="text-[22px] font-medium tracking-[-0.5px] text-[#F5F7FC]">Finish the review</h2>
                <Link href="/sessions" className="min-h-[44px] text-[15px] text-[#CAD0DA] hover:text-[#DFFF00] inline-flex items-center gap-1 transition-colors">
                  <span>All sessions</span>
                  <i className="ri-arrow-right-line" aria-hidden="true" />
                </Link>
              </div>
              {ended.length > 0 ? (
                <ul className="divide-y divide-[#232935]" data-testid="ended-list">
                  {ended.slice(0, 6).map((s) => {
                    const review = buildReview(s);
                    const adjustments = proposeChanges(s).length;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-4 py-4">
                        <div className="min-w-0">
                          <h3 className="text-[18px] font-medium text-[#F5F7FC] truncate">{s.title}</h3>
                          <p className="text-[14px] text-[#B7C1CE] mt-0.5 tabular-nums">
                            {review ? `${formatDuration(review.summary.trackedSec)} tracked` : "Ended"}
                            {review && review.summary.anchors.late + review.summary.anchors.cancelled > 0
                              ? ` · ${review.summary.anchors.late + review.summary.anchors.cancelled} anchor miss`
                              : ""}
                            {adjustments > 0 ? ` · ${adjustments} adjustment${adjustments === 1 ? "" : "s"} ready` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <EnvironmentBadge environment={s.environment} size="sm" />
                            <Signal tone="muted" icon="ri-stop-circle-line">Ended</Signal>
                          </div>
                        </div>
                        <Link href={`/live/${s.id}/review${adjustments > 0 ? "?view=next" : ""}`} className="shrink-0">
                          <Button variant="ghost" size="sm" icon="ri-arrow-right-line">{adjustments > 0 ? "Review changes" : "Open Review"}</Button>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[15px] text-[#9AA5B5] py-4" data-testid="ended-empty">
                  Nothing to review yet. Review opens as soon as a show ends, with the plan beside what was recorded.
                </p>
              )}
            </div>
          </div>
        )}

        <TruthPanel />
      </div>
    </StandardShell>
  );
}

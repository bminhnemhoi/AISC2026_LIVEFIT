"use client";

import React, { useId, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@/contracts";
import { Button } from "@/components/ui";
import { buildReview, formatClock, type Review } from "@/lib/domain";
import { buildLedger } from "@/lib/intelligence/capabilities";
import { cell, formatCount } from "@/lib/intelligence/format";
import { DEFAULT_FIXTURE_SCENARIO, fixtureResultFor, type FixtureScenarioId } from "@/lib/intelligence/fixtures";
import type { LiveIntelligenceSnapshot } from "@/lib/intelligence/types";
import { recordedWindows, seriesStat } from "@/lib/intelligence/windows";
import { CapabilityLedger } from "./CapabilityLedger";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { EvidenceRefreshControl, FixtureBanner, FixturePicker, LaterDisclosure, ValueText } from "./EvidenceParts";
import { ObservationsSection } from "./LaterEvidenceView";
import { ProductPerformanceTable } from "./ProductPerformanceTable";
import { ProviderStatePanel } from "./ProviderState";
import { SegmentAttributionTable } from "./SegmentAttributionTable";
import { useLiveIntelligence, useProviderCapabilities } from "./useLiveIntelligence";

/**
 * Insights: PLATFORM EVIDENCE. Provider-observed data, kept apart from LiveLift's own operations analytics.
 *
 * Nothing is fetched or shown until the operator asks. A SIMULATED rehearsal never shows provider evidence by default;
 * its only evidence is a fixture, behind an explicit, clearly labelled opt-in. A REAL show asks the server.
 */

/** Until evidence is actually on screen, each provider metric is plainly unavailable: never a number, never zero. */
function UnavailableMetrics(): React.ReactElement {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[#9AA5B5]" aria-label="Provider metrics, all unavailable" data-testid="metrics-unavailable">
      {["Views", "GMV", "CTR", "Conversion", "Engagement", "Sales"].map((m) => (
        <li key={m}>
          <span className="text-[#CAD0DA]">{m}</span> <span aria-hidden="true">—</span> Unavailable
        </li>
      ))}
    </ul>
  );
}

const UNAVAILABLE_LEAD =
  "Unavailable: no provider-observed TikTok Shop / LIVE metrics are supplied to Insights. Account connection does not supply show performance analytics. Views, GMV, CTR, conversion, engagement, and sales remain unavailable.";

function TrendTable({ sessions, scenario, tz }: { sessions: Session[]; scenario: FixtureScenarioId; tz: string }): React.ReactElement | null {
  const rows = useMemo(() => {
    const out: Array<{ session: Session; review: Review; snapshot: LiveIntelligenceSnapshot }> = [];
    for (const s of sessions) {
      if (s.environment !== "SIMULATED") continue;
      const review = buildReview(s);
      if (!review) continue;
      const r = fixtureResultFor(s, review, scenario);
      if (r?.kind === "available") out.push({ session: s, review, snapshot: r.snapshot });
    }
    return out.slice(0, 6);
  }, [sessions, scenario]);
  if (rows.length < 2) return null;

  const total = (snap: LiveIntelligenceSnapshot, key: "clicks" | "orders" | "gmv") => {
    const s = seriesStat(snap.minuteBuckets, key);
    if (s.sum === null) return <ValueText cell={cell(null, "missing")} />;
    return (
      <>
        {s.missing > 0 && <span className="text-[#CAD0DA]">≥ </span>}
        <ValueText cell={cell(s.sum, "available", { metric: key,  })} />
        {s.missing > 0 && <span className="block text-[12px] text-[#9AA5B5]">{formatCount(s.missing)} min not recorded</span>}
      </>
    );
  };

  return (
    <section className="rounded-[12px] bg-[#13161C] p-3 sm:p-4" aria-label="Later-evidence trend" data-testid="evidence-trend">
      <h3 className="text-[18px] font-medium text-[#F5F7FC]">Later-evidence trend</h3>
      <p className="mt-0.5 max-w-[720px] text-[14px] leading-snug text-[#9AA5B5]">
        Totals from each show&apos;s fixture provider minutes. Where minutes were not recorded the total is a lower bound (≥), never filled in. Different shows are different audiences and days, so a difference is not a verdict.
      </p>
      <div className="mt-2 overflow-x-auto rounded-[8px] border border-[#2A303A] focus-visible:outline-2 focus-visible:outline-[#DFFF00]" tabIndex={0} role="region" aria-label="Later-evidence totals by show">
        <table className="w-full text-left text-[15px]">
          <caption className="sr-only">Fixture provider evidence totals by show</caption>
          <thead className="bg-[#1B1F27] text-[14px] text-[#CAD0DA]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Show</th>
              <th scope="col" className="px-3 py-2 font-medium">Clicks</th>
              <th scope="col" className="px-3 py-2 font-medium">Orders</th>
              <th scope="col" className="px-3 py-2 font-medium">GMV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232935]">
            {rows.map(({ session, snapshot, review }) => (
              <tr key={session.id}>
                <th scope="row" className="min-w-[160px] px-3 py-2.5 align-top font-normal">
                  <span className="font-medium text-[#F5F7FC]">{session.title}</span>
                  <span className="block text-[13px] text-[#9AA5B5]">{formatClock(review.summary.startedAtMs, tz)} start</span>
                </th>
                <td className="px-3 py-2.5 align-top">{total(snapshot, "clicks")}</td>
                <td className="px-3 py-2.5 align-top">{total(snapshot, "orders")}</td>
                <td className="px-3 py-2.5 align-top">{total(snapshot, "gmv")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlatformEvidencePanel({ session, sameEnvironmentSessions }: { session: Session | null; sameEnvironmentSessions: Session[] }): React.ReactElement {
  const uid = useId();
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const [scenario, setScenario] = useState<FixtureScenarioId>(DEFAULT_FIXTURE_SCENARIO);
  const review = useMemo(() => (session ? buildReview(session) : null), [session]);
  const requested = session !== null && requestedFor === session.id;
  const simulated = session?.environment === "SIMULATED";
  const intelligence = useLiveIntelligence({
    session,
    review,
    enabled: requested && session !== null,
    scenario,
  });
  const capabilities = useProviderCapabilities(requested && !simulated);
  const tz = session?.timezone ?? "UTC";
  const state = intelligence.state;

  return (
    <section className="space-y-4" aria-labelledby={`${uid}-h`} data-testid="platform-evidence" data-environment={session?.environment ?? "none"}>
      <div className="min-w-0">
        <h2 id={`${uid}-h`} className="text-[22px] font-medium tracking-[-0.3px]">
          Platform evidence
        </h2>
        <p className="mt-1 max-w-[760px] text-[15px] leading-relaxed text-[#B7C1CE]">
          Provider-observed TikTok data, fetched after a LIVE. It is kept apart from the LiveLift operations analytics above: the two are different kinds of evidence and are never added together. Observation does not establish causation.
        </p>
      </div>

      {!session ? (
        <p className="rounded-[12px] bg-[#13161C] px-4 py-4 text-[15px] text-[#CAD0DA]" data-testid="platform-evidence-none">
          Choose a session above to see its provider evidence.
        </p>
      ) : !review ? (
        <p className="rounded-[12px] bg-[#13161C] px-4 py-4 text-[15px] text-[#CAD0DA]" data-testid="platform-evidence-not-ended">
          Provider evidence is a post-LIVE record, so it only exists once a show has ended and its tracking was recorded. “{session.title}” has not.
        </p>
      ) : !requested ? (
        <div className="rounded-[12px] bg-[#13161C] px-4 py-4" data-testid="platform-evidence-idle">
          <p className="max-w-[760px] text-[15px] leading-relaxed text-[#CAD0DA]">{simulated ? UNAVAILABLE_LEAD : "Provider evidence is fetched when you ask, for one show at a time. Account connection alone does not supply show performance analytics."}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="md" icon={simulated ? "ri-flask-line" : "ri-database-2-line"} onClick={() => setRequestedFor(session.id)} data-testid="platform-evidence-request">
              {simulated ? "Show fixture provider evidence" : "Check provider evidence"}
            </Button>
            {simulated && <span className="text-[14px] text-[#9AA5B5]">A SIMULATED demo. It is labelled as fixture data and never mixed with REAL evidence.</span>}
            <Link href="/integrations" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[8px] px-3 text-[15px] text-[#CAD0DA] hover:bg-[#1E232B] hover:text-white">
              Provider access
              <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4" data-testid="platform-evidence-body" data-state={state.kind}>
          <EvidenceRefreshControl intelligence={intelligence} session={session} />
          {simulated && (
            <FixtureBanner>
              <FixturePicker value={scenario} onChange={setScenario} />
            </FixtureBanner>
          )}
          {state.kind === "available" && review ? (
            <>
              <LaterDisclosure origin={state.origin} provider={state.snapshot.provider} fetchedAtMs={state.snapshot.fetchedAt} tz={tz} />
              <EvidenceTimeline snapshot={state.snapshot} windows={recordedWindows(review)} startedAtMs={review.summary.startedAtMs} endedAtMs={review.summary.endedAtMs} tz={tz} />
              <SegmentAttributionTable review={review} snapshot={state.snapshot} tz={tz} />
              <ObservationsSection snapshot={state.snapshot} review={review} tz={tz} origin={state.origin} />
              <ProductPerformanceTable snapshot={state.snapshot} products={session.products} review={review} origin={state.origin} />
              {simulated && <TrendTable sessions={sameEnvironmentSessions} scenario={scenario} tz={tz} />}
            </>
          ) : (
            <ProviderStatePanel state={state} onRetry={intelligence.reload} />
          )}
          {!simulated && (
            <section className="rounded-[12px] bg-[#13161C] p-4" aria-label="Data availability" data-testid="platform-availability">
              <h3 className="text-[18px] font-medium text-[#F5F7FC]">Data availability</h3>
              <CapabilityLedger rows={buildLedger({ loginKit: null, server: capabilities.server })} className="mt-1" />
            </section>
          )}
        </div>
      )}
      {!(session && review && requested && state.kind === "available") && <UnavailableMetrics />}
    </section>
  );
}

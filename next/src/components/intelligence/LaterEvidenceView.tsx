"use client";

import React, { useId, useMemo } from "react";
import type { Session } from "@/contracts";
import { formatClock, formatDay, type Review } from "@/lib/domain";
import type { FixtureScenarioId } from "@/lib/intelligence/fixtures";
import { deriveObservations } from "@/lib/intelligence/observations";
import type { EvidenceOrigin, LiveIntelligenceSnapshot } from "@/lib/intelligence/types";
import { recordedWindows } from "@/lib/intelligence/windows";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { EvidenceRefreshControl, FixtureBanner, FixturePicker, LaterDisclosure, TierLabel, providerName } from "./EvidenceParts";
import { ProductPerformanceTable } from "./ProductPerformanceTable";
import { ProviderStatePanel } from "./ProviderState";
import { SegmentAttributionTable } from "./SegmentAttributionTable";
import type { LiveIntelligenceView } from "./useLiveIntelligence";

/** Observed patterns, worded as associations in a time window. Never a cause. */
export function ObservationsSection({ snapshot, review, tz, origin }: { snapshot: LiveIntelligenceSnapshot; review: Review; tz: string; origin: EvidenceOrigin }): React.ReactElement {
  const uid = useId();
  const { observations, reason } = useMemo(() => deriveObservations(recordedWindows(review), snapshot, tz), [review, snapshot, tz]);
  return (
    <section className="rounded-[12px] bg-[#13161C] p-4" aria-labelledby={`${uid}-h`} data-testid="observations">
      <h3 id={`${uid}-h`} className="text-[18px] font-medium text-[#F5F7FC]">
        Observed patterns
      </h3>
      <p className="mt-0.5 max-w-[760px] text-[14px] leading-snug text-[#9AA5B5]">
        What the provider&apos;s minutes show alongside each segment window. These are associations in time, not causes: they do not show why anything happened.
      </p>
      {observations.length === 0 ? (
        <p className="mt-3 text-[15px] text-[#CAD0DA]" data-testid="no-observations">
          {reason}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#1F2530]">
          {observations.map((o) => (
            <li key={o.id} className="py-2.5" data-testid="observation">
              <p className="text-[16px] leading-snug text-[#F5F7FC]">{o.text}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-[#9AA5B5]">
                <TierLabel origin={origin} className="!text-[13px]" />
                <span>{o.basis}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Provenance({ snapshot, origin, tz }: { snapshot: LiveIntelligenceSnapshot; origin: EvidenceOrigin; tz: string }): React.ReactElement {
  const w = snapshot.providerWindow;
  const rows: Array<[string, React.ReactNode]> = [
    ["Snapshot", <span key="s" className="break-all font-mono text-[12px]">{snapshot.snapshotId}</span>],
    ["Source", providerName(snapshot.provider)],
    ["Evidence tier", <TierLabel key="t" origin={origin} />],
    ["Fetched", `${formatDay(snapshot.fetchedAt, tz)} ${formatClock(snapshot.fetchedAt, tz, true)}`],
    ["Provider window", w ? `${formatClock(w.startMs, tz)}–${formatClock(w.endMs, tz)}` : "Not stated"],
    ["Provider session", snapshot.providerSessionId ? <span key="p" className="font-mono text-[13px]">{snapshot.providerSessionId}</span> : "Not stated"],
    ["Reconciliation", snapshot.reconciliationVersion],
  ];
  return (
    <section className="rounded-[12px] bg-[#13161C] p-4" aria-label="Where this evidence came from" data-testid="provenance">
      <h3 className="text-[16px] font-medium text-[#F5F7FC]">Where this came from</h3>
      <dl className="mt-2 space-y-1.5 text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-[#9AA5B5]">{k}</dt>
            <dd className="min-w-0 text-right text-[#E4E8F0]">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Limits({ snapshot }: { snapshot: LiveIntelligenceSnapshot }): React.ReactElement {
  return (
    <section className="rounded-[12px] bg-[#13161C] p-4" aria-label="What this evidence cannot tell you" data-testid="evidence-limits">
      <h3 className="text-[16px] font-medium text-[#F5F7FC]">What this cannot tell you</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-snug text-[#B7C1CE]">
        {snapshot.evidenceLimits.map((l) => (
          <li key={l}>{l}</li>
        ))}
        <li>Association is not causation. Nothing here says a segment caused a click, an order or a sale.</li>
        <li>A missing value is not zero. “Not recorded” means the provider sent nothing.</li>
      </ul>
    </section>
  );
}

/** The "With later evidence" perspective of an ended show. Read-only: it never writes to the session. */
export function LaterEvidenceView({
  session,
  review,
  intelligence,
  scenario,
  onScenario,
  onRetry,
}: {
  session: Session;
  review: Review;
  intelligence: LiveIntelligenceView;
  scenario: FixtureScenarioId;
  onScenario: (s: FixtureScenarioId) => void;
  onRetry: () => void;
}): React.ReactElement {
  const tz = session.timezone;
  const { state } = intelligence;
  const simulated = session.environment === "SIMULATED";
  const windows = useMemo(() => recordedWindows(review), [review]);

  return (
    <div className="space-y-4" data-testid="later-evidence-view" data-state={state.kind} data-origin={state.kind === "available" ? state.origin : undefined}>
      {/* The one idea of this perspective comes first: this was not known during the LIVE. */}
      {state.kind === "available" && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-[420px]">
            <LaterDisclosure origin={state.origin} provider={state.snapshot.provider} fetchedAtMs={state.snapshot.fetchedAt} tz={tz} />
          </div>

        </div>
      )}
      <EvidenceRefreshControl intelligence={intelligence} session={session} />
      {simulated && (
        <FixtureBanner>
          <FixturePicker value={scenario} onChange={onScenario} />
        </FixtureBanner>
      )}

      {state.kind === "available" ? (
        <>
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <EvidenceTimeline snapshot={state.snapshot} windows={windows} startedAtMs={review.summary.startedAtMs} endedAtMs={review.summary.endedAtMs} tz={tz} />
              <SegmentAttributionTable review={review} snapshot={state.snapshot} tz={tz} />
              <ObservationsSection snapshot={state.snapshot} review={review} tz={tz} origin={state.origin} />
              <ProductPerformanceTable snapshot={state.snapshot} products={session.products} review={review} origin={state.origin} />
            </div>
            <aside className="space-y-4 xl:sticky xl:top-4" aria-label="Evidence provenance and limits">
              <Provenance snapshot={state.snapshot} origin={state.origin} tz={tz} />
              <Limits snapshot={state.snapshot} />
            </aside>
          </div>
        </>
      ) : (
        <ProviderStatePanel state={state} onRetry={onRetry} />
      )}
    </div>
  );
}

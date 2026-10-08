"use client";

import React, { useId, useState } from "react";
import { cell } from "@/lib/intelligence/format";
import { ValueText } from "./EvidenceParts";
import type { HistoricalEvidence } from "@/contracts/liveIntelligence";
import { formatClock } from "@/lib/domain";
import { LANE_LABEL, type ReplayEntry, type ReplayLane, type ReplayModel } from "@/lib/intelligence/replay";

/**
 * "As known then": the operational record in the order it happened, as the operator could have seen it.
 * It answers "why did I decide that, then?" by showing what the plan expected and what was actually running at the
 * moment of each decision or report. Nothing a provider reported afterwards appears here.
 */

const LANE_STYLE: Record<ReplayLane, { icon: string; tone: string }> = {
  plan: { icon: "ri-calendar-line", tone: "text-[#9AA5B5]" },
  actual: { icon: "ri-play-line", tone: "text-[#CAD0DA]" },
  decision: { icon: "ri-route-line", tone: "text-[#DFFF00]" },
  operator: { icon: "ri-hand-heart-line", tone: "text-[#CAD0DA]" },
};

const KEY_LANES: readonly ReplayLane[] = ["plan", "decision", "operator"];

function Entry({ e, tz }: { e: ReplayEntry; tz: string }): React.ReactElement {
  const lane = LANE_STYLE[e.lane];
  const ctx = e.context && (e.context.planned || e.context.actual) ? e.context : null;
  return (
    <li className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[72px_132px_minmax(0,1fr)]" data-testid={`replay-${e.lane}`} data-type={e.type}>
      <span className="pt-0.5 font-mono text-[13px] tabular-nums text-[#AEB7C5]">{formatClock(e.atMs, tz, true)}</span>
      <span className={`col-start-2 flex items-center gap-1.5 text-[14px] sm:col-start-auto ${lane.tone}`}>
        <i className={e.quickCue ? e.quickCue.icon : lane.icon} aria-hidden="true" />
        {e.quickCue ? "Operator report" : LANE_LABEL[e.lane]}
      </span>
      <div className="col-start-2 min-w-0 sm:col-start-auto">
        <p className="text-[16px] leading-snug text-[#F5F7FC]">{e.summary}</p>
        {ctx && (
          <p className="mt-0.5 text-[14px] text-[#9AA5B5]" data-testid="replay-context">
            At that moment: {ctx.planned ? <>plan expected “{ctx.planned}”</> : "no segment planned"}
            {" · "}
            {ctx.actual ? <>“{ctx.actual}” was running</> : "no segment was running"}
          </p>
        )}
        {e.quickCue && <p className="mt-0.5 text-[13px] text-[#9AA5B5]">Reported by {e.actor}. A report, not a platform confirmation.</p>}
      </div>
    </li>
  );
}

export function ReplayTimeline({ replay, tz, historical }: { replay: ReplayModel; tz: string; historical?: { state: string; evidence: HistoricalEvidence | null } }): React.ReactElement {
  const uid = useId();
  const [all, setAll] = useState(false);
  const shown = all ? replay.entries : replay.entries.filter((e) => KEY_LANES.includes(e.lane));
  const hidden = replay.entries.length - replay.entries.filter((e) => KEY_LANES.includes(e.lane)).length;

  return (
    <section className="rounded-[12px] bg-[#13161C] p-4" aria-labelledby={`${uid}-h`} data-testid="known-then-replay">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${uid}-h`} className="text-[18px] font-medium text-[#F5F7FC]">
            What you knew, in order
          </h3>
          <p className="mt-0.5 max-w-[720px] text-[14px] leading-snug text-[#9AA5B5]">
            Only records written while the LIVE ran. Each decision shows what the plan expected and what was actually running at that moment.
          </p>
        </div>
        {hidden > 0 && (
          <button
            type="button"
            aria-pressed={all}
            onClick={() => setAll((v) => !v)}
            data-testid="replay-toggle-all"
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[8px] px-3 text-[15px] text-[#CAD0DA] hover:bg-[#1E232B] hover:text-white"
          >
            <i className={all ? "ri-filter-off-line" : "ri-filter-3-line"} aria-hidden="true" />
            {all ? "Decisions and reports only" : `Show every recorded step (${hidden} more)`}
          </button>
        )}
      </div>
      {historical?.evidence?.providerEvidence.map(e => <ul key={e.telemetryId} className="mt-2 text-[14px] text-[#B4C6DD]" data-testid="known-provider-observations">
        {e.metrics.map(m => <li key={m.key}>{m.source === "fixture" ? "SIMULATED / FIXTURE" : "Provider observed"} · {m.key.replaceAll("_", " ")} · <ValueText cell={cell(m.value, m.availability)} /> · recorded {formatClock(e.recordedAt, tz, true)}</li>)}
      </ul>)}

      <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-[#101319] px-3 py-2.5 text-[14px] leading-snug text-[#B7C1CE]" data-testid="provider-then-note">
        <i className="ri-database-2-line mt-0.5 text-[#9AA5B5]" aria-hidden="true" />
        <p>
          <strong className="font-medium text-[#F5F7FC]">Provider evidence available then:</strong> {historical?.state === "fetching" ? "checking recorded history…" : historical?.state === "unavailable" ? "server history unavailable; unknown, not zero." : historical?.evidence?.providerEvidence.length ? "recorded provider observations shown here. Provider observed is not platform confirmed." : "none recorded in LiveLift. LiveLift cannot see what TikTok’s own screens showed the operator; only what the operator reported appears below."}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="mt-3 text-[15px] text-[#9AA5B5]">No decisions or operator reports were recorded while the LIVE ran.</p>
      ) : (
        <ol className="mt-2 divide-y divide-[#1F2530]" data-testid="replay-list">
          {shown.map((e) => (
            <Entry key={e.id} e={e} tz={tz} />
          ))}
        </ol>
      )}

      {replay.appendedAfterEnd > 0 && (
        <p className="mt-2 text-[14px] text-[#9AA5B5]" data-testid="replay-appended-note">
          <i className="ri-history-line mr-1.5" aria-hidden="true" />
          {replay.appendedAfterEnd} note{replay.appendedAfterEnd === 1 ? "" : "s"} or correction{replay.appendedAfterEnd === 1 ? "" : "s"} recorded after the LIVE ended {replay.appendedAfterEnd === 1 ? "is" : "are"} kept in Actual history
          and not replayed here.
        </p>
      )}
    </section>
  );
}

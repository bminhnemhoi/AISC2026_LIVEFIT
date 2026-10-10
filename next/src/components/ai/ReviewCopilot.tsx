"use client";

import React from "react";
import type { Session } from "@/contracts";
import type { AiFact, ReviewAvailable } from "@/contracts/ai";
import { formatClock } from "@/lib/domain";
import { Button } from "@/components/ui";
import { Basis, DISCLOSURE, FactList, LayerLabel, PHASE_LABEL, StateChip, isProviderFact, phaseMessage, useArrivalMotion } from "./CopilotParts";
import type { AiCopilot } from "./useAiCopilot";

/**
 * The Review Copilot: an operational summary of one ENDED show, its timing deviations, its cue/report gaps, its
 * evidence limits and suggested Next LIVE improvements.
 *
 * It states only what LiveLift recorded. It has no TikTok analytics, so it can say "no confirmed platform
 * outcome" and can never say how a product performed. Suggestions name adjustments LiveLift already proposes; they
 * are NOT selected, NOT applied and never edit this show: the operator picks them in Next LIVE.
 */

export function ReviewCopilot({
  copilot,
  perspective,
  session,
  source,
  archive,
  facts,
  opened,
  onOpen,
  onOpenNextLive,
}: {
  copilot: AiCopilot<ReviewAvailable>;
  /**
   * "known": show only what the operator could have known during the LIVE; provider (later) facts, and AI statements that
   * rest on them, stay out of view and are counted. "later" or unset: show everything, with later evidence labelled.
   */
  perspective?: "known" | "later";
  session: Session;
  source: "remote" | "local";
  /** A pre-Phase-2 REAL show kept in this browser: it is not in the room, so the server cannot read it. */
  archive: boolean;
  /** Product-logic facts for this show (shown whether or not any AI is configured). */
  facts: AiFact[];
  /** The operator has opened the Copilot. A rehearsal's Review never contacts the server before this. */
  opened: boolean;
  onOpen: () => void;
  onOpenNextLive: () => void;
}): React.ReactElement {
  const tz = session.timezone;
  const result = copilot.result;
  const arrival = useArrivalMotion(result);
  const stale = result !== null && result.basis.revision !== session.revision;
  const asking = copilot.phase === "generating";
  const unopened = !archive && !opened;
  const message = archive || unopened ? null : phaseMessage(copilot.phase, copilot.failure);
  const ask = (): void => copilot.ask(source === "remote" ? { sessionId: session.id } : { sessionId: session.id, session });
  const known = perspective === "known";
  const lateRecords = session.runtime.endedAtMs !== null && session.events.some(e => e.recordedAtMs > session.runtime.endedAtMs!);
  const shown = known ? facts : result && !stale ? result.facts : facts;
  // Provider evidence is later evidence. It is labelled everywhere, and withheld entirely from the "as known then" view.
  const allFacts = result ? result.facts : facts;
  const restsOnLater = (cites: string[]): boolean => lateRecords || cites.some((c) => allFacts.some((f) => f.id === c && isProviderFact(f)));
  const keep = <T extends { cites: string[] }>(items: T[]): T[] => (known ? items.filter((i) => !restsOnLater(i.cites)) : items);
  const providerShown = shown.filter(isProviderFact);
  const operationsShown = shown.filter((f) => !isProviderFact(f));
  const hasProvider = allFacts.some(isProviderFact);
  const statementLists: Array<Array<{ cites: string[] }>> = result ? [result.output.deviations, result.output.gaps, result.output.evidenceLimits, result.output.nextLive, result.output.manualIdeas] : [];
  const withheld = known && result ? statementLists.reduce((n, list) => n + list.length - keep(list).length, 0) + (restsOnLater(result.output.summary.cites) ? 1 : 0) : 0;

  return (
    <section className="rounded-[12px] bg-[#13161C] border border-[#1B2F38] p-4 space-y-3" aria-label="AI Review Copilot" data-testid="review-copilot" data-phase={archive ? "archive" : unopened ? "unopened" : copilot.phase}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-medium text-[#F5F7FC] inline-flex items-center gap-2">
            <i className="ri-sparkling-2-line text-[#7DD8EA]" aria-hidden="true" />
            AI Review Copilot
          </h2>
          <p className="text-[16px] leading-snug text-[#B7C1CE] mt-0.5 max-w-[760px]">
            {hasProvider
              ? "A second reading of this show's evidence. Part of what it was shown is provider evidence fetched after the LIVE, labelled as later evidence. It never edits this show."
              : "A second reading of this show's recorded evidence. It does not know viewer, sales or TikTok analytics, and it never edits this show."}
            {session.environment === "SIMULATED" ? " Every record here is SIMULATED." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!archive && !unopened && <StateChip phase={copilot.phase} />}
          {unopened && (
            <Button variant="assist" size="md" icon="ri-sparkling-2-line" onClick={onOpen} data-testid="copilot-open-btn">
              Check the AI Copilot
            </Button>
          )}
          {!archive && !unopened && (copilot.canAsk || asking) && (
            <Button variant="assist" size="md" icon="ri-sparkling-2-line" onClick={ask} disabled={!copilot.canAsk} data-testid="copilot-ask-btn">
              {asking ? "Analysing…" : result ? "Analyse again" : "Analyse this show"}
            </Button>
          )}
        </div>
      </div>

      {unopened && (
        <p className="text-[16px] leading-snug text-[#CAD0DA]" data-testid="copilot-unopened-note">
          The AI Copilot has not been checked yet. Checking it contacts this server; nothing is sent to an AI provider until you ask for an analysis.
        </p>
      )}
      {archive && (
        <p className="text-[16px] text-[#F6C875]" data-testid="copilot-archive-note">
          This is a local archive. The AI Copilot reads shows from the room, so it is not available here. The product-logic facts below still apply.
        </p>
      )}
      {!archive && !unopened && (
        <p role="status" className="sr-only" data-testid="copilot-announce">
          AI Review Copilot: {PHASE_LABEL[copilot.phase]}.
        </p>
      )}
      {message && (
        <p
          className={`text-[16px] leading-snug ${["unavailable", "rate_limited", "invalid_response", "status_unavailable"].includes(copilot.phase) ? "text-[#F6C875]" : "text-[#CAD0DA]"}`}
          data-testid="copilot-message"
        >
          {message}
        </p>
      )}
      {copilot.phase === "not_configured" && copilot.configIssues.length > 0 && (
        <p className="text-[16px] text-[#9AA5B5]" data-testid="copilot-config-issues">
          An administrator needs to set: <span className="font-mono text-[#CAD0DA]">{copilot.configIssues.join(", ")}</span>
        </p>
      )}
      {copilot.viewer && <p className="text-[16px] text-[#F6C875]" data-testid="copilot-viewer-note">You are viewing read-only. Only an operator can ask the Copilot.</p>}
      {copilot.phase === "status_unavailable" && (
        <Button variant="secondary" size="md" onClick={copilot.recheck} data-testid="copilot-recheck-btn">
          Check again
        </Button>
      )}
      {stale && (
        <p role="status" className="rounded-[8px] bg-[#2A2316] border border-[#5E4822] px-3 py-1.5 text-[16px] text-[#F6C875]" data-testid="copilot-stale">
          This show&apos;s record has changed since the analysis (for example a note or correction was added), so it is out of date. Analyse again.
        </p>
      )}

      <div className={`grid grid-cols-1 gap-4 ${result ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : ""}`}>
        {result && (
          <div className={`space-y-4 min-w-0 transition-opacity duration-200 ${arrival} ${stale ? "opacity-60" : ""}`} data-testid="copilot-result" data-stale={stale}>
            <div className="rounded-[8px] bg-[#14171E] border border-dashed border-[#25505F] px-3 py-2 space-y-1">
              <LayerLabel kind="interpretation" extra="summary · can be wrong" />
              {known && restsOnLater(result.output.summary.cites) ? (
                <p className="text-[16px] leading-snug text-[#B7C1CE]" data-testid="ai-summary-withheld">
                  {lateRecords ? "This analysis uses records appended after the LIVE." : "This summary rests on provider evidence fetched after the LIVE."} Open “With later evidence” to read it.
                </p>
              ) : (
                <>
                  <p className="text-[16px] leading-snug text-[#F5F7FC]" data-testid="ai-summary">{result.output.summary.text}</p>
                  <Basis cites={result.output.summary.cites} facts={result.facts} />
                </>
              )}
            </div>
            {withheld > 0 && (
              <p className="text-[16px] leading-snug text-[#B4C6DD]" data-testid="ai-withheld-note">
                <i className="ri-time-line mr-1.5" aria-hidden="true" />
                {withheld} AI statement{withheld === 1 ? "" : "s"} rest{withheld === 1 ? "s" : ""} on evidence the operator did not have during the LIVE. {withheld === 1 ? "It is" : "They are"} shown under “With later evidence”.
              </p>
            )}

            <AiList title="Timing deviations" items={keep(result.output.deviations)} facts={result.facts} testId="ai-deviations" empty="The AI did not flag a timing deviation." />
            <AiList title="Cue and report gaps" items={keep(result.output.gaps)} facts={result.facts} testId="ai-gaps" empty="The AI did not flag a gap." />
            <AiList title="Evidence limits" items={keep(result.output.evidenceLimits)} facts={result.facts} testId="ai-limits" empty="No limits stated." />

            <section aria-label="AI recommendation: Next LIVE" className="space-y-2">
              <LayerLabel kind="recommendation" extra="Next LIVE · not selected, not applied" />
              {keep(result.output.nextLive).length === 0 && <p className="text-[16px] text-[#9AA5B5]" data-testid="ai-no-next-live">The AI is not suggesting a listed adjustment for this show.</p>}
              <ul className="space-y-2" data-testid="ai-next-live">
                {keep(result.output.nextLive).map((s) => (
                  <li key={s.change.id} className="rounded-[8px] bg-[#12222A] border border-[#25505F] px-3 py-2 space-y-1" data-testid="ai-next-live-item" data-change-id={s.change.id}>
                    <p className="text-[16px] font-medium text-[#F5F7FC]">{s.change.title}</p>
                    <p className="text-[16px] leading-snug text-[#B7C1CE]">{s.change.detail}</p>
                    <p className="text-[16px] leading-snug text-[#E4E8F0]">
                      <span className="font-semibold">Why (AI): </span>
                      {s.why}
                    </p>
                    <Basis cites={s.cites} facts={result.facts} />
                  </li>
                ))}
              </ul>
              {keep(result.output.nextLive).length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" size="md" icon="ri-arrow-right-line" onClick={onOpenNextLive} data-testid="ai-open-next-live-btn">
                    Choose in Next LIVE
                  </Button>
                  <span className="text-[16px] text-[#9AA5B5]" data-testid="ai-recommended-not-applied">Recommended, not applied. Nothing is selected until you select it. This show is never edited.</span>
                </div>
              )}
              {keep(result.output.manualIdeas).length > 0 && (
                <div className="space-y-1" data-testid="ai-manual-ideas">
                  <p className="text-[16px] leading-5 font-semibold tracking-[1.5px] uppercase text-[#AEB7C5]">AI suggestion · do by hand</p>
                  <ul className="space-y-1.5">
                    {keep(result.output.manualIdeas).map((m, i) => (
                      <li key={i} className="text-[16px] leading-snug text-[#E4E8F0]">
                        {m.text} <span className="text-[#B7C1CE]">Why (AI): {m.why}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[16px] text-[#9AA5B5]">These cannot be selected or applied. Add them in Prepare yourself if you agree.</p>
                </div>
              )}
            </section>
            <p className="text-[16px] leading-snug text-[#9AA5B5]" data-testid="ai-footer">
              Generated by {result.model} from {result.environment} evidence as of {formatClock(result.asOfMs, tz, true)}. {DISCLOSURE}
            </p>
          </div>
        )}

        <section aria-label="Observed facts" className="space-y-1.5 min-w-0">
          {hasProvider ? (
            <LayerLabel kind="operations" extra={result && !stale ? "what the AI was shown · known then" : "facts from LiveLift records · not AI"} />
          ) : result && !stale ? (
            <LayerLabel kind="observed" extra="what the AI was shown" />
          ) : (
            <LayerLabel kind="product" extra="facts from LiveLift records · not AI" />
          )}
          <FactList facts={hasProvider ? operationsShown : shown} all={shown} columns={!result} />
          {providerShown.length > 0 && !known && (
            <div className="space-y-1.5 pt-2" data-testid="provider-facts">
              <LayerLabel kind="provider" />
              <FactList facts={providerShown} all={shown} />
            </div>
          )}
          {known && providerShown.length > 0 && (
            <p className="pt-1 text-[16px] leading-snug text-[#B4C6DD]" data-testid="provider-facts-withheld">
              <i className="ri-time-line mr-1.5" aria-hidden="true" />
              {providerShown.length} provider fact{providerShown.length === 1 ? "" : "s"} {providerShown.length === 1 ? "belongs" : "belong"} to later evidence and {providerShown.length === 1 ? "is" : "are"} shown under “With later evidence”.
            </p>
          )}
          {!result && <p className="text-[16px] leading-snug text-[#9AA5B5] pt-1">{DISCLOSURE}</p>}
        </section>
      </div>
    </section>
  );
}

function AiList({ title, items, facts, testId, empty }: { title: string; items: Array<{ text: string; cites: string[] }>; facts: AiFact[]; testId: string; empty: string }): React.ReactElement {
  return (
    <section aria-label={title} className="space-y-1" data-testid={testId}>
      <LayerLabel kind="interpretation" extra={title.toLowerCase()} />
      {items.length === 0 && <p className="text-[16px] text-[#9AA5B5]">{empty}</p>}
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-[16px] leading-snug text-[#E4E8F0]">
            {it.text}
            <Basis cites={it.cites} facts={facts} />
          </li>
        ))}
      </ul>
    </section>
  );
}

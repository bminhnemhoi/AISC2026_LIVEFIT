"use client";

import React, { useMemo } from "react";
import type { Session } from "@/contracts";
import type { OperateAvailable } from "@/contracts/ai";
import { buildOperateFacts } from "@/lib/ai/context";
import { formatClock, type Forecast, type RecoveryAnalysis, type RecoveryOption } from "@/lib/domain";
import { Button } from "@/components/ui";
import { Signal } from "@/components/ops/StatusChips";
import { Basis, DISCLOSURE, FactList, LayerLabel, PHASE_LABEL, StateChip, phaseMessage, useArrivalMotion } from "./CopilotParts";
import type { AiCopilot } from "./useAiCopilot";

/**
 * The Operate Copilot: a compact advisory panel beside the Run of Show. It never competes with NOW / NEXT / WHY /
 * ACTION: it only adds a labelled second opinion on the same situation.
 *
 *   - Observed facts are LiveLift's own (live product logic, or the exact facts the AI was shown).
 *   - An AI recommendation can only name an option LiveLift already computed. It is shown as "recommended, not
 *     applied" and its button hands the option to the SAME explicit Apply path as the ACTION list. The Copilot
 *     itself never executes anything, and nothing here runs without a click.
 *   - If the AI is missing, slow or wrong, the desk is unaffected: this panel just says so.
 */

export function OperateCopilot({
  copilot,
  session,
  source,
  nowMs,
  forecast,
  analysis,
  locked,
  onApplyOption,
}: {
  copilot: AiCopilot<OperateAvailable>;
  session: Session;
  source: "remote" | "local";
  nowMs: number;
  forecast: Forecast;
  analysis: RecoveryAnalysis;
  /** REAL controls are locked (read-only, offline, a command pending). Advice stays readable; applying does not. */
  locked: boolean;
  onApplyOption: (option: RecoveryOption) => void;
}): React.ReactElement {
  const tz = session.timezone;
  const result = copilot.result;
  const arrival = useArrivalMotion(result);
  const stale = result !== null && result.basis.revision !== session.revision;
  const liveFacts = useMemo(() => buildOperateFacts(session, nowMs, forecast, analysis), [session, nowMs, forecast, analysis]);
  const showingResultFacts = result !== null && !stale;
  const facts = showingResultFacts ? result.facts : liveFacts;
  const message = phaseMessage(copilot.phase, copilot.failure);
  const asking = copilot.phase === "generating";

  const ask = (): void => copilot.ask(source === "remote" ? { sessionId: session.id } : { sessionId: session.id, session });

  return (
    <div data-testid="operate-copilot" data-phase={copilot.phase} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-[18px] font-medium text-[#F5F7FC] inline-flex items-center gap-2">
          <i className="ri-sparkling-2-line text-[#7DD8EA]" aria-hidden="true" />
          AI Copilot
        </h3>
        <StateChip phase={copilot.phase} />
      </div>
      <p className="text-[16px] leading-snug text-[#B7C1CE]">
        A second opinion that advises; it never starts, skips or applies anything for you.
        {session.environment === "SIMULATED" ? " This rehearsal is SIMULATED, so the advice is about the rehearsal only." : ""}
      </p>

      {/* The state is spoken once when it changes; the visible message below is not itself a live region. */}
      <p role="status" className="sr-only" data-testid="copilot-announce">
        AI Copilot: {PHASE_LABEL[copilot.phase]}.
      </p>

      {message && (
        <p
          className={`text-[16px] leading-snug ${["unavailable", "rate_limited", "invalid_response", "status_unavailable"].includes(copilot.phase) ? "text-[#F6C875]" : "text-[#CAD0DA]"}`}
          data-testid="copilot-message"
        >
          {message}
        </p>
      )}
      {copilot.phase === "not_configured" && copilot.configIssues.length > 0 && (
        <p className="text-[16px] leading-snug text-[#9AA5B5]" data-testid="copilot-config-issues">
          An administrator needs to set: <span className="font-mono text-[#CAD0DA]">{copilot.configIssues.join(", ")}</span>
        </p>
      )}
      {copilot.viewer && <p className="text-[16px] text-[#F6C875]" data-testid="copilot-viewer-note">You are viewing read-only. Only an operator can ask the Copilot.</p>}

      {(copilot.canAsk || asking) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="assist" size="desk" icon="ri-sparkling-2-line" onClick={ask} disabled={!copilot.canAsk} data-testid="copilot-ask-btn">
            {asking ? "Analysing…" : result ? "Analyse again" : "Analyse this show"}
          </Button>
          {copilot.model && <span className="text-[16px] text-[#9AA5B5]">Model: {copilot.model}</span>}
        </div>
      )}
      {copilot.phase === "status_unavailable" && (
        <Button variant="secondary" size="desk" onClick={copilot.recheck} data-testid="copilot-recheck-btn">
          Check again
        </Button>
      )}

      {stale && (
        <p role="status" className="rounded-[8px] bg-[#2A2316] border border-[#5E4822] px-3 py-1.5 text-[16px] leading-snug text-[#F6C875]" data-testid="copilot-stale">
          <i className="ri-history-line mr-1.5" aria-hidden="true" />
          The show has changed since this analysis, so its advice is out of date and cannot be applied from here. Analyse again for a fresh view.
        </p>
      )}

      {result && (
        <div className={`space-y-3 transition-opacity duration-200 ${arrival} ${stale ? "opacity-60" : ""}`} data-testid="copilot-result" data-stale={stale}>
          <section aria-label="AI interpretation" className="rounded-[8px] bg-[#14171E] border border-dashed border-[#25505F] px-3 py-2 space-y-1">
            <LayerLabel kind="interpretation" />
            <p className="text-[16px] leading-snug text-[#F5F7FC]" data-testid="ai-interpretation">{result.output.interpretation.text}</p>
            <Basis cites={result.output.interpretation.cites} facts={result.facts} />
          </section>

          <section aria-label="AI recommendation" className="space-y-2">
            <LayerLabel kind="recommendation" extra="not applied · your decision" />
            {result.output.recommendations.length === 0 && <p className="text-[16px] text-[#9AA5B5]" data-testid="ai-no-recommendation">The AI is not recommending an option right now.</p>}
            <ul className="space-y-2">
              {result.output.recommendations.map((rec) => {
                const live = analysis.options.find((o) => o.id === rec.option.id) ?? null;
                const label = live?.label ?? rec.option.label;
                const detail = live?.detail ?? rec.option.detail;
                const exception = live?.exception?.code ?? rec.option.exception;
                const disabled = locked || stale || live === null;
                return (
                  <li key={rec.option.id} className="rounded-[8px] bg-[#12222A] border border-[#25505F] px-3 py-2 space-y-1" data-testid="ai-recommendation" data-option-id={rec.option.id}>
                    <Signal tone="ai" icon="ri-lightbulb-flash-line" size="desk" className="font-medium">
                      <span data-testid="ai-recommendation-state">Recommended · not applied</span>
                    </Signal>
                    <p className="text-[16px] leading-snug font-medium text-[#F5F7FC]">{label}</p>
                    <p className="text-[16px] leading-snug text-[#B7C1CE]">
                      {exception && <span className="mr-1.5 font-medium text-[#F6C875]">{exception === "commitment_change" ? "Commitment change ·" : "Exception ·"}</span>}
                      {detail}
                    </p>
                    <p className="text-[16px] leading-snug text-[#E4E8F0]">
                      <span className="font-semibold">Why (AI): </span>
                      {rec.why}
                    </p>
                    <Basis cites={rec.cites} facts={result.facts} />
                    {live === null && !stale && <p className="text-[16px] text-[#F6C875]">This option is no longer offered: the situation changed.</p>}
                    <Button
                      size="desk"
                      variant="assist"
                      disabled={disabled}
                      onClick={() => live && onApplyOption(live)}
                      aria-label={`${exception === "commitment_change" ? "Review" : "Apply"} the recommended option: ${label}`}
                      data-testid="ai-apply-btn"
                    >
                      {exception === "commitment_change" ? "Review…" : exception ? "Apply exception" : "Apply option"}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {result.output.nextStep && (
              <div className="rounded-[8px] bg-[#14171E] border border-dashed border-[#25505F] px-3 py-2 space-y-1" data-testid="ai-next-step">
                <p className="text-[16px] leading-5 font-semibold tracking-[1.5px] uppercase text-[#AEB7C5]">Next · AI suggestion</p>
                <p className="text-[16px] leading-snug text-[#F5F7FC]">{result.output.nextStep.text}</p>
                <p className="text-[16px] leading-snug text-[#B7C1CE]">
                  <span className="font-semibold">Why (AI): </span>
                  {result.output.nextStep.why}
                </p>
                <Basis cites={result.output.nextStep.cites} facts={result.facts} />
                <p className="text-[16px] text-[#9AA5B5]">Guidance only. There is no button for it; you decide what to do.</p>
              </div>
            )}
          </section>

          {result.output.limitations.length > 0 && (
            <section aria-label="Limits" className="space-y-1">
              <p className="text-[16px] leading-5 font-semibold tracking-[1.5px] uppercase text-[#AEB7C5]">What the evidence does not establish</p>
              <ul className="list-disc pl-5 text-[16px] leading-snug text-[#B7C1CE]" data-testid="ai-limitations">
                {result.output.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-[16px] leading-snug text-[#9AA5B5]" data-testid="ai-footer">
            Generated by {result.model} from {result.environment} evidence as of {formatClock(result.asOfMs, tz, true)}. {DISCLOSURE}
          </p>
        </div>
      )}
      <section aria-label="Observed facts" className="space-y-1.5">
        {result ? <LayerLabel kind="observed" extra={showingResultFacts ? `what the AI was shown · as of ${formatClock(result.asOfMs, tz, true)}` : "live, from LiveLift records"} /> : <LayerLabel kind="product" extra="live facts from LiveLift records · not AI" />}
        <FactList facts={facts} />
      </section>

      {!result && <p className="text-[16px] leading-snug text-[#9AA5B5]">{DISCLOSURE}</p>}
    </div>
  );
}

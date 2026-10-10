"use client";

import React from "react";
import type { AiFact } from "@/contracts/ai";
import { Signal, type Tone } from "@/components/ops/StatusChips";
import type { CopilotPhase } from "./useAiCopilot";

/**
 * Entrance motion for an AI result: only a result that arrives while this view is on screen eases in. Re-showing one
 * that was already there (a tab or perspective switch remounts the view) appears at once, at full contrast.
 */
export function useArrivalMotion(result: unknown): string {
  const [shownAtMount] = React.useState(result);
  return result !== null && result !== shownAtMount ? "motion-safe:animate-content-in" : "";
}

/**
 * Shared pieces of the AI Copilot surfaces. The product's three-way distinction lives here so it looks the same
 * everywhere:
 *
 *   OBSERVED FACT      what LiveLift recorded or computed (product logic; never AI)
 *   AI INTERPRETATION  what a model says it means (may be wrong)
 *   AI RECOMMENDATION  advice naming an option LiveLift already offers (never applied by the Copilot)
 *
 * All text is 16px or larger and all targets are 44px, the operating-desk minimums.
 */

export const PHASE_LABEL: Record<CopilotPhase, string> = {
  checking: "Checking…",
  signed_out: "Sign in required",
  status_unavailable: "Status unavailable",
  not_configured: "Not configured",
  ready: "Ready",
  generating: "Generating…",
  available: "Available",
  unavailable: "Unavailable",
  rate_limited: "Rate limited",
  invalid_response: "Invalid response",
};

const PHASE_TONE: Record<CopilotPhase, Tone> = {
  checking: "muted",
  signed_out: "muted",
  status_unavailable: "warn",
  not_configured: "muted",
  ready: "neutral",
  generating: "ai",
  available: "ai",
  unavailable: "warn",
  rate_limited: "warn",
  invalid_response: "warn",
};

const PHASE_ICON: Record<CopilotPhase, string> = {
  checking: "ri-loader-4-line motion-safe:animate-spin",
  signed_out: "ri-lock-line",
  status_unavailable: "ri-wifi-off-line",
  not_configured: "ri-settings-3-line",
  ready: "ri-sparkling-2-line",
  generating: "ri-loader-4-line motion-safe:animate-spin",
  available: "ri-sparkling-2-fill",
  unavailable: "ri-cloud-off-line",
  rate_limited: "ri-timer-line",
  invalid_response: "ri-error-warning-line",
};

export function StateChip({ phase, testId = "copilot-state" }: { phase: CopilotPhase; testId?: string }): React.ReactElement {
  return (
    <span data-testid={testId} data-phase={phase}>
      <Signal tone={PHASE_TONE[phase]} icon={PHASE_ICON[phase]} size="desk" className="font-medium">
        {PHASE_LABEL[phase]}
      </Signal>
    </span>
  );
}

export type LayerKind = "observed" | "interpretation" | "recommendation" | "product" | "operations" | "provider";

const LAYER: Record<LayerKind, { icon: string; title: string; hint: string; tone: string }> = {
  observed: { icon: "ri-eye-line", title: "Observed fact", hint: "from LiveLift records", tone: "text-[#CAD0DA]" },
  product: { icon: "ri-calculator-line", title: "Product logic", hint: "not AI", tone: "text-[#CAD0DA]" },
  interpretation: { icon: "ri-sparkling-2-line", title: "AI interpretation", hint: "can be wrong", tone: "text-[#7DD8EA]" },
  recommendation: { icon: "ri-lightbulb-flash-line", title: "AI recommendation", hint: "recommended, not applied", tone: "text-[#7DD8EA]" },
  /** What the operator's own records show: known during the LIVE. */
  operations: { icon: "ri-clipboard-line", title: "Operations evidence", hint: "LiveLift records · known then", tone: "text-[#CAD0DA]" },
  /** What a provider reported afterwards: NOT known during the LIVE. */
  provider: { icon: "ri-database-2-line", title: "Provider evidence", hint: "later evidence · not known during the LIVE", tone: "text-[#B4C6DD]" },
};

/** The small uppercase label that tells the reader which layer a block belongs to. */
export function LayerLabel({ kind, extra, testId }: { kind: LayerKind; extra?: string; testId?: string }): React.ReactElement {
  const l = LAYER[kind];
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-[16px] leading-5 font-semibold tracking-[1.5px] uppercase ${l.tone}`} data-testid={testId ?? `layer-${kind}`}>
      <span className="inline-flex items-center gap-1.5">
        <i className={l.icon} aria-hidden="true" />
        {l.title}
      </span>
      <span className="font-normal normal-case tracking-normal text-[#9AA5B5]">· {extra ?? l.hint}</span>
    </p>
  );
}

const FACT_SIGNAL: Record<string, { tone: Tone; icon: string; label: string }> = {
  recorded: { tone: "neutral", icon: "ri-eye-line", label: "Recorded" },
  computed: { tone: "neutral", icon: "ri-calculator-line", label: "Computed" },
  operator_reported: { tone: "neutral", icon: "ri-hand-heart-line", label: "Operator reported" },
  gap: { tone: "warn", icon: "ri-question-line", label: "Not established" },
  simulated: { tone: "violet", icon: "ri-flask-line", label: "Simulated" },
  /** Provider provenance is orthogonal to the recorded/SIMULATED fact kind. */
  provider_observed: { tone: "ink", icon: "ri-database-2-line", label: "Provider observed · later" },
};

/**
 * A fact that came from a provider, fetched after the LIVE. The server may tag it with a `provider_observed` kind or
 * the shared contract uses evidenceTier and perspective; it is never presented as something the operator knew.
 */
export const isProviderFact = (f: AiFact): boolean => f.evidenceTier === "provider_observed" || f.perspective === "later_evidence";

/** Numbered so an AI statement can say which facts it rests on. `all` keeps the numbers of a filtered list stable. */
export function FactList({ facts, empty, columns = false, all }: { facts: AiFact[]; empty?: string; columns?: boolean; all?: AiFact[] }): React.ReactElement {
  if (facts.length === 0) return <p className="text-[16px] text-[#9AA5B5]">{empty ?? "Nothing to report yet."}</p>;
  return (
    <ol className={columns ? "md:columns-2 md:gap-x-10" : "space-y-1.5"} data-testid="fact-list">
      {facts.map((f, i) => {
        const s = (isProviderFact(f) ? FACT_SIGNAL.provider_observed : FACT_SIGNAL[f.kind]) ?? { tone: "muted" as Tone, icon: "ri-information-line", label: String(f.kind).replaceAll("_", " ") };
        const at = (all ?? facts).findIndex((x) => x.id === f.id);
        return (
          <li key={f.id} className={`flex gap-2.5 items-start ${columns ? "mb-1.5 break-inside-avoid" : ""}`} data-testid={`fact-${f.topic}`} data-fact-kind={f.kind}>
            <span className="mt-0.5 w-6 shrink-0 text-right text-[16px] leading-5 tabular-nums font-mono text-[#9AA5B5]" aria-hidden="true">
              {(at >= 0 ? at : i) + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] leading-snug text-[#E4E8F0] break-words">{f.text}</p>
              <Signal tone={s.tone} icon={s.icon} size="desk">
                {s.label}
              </Signal>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "Based on facts 1, 3": the numbers of the cited facts in the list above. */
export function Basis({ cites, facts }: { cites: string[]; facts: AiFact[] }): React.ReactElement | null {
  const numbers = cites.map((id) => facts.findIndex((f) => f.id === id) + 1).filter((n) => n > 0);
  if (numbers.length === 0) return null;
  // A statement that rests on provider evidence says so: the operator did not have that evidence during the LIVE.
  const later = cites.some((id) => facts.some((f) => f.id === id && isProviderFact(f)));
  return (
    <p className="text-[16px] leading-5 text-[#9AA5B5]" data-testid="basis">
      Based on {numbers.length === 1 ? "fact" : "facts"} {[...new Set(numbers)].sort((a, b) => a - b).join(", ")}
      {later && (
        <span className="text-[#B4C6DD]" data-testid="basis-later">
          {" "}
          · includes later provider evidence
        </span>
      )}
    </p>
  );
}

const UNAVAILABLE: Record<string, string> = {
  timeout: "The AI provider did not answer in time.",
  network: "The AI provider could not be reached.",
  provider_error: "The AI provider returned an error.",
  credentials_rejected: "The AI provider rejected this server's credentials. An administrator should check LIVELIFT_AI_API_KEY.",
  forbidden: "Only an operator can ask the Copilot.",
  signed_out: "You are signed out. Sign in to use the Copilot.",
};

const INVALID: Record<string, string> = {
  empty: "was empty",
  not_json: "was not in the expected format",
  schema: "was not in the expected format",
  unknown_reference: "referred to something LiveLift did not give it",
  unsafe_content: "contained a link or markup",
  unsupported_claim: "made a claim the recorded evidence does not support",
  ungrounded_number: "quoted a number that is not in the evidence",
};

/** The plain-language message for a phase that did not produce an answer. null when there is nothing to say. */
export function phaseMessage(phase: CopilotPhase, failure: { reason: string | null; retryAfterSec: number | null } | null): string | null {
  switch (phase) {
    case "checking":
      return "Checking whether the AI Copilot is available…";
    case "signed_out":
      return "Sign in to use the AI Copilot. Everything else works without it.";
    case "status_unavailable":
      return "LiveLift could not ask the server whether the AI Copilot is available. Everything else is unaffected.";
    case "not_configured":
      return "The AI Copilot is not set up on this server, so nothing here comes from AI. LiveLift works exactly as before.";
    case "ready":
      return "Ready. Nothing is sent to the AI provider until you ask.";
    case "generating":
      return "Asking the AI provider. The show is unaffected and nothing changes until you decide.";
    case "unavailable":
      return `${(failure?.reason && UNAVAILABLE[failure.reason]) ?? failure?.reason ?? "The AI Copilot is unavailable."} No AI answer was produced; that says nothing about the show.`;
    case "rate_limited":
      return failure?.retryAfterSec ? `AI requests are being limited. Try again in about ${failure.retryAfterSec <= 90 ? `${failure.retryAfterSec} seconds` : `${Math.ceil(failure.retryAfterSec / 60)} minutes`}.` : "AI requests are being limited. Try again in a few minutes.";
    case "invalid_response":
      return `The AI's answer ${(failure?.reason && INVALID[failure.reason]) ?? "could not be accepted"}, so LiveLift discarded it. Nothing from it is shown.`;
    case "available":
      return null;
  }
}

export const DISCLOSURE = "AI can be wrong. Observed facts come from LiveLift records; recommendations are advice and are never applied for you.";

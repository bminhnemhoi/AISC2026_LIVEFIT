"use client";

import type { Session } from "@/contracts";
import type { LiveIntelligenceView } from "./useLiveIntelligence";
import { Button } from "@/components/ui";
import React, { useId, useState } from "react";
import { formatClock, formatDay } from "@/lib/domain";
import type { CellText } from "@/lib/intelligence/format";
import { FIXTURE_SCENARIOS, type FixtureScenarioId } from "@/lib/intelligence/fixtures";
import type { EvidenceOrigin } from "@/lib/intelligence/types";

/**
 * Small shared pieces of the V7 evidence surfaces.
 *
 * Colour roles (never blurred): LIME is what LiveLift recorded and did; PROVIDER INK (a cool, quiet off-white) is
 * what a provider observed later; CYAN is AI; VIOLET is SIMULATED / fixture; AMBER is "look at this".
 */

export const INK = "#B4C6DD";

/** A value, or the words for why there is none. A recorded 0 shows as 0; a hole never does. */
export function ValueText({ cell, className = "" }: { cell: CellText; className?: string }): React.ReactElement {
  if (cell.state === "value") {
    return (
      <span data-state="value" className={`tabular-nums text-[#F5F7FC] ${className}`}>
        {cell.text}
      </span>
    );
  }
  if (cell.state === "zero") {
    return (
      <span data-state="zero" className={`tabular-nums text-[#F5F7FC] ${className}`}>
        {cell.text}
        <span className="sr-only"> (recorded as zero)</span>
      </span>
    );
  }
  return (
    <span data-state={cell.state} className={`italic text-[#9AA5B5] ${className}`}>
      {cell.text}
    </span>
  );
}

/** `compact` is for table cells: the short word, with the full name for hover and screen readers. */
export function TierLabel({ origin, compact = false, className = "" }: { origin: EvidenceOrigin; compact?: boolean; className?: string }): React.ReactElement {
  return origin === "fixture" ? (
    <span data-testid="tier-fixture" title="Fixture provider evidence" className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] text-[#C8B2FF] ${className}`}>
      <i className="ri-flask-line" aria-hidden="true" />
      {compact ? (
        <>
          Fixture<span className="sr-only"> provider evidence</span>
        </>
      ) : (
        "Fixture provider evidence"
      )}
    </span>
  ) : (
    <span data-testid="tier-provider" title="Provider observed" className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] text-[#B4C6DD] ${className}`}>
      <i className="ri-database-2-line" aria-hidden="true" />
      {compact ? (
        <>
          Provider<span className="sr-only"> observed</span>
        </>
      ) : (
        "Provider observed"
      )}
    </span>
  );
}

export function providerName(provider: string): string {
  if (/fixture/i.test(provider)) return "Fixture generator (not TikTok)";
  if (provider === "tiktok_shop") return "TikTok Shop";
  return provider;
}

/**
 * SIMULATED demo evidence is always labelled, in the SIMULATED violet, at the top of whatever shows it.
 * `children` is the fixture-state picker, which belongs to the banner: it is a rehearsal control, not provider data.
 */
export function FixtureBanner({ children }: { children?: React.ReactNode }): React.ReactElement {
  return (
    <div role="note" data-testid="fixture-banner" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[8px] border border-[#44385C] bg-[#211F2B] px-3.5 py-2.5 text-[#C8B2FF]">
      <div className="flex min-w-0 flex-1 basis-[300px] items-start gap-2.5">
        <i className="ri-flask-line mt-0.5 text-[18px]" aria-hidden="true" />
        <p className="text-[14px] leading-snug">
          <strong className="font-semibold tracking-[0.5px]">FIXTURE PROVIDER EVIDENCE</strong> · SIMULATED. Built from this rehearsal&apos;s recorded times. Not TikTok data, and never shown for a REAL show.
        </p>
      </div>
      {children}
    </div>
  );
}

/** The rehearsal's fixture-state picker. Each state is a deterministic demo of one thing the provider can say (or fail to say). */
export function FixturePicker({ value, onChange }: { value: FixtureScenarioId; onChange: (v: FixtureScenarioId) => void }): React.ReactElement {
  const uid = useId();
  const current = FIXTURE_SCENARIOS.find((s) => s.id === value);
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="fixture-picker">
      <label htmlFor={`${uid}-s`} className="shrink-0 text-[14px] text-[#C8B2FF]">
        Fixture state
      </label>
      <select
        id={`${uid}-s`}
        value={value}
        onChange={(e) => onChange(e.target.value as FixtureScenarioId)}
        title={current?.blurb}
        data-testid="fixture-select"
        className="min-h-11 min-w-0 max-w-full rounded-[8px] border border-[#44385C] bg-[#1B1824] px-3 text-[16px] text-[#F5F7FC]"
      >
        {FIXTURE_SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {current && <span className="sr-only">{current.blurb}</span>}
    </div>
  );
}

/**
 * The line the whole perspective rests on. One sentence, plainly: this was not known during the LIVE.
 * The provenance sits beneath it, quiet.
 */
export function LaterDisclosure({
  origin,
  provider,
  fetchedAtMs,
  tz,
}: {
  origin: EvidenceOrigin;
  provider: string;
  fetchedAtMs: number;
  tz: string;
}): React.ReactElement {
  return (
    <div role="note" data-testid="later-evidence-disclosure" className="flex items-start gap-3 rounded-[10px] border border-[#2C3A4C] bg-[#141A22] px-4 py-3">
      <i className="ri-time-line mt-0.5 text-[22px] text-[#B4C6DD]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[17px] font-medium leading-snug text-[#F5F7FC]">This data was not available to the operator during the LIVE.</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[14px] text-[#B7C1CE]">
          <TierLabel origin={origin} />
          <span>
            Fetched {formatDay(fetchedAtMs, tz)} {formatClock(fetchedAtMs, tz)}
          </span>
          <span>{providerName(provider)}</span>
        </p>
      </div>
    </div>
  );
}

/** The real refresh needs an explicit provider LIVE identity; it never changes the show. */
export function EvidenceRefreshControl({ intelligence, session }: { intelligence: LiveIntelligenceView; session: Session }): React.ReactElement | null {
  const [providerId, setProviderId] = useState("");
  const uid = useId();
  if (!intelligence.canRefresh) return null;
  const snapshot = intelligence.state.kind === "available" ? intelligence.state.snapshot : null;
  const simulated = session.environment === "SIMULATED";
  const mappedId = snapshot?.providerSessionId ?? providerId;
  return (
    <form className="flex flex-wrap items-end gap-3" aria-label="Fetch later provider evidence" onSubmit={e => { e.preventDefault(); intelligence.refresh(simulated ? undefined : mappedId); }}>
      {!simulated && !snapshot && <label htmlFor={`${uid}-provider`} className="min-w-0 text-[14px] text-[#B7C1CE]">Provider LIVE session ID
        <input id={`${uid}-provider`} value={providerId} onChange={e => setProviderId(e.target.value)} inputMode="numeric" pattern="[0-9]{1,30}" maxLength={30} required className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[#39414D] bg-[#101319] px-3 text-[16px] text-[#F5F7FC]" />
      </label>}
      <Button type="submit" variant="secondary" size="md" icon="ri-refresh-line" disabled={intelligence.refreshing || !simulated && !/^[0-9]{1,30}$/.test(mappedId)} data-testid="evidence-refresh-btn">
        {intelligence.refreshing ? "Fetching…" : simulated ? "Fetch fixture from server" : snapshot ? "Fetch again" : "Fetch provider evidence"}
      </Button>
    </form>
  );
}

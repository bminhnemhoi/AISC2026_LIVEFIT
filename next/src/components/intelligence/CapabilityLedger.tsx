import React from "react";
import { STATE_TONE, STATE_WORDS, type LedgerRow, type StateTone } from "@/lib/intelligence/capabilities";

/**
 * What the provider can and cannot give LiveLift, one honest line each. An unavailable feature is a stated fact
 * with a reason, not a broken control: the state is words first (never colour alone), and nothing here looks like an
 * error unless someone could actually act to change it.
 */

const TONE: Record<StateTone, { text: string; icon: string }> = {
  ok: { text: "text-[#DFFF00]", icon: "ri-checkbox-circle-line" },
  attention: { text: "text-[#F6C875]", icon: "ri-time-line" },
  fixed: { text: "text-[#9AA5B5]", icon: "ri-forbid-2-line" },
  neutral: { text: "text-[#9AA5B5]", icon: "ri-question-line" },
};

export function CapabilityLedger({ rows, className = "" }: { rows: LedgerRow[]; className?: string }): React.ReactElement {
  return (
    <ul className={`divide-y divide-[#1F2530] ${className}`} data-testid="capability-ledger" aria-label="Provider capabilities">
      {rows.map((r) => {
        const tone = TONE[STATE_TONE[r.state]];
        return (
          <li key={r.key} data-testid={`capability-${r.key}`} data-state={r.state} className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-3 md:grid-cols-[minmax(0,220px)_minmax(0,250px)_minmax(0,1fr)]">
            <p className="text-[16px] font-medium text-[#F5F7FC]">{r.name}</p>
            <p className={`flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.8px] ${tone.text}`}>
              <i className={tone.icon} aria-hidden="true" />
              {STATE_WORDS[r.state]}
            </p>
            <p className="text-[14px] leading-snug text-[#B7C1CE]">{r.why}</p>
          </li>
        );
      })}
    </ul>
  );
}

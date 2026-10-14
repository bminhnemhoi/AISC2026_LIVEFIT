import React from "react";
import {
  BASIS_WORDS, CONTROL_LABEL, PLATFORM_CAPABILITIES, PLATFORM_LABEL,
  type Basis, type CapabilityRow, type ControlKey, type PlatformId, type Support,
} from "@/lib/platform";

const SUPPORT_WORDS: Record<Support, { text: string; icon: string; cls: string }> = {
  official_api: { text: "LiveLift can call it", icon: "ri-plug-line", cls: "text-[#DFFF00]" },
  operator_assisted: { text: "Operator does it, then reports", icon: "ri-hand-heart-line", cls: "text-[#F6C875]" },
  not_established: { text: "Not established", icon: "ri-question-line", cls: "text-[#9AA5B5]" },
};

const BASIS_CLS: Record<Basis, string> = {
  documented: "text-[#B4C6DD]",
  repo_research: "text-[#B4C6DD]",
  inferred: "text-[#F6C875]",
  unverified: "text-[#F6C875]",
  not_documented: "text-[#9AA5B5]",
};

const KEYS: ControlKey[] = Object.keys(CONTROL_LABEL) as ControlKey[];
const PLATFORMS: PlatformId[] = ["shopee_live", "tiktok"];

function Cell({ row }: { row: CapabilityRow }): React.ReactElement {
  const s = SUPPORT_WORDS[row.support];
  return (
    <div>
      <p className={`text-[15px] font-medium inline-flex items-center gap-1.5 ${s.cls}`}>
        <i className={s.icon} aria-hidden="true" />
        {s.text}
      </p>
      <p className={`text-[13px] ${BASIS_CLS[row.basis]}`}>{BASIS_WORDS[row.basis]}</p>
      <p className="text-[14px] text-[#B7C1CE] mt-0.5">{row.note}</p>
    </div>
  );
}

/** The same question asked of each platform. A gap is shown as a gap, with the reason, never as a missing row. */
export function CapabilityTable(): React.ReactElement {
  return (
    <div className="overflow-x-auto" data-testid="capability-table">
      <table className="w-full text-left border-separate border-spacing-0 min-w-[640px]">
        <caption className="sr-only">What each platform lets LiveLift do, and how well that is known</caption>
        <thead>
          <tr>
            <th scope="col" className="py-2 pr-3 text-[13px] font-semibold tracking-[1.2px] uppercase text-[#AEB7C5]">Action</th>
            {PLATFORMS.map((p) => (
              <th key={p} scope="col" className="py-2 pr-3 text-[13px] font-semibold tracking-[1.2px] uppercase text-[#AEB7C5]">{PLATFORM_LABEL[p]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KEYS.map((key) => (
            <tr key={key} className="align-top">
              <th scope="row" className="py-3 pr-3 text-[15px] font-medium text-[#F5F7FC] border-t border-[#232935]">{CONTROL_LABEL[key]}</th>
              {PLATFORMS.map((p) => {
                const row = PLATFORM_CAPABILITIES[p].find((r) => r.key === key)!;
                return (
                  <td key={p} className="py-3 pr-3 border-t border-[#232935]" data-testid={`cap-${p}-${key}`}>
                    <Cell row={row} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

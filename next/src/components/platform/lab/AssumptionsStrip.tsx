"use client";

import React from "react";
import type { LabCommand, SimAssumptions } from "@/lib/platform";
import type { LabWords } from "./labCopy";

/**
 * The questions Shopee's documentation does not answer, as switches, always on screen. The simulation answers them
 * by assumption only; flipping one shows how LiveLift copes either way.
 */
export function AssumptionsStrip({
  assumptions,
  words,
  act,
}: {
  assumptions: SimAssumptions;
  words: LabWords;
  act: (cmds: LabCommand[]) => void;
}): React.ReactElement {
  const w = words.assumptions;
  return (
    <section aria-label={w.title} data-testid="assumptions" className="shrink-0 rounded-[10px] border border-[#4A3D22] bg-[#17140E] px-3 flex flex-wrap items-center gap-x-4 gap-y-0 text-[15px]">
      <span data-testid="assumptions-simulated" className="shrink-0 rounded-[6px] border border-[#C8B2FF] bg-[#211F2B] px-1.5 text-[13px] font-medium tracking-wide text-[#C8B2FF]">SIMULATED</span>{" "}
      <h2 className="font-medium text-[#F6C875] inline-flex items-center gap-1.5">
        <i className="ri-question-line" aria-hidden="true" />
        {w.title}
        <span className="font-normal text-[#F6C875]">· {w.caveat}</span>
      </h2>
      <label className="inline-flex items-center gap-2 min-h-[44px] text-[#F5F7FC] cursor-pointer">
        <input
          type="checkbox"
          checked={assumptions.appLiveControllable}
          onChange={(e) => act([{ kind: "assume", patch: { appLiveControllable: e.target.checked } }])}
          className="w-5 h-5 accent-[#DFFF00]"
          data-testid="lab-assume-a1"
        />
        {w.a1}
      </label>
      <label className="inline-flex items-center gap-2 min-h-[44px] text-[#F5F7FC] cursor-pointer">
        <input
          type="checkbox"
          checked={assumptions.detailExposesShowingItem}
          onChange={(e) => act([{ kind: "assume", patch: { detailExposesShowingItem: e.target.checked } }])}
          className="w-5 h-5 accent-[#DFFF00]"
          data-testid="lab-assume-a2"
        />
        {w.a2}
      </label>
    </section>
  );
}

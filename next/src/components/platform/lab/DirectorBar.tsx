"use client";

import React from "react";
import { formatClock } from "@/lib/domain";
import { DIRECTOR_STEPS, type DirectorAvailability } from "@/lib/platform";
import { Button } from "@/components/ui";
import type { LabWords } from "./labCopy";
import { DIRECTOR_SPEEDS, type DirectorPlayer } from "./useDirectorPlayer";

/** Play, pause, step and reset the 90 second story, with the caption of the step that just played. */
export function DirectorBar({
  player,
  cursor,
  fit,
  tz,
  words,
  presenter,
}: {
  player: DirectorPlayer;
  cursor: number;
  fit: DirectorAvailability;
  tz: string;
  words: LabWords;
  presenter: boolean;
}): React.ReactElement {
  const w = words.director;
  const total = DIRECTOR_STEPS.length;
  const caption = !fit.ok
    ? w.unavailable[fit.reason]
    : cursor === 0
      ? w.ready
      : w.captions[DIRECTOR_STEPS[cursor - 1].id]({
          first: fit.cast.first.name,
          second: fit.cast.second.name,
          flash: fit.cast.flash.title,
          flashAt: formatClock(fit.cast.flash.atMs, tz),
        });

  return (
    <section aria-label={w.region} data-testid="director" className="shrink-0 rounded-[12px] bg-[#13161C] border border-[#2B2640] px-3 py-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* The honesty mark lives inside the bar, whatever the caption or language says. */}
        <span data-testid="director-simulated" className="shrink-0 rounded-[6px] border border-[#C8B2FF] bg-[#211F2B] px-1.5 text-[13px] font-medium tracking-wide text-[#C8B2FF]">SIMULATED</span>{" "}
        {/* Wraps on a phone: the Vietnamese labels are wider than a 390 px row. */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={w.region}>
          {player.playing ? (
            <Button variant="primary" size="desk" icon="ri-pause-line" onClick={player.pause} className="min-w-[8.5rem]" data-testid="director-pause">{w.pause}</Button>
          ) : (
            <Button variant="primary" size="desk" icon="ri-play-fill" onClick={player.play} disabled={!fit.ok} className="min-w-[8.5rem]" data-testid="director-play">{w.play}</Button>
          )}
          <Button variant="secondary" size="desk" icon="ri-skip-forward-line" onClick={player.step} disabled={!fit.ok || player.done} data-testid="director-step">{w.step}</Button>
          <Button variant="ghost" size="desk" icon="ri-restart-line" onClick={player.reset} data-testid="director-reset">{w.reset}</Button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label={w.speed}>
          {DIRECTOR_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={player.speed === s}
              onClick={() => player.setSpeed(s)}
              className={`min-h-[44px] min-w-[44px] px-2 rounded-[8px] text-[15px] tabular-nums cursor-pointer focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2 ${
                player.speed === s ? "bg-[#2A2540] text-[#F5F7FC] font-semibold" : "text-[#9AA5B5] hover:text-[#F5F7FC]"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 min-w-[180px] flex-1">
          <ol className="flex flex-1 gap-[3px]" aria-hidden="true">
            {DIRECTOR_STEPS.map((step, i) => (
              <li key={step.id} className={`h-[6px] flex-1 rounded-full ${i < cursor ? "bg-[#C8B2FF]" : "bg-[#2B2640]"}`} />
            ))}
          </ol>
          <span className="min-w-[6.5em] text-right text-[14px] text-[#CAD0DA] tabular-nums whitespace-nowrap" data-testid="director-progress">{w.progress(cursor, total)}</span>
        </div>
      </div>
      {/* Two lines are always reserved (more on a phone), so a longer caption never moves the zones below. */}
      <p
        aria-live="polite"
        data-testid="director-caption"
        className={`${presenter ? "text-[clamp(22px,2.4vw,34px)]" : "text-[18px]"} leading-snug min-h-[5.5em] md:min-h-[2.75em] text-[#F5F7FC]`}
      >
        {caption}
        {player.done && !presenter && <span className="block text-[14px] leading-5 text-[#9AA5B5]">{w.done}</span>}
      </p>
    </section>
  );
}

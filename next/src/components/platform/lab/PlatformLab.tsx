"use client";

import React, { useCallback, useMemo, useReducer } from "react";
import Link from "next/link";
import type { Session } from "@/contracts";
import { HostApp, type HostAppActions } from "@/components/platform/host-app";
import { forecastSession } from "@/lib/domain";
import { directorAvailability, labNow, readsOf, toHostAppViewModel, type LabCommand } from "@/lib/platform";
import { BrandMark, EnvironmentBadge } from "@/components/ui";
import { AssumptionsStrip } from "./AssumptionsStrip";
import { DirectorBar } from "./DirectorBar";
import { LabDesk } from "./LabDesk";
import { labCopy, type LabLang } from "./labCopy";
import { initLabUi, labReducer } from "./labReducer";
import { useDirectorPlayer } from "./useDirectorPlayer";
import { useLabPreferences } from "./useLabPreferences";
import { useSimulatorControls } from "./useSimulatorControls";
import { Wire } from "./Wire";

const LANGS: LabLang[] = ["en", "vi"];

/**
 * The Platform Lab: LiveLift's desk, the wire, and the host's SIMULATED Shopee app, side by side, on an in-memory copy
 * of the show. Every control is a lab command; the Demo Director plays the same commands the same way every time.
 */
export function PlatformLab({ show }: { show: Session }): React.ReactElement {
  const { lang, setLang, presenter, togglePresenter } = useLabPreferences();
  const words = labCopy[lang];
  const [ui, dispatch] = useReducer(labReducer, show, initLabUi);
  const { lab } = ui;
  const { session, world } = lab;
  const nowMs = labNow(lab);
  const act = useCallback((cmds: LabCommand[]) => dispatch({ type: "act", cmds }), []);
  const player = useDirectorPlayer(ui.cursor, dispatch);
  const forecast = useMemo(() => forecastSession(session, nowMs), [session, nowMs]);
  const simulator = useSimulatorControls({
    session,
    nowMs,
    nextAnchorMs: forecast.anchorGuard?.committedMs ?? null,
    run: (body) => act([{ kind: "show", body }]),
  });
  const fit = useMemo(() => directorAvailability(session), [session]);
  const model = useMemo(() => toHostAppViewModel(world.sim, world.sync, session, nowMs, words.hostApp), [world.sim, world.sync, session, nowMs, words.hostApp]);
  const actions = useMemo<HostAppActions>(
    () => ({
      onGoLive: () => act([{ kind: "host", action: { type: "start_live", title: session.title } }]),
      onEndLive: () => act([{ kind: "host", action: { type: "end_live" } }]),
      onPin: (itemId) => act([{ kind: "host", action: { type: "pin_item", itemId } }]),
      onUnpin: () => act([{ kind: "host", action: { type: "unpin_item" } }]),
      onAddItem: (itemId) => act([{ kind: "host", action: { type: "add_live_item", itemId } }]),
      onRemoveItem: (itemId) => act([{ kind: "host", action: { type: "remove_live_item", itemId } }]),
    }),
    [act, session.title]
  );
  const h = words.header;

  return (
    <div
      lang={lang}
      data-testid="platform-lab"
      data-presenter={presenter ? "on" : "off"}
      className="min-h-dvh xl:h-dvh flex flex-col bg-[#090B0F] text-[#F5F7FC] xl:overflow-hidden"
    >
      <header className="shrink-0 min-h-[52px] bg-[#101319] border-b border-[#1E232B] px-3 xl:px-5 py-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" aria-label={h.leave} title={h.leave} className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 hover:opacity-80">
            <BrandMark size={28} />
          </Link>
          <h1 className={`${presenter ? "text-[22px]" : "text-[18px]"} font-medium truncate min-w-0`}>
            {h.title} <span className="text-[#9AA5B5] font-normal">· {show.title}</span>
          </h1>
          <EnvironmentBadge environment="SIMULATED" size="sm" />
          <span className="text-[14px] text-[#C8B2FF] hidden md:inline" title={h.labRunHint} data-testid="lab-run-note">{h.labRun}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-[8px] border border-[#2C3340]" role="group" aria-label={words.lang.label}>
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                data-testid={`lab-lang-${l}`}
                className={`min-h-[40px] min-w-[44px] px-2 text-[14px] font-medium cursor-pointer rounded-[7px] focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2 ${
                  lang === l ? "bg-[#292D35] text-[#F5F7FC]" : "text-[#9AA5B5] hover:text-[#F5F7FC]"
                }`}
              >
                {words.lang[l]}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={presenter}
            onClick={togglePresenter}
            title={h.presenterHint}
            data-testid="lab-presenter"
            className={`min-h-[40px] px-3 rounded-[8px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2 ${
              presenter ? "bg-[#2A2540] text-[#F5F7FC]" : "text-[#CAD0DA] hover:bg-[#1E232B]"
            }`}
          >
            <i className="ri-slideshow-3-line" aria-hidden="true" />
            {h.presenter}
            <kbd className="text-[12px] text-[#9AA5B5] border border-[#2C3340] rounded px-1" aria-hidden="true">P</kbd>
          </button>
          {!presenter && (
            <Link
              href={`/live/${show.id}`}
              className="min-h-[40px] px-3 rounded-[8px] text-[14px] text-[#CAD0DA] hover:bg-[#1E232B] hover:text-white inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2"
            >
              <i className="ri-arrow-go-back-line" aria-hidden="true" />
              {words.notSimulated.back}
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 flex flex-col gap-2 p-2 xl:p-3 outline-none">
        <DirectorBar player={player} cursor={ui.cursor} fit={fit} tz={session.timezone} words={words} presenter={presenter} />
        <AssumptionsStrip assumptions={world.sim.assumptions} words={words} act={act} />
        <div className="flex-1 min-h-0 grid gap-2 xl:gap-3 grid-cols-1 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)_clamp(280px,calc((100dvh-230px)*0.462),420px)]">
          <div className="order-2 xl:order-1 min-h-0">
            <LabDesk lab={lab} forecast={forecast} strip={simulator.strip} words={words} lang={lang} presenter={presenter} act={act} />
          </div>
          <div className="order-3 xl:order-2 min-h-[460px] xl:min-h-0">
            <Wire ledger={world.sim.ledger} reads={readsOf(world)} trace={lab.trace} tz={session.timezone} words={words} lang={lang} presenter={presenter} />
          </div>
          {/* A sized container: the phone fits itself to the zone, so nothing around it moves when it changes. */}
          <section
            aria-label={words.phone.region}
            className="order-1 xl:order-3 h-[min(78dvh,760px)] xl:h-auto min-h-0 [container-type:size] flex items-start justify-center"
            data-testid="lab-phone-zone"
          >
            {/* The phone is drawn for 390 × 844. Here it takes the zone's width and at most its height, so on a short
                screen it is a little stubbier rather than so narrow that its overlays collide. Text keeps its size. */}
            <div className="w-full h-[min(100cqh,calc(100cqw*844/390))]">
              <HostApp viewModel={model} actions={actions} className="!h-full !max-h-full" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

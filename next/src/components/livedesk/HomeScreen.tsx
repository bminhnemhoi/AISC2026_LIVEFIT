"use client";

import React from "react";
import Link from "next/link";
import { useCurrentLive, useLiveRecap, useStartFlow } from "@/lib/livedesk/hooks";
import { IconCheck } from "./icons";
import { duration } from "./i18n";
import { HeroSpec } from "./HeroSpec";
import { StepArt } from "./art";
import { Shell, useShell } from "./Shell";
import { SimTag, TapeTitle } from "./ui";

type StepState = "done" | "active" | "todo";

function HomeBody() {
  const { c, lang } = useShell();
  const { view } = useStartFlow();
  const live = useCurrentLive();
  const recap = useLiveRecap(live?.id ?? "");
  const synced = view.products.filter((p) => p.sync.state === "synced").length;
  const running = live?.mode === "live";
  const states: StepState[] = [
    view.connected ? "done" : "active",
    !view.connected ? "todo" : synced > 0 ? "done" : "active",
    running || live?.mode === "ended" ? "done" : synced > 0 ? "active" : "todo",
    running ? "active" : live?.mode === "ended" ? "done" : "todo",
  ];
  const deskHref = live ? `/desk/${encodeURIComponent(live.id)}` : null;
  const next = running && deskHref ? { label: c.nextDesk, href: deskHref, cta: c.openDesk }
    : !view.connected ? { label: c.nextConnect, href: "/start", cta: c.openStart }
    : synced === 0 ? { label: c.nextImport, href: "/start", cta: c.openStart }
    : live?.mode === "ended" && deskHref ? { label: c.nextRecap, href: `${deskHref}/recap`, cta: c.openRecap }
    : { label: c.nextStart, href: "/start", cta: c.openStart };
  const stateWord = (s: StepState): string => (s === "done" ? c.flowDone : s === "active" ? c.flowNow : c.flowLater);
  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-intro">
          <h1><TapeTitle text={c.homeTitle} mark={c.homeTitleMark} /></h1>
          <p className="lede">{c.homeLede}</p>
        </div>
        <HeroSpec />
      </div>
      <section className="home-flow" aria-labelledby="flow-h" data-testid="home-flow">
        {/* The next step comes first in reading order, so on a phone it sits right under the intro. */}
        <div className="home-status">
          <div className="home-next">
            <p className="label">{c.nextLabel}</p>
            <p className="home-next-text">{next.label}</p>
            <Link href={next.href} className="btn btn-primary btn-lg" data-testid="home-next">{next.cta}</Link>
          </div>
          <dl className="status-list" aria-label={c.statusLabel}>
            <div><dt>{c.connectTitle}</dt><dd>{view.connected ? c.connected : c.notConnected}</dd></div>
            <div><dt>{c.productsTitle}</dt><dd>{c.productsCount(view.products.length, synced)}</dd></div>
            {live && recap && <div><dt>{c.desk}</dt><dd>{running ? c.liveRunning(duration(recap.durationSec, lang)) : c.liveEnded(duration(recap.durationSec, lang))}</dd></div>}
          </dl>
        </div>
        <h2 id="flow-h" className="label">{c.flowLabel}</h2>
        <ol className="flow" data-testid="loop-guide">
          {c.flow.map((title, i) => (
            <li key={title} className={`flow-step is-${states[i]}`}>
              <span className={`step-n is-${states[i]}`} aria-hidden="true">{states[i] === "done" ? <IconCheck size={18} /> : i + 1}</span>
              <StepArt step={i} />
              <div>
                <h3>{title}<span className="sr-only">: {stateWord(states[i])}</span></h3>
                <p>{c.flowText[i]}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="truth" aria-labelledby="truth-h" data-testid="truth-panel">
        <h2 id="truth-h">{c.truthTitle}</h2>
        <dl>
          {c.truth.map((t, i) => (
            <div key={t.term}>
              <dt>{i === 0 ? <SimTag>{t.term}</SimTag> : t.term}</dt>
              <dd>{t.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="home-legacy"><Link href="/legacy" data-testid="home-legacy">{c.legacy}</Link></p>
    </div>
  );
}

export function HomeScreen() {
  return (
    <Shell screen="home">
      <HomeBody />
    </Shell>
  );
}

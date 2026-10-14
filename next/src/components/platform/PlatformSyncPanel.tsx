"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Session } from "@/contracts";
import { formatClock, type CommandBody } from "@/lib/domain";
import {
  SIM_SHOP_ID, callJson, hostAct, linkSession, ongoingSession, pinAndRecord, plannedProductIds, syncCycle,
  logReads, readsOf, unpinFromLiveLift, withAssumptions, withFault, type HostAction, type LedgerEntry, type ReadEntry, type ShopeeFault,
} from "@/lib/platform";
import { Button } from "@/components/ui";
import { Signal } from "@/components/ops/StatusChips";
import { CapabilityTable } from "./CapabilityTable";
import { labCopy } from "./lab/labCopy";
import { addNotices, usePlatformWorld } from "./usePlatformWorld";

const FAULT_LABEL = labCopy.en.faults;

const card = "rounded-[10px] bg-[#0F1218] border border-[#232935] p-3";
const label = "text-[13px] font-semibold tracking-[1.2px] uppercase text-[#AEB7C5]";

function LedgerRow({ entry, tz }: { entry: LedgerEntry | ReadEntry; tz: string }): React.ReactElement {
  if (entry.kind === "host_app") {
    return (
      <li className="py-2 flex gap-3 items-start" data-testid="ledger-host">
        <span className="font-mono tabular-nums text-[14px] text-[#AEB7C5] w-[78px] shrink-0">{formatClock(entry.atMs, tz, true)}</span>
        <p className="text-[15px] text-[#F5F7FC]">
          <i className="ri-smartphone-line text-[#C8B2FF] mr-1.5" aria-hidden="true" />
          <span className="text-[#C8B2FF]">Host in the app</span> · {entry.summary}
        </p>
      </li>
    );
  }
  const failed = entry.envelope.error !== "";
  return (
    <li className="py-2 flex gap-3 items-start" data-testid="ledger-api">
      <span className="font-mono tabular-nums text-[14px] text-[#AEB7C5] w-[78px] shrink-0">{formatClock(entry.atMs, tz, true)}</span>
      <details className="min-w-0 flex-1">
        <summary className="cursor-pointer text-[15px] text-[#F5F7FC] list-none">
          <i className="ri-plug-line text-[#7DD8EA] mr-1.5" aria-hidden="true" />
          <span className="font-mono">{entry.endpoint}</span>{" "}
          <span className={failed ? "text-[#F4A4A4]" : "text-[#DFFF00]"}>{failed ? `${entry.envelope.error}: ${entry.envelope.message}` : "OK"}</span>{" "}
          <span className={entry.basis === "documented" ? "text-[#B4C6DD] text-[13px]" : "text-[#F6C875] text-[13px]"}>
            {labCopy.en.wire.basis[entry.basis]}
          </span>
        </summary>
        <pre className="mt-1 p-2 rounded-[8px] bg-[#13161C] text-[13px] text-[#CAD0DA] overflow-x-auto whitespace-pre-wrap break-all">
          {callJson(entry)}
        </pre>
      </details>
    </li>
  );
}

/**
 * Two-way sync between this rehearsal and a SIMULATED Live. LiveLift's own calls go through the same bridge a real
 * connection would use; the host's app is a second pair of hands that LiveLift can only learn about by reading.
 * Nothing here is sent to Shopee, and nothing recorded from it is more than "simulated".
 */
export function PlatformSyncPanel({
  session,
  nowMs,
  onRecord,
}: {
  session: Session;
  nowMs: number;
  /** Record an outcome in the show through the desk's own command path, so history, notices and errors behave as for any action. */
  onRecord: (command: CommandBody) => void;
}): React.ReactElement {
  const { world, latest, update, reset } = usePlatformWorld(session);
  const recordRef = useRef(onRecord);
  useEffect(() => {
    recordRef.current = onRecord;
  }, [onRecord]);
  const [linkText, setLinkText] = useState("");
  const [showReads, setShowReads] = useState(false);
  const tz = session.timezone;

  const runCycle = useCallback(
    (t: number): void => {
      const w = latest();
      const r = syncCycle(session, w.sim, w.sync, t);
      update((x) => addNotices(logReads({ ...x, sim: r.sim, sync: r.sync }, r.reads), t, r.notices));
      for (const command of r.commands) recordRef.current(command);
    },
    [latest, session, update]
  );

  // Automatic sync: whenever the show, the clock or the platform's conditions move. Idempotent, so repeating it is harmless.
  const { auto } = world;
  const { fault } = world.sim;
  const { appLiveControllable, detailExposesShowingItem } = world.sim.assumptions;
  useEffect(() => {
    if (auto) runCycle(nowMs);
    // runCycle is intentionally left out: it changes with every show revision, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, session.revision, session.lifecycle, nowMs, fault, appLiveControllable, detailExposesShowingItem]);

  const afterHost = (): void => {
    if (latest().auto) runCycle(nowMs);
  };
  const host = (action: HostAction): void => {
    update((w) => ({ ...w, sim: hostAct(w.sim, nowMs, action).sim }));
    afterHost();
  };
  const notice = (code: string, summary: string): void => {
    update((w) => addNotices(w, nowMs, [{ code, summary }]));
  };

  const pin = (productId: string): void => {
    const w = latest();
    const r = pinAndRecord(w.sim, w.sync, session, productId, nowMs);
    update((x) => logReads({ ...x, sim: r.sim, sync: r.sync }, r.reads));
    if (r.command) recordRef.current(r.command);
    if (r.notice) notice(r.notice.code, r.notice.summary);
  };

  const link = (): void => {
    const id = Number(linkText.trim());
    if (!Number.isSafeInteger(id) || id <= 0) {
      notice("link_invalid", "Enter the session ID shown in the live app.");
      return;
    }
    update((w) => ({ ...w, sync: linkSession(w.sync, id) }));
    setLinkText("");
    if (latest().auto) runCycle(nowMs);
  };

  // A reset world has no live. With auto-sync on, bring the platform in line straight away instead of waiting for the
  // clock or the show to move.
  const resetWorld = (): void => {
    reset();
    if (latest().auto) runCycle(nowMs);
  };

  const { sim, sync } = world;
  const live = ongoingSession(sim);
  const linked = sync.providerSessionId !== null ? (sim.sessions[sync.providerSessionId] ?? null) : null;
  const snapshot = sync.last;
  const showingItem = snapshot?.showing.state === "item" ? snapshot.showing.itemId : null;
  const products = plannedProductIds(session).flatMap((id) => {
    const p = session.products.find((x) => x.id === id);
    const l = sync.links.find((x) => x.productId === id);
    return p && l ? [{ product: p, link: l }] : [];
  });
  const bag = live ? live.items.map((i) => sim.catalog.find((c) => c.itemId === i.itemId)).filter((c) => c !== undefined) : [];
  const notInBag = sim.catalog.filter((c) => live && !live.items.some((i) => i.itemId === c.itemId));
  // Newest first. Reads come from the read log, placed after the call they followed.
  const at = (e: LedgerEntry | ReadEntry): [number, number] => (e.kind === "read" ? [e.afterSeq, e.n] : [e.seq, 0]);
  const ledger = [...sim.ledger.filter((e) => e.kind === "host_app" || !e.readOnly), ...(showReads ? readsOf(world) : [])]
    .sort((a, b) => at(b)[0] - at(a)[0] || at(b)[1] - at(a)[1])
    .slice(0, 14);
  const canPin = linked?.status === "ongoing";
  const nextNewItemId = 200001 + sim.catalog.filter((c) => c.itemId >= 200001).length;

  return (
    <div className="space-y-4" data-testid="platform-panel" aria-label="Platform sync">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 max-w-[560px]">
          <Signal tone="violet" icon="ri-flask-line" size="desk" className="font-semibold">SIMULATED Live</Signal>
          <p className="text-[14px] text-[#B7C1CE] mt-1">
            LiveLift is talking to a simulation of Shopee&apos;s API. Nothing is sent to any real live platform. Only <span className="font-mono">update_show_item</span> copies
            Shopee&apos;s published page; the other calls are marked <em>shape inferred</em>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/live/${session.id}/lab`}
            className="min-h-[44px] px-2.5 rounded-[8px] text-[16px] font-medium text-[#C8B2FF] hover:bg-[#1E232B] inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-3"
            data-testid="platform-open-lab"
          >
            <i className="ri-flask-line" aria-hidden="true" />
            {labCopy.en.header.openLab}
          </Link>
          <label className="inline-flex items-center gap-2 min-h-[44px] text-[16px] text-[#F5F7FC] cursor-pointer">
            <input
              type="checkbox"
              checked={world.auto}
              onChange={(e) => update((w) => ({ ...w, auto: e.target.checked }))}
              className="w-5 h-5 accent-[#DFFF00]"
              data-testid="platform-auto"
            />
            Auto-sync
          </label>
          <Button variant="secondary" size="desk" icon="ri-refresh-line" onClick={() => runCycle(nowMs)} data-testid="platform-sync-now">Sync now</Button>
          <Button variant="ghost" size="desk" icon="ri-restart-line" onClick={resetWorld} data-testid="platform-reset">Reset</Button>
        </div>
      </div>

      <section className={card} aria-label="Connection">
        <p className={label}>Linked live</p>
        <p className="text-[16px] text-[#F5F7FC] mt-1" data-testid="platform-linked" role="status">
          {linked ? (
            <>Platform session <span className="font-mono">{linked.sessionId}</span> · {linked.status}{linked.origin === "shopee_app" ? " · started in the app" : " · opened by LiveLift"}</>
          ) : (
            "No live is linked yet. LiveLift opens one when the show starts."
          )}
        </p>
        {sync.problem && <p className="text-[15px] text-[#F4A4A4] mt-1" data-testid="platform-problem">{sync.problem}</p>}
        {/* Any live LiveLift is not linked to, including when its own live could not start because this one was on air. */}
        {live && live.sessionId !== sync.providerSessionId && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <label className="text-[15px] text-[#CAD0DA]" htmlFor="platform-link-id">A live is running in the app. Its session ID:</label>
            <input
              id="platform-link-id"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 6236215"
              className="min-h-[44px] w-[150px] rounded-[8px] bg-[#13161C] border border-[#2C3340] px-3 text-[16px] text-[#F5F7FC]"
            />
            <Button variant="secondary" size="desk" onClick={link} data-testid="platform-link">Link it</Button>
            <p className="basis-full text-[14px] text-[#9AA5B5]">No call that lists live sessions was found, so LiveLift cannot discover a live on its own.</p>
          </div>
        )}
      </section>

      <section className={card} aria-label="From LiveLift to the platform">
        <p className={label}>LiveLift → SIMULATED Live</p>
        <ul className="mt-1 divide-y divide-[#1F2530]" data-testid="platform-products">
          {products.length === 0 && <li className="py-2 text-[15px] text-[#9AA5B5]">The run of show uses no products.</li>}
          {products.map(({ product, link: l }) => {
            const inBag = snapshot?.itemIds.includes(l.itemId) ?? false;
            const pinned = showingItem === l.itemId;
            return (
              <li key={product.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[16px] text-[#F5F7FC] truncate">{product.name}</p>
                  <p className="text-[14px] text-[#9AA5B5]">
                    item {l.itemId} · {pinned ? "pinned on the platform" : inBag ? "in the live bag" : "not in the live bag"}
                  </p>
                </div>
                <Button variant={pinned ? "ghost" : "secondary"} size="desk" icon="ri-pushpin-line" disabled={!canPin || pinned} onClick={() => pin(product.id)} data-testid={`pin-${product.id}`}>
                  {pinned ? "Pinned" : "Pin on the platform"}
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="desk"
            icon="ri-pushpin-2-line"
            onClick={() => {
              const r = unpinFromLiveLift();
              if (!r.ok) notice("unpin_unsupported", r.message);
            }}
            data-testid="platform-unpin"
          >
            Unpin
          </Button>
          <p className="text-[14px] text-[#9AA5B5] min-w-0 flex-1">No endpoint that clears the pinned product was found, so this one stays with the operator.</p>
        </div>
      </section>

      <section className={`${card} border-[#3A3358]`} aria-label="The host's live app (simulated)">
        <p className={`${label} text-[#C8B2FF]`}>The host&apos;s live app (simulated)</p>
        {!live ? (
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <Button variant="secondary" size="desk" icon="ri-live-line" onClick={() => host({ type: "start_live", title: `${session.title} (host app)` })} data-testid="host-go-live">Go live in the app</Button>
            <p className="text-[14px] text-[#9AA5B5]">Or let LiveLift open it when the show starts.</p>
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            <p className="text-[15px] text-[#CAD0DA]">
              Live <span className="font-mono" data-testid="host-session-id">{live.sessionId}</span> · {live.title}
            </p>
            <ul className="divide-y divide-[#1F2530]" data-testid="host-bag">
              {bag.length === 0 && <li className="py-2 text-[15px] text-[#9AA5B5]">The live bag is empty.</li>}
              {bag.map((c) => (
                <li key={c.itemId} className="py-1.5 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[16px] text-[#F5F7FC]">
                    {c.name} {live.showingItemId === c.itemId && <span className="text-[#C8B2FF] text-[14px]">· pinned</span>}
                  </span>
                  <span className="inline-flex gap-1.5">
                    <Button variant="secondary" size="desk" icon="ri-pushpin-line" disabled={live.showingItemId === c.itemId} onClick={() => host({ type: "pin_item", itemId: c.itemId })} data-testid={`host-pin-${c.itemId}`}>Pin</Button>
                    <Button variant="ghost" size="desk" onClick={() => host({ type: "remove_live_item", itemId: c.itemId })} aria-label={`Remove ${c.name} from the bag`}>Remove</Button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 flex-wrap">
              {notInBag.map((c) => (
                <Button key={c.itemId} variant="ghost" size="desk" icon="ri-add-line" onClick={() => host({ type: "add_live_item", itemId: c.itemId })} data-testid={`host-add-${c.itemId}`}>Add {c.name}</Button>
              ))}
              <Button variant="ghost" size="desk" icon="ri-close-circle-line" disabled={live.showingItemId === null} onClick={() => host({ type: "unpin_item" })} data-testid="host-unpin">Unpin</Button>
              <Button variant="danger" size="desk" icon="ri-stop-circle-line" onClick={() => host({ type: "end_live" })} data-testid="host-end">End live in the app</Button>
            </div>
          </div>
        )}
        <div className="mt-2">
          <Button
            variant="ghost"
            size="desk"
            icon="ri-store-2-line"
            onClick={() => host({ type: "add_catalog_item", item: { itemId: nextNewItemId, shopId: SIM_SHOP_ID, name: `New product ${nextNewItemId - 200000}`, price: 99000, currency: "VND" } })}
            data-testid="host-new-product"
          >
            Add a product to the shop
          </Button>
        </div>
      </section>

      <section aria-label="What LiveLift noticed">
        <p className={label}>What LiveLift noticed</p>
        <ul className="mt-1 divide-y divide-[#1F2530]" data-testid="platform-notices" aria-live="polite">
          {world.notices.length === 0 && <li className="py-2 text-[15px] text-[#9AA5B5]">Nothing yet.</li>}
          {world.notices.map((n) => (
            <li key={n.id} className="py-2 flex gap-3 items-start">
              <span className="font-mono tabular-nums text-[14px] text-[#AEB7C5] w-[78px] shrink-0">{formatClock(n.atMs, tz, true)}</span>
              <p className="text-[15px] text-[#F5F7FC]">{n.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Call log">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className={label}>Call log</p>
          <label className="inline-flex items-center gap-2 text-[14px] text-[#CAD0DA] cursor-pointer">
            <input type="checkbox" checked={showReads} onChange={(e) => setShowReads(e.target.checked)} className="w-4 h-4 accent-[#DFFF00]" />
            Show reads
          </label>
        </div>
        <ol className="mt-1 divide-y divide-[#1F2530]" data-testid="platform-ledger">
          {ledger.length === 0 && <li className="py-2 text-[15px] text-[#9AA5B5]">No calls yet.</li>}
          {ledger.map((e) => <LedgerRow key={e.kind === "read" ? `read-${e.n}` : `${e.kind}-${e.seq}`} entry={e} tz={tz} />)}
        </ol>
      </section>

      <details className={card}>
        <summary className="cursor-pointer text-[16px] font-medium text-[#F5F7FC]">Rehearsal conditions and open questions</summary>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-3 flex-wrap text-[15px] text-[#CAD0DA]">
            <span className="min-w-[170px]">Platform condition</span>
            <select
              value={fault ?? "none"}
              onChange={(e) => update((w) => ({ ...w, sim: withFault(w.sim, e.target.value === "none" ? null : (e.target.value as ShopeeFault)) }))}
              className="min-h-[44px] rounded-[8px] bg-[#13161C] border border-[#2C3340] px-3 text-[16px] text-[#F5F7FC]"
              data-testid="platform-fault"
            >
              {(Object.keys(FAULT_LABEL) as Array<ShopeeFault | "none">).map((k) => <option key={k} value={k}>{FAULT_LABEL[k]}</option>)}
            </select>
          </label>
          <p className="text-[14px] text-[#9AA5B5]">Each condition returns the error text from Shopee&apos;s page. LiveLift stops, says so once, and the operator continues by hand.</p>
          <fieldset className="space-y-1">
            <legend className="text-[14px] text-[#F6C875]">Not verified on a real platform. Switch to see how LiveLift copes either way.</legend>
            <label className="flex items-start gap-3 min-h-[44px] text-[15px] text-[#CAD0DA] cursor-pointer">
              <input type="checkbox" checked={appLiveControllable} onChange={(e) => update((w) => ({ ...w, sim: withAssumptions(w.sim, { appLiveControllable: e.target.checked }) }))} className="w-5 h-5 mt-0.5 accent-[#DFFF00]" data-testid="assume-app-live" />
              <span>A1 · The API can control a live the host started in the app</span>
            </label>
            <label className="flex items-start gap-3 min-h-[44px] text-[15px] text-[#CAD0DA] cursor-pointer">
              <input type="checkbox" checked={detailExposesShowingItem} onChange={(e) => update((w) => ({ ...w, sim: withAssumptions(w.sim, { detailExposesShowingItem: e.target.checked }) }))} className="w-5 h-5 mt-0.5 accent-[#DFFF00]" data-testid="assume-showing" />
              <span>A2 · Reading the live shows which product is pinned</span>
            </label>
          </fieldset>
        </div>
      </details>

      <details className={card}>
        <summary className="cursor-pointer text-[16px] font-medium text-[#F5F7FC]">What each platform allows</summary>
        <div className="mt-3"><CapabilityTable /></div>
      </details>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { Button, Dialog } from "@/components/ui";
import { Signal } from "@/components/ops/StatusChips";
import { SCENARIOS, type ScenarioId } from "@/lib/domain";
import { sessionStore } from "@/lib/store/sessionStore";
import { useSessions } from "@/lib/store/hooks";

const STATUS: Record<string, { text: string; action: string; path: string }> = {
  planned: { text: "Ready to rehearse", action: "Open rehearsal desk", path: "prepare" },
  active: { text: "Rehearsal in progress", action: "Continue rehearsal", path: "operate" },
  ended: { text: "Completed — Review is available", action: "Open Review", path: "review" },
};

export default function SimulatorPage(): React.ReactElement {
  const { hydrated, sessions } = useSessions("SIMULATED");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetScenarioId, setResetScenarioId] = useState<ScenarioId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const completed = sessions.filter((s) => s.lifecycle === "ended");
  const custom = sessions.filter((s) => !SCENARIOS.some((x) => x.sessionId === s.id) && s.id !== "sim-buffered-done");

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1160px] mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[34px] font-medium tracking-tight text-[#F5F7FC]">Simulator</h1>
            <p className="text-[16px] text-[#B7C1CE] mt-1">Rehearse the whole loop without creating real platform evidence.</p>
          </div>
          <Signal tone="violet" icon="ri-flask-line" className="text-[15px] font-medium">All signals and evidence are simulated</Signal>
        </div>

        <div className="mt-6 rounded-[12px] bg-[#1A1726] p-5" data-testid="sim-explainer">
          <p className="text-[15px] text-[#E4DAFF] leading-relaxed">
            Each rehearsal uses a <strong>virtual clock</strong> that only moves when you move it, so the same scenario and the same actions
            always produce the same outcome. Rehearsals run through the same engine as a real show, are stored separately from REAL history,
            and never count as real learning.
          </p>
        </div>

        {!hydrated ? (
          <p className="mt-6 text-[#9AA5B5]" role="status">Loading rehearsals…</p>
        ) : (
          <ul className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="scenario-list">
            {SCENARIOS.map((sc, index) => {
              const session = sessions.find((s) => s.id === sc.sessionId) ?? null;
              const st = session ? STATUS[session.lifecycle] : null;
              return (
                <li key={sc.id} className="rounded-[12px] bg-[#13161C] p-5 flex flex-col" data-testid={`scenario-${sc.id}`}>
                  <Signal tone="violet" icon="ri-flask-line" className="text-[13px] font-semibold tracking-[1.2px] uppercase">
                    Scenario
                  </Signal>
                  <h2 className="text-[20px] font-medium text-[#F5F7FC] mt-2">{sc.title}</h2>
                  <p className="text-[14px] text-[#CAD0DA] mt-1">{sc.summary}</p>
                  <p className="text-[13px] font-semibold tracking-[1.4px] uppercase text-[#AEB7C5] mt-4">Watch for</p>
                  <ul className="mt-1 space-y-1.5 text-[14px] text-[#B7C1CE] list-disc list-inside flex-1">
                    {sc.watchFor.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-[#202632]">
                    {session && st ? (
                      <>
                        <p className="text-[14px] text-[#9AA5B5] mb-2">{st.text}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/live/${session.id}/${st.path}`}>
                            <Button variant={index === 0 ? "primary" : "secondary"} icon="ri-play-line" data-testid={`open-${sc.id}`}>{st.action}</Button>
                          </Link>
                          {session.lifecycle !== "planned" && (
                            <Button variant="ghost" icon="ri-restart-line" onClick={() => setResetScenarioId(sc.id)} data-testid={`reset-${sc.id}`}>
                              Reset this run
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <Button variant="secondary" icon="ri-restart-line" onClick={() => setResetScenarioId(sc.id)} data-testid={`reset-${sc.id}`}>
                        Restore this scenario
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hydrated && completed.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[20px] font-medium text-[#F5F7FC] mb-2">Completed rehearsals</h2>
            <ul className="divide-y divide-[#232935] rounded-[12px] bg-[#13161C]" data-testid="completed-rehearsals">
              {completed.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[16px] text-[#F5F7FC] truncate">{s.title}</p>
                    <p className="text-[13px] text-[#9AA5B5]">Generated by running the scripted scenario through the engine — not hand-written history.</p>
                  </div>
                  <Link href={`/live/${s.id}/review`}>
                    <Button variant="secondary" size="sm" icon="ri-arrow-right-line">Open Review</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hydrated && custom.length > 0 && (
          <p className="mt-6 text-[14px] text-[#9AA5B5]">
            {custom.length} of your own rehearsal{custom.length === 1 ? "" : "s"} {custom.length === 1 ? "is" : "are"} listed under Sessions.
          </p>
        )}

        {message && (
          <p role="status" className="mt-6 text-[15px] text-[#F6C875]" data-testid="simulator-message">
            {message}
          </p>
        )}

        <div className="mt-8 flex items-center gap-4 flex-wrap">
          <Link href="/live/new?env=sim">
            <Button variant="secondary" icon="ri-add-line">Create your own rehearsal</Button>
          </Link>
          <Button variant="ghost" icon="ri-delete-bin-line" onClick={() => setResetOpen(true)} data-testid="purge-rehearsals-btn">
            Delete all rehearsals…
          </Button>
        </div>

        <Dialog
          isOpen={resetScenarioId !== null}
          onClose={() => setResetScenarioId(null)}
          title="Reset this rehearsal run?"
          confirmText="Reset this run"
          onConfirm={() => {
            if (!resetScenarioId) return;
            const r = sessionStore.resetScenario(resetScenarioId);
            setMessage(r.ok ? null : r.reason);
            setResetScenarioId(null);
          }}
        >
          {(() => {
            const sc = SCENARIOS.find((x) => x.id === resetScenarioId);
            const dependents = sc ? sessions.filter((s) => s.derivedFrom?.sessionId === sc.sessionId).length : 0;
            return (
              <div className="space-y-2 text-[15px] text-[#CAD0DA]" data-testid="reset-scenario-dialog">
                <p>
                  Only <strong className="text-[#F5F7FC]">{sc?.title}</strong> goes back to its starting state; its run history is cleared.
                  Every other rehearsal — completed runs, your own rehearsals and plans made from them — is kept exactly as it is. REAL shows are
                  never touched.
                </p>
                {dependents > 0 && (
                  <p className="text-[#F6C875]">
                    {dependents} plan{dependents === 1 ? " was" : "s were"} created from this run. {dependents === 1 ? "It keeps" : "They keep"} {dependents === 1 ? "its" : "their"} own copy and change list; the link back will open the fresh run.
                  </p>
                )}
              </div>
            );
          })()}
        </Dialog>

        <Dialog
          isOpen={resetOpen}
          onClose={() => setResetOpen(false)}
          title="Delete every rehearsal?"
          confirmText="Delete all rehearsals"
          confirmVariant="danger"
          onConfirm={() => {
            const r = sessionStore.purgeRehearsals();
            setMessage(r.ok ? null : r.reason);
            setResetOpen(false);
          }}
        >
          <p className="text-[15px] text-[#CAD0DA]" data-testid="reset-dialog">
            This permanently deletes all {sessions.length} SIMULATED shows on this device — completed runs, your own rehearsals and plans made from
            them — and regenerates only the scripted scenarios. REAL shows are not touched. To reset one scenario, use “Reset this run” on its card
            instead.
          </p>
        </Dialog>
      </div>
    </StandardShell>
  );
}

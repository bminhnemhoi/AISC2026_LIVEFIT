import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { LoopGuide } from "./loop";

/**
 * The loop at a glance. Full on a first visit (one sentence per step), compact once the operator has
 * their own shows. Every step links to a real place when there is one, and says why not when there is not.
 */
export function LoopGuideStrip({
  guide,
  compact = false,
  showCurrent = true,
}: {
  guide: LoopGuide;
  compact?: boolean;
  /** False when the account's state is unknown (the room cannot be asked): the loop is explained, no step is called "next". */
  showCurrent?: boolean;
}): React.ReactElement {
  return (
    <section aria-labelledby="loop-guide-title" data-testid="loop-guide" className={compact ? "mt-8" : "mt-10"}>
      <h2 id="loop-guide-title" className="text-[22px] font-medium tracking-[-0.5px] text-[#F5F7FC]">
        How a LIVE runs in LiveLift
      </h2>
      {!compact && (
        <p className="text-[15px] text-[#B7C1CE] mt-1">Each LIVE feeds the next one. You can start at any step that is open.</p>
      )}
      <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {guide.steps.map((step, i) => {
          const isCurrent = showCurrent && step.id === guide.current;
          return (
            <li
              key={step.id}
              data-testid={`loop-step-${step.id}`}
              aria-current={isCurrent ? "step" : undefined}
              className={`rounded-[12px] p-4 flex flex-col border ${
                isCurrent ? "bg-[#1B1F27] border-[#DFFF00]" : "bg-[#13161C] border-[#232935]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold tracking-[1.4px] uppercase text-[#AEB7C5]">Step {i + 1}</span>
                {isCurrent && <span className="text-[13px] font-medium text-[#DFFF00]">Your next step</span>}
              </div>
              <h3 className="text-[19px] font-medium text-[#F5F7FC] mt-1.5">{step.label}</h3>
              {!compact && <p className="text-[14px] leading-snug text-[#B7C1CE] mt-1.5 flex-1">{step.summary}</p>}
              <div className="mt-3">
                {step.href ? (
                  <Link
                    href={step.href}
                    className="min-h-[44px] -my-1.5 text-[15px] text-[#CAD0DA] hover:text-[#DFFF00] inline-flex flex-wrap items-center gap-x-1 transition-colors"
                  >
                    <span className="whitespace-nowrap">
                      {step.action}
                      <i className="ri-arrow-right-line ml-1" aria-hidden="true" />
                    </span>
                    {step.rehearsal && <span className="text-[13px] text-[#C8B2FF]">(rehearsal)</span>}
                  </Link>
                ) : (
                  <span className="text-[14px] text-[#9AA5B5]">{step.action}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * A miniature of the Operate desk so a first-time visitor sees the product before reading about it. It is drawn,
 * not live: the show, times and names are invented and the caption says so. Hidden from assistive technology
 * because it carries no information that the text beside it does not.
 */
function DeskPreview(): React.ReactElement {
  return (
    <figure className="m-0" data-testid="desk-preview">
      <div aria-hidden="true" className="rounded-[12px] border border-[#2A303A] bg-[#0C0E14] p-3 space-y-2 select-none">
        <div className="flex items-center justify-between rounded-[8px] bg-[#101319] px-3 py-2 text-[13px]">
          <span className="font-semibold text-[#F5F7FC]">Evening show</span>
          <span className="inline-flex items-center gap-1.5 text-[#DFFF00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DFFF00]" />
            Tracking active
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[8px] bg-[#1B1F27] p-3">
            <p className="text-[12px] font-semibold tracking-[1.4px] text-[#DFFF00]">NOW</p>
            <p className="mt-1 text-[16px] font-medium text-[#F5F7FC]">Opening</p>
            <p className="text-[22px] leading-tight font-medium tabular-nums text-[#F5F7FC]">1:12</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-[#2A303A]"><div className="h-1.5 w-[40%] rounded-full bg-[#DFFF00]" /></div>
          </div>
          <div className="rounded-[8px] bg-[#1B1F27] p-3">
            <p className="text-[12px] font-semibold tracking-[1.4px] text-[#DFFF00]">NEXT</p>
            <p className="mt-1 text-[16px] font-medium text-[#F5F7FC]">Zip Hoodie</p>
            <p className="text-[13px] leading-snug text-[#B7C1CE]"><span className="font-semibold text-[#F5F7FC]">WHY</span> Flash Sale is committed for 20:12.</p>
          </div>
        </div>
        <div className="rounded-[8px] bg-[#DFFF00] px-3 py-2 text-center text-[15px] font-semibold text-[#111407]">Next segment · Zip Hoodie</div>
      </div>
      <figcaption className="mt-2 text-[13px] text-[#9AA5B5]">Illustration of the Operate desk. Invented example, not a real show.</figcaption>
    </figure>
  );
}

/** First visit: what LiveLift is, who it is for, and three honest ways in. */
export function FirstRunHero({ reviewHref }: { reviewHref: string | null }): React.ReactElement {
  return (
    <div className="mt-8 rounded-[12px] bg-[#13161C] p-6 sm:p-8" data-testid="first-run">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 lg:gap-12 items-center">
        <div>
          <h2 className="text-[34px] sm:text-[40px] leading-[1.1] font-semibold tracking-[-1px] text-[#F5F7FC]">
            Plan the show.
            <br />
            Run it. <span className="text-[#DFFF00]">Learn from it.</span>
          </h2>
          <dl className="mt-6 space-y-4 max-w-[640px]">
            <div>
              <dt className="text-[14px] font-semibold text-[#DFFF00]">Who it is for</dt>
              <dd className="mt-0.5 text-[17px] leading-relaxed text-[#E4E8F0]">
                LiveLift is for the operator who works beside a host on a TikTok Shop LIVE.
              </dd>
            </div>
            <div>
              <dt className="text-[14px] font-semibold text-[#DFFF00]">What it gives you</dt>
              <dd className="mt-0.5 text-[17px] leading-relaxed text-[#CAD0DA]">
                A timed run of show, then one desk that shows what is on now, what is next and what to do when time slips. Afterwards, a truthful
                review of what actually happened, before the next one.
              </dd>
            </div>
            <div>
              <dt className="text-[14px] font-semibold text-[#DFFF00]">Where it sits</dt>
              <dd className="mt-0.5 text-[17px] leading-relaxed text-[#CAD0DA]">
                It sits next to TikTok, not inside it. There is nothing to connect before you begin.
              </dd>
            </div>
          </dl>
        </div>
        <DeskPreview />
      </div>

      <h3 className="mt-8 text-[15px] font-semibold text-[#CAD0DA]">Start here</h3>
      <ul className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="entry-points">
        <li className="rounded-[12px] bg-[#1B1F27] p-5 flex flex-col">
          <i className="ri-add-line text-[22px] text-[#DFFF00]" aria-hidden="true" />
          <h4 className="text-[18px] font-medium text-[#F5F7FC] mt-2">Create a LIVE</h4>
          <p className="text-[14px] text-[#B7C1CE] mt-1 flex-1">Start a real show, or pick the 30-minute template to have something to edit.</p>
          <Link href="/live/new" className="mt-4">
            <Button variant="primary" size="lg" icon="ri-add-line" data-testid="create-live-btn">Create LIVE</Button>
          </Link>
        </li>
        <li className="rounded-[12px] bg-[#1B1F27] p-5 flex flex-col">
          <i className="ri-flask-line text-[22px] text-[#C8B2FF]" aria-hidden="true" />
          <h4 className="text-[18px] font-medium text-[#F5F7FC] mt-2">Rehearse in the Simulator</h4>
          <p className="text-[14px] text-[#B7C1CE] mt-1 flex-1">
            Run a scripted show on a virtual clock and see a time slip handled. Everything is marked SIMULATED.
          </p>
          <Link href="/simulator" className="mt-4">
            <Button variant="secondary" size="lg" icon="ri-flask-line" data-testid="try-simulator-btn">Try Simulator</Button>
          </Link>
        </li>
        {reviewHref && (
          <li className="rounded-[12px] bg-[#1B1F27] p-5 flex flex-col">
            <i className="ri-file-list-3-line text-[22px] text-[#CAD0DA]" aria-hidden="true" />
            <h4 className="text-[18px] font-medium text-[#F5F7FC] mt-2">See a finished Review</h4>
            <p className="text-[14px] text-[#B7C1CE] mt-1 flex-1">
              Open a completed rehearsal: plan against recorded actuals, and the changes you could carry into the next LIVE.
            </p>
            <Link href={reviewHref} className="mt-4">
              <Button variant="secondary" size="lg" icon="ri-arrow-right-line" data-testid="sample-review-btn">Open sample Review</Button>
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

/** The operator has shows of their own but none is running: say so, and offer the next useful move. */
export function IdleCard({ next }: { next: { href: string; label: string } | null }): React.ReactElement {
  return (
    <div className="mt-8 rounded-[12px] bg-[#13161C] p-6 lg:p-7" data-testid="idle-card">
      <span className="text-[14px] font-semibold tracking-[1.7px] text-[#DFFF00] uppercase">No LIVE is running</span>
      <h2 className="text-[24px] font-medium tracking-[-0.6px] text-[#F5F7FC] mt-2">Ready for the next one?</h2>
      <div className="flex items-center gap-4 mt-5 flex-wrap">
        <Link href="/live/new">
          <Button variant="primary" size="lg" icon="ri-add-line" data-testid="create-live-btn">Create LIVE</Button>
        </Link>
        {next && (
          <Link href={next.href}>
            <Button variant="secondary" size="lg" icon="ri-arrow-right-line" data-testid="idle-next-btn">{next.label}</Button>
          </Link>
        )}
        <Link href="/simulator">
          <Button variant="ghost" size="lg" icon="ri-flask-line" data-testid="try-simulator-btn">Try Simulator</Button>
        </Link>
      </div>
    </div>
  );
}

/** REAL, SIMULATED and what is not connected, in plain words. Replaces the old one-line footnote. */
export function TruthPanel(): React.ReactElement {
  return (
    <section aria-labelledby="truth-title" className="mt-12 rounded-[12px] bg-[#101319] p-6" data-testid="truth-panel">
      <h2 id="truth-title" className="text-[20px] font-medium text-[#F5F7FC]">What is real, and what is not</h2>
      <dl className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5 text-[15px]">
        <div>
          <dt className="font-medium text-[#F5F7FC] inline-flex items-center gap-2">
            <i className="ri-broadcast-line text-[#CAD0DA]" aria-hidden="true" />
            REAL
          </dt>
          <dd className="text-[#B7C1CE] mt-1">
            A show you run. It lives in the shared room with the operator and clock that recorded it, so every desk sees the same record.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[#C8B2FF] inline-flex items-center gap-2">
            <i className="ri-flask-line" aria-hidden="true" />
            SIMULATED
          </dt>
          <dd className="text-[#B7C1CE] mt-1">
            A rehearsal. It stays in this browser on a virtual clock, is labelled wherever it appears, and never counts as real history.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[#F5F7FC] inline-flex items-center gap-2">
            <i className="ri-plug-line text-[#CAD0DA]" aria-hidden="true" />
            Not connected
          </dt>
          <dd className="text-[#B7C1CE] mt-1">
            LiveLift does not pin, promote or read analytics on TikTok. The operator does that in TikTok and reports it here, and a report
            is the operator&apos;s word.{" "}
            <Link href="/integrations" className="underline underline-offset-4 text-[#CAD0DA] hover:text-[#DFFF00]">
              See what is supported
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}

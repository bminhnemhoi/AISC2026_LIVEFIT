"use client";

import React, { useSyncExternalStore } from "react";
import { announcer, type Announcement } from "@/lib/client/announcer";

const latest = (log: Announcement[], priority: Announcement["priority"]): Announcement | undefined => {
  for (let i = log.length - 1; i >= 0; i--) if (log[i].priority === priority) return log[i];
  return undefined;
};

/**
 * The two always-present live regions every critical announcement goes through (see `lib/client/announcer`).
 *
 * Mounted once, in the root layout, as its own child of <body> and marked `data-keep-live` so an open modal
 * (which makes the rest of the page inert) leaves it alone and announcements still arrive. Each message is a new
 * child node (keyed by id), which is what makes assistive technology read it, including a repeat of an earlier text.
 * Nothing that ticks (a clock, "last contact Ns ago") ever reaches here.
 */
export function LiveAnnouncer(): React.ReactElement {
  const log = useSyncExternalStore(announcer.subscribe, announcer.getSnapshot, announcer.getServerSnapshot);
  const polite = latest(log, "polite");
  const assertive = latest(log, "assertive");
  return (
    <div data-keep-live data-testid="live-announcer" className="sr-only">
      <div role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite && <p key={polite.id}>{polite.text}</p>}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        {assertive && <p key={assertive.id}>{assertive.text}</p>}
      </div>
    </div>
  );
}

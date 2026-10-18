/**
 * Authority time for REAL shows.
 *
 * The browser wall clock never timestamps a REAL command and never defines "now" for a REAL show. Time
 * comes from the server: `serverNowMs` is ALREADY the authority's corrected time (the server has applied any catch-up
 * to time it had recorded). It is interpolated between polls with the monotonic browser timer (`performance.now()`),
 * which is immune to wall-clock changes:
 *
 *   display authority time = serverNowMs + monotonic elapsed since the snapshot
 *
 * `clockBehindByMs` is informational discrepancy data (how far the server's raw clock trails recorded time) and is
 * NEVER added to the displayed time: that would count the correction twice.
 *
 * While the room is stale or disconnected the interpolation is FROZEN at the instant contact was lost:
 * LiveLift does not extrapolate transitions it has not seen.
 */

export interface AuthorityClockSample {
  /** The authority's corrected time when the read was answered. */
  serverNowMs: number;
  /** Monotonic browser time at (the middle of) the exchange that produced this sample. */
  receivedPerfMs: number;
}

/**
 * The authority's effective "now" for display and projection.
 * `frozenAtPerfMs` stops the interpolation (stale/disconnected); null lets it run.
 */
export function authorityNowMs(sample: AuthorityClockSample, perfNowMs: number, frozenAtPerfMs: number | null = null): number {
  const at = frozenAtPerfMs === null ? perfNowMs : Math.min(perfNowMs, frozenAtPerfMs);
  return Math.round(sample.serverNowMs + Math.max(0, at - sample.receivedPerfMs));
}

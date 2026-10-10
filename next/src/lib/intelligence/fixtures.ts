import type { Session } from "@/contracts";
import type { Review } from "@/lib/domain";
import { reconcileLiveEvidence } from "@/lib/domain/liveIntelligence";
import { fixtureEvidence, type FixtureCase } from "@/lib/domain/liveIntelligenceFixtures";
import type { LiveIntelligenceResult } from "./types";
import { parseSnapshot } from "./parse";

export const FIXTURE_SCENARIOS = [
  { id: "rich", label: "Rich post-LIVE evidence", blurb: "Minute and product evidence, with canonical recorded-window attribution." },
  { id: "ambiguous", label: "Ambiguous minute boundary", blurb: "Provider minutes shifted so each segment edge overlaps two segments." },
  { id: "repeated_product", label: "Repeated product mapping", blurb: "Whole-LIVE product mapping; repeated segment uses never divide the total." },
  { id: "zero_clicks", label: "Zero clicks", blurb: "Clicks recorded as 0 every minute. A real zero." },
  { id: "missing_clicks", label: "Missing clicks", blurb: "Clicks not recorded at all. Not zero." },
  { id: "zero_gmv", label: "Zero GMV", blurb: "GMV and orders recorded as 0." },
  { id: "missing_gmv", label: "Missing GMV", blurb: "Orders recorded, GMV not recorded." },
  { id: "unsupported_comments", label: "Unsupported raw comments", blurb: "Comment counts not offered; raw chat text never exists." },
  { id: "not_configured", label: "No provider configured", blurb: "The server has no provider evidence at all." },
  { id: "access_not_granted", label: "Access not granted", blurb: "A provider exists; the seller has not granted access." },
  { id: "auth_expired", label: "Authorization expired", blurb: "Access was granted and has since expired or been revoked." },
  { id: "rate_limited", label: "Rate limited", blurb: "The provider is limiting requests." },
  { id: "unavailable", label: "Provider unavailable", blurb: "The provider could not be reached." },
] as const;

export type FixtureScenarioId = (typeof FIXTURE_SCENARIOS)[number]["id"];

export const DEFAULT_FIXTURE_SCENARIO: FixtureScenarioId = "rich";

export const isFixtureScenario = (v: string | null | undefined): v is FixtureScenarioId => FIXTURE_SCENARIOS.some((s) => s.id === v);

/** Fixture controls map to the same cases used by the server certification. */
export function providerFixtureCase(scenario: FixtureScenarioId): FixtureCase {
  return scenario === "rich" ? "normal" : scenario === "ambiguous" ? "shifted_boundary" : scenario === "rate_limited" ? "rate_limit" : scenario;
}

/** Browser-only SIMULATED demos reuse Provider Core's parser and attribution, never a second implementation. */
export function buildScenarioRaw(session: Session, review: Review, scenario: FixtureScenarioId): unknown {
  if (session.environment !== "SIMULATED") throw new Error("Fixture evidence requires a SIMULATED rehearsal");
  const fetchedAt = review.summary.endedAtMs + 3_600_000;
  const data = fixtureEvidence(session, fetchedAt, providerFixtureCase(scenario));
  const snapshot = reconcileLiveEvidence(session, data, { snapshotId: "00000000-0000-4000-8000-000000000007", providerSessionId: "1000001", fetchedAt,
    productMappings: session.products.slice(0, 1).map(p => ({ liveLiftProductId: p.id, providerProductId: "100001" })) });
  if (scenario === "unsupported_comments") snapshot.segmentAttributions.forEach(a => a.metrics.filter(m => m.key === "comments").forEach(m => { m.value = null; m.availability = "unsupported"; }));
  return snapshot;
}

export function fixtureResultFor(session: Session, review: Review, scenario: FixtureScenarioId): LiveIntelligenceResult | null {
  if (session.environment !== "SIMULATED") return null;
  switch (scenario) {
    case "not_configured": return { kind: "not_configured" };
    case "access_not_granted": return { kind: "access_not_granted" };
    case "auth_expired": return { kind: "auth_expired" };
    case "rate_limited": return { kind: "rate_limited", retryAfterSec: 60 };
    case "unavailable": return { kind: "unavailable", reason: "server", message: "The provider could not be reached." };
    default: {
      const parsed = parseSnapshot(buildScenarioRaw(session, review, scenario));
      return parsed.ok ? { kind: "available", snapshot: parsed.snapshot, origin: "fixture" } : { kind: "unavailable", reason: "malformed", message: "The fixture could not be read." };
    }
  }
}

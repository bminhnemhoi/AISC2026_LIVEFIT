import type { AiFact } from "@/contracts/ai";
import type { LiveIntelligenceSnapshot } from "@/contracts/liveIntelligence";
import { sanitizeUntrusted } from "./redact";

/** Only complete temporal windows become AI quantitative facts; ambiguous/partial evidence remains a limit. */
export function laterEvidenceFacts(snapshot: LiveIntelligenceSnapshot, firstId: number): AiFact[] {
  const facts: AiFact[] = [];
  const add = (text: string) => facts.push({ id: `f${firstId + facts.length}`, topic: "later_provider_evidence", kind: snapshot.mode === "SIMULATED" ? "simulated" : "recorded",
    text, evidenceTier: "provider_observed", source: snapshot.provider === "fixture" ? "fixture" : "tiktok_shop", fetchedAt: snapshot.fetchedAt, perspective: "later_evidence" });
  const label = snapshot.mode === "SIMULATED" ? "SIMULATED / FIXTURE provider-observed" : "Provider-observed";
  add(`${label} evidence was fetched later at ${snapshot.fetchedAt}; it was unavailable to the LIVE operator. Observation is not causation; no platform confirmation is established.`);
  for (const segment of snapshot.segmentAttributions.slice(0, 6)) {
    const title = sanitizeUntrusted(segment.title, 60);
    if (segment.coverage !== "complete") { add(`${label} coverage for ${title} is ${segment.coverage}; segment totals are unknown, not zero.`); continue; }
    for (const key of ["clicks", "orders", "gmv"]) {
      const metric = segment.metrics.find((m) => m.key === key);
      if (!metric || metric.availability !== "available" || metric.value === null) { add(`${label} ${key} for ${title} is missing, not zero.`); continue; }
      const value = typeof metric.value === "number" ? String(metric.value) : "amount" in metric.value ? `${metric.value.amount} ${metric.value.currency}` : null;
      if (value !== null) add(`${label} ${key}: ${value} during the recorded window for ${title}; later evidence, complete temporal coverage, observation only.`);
    }
  }
  const complete = snapshot.segmentAttributions.filter((s) => s.coverage === "complete").sort((a, b) => a.actualStartMs! - b.actualStartMs!);
  for (let i = 1; i < complete.length && facts.length < 23; i++) {
    const a = complete[i - 1], b = complete[i];
    const av = a.metrics.find((m) => m.key === "clicks")?.value, bv = b.metrics.find((m) => m.key === "clicks")?.value;
    if (typeof av === "number" && typeof bv === "number" && av !== bv) add(`${label} clicks were ${bv > av ? "higher" : "lower"} during the recorded window for ${sanitizeUntrusted(b.title, 60)} than ${sanitizeUntrusted(a.title, 60)} (${bv} versus ${av}); later evidence, observation only.`);
  }
  return facts.slice(0, 24);
}

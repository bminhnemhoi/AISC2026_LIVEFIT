import { LiveIntelligenceSnapshotSchema } from "@/contracts/liveIntelligence";
import type { EvidenceOrigin, LiveIntelligenceSnapshot, MalformedReason } from "./types";

export type SnapshotParse = { ok: true; snapshot: LiveIntelligenceSnapshot; origin: EvidenceOrigin } | { ok: false; reason: MalformedReason };

/** The browser validates the exact shared wire contract; it never repairs untrusted provider values. */
export function parseSnapshot(raw: unknown): SnapshotParse {
  if (raw && typeof raw === "object" && "perspective" in raw && raw.perspective !== "later_evidence") return { ok: false, reason: "wrong_perspective" };
  const parsed = LiveIntelligenceSnapshotSchema.safeParse(raw);
  return parsed.success ? { ok: true, snapshot: parsed.data, origin: parsed.data.provider === "fixture" ? "fixture" : "provider" } : { ok: false, reason: "malformed" };
}

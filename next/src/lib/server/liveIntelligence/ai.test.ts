// @vitest-environment node
import { expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import type { AiContext, ReviewAiContext } from "@/contracts/ai";
import { buildOperateContext, buildReviewContext } from "@/lib/ai/context";
import { validateModelOutput, groundingCorpus } from "@/lib/ai/output";
import { buildPrompt } from "@/lib/ai/prompt";
import { reconcileLiveEvidence } from "@/lib/domain/liveIntelligence";
import { runReview, runOperate, deploymentSecrets } from "../ai/service";
import type { AiProvider } from "../ai/provider";
import { providerFixtureSession, FIXTURE_START } from "./fixtureSession";
import { fixtureEvidence } from "./fixtures";

const session = providerFixtureSession();
const later = reconcileLiveEvidence(session, fixtureEvidence(session, FIXTURE_START + 500_000), { snapshotId: randomUUID(), providerSessionId: "123", fetchedAt: FIXTURE_START + 500_000, productMappings: [] });
const context = buildReviewContext(session, { laterEvidence: later })!.context;
const facts = context.facts.filter((f) => f.evidenceTier === "provider_observed");
const answer = (text: string, cites = [facts[1].id]) => JSON.stringify({ summary: { text, cites }, deviations: [], gaps: [], evidenceLimits: [], nextLive: [], manualIdeas: [] });
const allow = { factIds: new Set(context.facts.map((f) => f.id)), aliases: new Set<string>(), evidence: groundingCorpus(context), providerFacts: facts };

test("Review context retains source, evidence tier, fetched time and fixture labels; platform remains not established", () => {
  expect(context.laterEvidence).toMatchObject({ source: "fixture", perspective: "later_evidence", evidenceTier: "provider_observed", fetchedAt: later.fetchedAt });
  expect(facts.every((f) => f.source === "fixture" && f.evidenceTier === "provider_observed" && f.perspective === "later_evidence")).toBe(true);
  expect(context.platform.analytics).toBe("not_established"); expect(facts[1].text).toContain("SIMULATED / FIXTURE");
  expect(validateModelOutput("review", answer(facts[1].text), allow).ok).toBe(true);
  expect(buildPrompt("review", context).system).toContain("REVIEW LATER EVIDENCE");
});
test.each([
  "Product A caused more clicks and sales.", "Product A drove sales.", "TikTok confirmed 10 orders.", "The platform confirmed sales.",
  "Provider-observed clicks: 0 during Product A.", "During LIVE the operator knew there were 10 clicks.",
  "GMV rose because Product A was shown.", "Clicks were higher during Product A.", "Product A generated 10 clicks.",
  "The minute crossing Product A and Product B had 5 clicks assigned to each.",
])("rejects causal, promoted, missing-as-zero, ambiguous and hindsight claim: %s", (text) => {
  expect(validateModelOutput("review", answer(text), allow)).toMatchObject({ ok: false });
});
test("exact provider sentence must cite its own fact, not a schedule fact", () => {
  expect(validateModelOutput("review", answer(facts[1].text, ["f1"]), allow)).toMatchObject({ ok: false, reason: "unsupported_claim" });
});
test("comparison is permitted only as an exact computed observation over complete windows", () => {
  const comparison = facts.find((f) => f.text.includes("clicks were higher"))!; expect(comparison).toBeDefined();
  expect(validateModelOutput("review", answer(comparison.text, [comparison.id]), allow).ok).toBe(true);
  const ambiguousSession = providerFixtureSession("boundary");
  const ambiguous = reconcileLiveEvidence(ambiguousSession, fixtureEvidence(ambiguousSession, later.fetchedAt, "boundary"), { snapshotId: randomUUID(), providerSessionId: "123", fetchedAt: later.fetchedAt, productMappings: [] });
  const ctx = buildReviewContext(ambiguousSession, { laterEvidence: ambiguous })!.context;
  expect(ctx.facts.some((f) => f.evidenceTier === "provider_observed" && f.text.includes("clicks were higher"))).toBe(false);
});
test("wrong session, environment or stale revision cannot enter AI Review", () => {
  for (const invalid of [{ ...later, sessionId: "another" }, { ...later, mode: "REAL" as const }, { ...later, sessionRevision: 999 }]) {
    expect(buildReviewContext(session, { laterEvidence: invalid })!.context.laterEvidence).toBeUndefined();
  }
});
test("AI Review consumes only server-selected later snapshot; adversarial output rejected", async () => {
  let seen: AiContext | undefined;
  const provider: AiProvider = { model: "fixture", async complete(request) {
    seen = JSON.parse(request.user.slice(request.user.indexOf("\n", request.user.indexOf("EVIDENCE")) + 1)) as ReviewAiContext;
    const fact = seen.facts.find((f) => f.evidenceTier === "provider_observed" && f.text.includes("clicks:"))!;
    return answer(fact.text, [fact.id]);
  } };
  const result = await runReview(session, [], { provider, laterEvidence: later }); expect(result.status).toBe("available"); expect(seen && "laterEvidence" in seen).toBe(true);
  const hostile: AiProvider = { model: "fixture", async complete() { return answer("Product A caused 10 clicks."); } };
  expect((await runReview(session, [], { provider: hostile, laterEvidence: later })).status).toBe("invalid_response");
});
test("AI Operate ignores injected later snapshot and its citations; no future evidence in prompts", async () => {
  const operate = buildOperateContext(session, FIXTURE_START + 20_000).context;
  expect(operate.facts.some((f) => f.evidenceTier === "provider_observed")).toBe(false);
  let prompt = "";
  const provider: AiProvider = { model: "fixture", async complete(request) { prompt = request.user; return JSON.stringify({ interpretation: { text: "The host is operating.", cites: ["f1"] }, recommendations: [], nextStep: null, limitations: [] }); } };
  await runOperate(session, FIXTURE_START + 20_000, [], { provider, laterEvidence: later });
  expect(prompt).not.toContain("laterEvidence"); expect(prompt).not.toContain(String(later.fetchedAt)); expect(prompt).not.toContain(later.snapshotId);
  const hostile = { interpretation: { text: "There were 10 clicks.", cites: ["f1"] }, recommendations: [], nextStep: null, limitations: [] };
  expect(validateModelOutput("operate", JSON.stringify(hostile), { factIds: new Set(operate.facts.map((f) => f.id)), aliases: new Set(), evidence: groundingCorpus(context), providerFacts: facts })).toMatchObject({ ok: false, reason: "unsupported_claim" });
});
test("deployment cipher, authorization code and provider tokens are redacted by literal value", () => {
  const env = { LIVELIFT_TIKTOK_SHOP_CIPHER: randomUUID(), LIVELIFT_AUTHORIZATION_CODE: randomUUID(), LIVELIFT_TIKTOK_SHOP_ACCESS_TOKEN: randomUUID() };
  expect(deploymentSecrets(env)).toEqual(expect.arrayContaining(Object.values(env)));
  expect(deploymentSecrets({ LIVELIFT_TIKTOK_SHOP_CIPHER: "123" })).toContain("123");
});

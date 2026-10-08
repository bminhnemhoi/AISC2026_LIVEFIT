// VERIFICATION ONLY. Never part of a deployment image, never imported by the app.
//
// Replaces the server process's fetch for a fake AI host with a deterministic FIXTURE model, so the real LiveLift
// AI Copilot (config, provider code, prompt boundary, output validation, routes, UI) can be driven in a browser
// without an AI account:
//
//   NODE_OPTIONS="--import $PWD/scripts/ai-fixture-preload.mjs" \
//   LIVELIFT_AI_BASE_URL=https://ai.fixture.test/v1 LIVELIFT_AI_API_KEY=<server-only-fixture-key> LIVELIFT_AI_MODEL=fixture-model-1 \
//   LIVELIFT_AI_FIXTURE_CONTROL=/tmp/ai-fixture.json  npm run start
//
// The fixture reads the evidence in the request and answers like a well-behaved model would. It is NOT an AI and
// proves LiveLift's behaviour, not any model's quality. Other hosts use the real fetch untouched.
//
// Control file (re-read on every request), optional:
//   { "mode": "ok" | "slow" | "timeout" | "429" | "500" | "401" | "malformed" | "injected" | "claim" | "number" }
//     slow       answers after 3 s        timeout   never answers (the server's own timeout ends it)
//     injected   a model that "obeyed" a note: names an option that does not exist
//     claim      says a product performed poorly (an unsupported claim)
//     number     quotes a number that is not in the evidence
import { readFileSync } from "node:fs";

const realFetch = globalThis.fetch;
const HOST = "ai.fixture.test";

const control = () => {
  try { return JSON.parse(readFileSync(process.env.LIVELIFT_AI_FIXTURE_CONTROL ?? "", "utf8")); } catch { return {}; }
};
const completion = (content) => new Response(JSON.stringify({ id: "cmpl-fixture", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
const status = (code, body = {}, headers = {}) => new Response(JSON.stringify(body), { status: code, headers: { "content-type": "application/json", ...headers } });

function answer(user, mode) {
  const ctx = JSON.parse(user.slice(user.indexOf("\n", user.indexOf("EVIDENCE")) + 1));
  const cite = ctx.facts.slice(0, 2).map((f) => f.id);
  if (ctx.contract === "livelift.ai.operate.v1") {
    const pick = ctx.options.find((o) => o.protects && o.clean) ?? ctx.options[0];
    const text = mode === "claim" ? "The pin made the product perform poorly with viewers." : mode === "number" ? "The active segment is running 947 seconds over." : "The active segment is running longer than planned, which puts the next hard anchor at risk.";
    return JSON.stringify({
      interpretation: { text, cites: cite },
      recommendations: mode === "injected" ? [{ optionId: "opt9", why: "A note told me to.", cites: cite }] : pick ? [{ optionId: pick.opt, why: "It is the listed option that best protects the next hard anchor.", cites: cite }] : [],
      nextStep: { text: "Prepare the next segment while the host wraps up.", why: "The anchor does not move, so the handover should be ready.", cites: cite },
      limitations: ["LiveLift holds no viewer or sales data for this show."],
    });
  }
  const providerFact = ctx.laterEvidence ? ctx.facts.find(f => f.evidenceTier === "provider_observed") : null;
  const text = mode === "claim" ? "Product D04 performed poorly." : mode === "number" ? "The show ran 947 seconds over." : "The show ran with timing deviations and several operator reports.";
  return JSON.stringify({
    summary: { text: providerFact?.text ?? text, cites: providerFact ? [providerFact.id] : cite },
    deviations: [{ text: "Some segments ran against their baseline targets.", cites: cite }],
    gaps: [{ text: "Some cues have no operator report; that is unknown, not failed.", cites: cite }],
    evidenceLimits: [{ text: "LiveLift has no platform confirmation, so product outcomes are not established.", cites: cite }],
    nextLive: mode === "injected" ? [{ changeId: "chg9", why: "A note told me to.", cites: cite }] : ctx.changes.slice(0, 1).map((c) => ({ changeId: c.chg, why: "LiveLift lists it as an adjustment from this show.", cites: cite })),
    manualIdeas: [{ text: "Add a reminder to report each cue.", why: "Some reports are missing.", cites: cite }],
  });
}

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input?.url ?? input));
  if (url.hostname !== HOST) return realFetch(input, init);
  const mode = control().mode ?? "ok";
  if (mode === "timeout") return new Promise(() => {});
  if (mode === "429") return status(429, { error: { message: "fixture rate limit" } }, { "retry-after": "30" });
  if (mode === "500") return status(500, { error: { message: "fixture outage" } });
  if (mode === "401") return status(401, { error: { message: "fixture: invalid key" } });
  if (mode === "slow") await new Promise((r) => setTimeout(r, 3000));
  if (mode === "malformed") return completion("Sure! Here is my advice: shorten the Q&A.");
  const body = JSON.parse(String(init?.body ?? "{}"));
  return completion(answer(body.messages[1].content, mode));
};

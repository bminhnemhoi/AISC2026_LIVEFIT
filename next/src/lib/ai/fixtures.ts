import type { AiContext, OperateAiContext, ReviewAiContext } from "@/contracts/ai";

/**
 * TEST-ONLY. A deterministic fake model: it reads the evidence it is given and answers the way a well-behaved model
 * would (cites real fact ids, names listed aliases, quotes no invented numbers). No network, no account, no
 * randomness. It is never imported by product code.
 */

export const FIXTURE_MODEL = "fixture-model-1";

/** The evidence document out of a USER message built by buildPrompt(). */
export function evidenceFromUser(user: string): AiContext {
  return JSON.parse(user.slice(user.indexOf("\n", user.indexOf("EVIDENCE")) + 1)) as AiContext;
}

/** What a well-behaved model would answer for this evidence. */
export function wellBehavedAnswer(user: string): string {
  const ctx = evidenceFromUser(user);
  const cite = ctx.facts.slice(0, 2).map((f) => f.id);
  if (ctx.contract === "livelift.ai.operate.v1") {
    const op = ctx as OperateAiContext;
    const pick = op.options.find((o) => o.protects && o.clean) ?? op.options[0];
    return JSON.stringify({
      interpretation: { text: "The active segment is running longer than planned, which puts the next hard anchor at risk.", cites: cite },
      recommendations: pick ? [{ optionId: pick.opt, why: "It is the listed option that best protects the next hard anchor.", cites: cite }] : [],
      nextStep: { text: "Prepare the next segment while the host wraps up.", why: "The anchor does not move, so the handover should be ready.", cites: cite },
      limitations: ["LiveLift holds no viewer or sales data for this show."],
    });
  }
  const rv = ctx as ReviewAiContext;
  return JSON.stringify({
    summary: { text: "The show ran with timing deviations and several operator reports.", cites: cite },
    deviations: [{ text: "Some segments ran against their baseline targets.", cites: cite }],
    gaps: [{ text: "Some cues have no operator report; that is unknown, not failed.", cites: cite }],
    evidenceLimits: [{ text: "LiveLift has no platform confirmation, so product outcomes are not established.", cites: cite }],
    nextLive: rv.changes.slice(0, 1).map((c) => ({ changeId: c.chg, why: "LiveLift lists it as an adjustment from this show.", cites: cite })),
    manualIdeas: [{ text: "Add a reminder to report each cue.", why: "Some reports are missing.", cites: cite }],
  });
}

/** A provider object for the service (no HTTP). */
export const fixtureProvider = {
  model: FIXTURE_MODEL,
  complete: async (request: { system: string; user: string }): Promise<string> => wellBehavedAnswer(request.user),
};

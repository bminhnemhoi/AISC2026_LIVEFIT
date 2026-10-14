import {
  OperateAvailableSchema,
  ReviewAvailableSchema,
  type AiContext,
  type AiInvalidReason,
  type AiOptionRef,
  type AiPriorSession,
  type AiTask,
  type OperateResult,
  type ReviewResult,
} from "@/contracts/ai";
import type { Session } from "@/contracts";
import type { LiveIntelligenceSnapshot } from "@/contracts/liveIntelligence";
import type { RecoveryOption } from "@/lib/domain";
import { buildOperateContext, buildReviewContext } from "@/lib/ai/context";
import { buildPrompt } from "@/lib/ai/prompt";
import { groundingCorpus, validateModelOutput } from "@/lib/ai/output";
import { REDACTED } from "@/lib/ai/redact";
import type { AiEnv } from "./config";
import { AiProviderError, type AiProvider } from "./provider";
import { createConfiguredProvider } from "./providers";

/**
 * Runs one Copilot request: evidence in, validated advice out. It never touches the authority: it receives a
 * session value, returns a value, and has no handle through which a recommendation could be applied.
 */

/**
 * Every secret this deployment holds, by exact value. Pattern redaction (lib/ai/redact) catches things that LOOK like
 * credentials; this catches the deployment's OWN, however they are spelled: if an operator pastes the AI key, a TikTok
 * secret or the encryption key into a note, the literal value is removed before anything leaves the server.
 */
export function deploymentSecrets(env: AiEnv = process.env): string[] {
  const providerSecrets = new Set(["LIVELIFT_TIKTOK_SHOP_APP_SECRET", "LIVELIFT_TIKTOK_SHOP_ACCESS_TOKEN", "LIVELIFT_TIKTOK_SHOP_CIPHER", "LIVELIFT_TIKTOK_CREATOR_ACCESS_TOKEN"]);
  return Object.entries(env)
    .filter(([name, value]) => /KEY|SECRET|TOKEN|PASSWORD|PASSWD|CIPHER|AUTHORIZATION_CODE/i.test(name) && typeof value === "string" && value.length > 0 && (value.length >= 8 || providerSecrets.has(name)))
    .map(([, value]) => value as string)
    .sort((a, b) => b.length - a.length);
}

export function scrubSecrets(text: string, secrets: string[]): string {
  return secrets.reduce((out, secret) => out.split(secret).join(REDACTED), text);
}

export interface AiDeps {
  /** Replaces the configured provider (tests). */
  provider?: AiProvider;
  env?: AiEnv;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Server-loaded snapshot. runOperate never reads this field. */
  laterEvidence?: LiveIntelligenceSnapshot | null;
}

type Failure = Exclude<OperateResult, { status: "available" }>;

function provide(deps: AiDeps): { provider: AiProvider } | { failure: Failure } {
  if (deps.provider) return { provider: deps.provider };
  // The wire format (OpenAI-compatible unless LIVELIFT_AI_PROVIDER says otherwise) is chosen in providers.ts.
  const configured = createConfiguredProvider(deps.env, deps.fetchImpl);
  if (!configured.ok) return { failure: { status: "not_configured", configIssues: configured.issues } };
  return { provider: configured.provider };
}

/** One model call. Every provider failure becomes a truthful non-available state; nothing of its text is kept. */
async function converse(task: AiTask, context: AiContext, provider: AiProvider, secrets: string[]): Promise<{ raw: string } | { failure: Failure }> {
  try {
    const prompt = buildPrompt(task, context);
    return { raw: await provider.complete({ system: scrubSecrets(prompt.system, secrets), user: scrubSecrets(prompt.user, secrets) }) };
  } catch (error) {
    if (error instanceof AiProviderError) {
      if (error.kind === "rate_limited") return { failure: { status: "rate_limited", retryAfterSec: error.retryAfterSec } };
      if (error.kind === "malformed") return { failure: { status: "invalid_response", reason: "not_json" } };
      return { failure: { status: "unavailable", reason: error.kind } };
    }
    return { failure: { status: "unavailable", reason: "provider_error" } };
  }
}

const invalid = (reason: AiInvalidReason): Failure => ({ status: "invalid_response", reason });

const optionRef = (o: RecoveryOption): AiOptionRef => ({
  id: o.id,
  label: o.label,
  detail: o.detail,
  kind: o.kind,
  clean: o.clean,
  protects: o.protects,
  exception: o.exception?.code ?? null,
});

/** `nowMs` is the show's own clock at this instant: the room's time for REAL, the virtual clock for SIMULATED. */
export async function runOperate(session: Session, nowMs: number, priors: AiPriorSession[], deps: AiDeps = {}): Promise<OperateResult> {
  const picked = provide(deps);
  if ("failure" in picked) return picked.failure;
  const { context, optionByAlias, analysis } = buildOperateContext(session, nowMs, { priors });
  const answer = await converse("operate", context, picked.provider, deploymentSecrets(deps.env));
  if ("failure" in answer) return answer.failure;

  const verdict = validateModelOutput("operate", answer.raw, {
    factIds: new Set(context.facts.map((f) => f.id)),
    aliases: new Set(optionByAlias.keys()),
    evidence: groundingCorpus(context),
  });
  if (!verdict.ok) return invalid(verdict.reason);
  const out = verdict.output;
  const seen = new Set<string>();
  const recommendations = out.recommendations
    .filter((r) => (seen.has(r.optionId) ? false : (seen.add(r.optionId), true)))
    .map((r) => ({ option: optionRef(optionByAlias.get(r.optionId) as RecoveryOption), why: r.why, cites: r.cites }));

  const result = OperateAvailableSchema.safeParse({
    status: "available",
    task: "operate",
    environment: session.environment,
    model: picked.provider.model,
    generatedAtMs: (deps.now ?? Date.now)(),
    asOfMs: nowMs,
    facts: context.facts,
    basis: { revision: session.revision, criticalSegmentId: analysis.criticalSegmentId, recoveryStatus: analysis.status },
    output: { interpretation: out.interpretation, recommendations, nextStep: out.nextStep, limitations: out.limitations },
  });
  return result.success ? result.data : invalid("schema");
}

export async function runReview(session: Session, priors: AiPriorSession[], deps: AiDeps = {}): Promise<ReviewResult> {
  const picked = provide(deps);
  if ("failure" in picked) return picked.failure;
  const built = buildReviewContext(session, { priors, laterEvidence: deps.laterEvidence });
  if (!built) return invalid("empty");
  const { context, changeByAlias, review } = built;
  const answer = await converse("review", context, picked.provider, deploymentSecrets(deps.env));
  if ("failure" in answer) return answer.failure;

  const verdict = validateModelOutput("review", answer.raw, {
    factIds: new Set(context.facts.map((f) => f.id)),
    aliases: new Set(changeByAlias.keys()),
    evidence: groundingCorpus(context),
    providerFacts: context.facts.filter((f) => f.evidenceTier === "provider_observed"),
  });
  if (!verdict.ok) return invalid(verdict.reason);
  const out = verdict.output;
  const seen = new Set<string>();
  const nextLive = out.nextLive
    .filter((r) => (seen.has(r.changeId) ? false : (seen.add(r.changeId), true)))
    .map((r) => {
      const change = changeByAlias.get(r.changeId)!;
      return { change: { id: change.id, title: change.title, detail: change.detail, basis: change.basis }, why: r.why, cites: r.cites };
    });

  const result = ReviewAvailableSchema.safeParse({
    status: "available",
    task: "review",
    environment: session.environment,
    model: picked.provider.model,
    generatedAtMs: (deps.now ?? Date.now)(),
    asOfMs: review.summary.endedAtMs,
    facts: context.facts,
    basis: { revision: session.revision, criticalSegmentId: null, recoveryStatus: "ended" },
    output: { summary: out.summary, deviations: out.deviations, gaps: out.gaps, evidenceLimits: out.evidenceLimits, nextLive, manualIdeas: out.manualIdeas },
  });
  return result.success ? result.data : invalid("schema");
}

/** A short, fixed code for logs: never provider text, never evidence. */
export function resultCode(task: AiTask, result: OperateResult | ReviewResult): string {
  switch (result.status) {
    case "available":
      return `ai_${task}_available`;
    case "not_configured":
      return `ai_${task}_not_configured`;
    case "rate_limited":
      return `ai_${task}_rate_limited`;
    case "unavailable":
      return `ai_${task}_unavailable_${result.reason}`;
    case "invalid_response":
      return `ai_${task}_invalid_${result.reason}`;
  }
}

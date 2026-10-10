import { loadAiConfig, loadProviderKind, PROVIDER_ENV, type AiConfig, type AiEnv, type AiProviderKind } from "./config";
import { AiProviderError, createOpenAiCompatibleProvider, exchangeJson, type AiProvider } from "./provider";

/**
 * Which wire format the configured model speaks, chosen by one environment variable. Same base URL, key, model,
 * timeout and output budget as every provider (config.ts); plain `fetch`, no SDK, no new dependency.
 *
 *   LIVELIFT_AI_PROVIDER   unset or "openai_compatible"  Chat Completions (OpenAI and compatible servers)
 *                          "anthropic"                    Anthropic Messages API (base URL e.g. https://api.anthropic.com/v1)
 *                          "gemini"                       Google Gemini generateContent (base URL e.g. https://generativelanguage.googleapis.com/v1beta)
 *
 * Any other value is "not configured", reported by the variable's NAME only.
 */

export { PROVIDER_ENV, PROVIDER_KINDS, loadProviderKind, type AiProviderKind } from "./config";

const ANTHROPIC_VERSION = "2023-06-01";

/** The text blocks of a Messages API reply. A refusal is a provider failure, never content. */
function anthropicText(body: unknown): string {
  const reply = body as { stop_reason?: unknown; content?: unknown } | null;
  if (reply?.stop_reason === "refusal") throw new AiProviderError("provider_error");
  if (!Array.isArray(reply?.content)) throw new AiProviderError("malformed");
  return reply.content.map((b) => ((b as { type?: unknown })?.type === "text" && typeof (b as { text?: unknown }).text === "string" ? (b as { text: string }).text : "")).join("");
}

export function createAnthropicProvider(config: AiConfig, fetchImpl?: typeof fetch): AiProvider {
  return {
    model: config.model,
    complete: (request) =>
      exchangeJson(config.timeoutMs, {
        url: `${config.baseUrl}/messages`,
        headers: { "x-api-key": config.apiKey, "anthropic-version": ANTHROPIC_VERSION },
        body: { model: config.model, max_tokens: config.maxOutputTokens, system: request.system, messages: [{ role: "user", content: request.user }] },
        read: anthropicText,
      }, fetchImpl),
  };
}

function geminiText(body: unknown): string {
  const candidates = (body as { candidates?: unknown } | null)?.candidates;
  const parts = Array.isArray(candidates) ? (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts : undefined;
  if (!Array.isArray(parts)) throw new AiProviderError("malformed");
  return parts.map((p) => (typeof (p as { text?: unknown })?.text === "string" ? (p as { text: string }).text : "")).join("");
}

export function createGeminiProvider(config: AiConfig, fetchImpl?: typeof fetch): AiProvider {
  return {
    model: config.model,
    complete: (request) =>
      exchangeJson(config.timeoutMs, {
        url: `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
        // The key travels in a header, never in the URL.
        headers: { "x-goog-api-key": config.apiKey },
        body: {
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: config.maxOutputTokens, ...(config.jsonMode ? { responseMimeType: "application/json" } : {}) },
        },
        read: geminiText,
      }, fetchImpl),
  };
}

export function createProvider(kind: AiProviderKind, config: AiConfig, fetchImpl?: typeof fetch): AiProvider {
  switch (kind) {
    case "openai_compatible": return createOpenAiCompatibleProvider(config, fetchImpl);
    case "anthropic": return createAnthropicProvider(config, fetchImpl);
    case "gemini": return createGeminiProvider(config, fetchImpl);
  }
}

/** The configured provider, or the names of the variables that stop one. */
export function createConfiguredProvider(env: AiEnv = process.env, fetchImpl?: typeof fetch): { ok: true; provider: AiProvider } | { ok: false; issues: string[] } {
  const config = loadAiConfig(env);
  const kind = loadProviderKind(env);
  const issues = [...(config.ok ? [] : config.issues), ...(kind === null ? [PROVIDER_ENV] : [])];
  if (!config.ok || kind === null) return { ok: false, issues };
  return { ok: true, provider: createProvider(kind, config.config, fetchImpl) };
}

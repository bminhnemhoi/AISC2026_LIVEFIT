import type { AiStatusView } from "@/contracts/ai";

/**
 * AI provider configuration. Server-side only: it is read from the process environment at call time, never from
 * the browser, never persisted, never logged. A deployment with any problem is "not configured": nothing is
 * called and nothing is guessed. Problems are reported by variable NAME only, never by value.
 */

export const ENV = {
  baseUrl: "LIVELIFT_AI_BASE_URL",
  apiKey: "LIVELIFT_AI_API_KEY",
  model: "LIVELIFT_AI_MODEL",
  timeoutMs: "LIVELIFT_AI_TIMEOUT_MS",
  maxOutputTokens: "LIVELIFT_AI_MAX_OUTPUT_TOKENS",
  jsonMode: "LIVELIFT_AI_JSON_MODE",
} as const;

export interface AiConfig {
  /** Origin and path of an OpenAI-compatible API, without a trailing slash (for example https://api.openai.com/v1). */
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  /** Ask the endpoint for a JSON object (`response_format`). Turn off only for endpoints that reject it. */
  jsonMode: boolean;
}

export type AiConfigResult = { ok: true; config: AiConfig; issues: [] } | { ok: false; issues: string[] };

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const credential = /^[\x21-\x7e]{8,512}$/;
const modelName = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,99}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https, or plain http only to this machine (a local model server). No credentials, query or fragment in the URL. */
function parseBaseUrl(value: string | undefined): string | null {
  if (!value || value.length > 512) return null;
  try {
    const url = new URL(value);
    const secure = url.protocol === "https:";
    const local = url.protocol === "http:" && LOOPBACK.has(url.hostname);
    if (!(secure || local) || url.username || url.password || url.search || url.hash) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number): number | null {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^\d{1,6}$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= min && n <= max ? n : null;
}

export type AiEnv = Record<string, string | undefined>;

export function loadAiConfig(env: AiEnv = process.env): AiConfigResult {
  const issues: string[] = [];
  const baseUrl = parseBaseUrl(env[ENV.baseUrl]);
  if (!baseUrl) issues.push(ENV.baseUrl);
  const apiKey = env[ENV.apiKey];
  if (!apiKey || !credential.test(apiKey)) issues.push(ENV.apiKey);
  const model = env[ENV.model];
  if (!model || !modelName.test(model)) issues.push(ENV.model);
  const timeoutMs = boundedInt(env[ENV.timeoutMs], DEFAULT_TIMEOUT_MS, 1000, 60_000);
  if (timeoutMs === null) issues.push(ENV.timeoutMs);
  const maxOutputTokens = boundedInt(env[ENV.maxOutputTokens], DEFAULT_MAX_OUTPUT_TOKENS, 100, 4000);
  if (maxOutputTokens === null) issues.push(ENV.maxOutputTokens);
  const jsonRaw = env[ENV.jsonMode]?.trim().toLowerCase();
  if (jsonRaw !== undefined && jsonRaw !== "" && jsonRaw !== "on" && jsonRaw !== "off") issues.push(ENV.jsonMode);

  if (issues.length || !baseUrl || !apiKey || !model || timeoutMs === null || maxOutputTokens === null) return { ok: false, issues };
  return { ok: true, issues: [], config: { baseUrl, apiKey, model, timeoutMs, maxOutputTokens, jsonMode: jsonRaw !== "off" } };
}

/** Which wire format the model speaks (see providers.ts). Unset means OpenAI-compatible; anything unknown is an issue. */
export const PROVIDER_ENV = "LIVELIFT_AI_PROVIDER";
export const PROVIDER_KINDS = ["openai_compatible", "anthropic", "gemini"] as const;
export type AiProviderKind = (typeof PROVIDER_KINDS)[number];

export function loadProviderKind(env: AiEnv = process.env): AiProviderKind | null {
  const raw = env[PROVIDER_ENV]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return "openai_compatible";
  return (PROVIDER_KINDS as readonly string[]).includes(raw) ? (raw as AiProviderKind) : null;
}

/** What the browser may know: whether the Copilot can run, and with which model. Never a key, URL or value. */
export function aiStatus(env: AiEnv = process.env): AiStatusView {
  const result = loadAiConfig(env);
  const kindOk = loadProviderKind(env) !== null;
  if (result.ok && kindOk) return { state: "ready", model: result.config.model, configIssues: [] };
  return { state: "not_configured", model: null, configIssues: [...(result.ok ? [] : result.issues), ...(kindOk ? [] : [PROVIDER_ENV])] };
}

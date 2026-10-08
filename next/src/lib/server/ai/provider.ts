import type { AiConfig } from "./config";

/**
 * The provider boundary. LiveLift talks to a model through this one interface so that nothing else knows (or can
 * leak) which vendor, URL or key is behind it. The default implementation speaks the widely supported
 * OpenAI-compatible Chat Completions HTTP shape; tests use deterministic fixtures through the same code path.
 *
 * Failures are values with a closed vocabulary. The provider's own error text is NEVER kept: it can echo parts of
 * the request, and it is not LiveLift's to show, log or store.
 */

export type AiProviderFailure = "timeout" | "network" | "provider_error" | "credentials_rejected" | "rate_limited" | "malformed";

export class AiProviderError extends Error {
  constructor(readonly kind: AiProviderFailure, readonly retryAfterSec: number | null = null) {
    super(kind);
    this.name = "AiProviderError";
  }
}

export interface AiCompletionRequest {
  /** Instructions only. Carries nothing a person wrote. */
  system: string;
  /** The evidence document, introduced as data. */
  user: string;
}

export interface AiProvider {
  readonly model: string;
  /** Resolves to the model's raw text. Rejects only with AiProviderError. */
  complete(request: AiCompletionRequest): Promise<string>;
}

const MAX_RESPONSE_BYTES = 262_144;

function retryAfter(header: string | null): number | null {
  if (!header || !/^\d{1,5}$/.test(header.trim())) return null;
  const n = Number(header.trim());
  return n >= 1 ? Math.min(n, 3600) : null;
}

async function readBounded(res: Response): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => {});
        throw new AiProviderError("malformed");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

function contentOf(body: unknown): string {
  const choices = (body as { choices?: unknown } | null)?.choices;
  const message = Array.isArray(choices) ? (choices[0] as { message?: { content?: unknown } } | undefined)?.message : undefined;
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof (part as { text?: unknown })?.text === "string" ? (part as { text: string }).text : "")).join("");
  if (content === null || content === undefined) return "";
  throw new AiProviderError("malformed");
}

export function createOpenAiCompatibleProvider(config: AiConfig, fetchImpl?: typeof fetch): AiProvider {
  return {
    model: config.model,
    async complete(request) {
      const doFetch = fetchImpl ?? globalThis.fetch;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AiProviderError("timeout"));
          controller.abort();
        }, config.timeoutMs);
      });
      const exchange = (async (): Promise<string> => {
        let res: Response;
        try {
          res = await doFetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${config.apiKey}` },
            body: JSON.stringify({
              model: config.model,
              messages: [
                { role: "system", content: request.system },
                { role: "user", content: request.user },
              ],
              temperature: 0.2,
              max_tokens: config.maxOutputTokens,
              ...(config.jsonMode ? { response_format: { type: "json_object" } } : {}),
            }),
            // A redirect could carry the credential to another host.
            redirect: "error",
            cache: "no-store",
            signal: controller.signal,
          });
        } catch (error) {
          throw error instanceof AiProviderError ? error : new AiProviderError(controller.signal.aborted ? "timeout" : "network");
        }
        if (res.status === 429) throw new AiProviderError("rate_limited", retryAfter(res.headers.get("retry-after")));
        if (res.status === 401 || res.status === 403) throw new AiProviderError("credentials_rejected");
        if (res.status === 408 || res.status === 504) throw new AiProviderError("timeout");
        if (!res.ok) throw new AiProviderError("provider_error");
        let text: string;
        try {
          text = await readBounded(res);
        } catch (error) {
          throw error instanceof AiProviderError ? error : new AiProviderError(controller.signal.aborted ? "timeout" : "network");
        }
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          throw new AiProviderError("malformed");
        }
        return contentOf(body);
      })();
      try {
        // Bound both headers and body even if a fetch implementation ignores abort.
        return await Promise.race([exchange, timeout]);
      } finally {
        clearTimeout(timer);
        exchange.catch(() => {});
      }
    },
  };
}

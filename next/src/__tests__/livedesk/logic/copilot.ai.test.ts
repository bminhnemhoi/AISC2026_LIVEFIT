import { describe, expect, it } from "vitest";
import { refineSuggestions, type CopilotAiInput } from "@/lib/livedesk/copilot/ai";
import { scoreRules, type ProductSignals } from "@/lib/livedesk/copilot";
import * as S from "@/lib/livedesk/session";
import { AiProviderError, type AiProvider } from "@/lib/server/ai/provider";
import { PROVIDER_ENV, createAnthropicProvider, createConfiguredProvider, createGeminiProvider, loadProviderKind } from "@/lib/server/ai/providers";
import { aiStatus, type AiConfig } from "@/lib/server/ai/config";
import { liveDesk } from "./helpers";

// Fixture mode: every provider here is a deterministic fake passed in through the same seam the service uses. No network.

const signals: ProductSignals[] = [
  { productId: "a", name: "Zip Hoodie", askPrice: 3, askSize: 1, readyToBuy: 2, addToCart: 1, addToCartBefore: 0, stock: 24, sinceShownSec: null, showing: false },
  { productId: "b", name: "Linen Shirt", askPrice: 0, askSize: 0, readyToBuy: 0, addToCart: 7, addToCartBefore: 2, stock: 30, sinceShownSec: 0, showing: true },
];
const input: CopilotAiInput = {
  atSec: 300,
  signals,
  excerpts: { a: ["chốt đơn, sđt [SĐT]", "Zip Hoodie giá bao nhiêu vậy shop"], b: ["Đẹp quá shop ơi"] },
  candidates: scoreRules(signals),
};

const fake = (answer: (user: string) => string): AiProvider & { users: string[] } => {
  const users: string[] = [];
  return { model: "fixture-model-1", users, complete: async ({ user }) => { users.push(user); return answer(user); } };
};
const failing = (kind: ConstructorParameters<typeof AiProviderError>[0]): AiProvider => ({ model: "fixture-model-1", complete: async () => { throw new AiProviderError(kind); } });

describe("Copilot model refinement (fixture providers only)", () => {
  it("runs with no key at all: rules only, every suggestion labelled rules", async () => {
    const r = await refineSuggestions(input, { env: {} });
    expect(r.aiStatus).toBe("rules_only");
    expect(r.candidates.map((c) => c.source)).toEqual(["rules", "rules"]);
  });

  it("re-ranks and rewords when the model behaves, labelled ai; numbers stay the rules' own", async () => {
    const provider = fake(() => JSON.stringify({ suggestions: [
      { ref: "k1", headline: "Signals suggest a flash sale on Linen Shirt soon" },
      { ref: "k0", headline: "Signals suggest Zip Hoodie is worth showing next" },
    ] }));
    const r = await refineSuggestions(input, { provider });
    expect(r.aiStatus).toBe("ai_ok");
    expect(r.candidates.map((c) => [c.kind, c.source, c.headline])).toEqual([
      ["flash_sale", "ai", "Signals suggest a flash sale on Linen Shirt soon"],
      ["show_next", "ai", "Signals suggest Zip Hoodie is worth showing next"],
    ]);
    expect(r.candidates.map((c) => c.sampleSize)).toEqual([input.candidates[1].sampleSize, input.candidates[0].sampleSize]);
  });

  it("sends only aggregated numbers and masked, short excerpts", async () => {
    const provider = fake(() => JSON.stringify({ suggestions: [] }));
    await refineSuggestions({ ...input, excerpts: { a: ["mail test@example.com " + "x".repeat(200)] } }, { provider });
    const user = provider.users[0];
    expect(user).toContain('"environment":"SIMULATED"');
    expect(user).not.toContain("test@example.com");
    expect(user).not.toContain("x".repeat(100));
  });

  it.each([
    ["timeout", failing("timeout")],
    ["provider_error", failing("provider_error")],
    ["rate_limited", failing("rate_limited")],
  ])("falls back to rules on %s", async (reason, provider) => {
    const r = await refineSuggestions(input, { provider });
    expect(r).toMatchObject({ aiStatus: "ai_fallback", reason });
    expect(r.candidates.every((c) => c.source === "rules")).toBe(true);
  });

  it.each([
    ["not JSON", "Sure! Show the hoodie."],
    ["unknown ref", JSON.stringify({ suggestions: [{ ref: "k7", headline: "Signals suggest showing Zip Hoodie next" }] })],
    ["extra field", JSON.stringify({ suggestions: [{ ref: "k0", headline: "Signals suggest showing Zip Hoodie next", probability: 0.8 }] })],
    ["a percentage", JSON.stringify({ suggestions: [{ ref: "k0", headline: "Signals suggest Zip Hoodie: 80% chance of sales" }] })],
    ["a cause", JSON.stringify({ suggestions: [{ ref: "k0", headline: "Signals suggest Zip Hoodie caused the spike" }] })],
    ["a promise", JSON.stringify({ suggestions: [{ ref: "k0", headline: "Signals suggest Zip Hoodie will increase sales" }] })],
    ["no hedge", JSON.stringify({ suggestions: [{ ref: "k0", headline: "Show Zip Hoodie next" }] })],
    ["the wrong product", JSON.stringify({ suggestions: [{ ref: "k0", headline: "Signals suggest showing Linen Shirt next" }] })],
    ["a forbidden phrase", JSON.stringify({ suggestions: [{ ref: "k0", headline: "Signals suggest Zip Hoodie, synced with Shopee" }] })],
  ])("falls back to rules on a reply with %s", async (_why, reply) => {
    const r = await refineSuggestions(input, { provider: fake(() => reply) });
    expect(r).toMatchObject({ aiStatus: "ai_fallback", reason: "invalid_output" });
    expect(r.candidates.map((c) => c.headline)).toEqual(input.candidates.map((c) => c.headline));
  });

  it("the desk shows which produced each suggestion and keeps a model's wording until it words it again", () => {
    let s = S.advance(liveDesk().state, 300);
    const live = liveDesk().liveId;
    const rules = S.buildDeskView(s, live)!.copilot;
    expect(rules).toMatchObject({ aiStatus: "rules_only", statusLabel: "Rules only (SIMULATED data)" });
    const proposed = s.live!.suggestions.filter((x) => x.state === "proposed");
    expect(proposed.length).toBeGreaterThan(0);
    s = S.applyCopilotAi(s, { aiStatus: "ai_ok", candidates: proposed.map((p) => ({ ...p, headline: `Signals suggest ${p.productId} (model wording)`, source: "ai" })) });
    let view = S.buildDeskView(s, live)!.copilot;
    expect(view.statusLabel).toBe("AI model, rules as fallback (SIMULATED data)");
    expect(view.suggestions.filter((x) => x.state === "proposed").every((x) => x.source === "ai")).toBe(true);
    s = S.applyCopilotAi(s, { aiStatus: "ai_fallback", candidates: [] });
    view = S.buildDeskView(s, live)!.copilot;
    expect(view.statusLabel).toBe("AI model unavailable, showing rules (SIMULATED data)");
  });
});

describe("extra providers by environment variable, plain fetch", () => {
  const config: AiConfig = { baseUrl: "https://ai.example.test/v1", apiKey: "fixture-key-123456", model: "fixture-model-1", timeoutMs: 1000, maxOutputTokens: 300, jsonMode: true };
  const recorder = (reply: unknown) => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    return { calls, f };
  };

  it("chooses the wire format from LIVELIFT_AI_PROVIDER, defaulting to OpenAI-compatible", () => {
    expect(loadProviderKind({})).toBe("openai_compatible");
    expect(loadProviderKind({ [PROVIDER_ENV]: "Anthropic" })).toBe("anthropic");
    expect(loadProviderKind({ [PROVIDER_ENV]: "gemini" })).toBe("gemini");
    expect(loadProviderKind({ [PROVIDER_ENV]: "something" })).toBeNull();
    const env = { LIVELIFT_AI_BASE_URL: "https://ai.example.test/v1", LIVELIFT_AI_API_KEY: "fixture-key-123456", LIVELIFT_AI_MODEL: "m", [PROVIDER_ENV]: "nope" };
    expect(createConfiguredProvider(env)).toEqual({ ok: false, issues: [PROVIDER_ENV] });
    expect(aiStatus(env)).toEqual({ state: "not_configured", model: null, configIssues: [PROVIDER_ENV] });
    expect(aiStatus({ ...env, [PROVIDER_ENV]: "anthropic" }).state).toBe("ready");
  });

  it("speaks the Anthropic Messages API", async () => {
    const { calls, f } = recorder({ content: [{ type: "text", text: "{\"a\":" }, { type: "text", text: "1}" }], stop_reason: "end_turn" });
    expect(await createAnthropicProvider(config, f).complete({ system: "S", user: "U" })).toBe('{"a":1}');
    expect(calls[0].url).toBe("https://ai.example.test/v1/messages");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("fixture-key-123456");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers.authorization).toBeUndefined();
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ model: "fixture-model-1", max_tokens: 300, system: "S", messages: [{ role: "user", content: "U" }] });
    const refused = recorder({ content: [], stop_reason: "refusal" });
    await expect(createAnthropicProvider(config, refused.f).complete({ system: "S", user: "U" })).rejects.toMatchObject({ kind: "provider_error" });
  });

  it("speaks Gemini generateContent with the key in a header, never the URL", async () => {
    const { calls, f } = recorder({ candidates: [{ content: { parts: [{ text: "{}" }] } }] });
    expect(await createGeminiProvider(config, f).complete({ system: "S", user: "U" })).toBe("{}");
    expect(calls[0].url).toBe("https://ai.example.test/v1/models/fixture-model-1:generateContent");
    expect(calls[0].url).not.toContain("fixture-key");
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("fixture-key-123456");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ systemInstruction: { parts: [{ text: "S" }] }, generationConfig: { responseMimeType: "application/json" } });
    const bad = recorder({ nothing: true });
    await expect(createGeminiProvider(config, bad.f).complete({ system: "S", user: "U" })).rejects.toMatchObject({ kind: "malformed" });
  });
});

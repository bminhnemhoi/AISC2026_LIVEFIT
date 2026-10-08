import { dirname, isAbsolute, join, resolve } from "node:path";
import type { ProviderCapability, ProviderStatus, ProviderState } from "@/contracts/liveIntelligence";
import { CAPABILITY_KEYS } from "@/contracts/liveIntelligence";

export const ENV = {
  mode: "LIVELIFT_INTELLIGENCE_MODE", dbPath: "LIVELIFT_PROVIDER_EVIDENCE_DB_PATH",
  appKey: "LIVELIFT_TIKTOK_SHOP_APP_KEY", appSecret: "LIVELIFT_TIKTOK_SHOP_APP_SECRET",
  accessToken: "LIVELIFT_TIKTOK_SHOP_ACCESS_TOKEN", shopCipher: "LIVELIFT_TIKTOK_SHOP_CIPHER",
  creatorToken: "LIVELIFT_TIKTOK_CREATOR_ACCESS_TOKEN", intervalPolicy: "LIVELIFT_TIKTOK_SHOP_INTERVAL_POLICY",
} as const;
export type IntelligenceEnv = Record<string, string | undefined>;
export interface IntelligenceConfig {
  mode: "off" | "real" | "fixture"; dbPath: string;
  appKey?: string; appSecret?: string; accessToken?: string; shopCipher?: string; creatorToken?: string;
  intervalPolicy: "unverified" | "half_open_confirmed";
}
export function evidenceStorePath(authorityPath: string, env: IntelligenceEnv = process.env): string {
  return env[ENV.dbPath] || join(dirname(authorityPath), "provider-evidence.sqlite");
}
export function loadIntelligenceConfig(authorityPath: string, env: IntelligenceEnv = process.env): { config: IntelligenceConfig; issues: string[] } {
  const issues: string[] = [];
  const rawMode = env[ENV.mode] || "off";
  const mode = ["off", "real", "fixture"].includes(rawMode) ? rawMode as IntelligenceConfig["mode"] : "off";
  if (rawMode !== mode) issues.push(ENV.mode);
  const dbPath = evidenceStorePath(authorityPath, env);
  if (!isAbsolute(dbPath) || [authorityPath, env.LIVELIFT_PROVIDER_DB_PATH ?? join(dirname(authorityPath), "provider-credentials.sqlite")].some((p) => resolve(p) === resolve(dbPath))) issues.push(ENV.dbPath);
  const rawPolicy = env[ENV.intervalPolicy] || "unverified";
  const intervalPolicy = rawPolicy === "half_open_confirmed" ? rawPolicy : "unverified";
  if (!["unverified", "half_open_confirmed"].includes(rawPolicy)) issues.push(ENV.intervalPolicy);
  const config: IntelligenceConfig = { mode, dbPath, intervalPolicy };
  for (const name of ["appKey", "appSecret", "accessToken", "shopCipher", "creatorToken"] as const) {
    const value = env[ENV[name]];
    if (value && !/^[\x21-\x7e]{1,4096}$/.test(value)) issues.push(ENV[name]);
    else if (value) config[name] = value;
    if (mode === "real" && name !== "creatorToken" && !value) issues.push(ENV[name]);
  }
  return { config, issues: [...new Set(issues)] };
}

export function capabilities(config: IntelligenceConfig, state: ProviderState): ProviderCapability[] {
  return CAPABILITY_KEYS.map((key): ProviderCapability => {
    const unsupported = ["raw_comment_text", "product_pin_state", "pin_unpin_control", "giveaway_control"].includes(key);
    const creator = key === "audience_concurrency";
    const support = unsupported ? "UNSUPPORTED" : creator ? "REALTIME" : "POST_LIVE";
    return { key, support, state: unsupported ? "UNSUPPORTED" : config.mode !== "real" || state === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : creator || state !== "AVAILABLE" ? "ACCESS_REQUIRED" : "POST_LIVE",
      scope: unsupported ? null : creator ? "creator.data.live.read.public" : "data.shop_analytics.public.read",
      note: unsupported ? "No verified official API for this capability; LiveLift does not implement it."
        : creator ? "Creator-only aggregate snapshot; restricted access required. Login Kit does not grant LIVE telemetry."
        : key === "comment_count" ? "Post-LIVE aggregate count only; no raw comment text."
        : "Post-LIVE shop official/marketing-account analytics. Successful transport never establishes platform confirmation." };
  });
}
export function intelligenceStatus(authorityPath: string, env: IntelligenceEnv = process.env, latestState?: ProviderState): ProviderStatus {
  const { config, issues } = loadIntelligenceConfig(authorityPath, env);
  const state = config.mode === "off" || issues.length ? "NOT_CONFIGURED" : latestState ?? "READY";
  return { provider: "tiktok_shop", state, mode: config.mode, configIssues: issues, capabilities: capabilities(config, state), fixtureLabel: config.mode === "fixture" ? "SIMULATED / FIXTURE" : null };
}

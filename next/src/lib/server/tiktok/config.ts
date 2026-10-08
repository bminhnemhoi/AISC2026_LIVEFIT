import type { ProductionConfig } from "../config";
import { TIKTOK_ROUTES } from "@/contracts/tiktok";
import { isAbsolute, dirname, join } from "node:path";

/** Scopes this build can use. `user.info.profile` needs TikTok approval; `user.info.stats` is deliberately excluded (Missing != Zero). */
export const SUPPORTED_SCOPES = ["user.info.basic", "user.info.profile"] as const;
export type TikTokScope = (typeof SUPPORTED_SCOPES)[number];

export const ENV = {
  clientKey: "LIVELIFT_TIKTOK_CLIENT_KEY",
  clientSecret: "LIVELIFT_TIKTOK_CLIENT_SECRET",
  redirectUri: "LIVELIFT_TIKTOK_REDIRECT_URI",
  encryptionKey: "LIVELIFT_PROVIDER_ENCRYPTION_KEY",
  scopes: "LIVELIFT_TIKTOK_SCOPES",
  providerDbPath: "LIVELIFT_PROVIDER_DB_PATH",
} as const;

export type TikTokConfig = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  scopes: TikTokScope[];
  encryptionKey: Buffer;
  providerDbPath: string;
};
export type TikTokConfigResult =
  | { ok: true; config: TikTokConfig; scopes: TikTokScope[]; issues: [] }
  | { ok: false; scopes: TikTokScope[]; issues: string[] };

const credential = /^[\x21-\x7e]{8,256}$/;

export function requestedScopes(env: NodeJS.ProcessEnv = process.env): { scopes: TikTokScope[]; valid: boolean } {
  const raw = env[ENV.scopes];
  if (raw === undefined || raw.trim() === "") return { scopes: ["user.info.basic"], valid: true };
  const parts = raw.split(",").map((s) => s.trim());
  const unique = [...new Set(parts)];
  const valid = unique.length > 0 && unique.every((s): s is TikTokScope => (SUPPORTED_SCOPES as readonly string[]).includes(s)) && unique.includes("user.info.basic");
  return { scopes: valid ? (unique as TikTokScope[]) : ["user.info.basic"], valid };
}

/** The exact callback this deployment registers with TikTok. TikTok requires https, no query, no fragment, at most 512 characters. */
export function expectedRedirectUri(origin: string): string {
  return `${origin}${TIKTOK_ROUTES.callback}`;
}

/** Where provider credentials live: beside the authority database unless an absolute path is given. Independent of the other settings so disconnect and workspace deletion can always find it. */
export function providerStorePath(production: Pick<ProductionConfig, "dbPath">, env: NodeJS.ProcessEnv = process.env): string {
  return env[ENV.providerDbPath] ?? join(dirname(production.dbPath), "provider-credentials.sqlite");
}

/**
 * Evaluates the environment at call time. Values are never returned in `issues`; only variable NAMES are.
 * A deployment with any problem is "not configured": nothing starts and nothing is guessed.
 */
export function loadTikTokConfig(production: Pick<ProductionConfig, "origin" | "dbPath">, env: NodeJS.ProcessEnv = process.env): TikTokConfigResult {
  const issues: string[] = [];
  const { scopes, valid: scopesValid } = requestedScopes(env);
  if (!scopesValid) issues.push(ENV.scopes);

  const clientKey = env[ENV.clientKey];
  if (!clientKey || !credential.test(clientKey)) issues.push(ENV.clientKey);
  const clientSecret = env[ENV.clientSecret];
  if (!clientSecret || !credential.test(clientSecret)) issues.push(ENV.clientSecret);

  const redirectUri = env[ENV.redirectUri];
  if (!redirectUri || redirectUri.length > 512 || redirectUri !== expectedRedirectUri(production.origin)) issues.push(ENV.redirectUri);

  let key: Buffer | undefined;
  const rawKey = env[ENV.encryptionKey];
  if (rawKey) {
    const decoded = /^[A-Za-z0-9+/_-]{43}=?$/.test(rawKey) ? Buffer.from(rawKey, "base64") : undefined;
    if (decoded?.length === 32) key = decoded;
  }
  if (!key) issues.push(ENV.encryptionKey);

  const providerDbPath = providerStorePath(production, env);
  if (!isAbsolute(providerDbPath)) issues.push(ENV.providerDbPath);

  if (issues.length || !clientKey || !clientSecret || !redirectUri || !key) return { ok: false, scopes, issues: [...new Set(issues)] };
  return { ok: true, scopes, issues: [], config: { clientKey, clientSecret, redirectUri, scopes, encryptionKey: key, providerDbPath } };
}

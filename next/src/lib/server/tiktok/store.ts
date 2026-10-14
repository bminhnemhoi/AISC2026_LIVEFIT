import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { decryptField, encryptField } from "./crypto";

function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const value = operation(); db.exec("COMMIT"); return value; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}

/**
 * Provider credential store: a SEPARATE SQLite file next to the authority database.
 *
 * Why separate: the authority database has a strict, verified schema (user_version 2) shared by startup, backup,
 * restore and migration. Provider secrets must not ride along in authority backups, and a restore of the room must
 * not roll tokens back (refresh tokens may rotate). This file has its own explicit, versioned migration and is
 * bound to one workspace id; any mismatch fails closed.
 *
 * Tokens are AES-256-GCM encrypted columns. Nothing here ever logs or returns a token to a caller outside the service.
 */
export const PROVIDER_SCHEMA_VERSION = 1;

export const PROVIDER_V1_SQL = `
CREATE TABLE provider_meta (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  workspace_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;
CREATE TRIGGER provider_meta_identity BEFORE UPDATE ON provider_meta
  BEGIN SELECT RAISE(ABORT, 'provider store identity is immutable'); END;
CREATE TABLE oauth_pending (
  state_hash TEXT PRIMARY KEY,
  binding_hash TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
) STRICT;
CREATE TABLE provider_connections (
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider = 'tiktok'),
  status TEXT NOT NULL CHECK(status IN ('connected', 'expired', 'disconnected')),
  open_id TEXT,
  granted_scopes TEXT NOT NULL,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  access_expires_at_ms INTEGER,
  refresh_expires_at_ms INTEGER,
  token_version INTEGER NOT NULL,
  profile_json TEXT CHECK(profile_json IS NULL OR json_valid(profile_json)),
  profile_state TEXT NOT NULL,
  profile_fetched_at_ms INTEGER,
  unavailable_reason TEXT,
  last_checked_at_ms INTEGER,
  connected_by_actor_id TEXT,
  connected_at_ms INTEGER,
  disconnected_at_ms INTEGER,
  revocation TEXT CHECK(revocation IS NULL OR revocation IN ('confirmed', 'unconfirmed')),
  PRIMARY KEY (workspace_id, provider)
) STRICT;
PRAGMA user_version = 1;
`;

export type StoredProfile = { displayName: string | null; avatarUrl: string | null; username: string | null; isVerified: boolean | null };
export type ConnectionRow = {
  status: "connected" | "expired" | "disconnected";
  openId: string | null;
  grantedScopes: string[];
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  accessExpiresAtMs: number | null;
  refreshExpiresAtMs: number | null;
  tokenVersion: number;
  profile: StoredProfile | null;
  profileState: "ok" | "partial" | "scope_missing" | "unknown";
  profileFetchedAtMs: number | null;
  unavailableReason: string | null;
  lastCheckedAtMs: number | null;
  connectedByActorId: string | null;
  connectedAtMs: number | null;
  disconnectedAtMs: number | null;
  revocation: "confirmed" | "unconfirmed" | null;
};
export type PendingRow = { bindingHash: string; actorId: string; redirectUri: string; expiresAtMs: number };

function open(path: string, workspaceId: string, create: boolean): DatabaseSync | null {
  const exists = existsSync(path);
  if (!exists && !create) return null;
  if (exists && !statSync(path).isFile()) throw new Error("Provider store is not a file");
  if (!exists) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try {
    if (!exists) chmodSync(path, 0o600);
    // secure_delete: disconnecting must overwrite the erased profile/identity bytes, not leave them in free pages.
    db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA secure_delete = ON;");
    const version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
    if (version === 0) {
      // Explicit, ordered, transactional v0 -> v1 migration of a brand-new file. Anything else is refused.
      const tables = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n;
      if (Number(tables) !== 0) throw new Error("Unrecognised provider store");
      transaction(db, () => {
        db.exec(PROVIDER_V1_SQL);
        db.prepare("INSERT INTO provider_meta VALUES (1, ?, ?)").run(workspaceId, Date.now());
      });
    } else if (version !== PROVIDER_SCHEMA_VERSION) throw new Error("Unsupported provider store version");
    const meta = db.prepare("SELECT workspace_id FROM provider_meta WHERE singleton = 1").get();
    if (!meta || meta.workspace_id !== workspaceId) throw new Error("Provider store belongs to another workspace");
    return db;
  } catch (error) { db.close(); throw error; }
}

const toInt = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const toStr = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));

function parseProfile(raw: unknown): StoredProfile | null {
  if (raw === null || raw === undefined) return null;
  try {
    const value = JSON.parse(String(raw)) as Record<string, unknown>;
    return {
      displayName: typeof value.displayName === "string" ? value.displayName : null,
      avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
      username: typeof value.username === "string" ? value.username : null,
      isVerified: typeof value.isVerified === "boolean" ? value.isVerified : null,
    };
  } catch { return null; }
}

function toConnection(row: Record<string, unknown>): ConnectionRow {
  const profileState = ["ok", "partial", "scope_missing", "unknown"].includes(String(row.profile_state)) ? (String(row.profile_state) as ConnectionRow["profileState"]) : "unknown";
  return {
    status: String(row.status) as ConnectionRow["status"],
    openId: toStr(row.open_id),
    grantedScopes: String(row.granted_scopes).split(",").filter(Boolean),
    accessTokenEnc: toStr(row.access_token_enc),
    refreshTokenEnc: toStr(row.refresh_token_enc),
    accessExpiresAtMs: toInt(row.access_expires_at_ms),
    refreshExpiresAtMs: toInt(row.refresh_expires_at_ms),
    tokenVersion: Number(row.token_version),
    profile: parseProfile(row.profile_json),
    profileState,
    profileFetchedAtMs: toInt(row.profile_fetched_at_ms),
    unavailableReason: toStr(row.unavailable_reason),
    lastCheckedAtMs: toInt(row.last_checked_at_ms),
    connectedByActorId: toStr(row.connected_by_actor_id),
    connectedAtMs: toInt(row.connected_at_ms),
    disconnectedAtMs: toInt(row.disconnected_at_ms),
    revocation: row.revocation === "confirmed" || row.revocation === "unconfirmed" ? row.revocation : null,
  };
}

export type TokenSet = { accessToken: string; refreshToken: string; accessExpiresAtMs: number; refreshExpiresAtMs: number };

/** A handle scoped to ONE workspace; every statement filters by it. */
export class ProviderStore {
  constructor(private db: DatabaseSync, readonly workspaceId: string, private key: Buffer) {}
  close(): void { this.db.close(); }

  // ---- pending OAuth authorizations (CSRF state) ----
  createPending(stateHash: string, bindingHash: string, actorId: string, redirectUri: string, now: number, ttlMs: number): void {
    transaction(this.db, () => {
      this.db.prepare("DELETE FROM oauth_pending WHERE expires_at_ms <= ?").run(now);
      // Bounded: a flood of starts cannot grow the table without limit.
      const count = Number(this.db.prepare("SELECT count(*) AS n FROM oauth_pending WHERE workspace_id = ?").get(this.workspaceId)!.n);
      if (count >= 20) this.db.prepare("DELETE FROM oauth_pending WHERE state_hash IN (SELECT state_hash FROM oauth_pending WHERE workspace_id = ? ORDER BY created_at_ms LIMIT ?)").run(this.workspaceId, count - 19);
      this.db.prepare("INSERT INTO oauth_pending VALUES (?, ?, ?, ?, ?, ?, ?)").run(stateHash, bindingHash, this.workspaceId, actorId, redirectUri, now, now + ttlMs);
    });
  }
  /** Single use: the row is removed whether or not the caller goes on to succeed. */
  consumePending(stateHash: string, now: number): PendingRow | null {
    return transaction(this.db, () => {
      const row = this.db.prepare("SELECT * FROM oauth_pending WHERE state_hash = ? AND workspace_id = ?").get(stateHash, this.workspaceId);
      if (!row) return null;
      this.db.prepare("DELETE FROM oauth_pending WHERE state_hash = ?").run(stateHash);
      if (Number(row.expires_at_ms) <= now) return null;
      return { bindingHash: String(row.binding_hash), actorId: String(row.actor_id), redirectUri: String(row.redirect_uri), expiresAtMs: Number(row.expires_at_ms) };
    });
  }

  // ---- connection ----
  get(): ConnectionRow | null {
    const row = this.db.prepare("SELECT * FROM provider_connections WHERE workspace_id = ? AND provider = 'tiktok'").get(this.workspaceId);
    return row ? toConnection(row) : null;
  }
  readTokens(row: ConnectionRow): { accessToken: string | null; refreshToken: string | null } {
    return {
      accessToken: row.accessTokenEnc ? decryptField(this.key, this.workspaceId, "access_token", row.accessTokenEnc) : null,
      refreshToken: row.refreshTokenEnc ? decryptField(this.key, this.workspaceId, "refresh_token", row.refreshTokenEnc) : null,
    };
  }
  /** Replaces any previous connection for this workspace with a fresh authorization. */
  saveConnection(input: { openId: string; grantedScopes: string[]; tokens: TokenSet; actorId: string; now: number }): void {
    const { tokens } = input;
    this.db.prepare(`INSERT INTO provider_connections VALUES (?, 'tiktok', 'connected', ?, ?, ?, ?, ?, ?, 1, NULL, 'unknown', NULL, NULL, ?, ?, ?, NULL, NULL)
      ON CONFLICT(workspace_id, provider) DO UPDATE SET status = 'connected', open_id = excluded.open_id, granted_scopes = excluded.granted_scopes,
        access_token_enc = excluded.access_token_enc, refresh_token_enc = excluded.refresh_token_enc, access_expires_at_ms = excluded.access_expires_at_ms,
        refresh_expires_at_ms = excluded.refresh_expires_at_ms, token_version = provider_connections.token_version + 1, profile_json = NULL, profile_state = 'unknown',
        profile_fetched_at_ms = NULL, unavailable_reason = NULL, last_checked_at_ms = excluded.last_checked_at_ms, connected_by_actor_id = excluded.connected_by_actor_id,
        connected_at_ms = excluded.connected_at_ms, disconnected_at_ms = NULL, revocation = NULL`)
      .run(this.workspaceId, input.openId, input.grantedScopes.join(","), encryptField(this.key, this.workspaceId, "access_token", tokens.accessToken), encryptField(this.key, this.workspaceId, "refresh_token", tokens.refreshToken), tokens.accessExpiresAtMs, tokens.refreshExpiresAtMs, input.now, input.actorId, input.now);
  }
  /** Compare-and-swap on token_version so a concurrent refresh or disconnect is never overwritten. Returns whether it applied. */
  replaceTokens(expectedVersion: number, tokens: TokenSet, grantedScopes: string[] | null): boolean {
    const result = this.db.prepare(`UPDATE provider_connections SET access_token_enc = ?, refresh_token_enc = ?, access_expires_at_ms = ?, refresh_expires_at_ms = ?,
      granted_scopes = COALESCE(?, granted_scopes), token_version = token_version + 1
      WHERE workspace_id = ? AND provider = 'tiktok' AND status = 'connected' AND token_version = ?`)
      .run(encryptField(this.key, this.workspaceId, "access_token", tokens.accessToken), encryptField(this.key, this.workspaceId, "refresh_token", tokens.refreshToken), tokens.accessExpiresAtMs, tokens.refreshExpiresAtMs, grantedScopes ? grantedScopes.join(",") : null, this.workspaceId, expectedVersion);
    return Number(result.changes) === 1;
  }
  saveProfile(expectedVersion: number, profile: StoredProfile | null, state: ConnectionRow["profileState"], now: number): void {
    this.db.prepare(`UPDATE provider_connections SET profile_json = ?, profile_state = ?, profile_fetched_at_ms = ?, unavailable_reason = NULL, last_checked_at_ms = ?
      WHERE workspace_id = ? AND provider = 'tiktok' AND status = 'connected' AND token_version >= ?`)
      .run(profile ? JSON.stringify(profile) : null, state, profile ? now : null, now, this.workspaceId, expectedVersion);
  }
  markUnavailable(reason: string, now: number): void {
    this.db.prepare("UPDATE provider_connections SET unavailable_reason = ?, last_checked_at_ms = ? WHERE workspace_id = ? AND provider = 'tiktok' AND status = 'connected'").run(reason, now, this.workspaceId);
  }
  /** Fail closed: tokens are erased; identity and the last known profile stay, labelled stale by the status view. */
  markExpired(now: number): void {
    this.db.prepare(`UPDATE provider_connections SET status = 'expired', access_token_enc = NULL, refresh_token_enc = NULL, access_expires_at_ms = NULL, refresh_expires_at_ms = NULL,
      unavailable_reason = NULL, last_checked_at_ms = ? WHERE workspace_id = ? AND provider = 'tiktok' AND status = 'connected'`).run(now, this.workspaceId);
  }
  /** Erases tokens, identity and profile. Only the tombstone (when, and whether TikTok confirmed revocation) remains. */
  markDisconnected(now: number, revocation: "confirmed" | "unconfirmed" | null): void {
    this.db.prepare(`UPDATE provider_connections SET status = 'disconnected', open_id = NULL, granted_scopes = '', access_token_enc = NULL, refresh_token_enc = NULL,
      access_expires_at_ms = NULL, refresh_expires_at_ms = NULL, token_version = token_version + 1, profile_json = NULL, profile_state = 'unknown', profile_fetched_at_ms = NULL,
      unavailable_reason = NULL, last_checked_at_ms = ?, connected_by_actor_id = NULL, connected_at_ms = NULL, disconnected_at_ms = ?, revocation = ?
      WHERE workspace_id = ? AND provider = 'tiktok'`).run(now, now, revocation, this.workspaceId);
    this.db.prepare("DELETE FROM oauth_pending WHERE workspace_id = ?").run(this.workspaceId);
  }
}

/** Opens (creating and migrating a new file when `create`) the store for exactly this workspace. */
export function openProviderStore(path: string, workspaceId: string, key: Buffer, create: boolean): ProviderStore | null {
  const db = open(path, workspaceId, create);
  return db ? new ProviderStore(db, workspaceId, key) : null;
}

/** Removes the provider store files; used when a workspace is deleted. */
export function removeProviderStoreFiles(path: string): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(`${path}${suffix}`, { force: true });
}

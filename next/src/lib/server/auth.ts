import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { AuthSession } from "@/contracts/production";
import { AuthorityError } from "./config";
import { deployment, transaction } from "./database";
import { log } from "./log";

export const COOKIE = "__Host-livelift_session";
export const SESSION_MS = 12 * 60 * 60 * 1000;
export const passwordSchema = z.string().min(15).max(128);
export const usernameSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
export const loginSchema = z.object({ username: usernameSchema, password: passwordSchema }).strict();
let active = 0;
const waiting: (() => void)[] = [];
/** Two hashes need roughly 256 MiB; reject excess queued work instead of unbounded memory. */
export async function passwordHash(password: string, salt: string): Promise<string> {
  passwordSchema.parse(password);
  if (active >= 2) {
    if (waiting.length >= 32) throw new AuthorityError(429, "rate_limited", "Authentication is busy.", 1);
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else active++;
  try {
    return await new Promise<string>((resolve, reject) => scrypt(password, Buffer.from(salt, "hex"), 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key.toString("hex"))));
  } finally {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
}
export function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function cookie(token: string, expiresAtMs: number): string {
  return `${COOKIE}=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Expires=${new Date(expiresAtMs).toUTCString()}`;
}
export function requestToken(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export function currentSession(db: DatabaseSync, request: Request, now = Date.now()): AuthSession {
  const token = requestToken(request);
  const row = token && db.prepare(`SELECT a.actor_id, a.name, a.role, s.expires_at_ms FROM login_sessions s
    JOIN accounts a ON a.actor_id = s.actor_id WHERE s.token_hash = ? AND s.expires_at_ms > ? AND a.enabled = 1`).get(tokenHash(token), now);
  if (!row) throw new AuthorityError(401, "unauthenticated", "A current login session is required.");
  return { ...deployment(db), access: { actorId: String(row.actor_id), name: String(row.name), role: row.role as "operator" | "viewer" }, expiresAtMs: Number(row.expires_at_ms) };
}
export async function login(db: DatabaseSync, username: string, password: string): Promise<{ token: string; session: AuthSession }> {
  const row = db.prepare("SELECT * FROM accounts WHERE username = ?").get(username);
  // Unknown, disabled and known accounts all perform the same parameterized scrypt work.
  const salt = row ? String(row.salt) : "00".repeat(16);
  const hash = await passwordHash(password, salt);
  const matches = timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(row ? String(row.password_hash) : "00".repeat(64), "hex"));
  if (!row || !matches) throw new AuthorityError(401, "invalid_credentials", "Invalid username or password.");
  return transaction(db, () => {
    // Password/role/disable may change while asynchronous hashing is in progress.
    const latest = db.prepare("SELECT * FROM accounts WHERE actor_id = ?").get(row.actor_id);
    if (!latest || latest.enabled !== 1 || latest.password_hash !== row.password_hash || latest.salt !== row.salt || latest.role !== row.role) throw new AuthorityError(401, "invalid_credentials", "Invalid username or password.");
    const token = randomBytes(32).toString("base64url");
    const expiresAtMs = Date.now() + SESSION_MS;
    db.prepare("DELETE FROM login_sessions WHERE expires_at_ms <= ?").run(Date.now());
    db.prepare("INSERT INTO login_sessions VALUES (?, ?, ?)").run(tokenHash(token), row.actor_id, expiresAtMs);
    return { token, session: { ...deployment(db), access: { actorId: String(row.actor_id), name: String(row.name), role: row.role as "operator" | "viewer" }, expiresAtMs } };
  });
}
export function logout(db: DatabaseSync, request: Request): void {
  const token = requestToken(request);
  if (token) db.prepare("DELETE FROM login_sessions WHERE token_hash = ?").run(tokenHash(token));
}
export async function addUser(db: DatabaseSync, username: string, name: string, role: string, password: string): Promise<string> {
  usernameSchema.parse(username); z.string().min(1).max(128).refine((s) => s.trim().length > 0).parse(name); z.enum(["operator", "viewer"]).parse(role);
  const salt = randomBytes(16).toString("hex");
  const hash = await passwordHash(password, salt);
  const actorId = randomUUID();
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 1)").run(actorId, username, name, role, salt, hash);
  log("admin_account_added", { actorId });
  return actorId;
}
export async function updateUser(db: DatabaseSync, username: string, action: string, value?: string): Promise<void> {
  const row = db.prepare("SELECT actor_id FROM accounts WHERE username = ?").get(usernameSchema.parse(username));
  if (!row) throw new Error("Account not found");
  if (action === "reset-password") {
    const salt = randomBytes(16).toString("hex");
    const hash = await passwordHash(passwordSchema.parse(value), salt);
    db.prepare("UPDATE accounts SET salt = ?, password_hash = ?, enabled = 1 WHERE actor_id = ?").run(salt, hash, row.actor_id);
  } else if (action === "set-role") {
    db.prepare("UPDATE accounts SET role = ? WHERE actor_id = ?").run(z.enum(["operator", "viewer"]).parse(value), row.actor_id);
  } else if (action === "disable") db.prepare("UPDATE accounts SET enabled = 0 WHERE actor_id = ?").run(row.actor_id);
  else if (action === "delete") db.prepare("DELETE FROM accounts WHERE actor_id = ?").run(row.actor_id);
  else throw new Error("Unknown user operation");
  log("admin_revocation", { actorId: String(row.actor_id), resultCode: action });
}

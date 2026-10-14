import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Provider tokens are encrypted at rest with AES-256-GCM. The associated data binds each ciphertext to its
 * workspace and column, so a value copied to another workspace or field fails authentication.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>` (base64url). The key comes only from the environment.
 */
const VERSION = "v1";

function aad(workspaceId: string, field: string): Buffer { return Buffer.from(`livelift:tiktok:${workspaceId}:${field}`, "utf8"); }

export function encryptField(key: Buffer, workspaceId: string, field: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(workspaceId, field));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Throws a generic error for every failure (wrong key, tampering, wrong workspace/field, bad format). */
export function decryptField(key: Buffer, workspaceId: string, field: string, sealed: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("credential_unreadable");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64url"));
    decipher.setAAD(aad(workspaceId, field));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new Error("credential_unreadable"); }
}

export function sha256Hex(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function randomToken(): string { return randomBytes(32).toString("base64url"); }
export function safeEqualHex(a: string, b: string): boolean {
  return a.length === b.length && /^[0-9a-f]+$/.test(a) && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/**
 * Everything a person typed or imported (operator notes, segment and product names, cue text, follow-ups) is
 * UNTRUSTED data. Before it can reach an external model it is normalised, stripped of anything that looks like
 * a credential or contact detail, and length-bounded. This is data hygiene, not the prompt-injection defence
 * (that is the role boundary in prompt.ts plus the output allowlist in output.ts); it keeps secrets and
 * unrelated personal data out of a third party's logs even when somebody pastes them into a note.
 */

export const REDACTED = "[redacted]";

/** Zero-width and bidirectional-control characters: invisible, and used to smuggle or reorder text. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// Stripping control characters is the point of this expression.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\bsk-[A-Za-z0-9_-]{12,}/g, // OpenAI-style keys
  /\b(?:act|rft|clt)\.[A-Za-z0-9._-]{12,}/g, // TikTok access/refresh/client tokens
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bLIVELIFT_[A-Z0-9_]+\s*[=:]\s*\S+/g,
  /\b(?:api[_-]?key|secret|token|password|passwd|authorization)\s*[=:]\s*\S+/gi,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}(?![A-Za-z0-9])/g, // long opaque blob
];
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED);
  return out.replace(EMAIL, "[email]");
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max - 1;
  // Do not cut a surrogate pair in half.
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
}

/** Normalise, redact and bound one untrusted string. The result is plain text: no control or invisible characters. */
export function sanitizeUntrusted(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const normalised = text.normalize("NFKC").replace(INVISIBLE, "").replace(/[\r\n\t]+/g, " ").replace(CONTROL, "");
  return clip(redactSecrets(normalised).replace(/\s{2,}/g, " ").trim(), max);
}

/**
 * JSON for the model. `<` and `>` are escaped so that text inside a note can never look like a markup or
 * role-boundary tag (`</evidence>`, `<system>`) to the model; the JSON stays valid and decodes to the same value.
 */
export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

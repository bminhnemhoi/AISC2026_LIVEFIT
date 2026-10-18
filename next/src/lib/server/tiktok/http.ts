import type { TikTokCallbackOutcome } from "@/contracts/tiktok";
import { Limiter } from "../boundary";
import { productionRuntime } from "../http";
import type { TikTokContext } from "./service";

/**
 * The callback arrives from tiktok.com as a cross-site top-level navigation, so the `SameSite=Strict` session cookie
 * is not sent. This separate, short-lived, HttpOnly, SameSite=Lax cookie binds the callback to the browser that
 * started the flow; its hash is stored with the single-use pending state. It carries no credential.
 */
export const BINDING_COOKIE = "__Host-livelift_tiktok_bind";

export function bindingCookie(value: string, ttlSeconds: number): string {
  return `${BINDING_COOKIE}=${value}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;
}
export function clearBindingCookie(): string {
  return `${BINDING_COOKIE}=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
export function readBinding(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${BINDING_COOKIE}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(BINDING_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export const tiktokLimits = new Limiter();

/** Always a fixed, allowlisted outcome code in the query; never the provider's text, the code or the state. */
export function callbackRedirect(origin: string, outcome: TikTokCallbackOutcome): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${origin}/integrations?tiktok=${outcome}`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Set-Cookie": clearBindingCookie(),
    },
  });
}

export async function tiktokContext(authorityDb: TikTokContext["authorityDb"]): Promise<TikTokContext> {
  const { production } = await productionRuntime();
  return { production, authorityDb };
}

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/** The page CSP from `src/proxy.ts`: the viewer room's host video must be allowed, nothing else loosened. */

function directives(path: string): { csp: Map<string, string>; names: string[]; referrer: string | null } {
  const res = proxy(new NextRequest(`http://localhost:3130${path}`));
  const raw = res.headers.get("Content-Security-Policy") ?? "";
  const pairs = raw.split(";").map(d => {
    const [name, ...values] = d.trim().split(/\s+/);
    return [name, values.join(" ")] as const;
  });
  // `names` keeps every directive in order, duplicates included: the Map alone would hide a repeated one.
  return { csp: new Map(pairs), names: pairs.map(([name]) => name), referrer: res.headers.get("Referrer-Policy") };
}

/** The complete directive set. A new directive is a policy change: add it here on purpose, with its own test. */
const EXPECTED_DIRECTIVES = [
  "default-src",
  "script-src",
  "style-src",
  "style-src-attr",
  "img-src",
  "media-src",
  "frame-src",
  "font-src",
  "connect-src",
  "object-src",
  "frame-ancestors",
  "base-uri",
  "form-action",
];

function nonceOf(value: string | undefined): string {
  const m = (value ?? "").match(/'nonce-([A-Za-z0-9+/=]+)'/);
  if (!m) throw new Error(`no nonce in ${value}`);
  return m[1];
}

describe("page CSP", () => {
  it("lets /xem play the host video: mp4 over https and the YouTube nocookie embed", () => {
    const { csp } = directives("/xem/ABC123");
    expect(csp.get("media-src")).toBe("'self' https:");
    expect(csp.get("frame-src")).toBe("https://www.youtube-nocookie.com");
  });

  it("keeps every other directive as it was", () => {
    const { csp } = directives("/phien");
    expect(csp.get("default-src")).toBe("'self'");
    expect(csp.get("img-src")).toBe("'self' data:");
    expect(csp.get("font-src")).toBe("'self'");
    expect(csp.get("connect-src")).toBe("'self'");
    expect(csp.get("object-src")).toBe("'none'");
    expect(csp.get("frame-ancestors")).toBe("'none'");
    expect(csp.get("base-uri")).toBe("'self'");
    expect(csp.get("form-action")).toBe("'self'");
    expect(csp.get("script-src")).toMatch(/^'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  });

  it.each(["/xem/ABC123", "/phien"])("%s: style tags need this response's nonce; inline style attributes only via style-src-attr", path => {
    const { csp } = directives(path);
    const nonce = nonceOf(csp.get("script-src"));
    // Same nonce as the scripts (Next stamps both from x-nonce), no 'unsafe-inline' for <style> elements.
    expect(csp.get("style-src")).toBe(`'self' 'nonce-${nonce}'`);
    expect(csp.get("style-src")).not.toContain("unsafe-inline");
    // React's style={{...}} props (XemRoom, the desk) are attributes: allowed there and nowhere else.
    expect(csp.get("style-src-attr")).toBe("'unsafe-inline'");
    expect(csp.get("script-src")).not.toContain("unsafe-inline");
  });

  it("issues a fresh nonce for every response", () => {
    const a = nonceOf(directives("/xem/ABC123").csp.get("style-src"));
    const b = nonceOf(directives("/xem/ABC123").csp.get("style-src"));
    expect(a).not.toBe(b);
  });

  it.each(["/xem/ABC123", "/xem", "/phien", "/"])("%s: exactly the expected directives, none unknown, none repeated", path => {
    const { names } = directives(path);
    expect([...names].sort()).toEqual([...EXPECTED_DIRECTIVES].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it("sends the origin only (never the room path) cross-site from /xem, so YouTube accepts the embed", () => {
    expect(directives("/xem/ABC123").referrer).toBe("strict-origin-when-cross-origin");
    expect(directives("/xem").referrer).toBe("strict-origin-when-cross-origin");
  });

  it("keeps no-referrer on the desk and every other page", () => {
    expect(directives("/phien").referrer).toBe("no-referrer");
    expect(directives("/xemxet").referrer).toBe("no-referrer");
  });
});

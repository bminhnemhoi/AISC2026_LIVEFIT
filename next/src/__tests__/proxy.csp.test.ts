// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/** The page CSP from `src/proxy.ts`: the viewer room's host video must be allowed, nothing else loosened. */

function directives(path: string): { csp: Map<string, string>; referrer: string | null } {
  const res = proxy(new NextRequest(`http://localhost:3130${path}`));
  const raw = res.headers.get("Content-Security-Policy") ?? "";
  const csp = new Map(
    raw.split(";").map(d => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values.join(" ")] as const;
    }),
  );
  return { csp, referrer: res.headers.get("Referrer-Policy") };
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

  it("sends the origin only (never the room path) cross-site from /xem, so YouTube accepts the embed", () => {
    expect(directives("/xem/ABC123").referrer).toBe("strict-origin-when-cross-origin");
    expect(directives("/xem").referrer).toBe("strict-origin-when-cross-origin");
  });

  it("keeps no-referrer on the desk and every other page", () => {
    expect(directives("/phien").referrer).toBe("no-referrer");
    expect(directives("/xemxet").referrer).toBe("no-referrer");
  });
});

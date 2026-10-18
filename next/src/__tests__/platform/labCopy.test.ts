import { describe, expect, it } from "vitest";
import { DIRECTOR_STEPS } from "@/lib/platform";
import { labCopy, type CaptionContext } from "@/components/platform/lab/labCopy";

const CTX: CaptionContext = { first: "Zip Hoodie", second: "Cargo Pants", flash: "Flash Sale announcement", flashAt: "20:12" };
const FORBIDDEN = [/synced with Shopee/i, /connected to Shopee/i, /confirmed by Shopee/i, /real-time from Shopee/i];

/** Every leaf as [path, text]; templates are called with sample values. */
function leaves(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    return [[path, String(path.includes(".captions.") ? fn(CTX) : fn("7", "7"))]];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  return [];
}

const keysOf = (value: unknown, path = ""): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).flatMap(([k, v]) => [`${path}.${k}`, ...keysOf(v, `${path}.${k}`)])
    : [];

describe("the Lab copy", () => {
  it("English and Vietnamese have the same keys (the notice headlines are Vietnamese only)", () => {
    const en = keysOf(labCopy.en).filter((k) => !k.startsWith(".noticeTitles."));
    const vi = keysOf(labCopy.vi).filter((k) => !k.startsWith(".noticeTitles."));
    expect(vi).toEqual(en);
    expect(labCopy.vi.hostApp.comments.length).toBe(labCopy.en.hostApp.comments.length);
  });

  it("has no empty line in either language", () => {
    for (const lang of ["en", "vi"] as const) {
      for (const [path, text] of leaves(labCopy[lang])) expect(text.trim(), `${lang}${path}`).not.toBe("");
    }
  });

  it("has a caption for every Director step, in both languages, that uses the show's own names", () => {
    for (const step of DIRECTOR_STEPS) {
      for (const lang of ["en", "vi"] as const) expect(labCopy[lang].director.captions[step.id](CTX).length, `${lang} ${step.id}`).toBeGreaterThan(20);
    }
    expect(labCopy.en.director.captions["livelift-pins"](CTX)).toContain("Zip Hoodie");
    expect(labCopy.vi.director.captions["host-pins"](CTX)).toContain("Cargo Pants");
    expect(labCopy.vi.director.captions["live-opens"](CTX)).toContain("20:12");
  });

  it("never claims a connection to Shopee", () => {
    for (const lang of ["en", "vi"] as const) {
      for (const [path, text] of leaves(labCopy[lang])) for (const bad of FORBIDDEN) expect(text, `${lang}${path}`).not.toMatch(bad);
    }
  });

  it("keeps the word SIMULATED wherever English has it, and on every simulated surface", () => {
    const vi = new Map(leaves(labCopy.vi));
    for (const [path, text] of leaves(labCopy.en)) {
      if (text.includes("SIMULATED")) expect(vi.get(path), path).toContain("SIMULATED");
    }
    for (const lang of ["en", "vi"] as const) {
      const c = labCopy[lang];
      for (const text of [c.wire.lanes.platform, c.wire.lanes.host, c.phone.region, c.desk.products, c.source.provider_observed]) {
        expect(text).toContain("SIMULATED");
      }
    }
  });

  it("names evidence the AGENTS way: a request accepted is still unverified", () => {
    expect(labCopy.en.source.request_accepted).toMatch(/platform verification unknown/);
    expect(labCopy.en.source.provider_observed).toBe("Provider observed (SIMULATED)");
    expect(labCopy.vi.source.provider_observed).toBe("Provider observed (SIMULATED)");
  });
});

describe("noticeLine (vi)", () => {
  const line = labCopy.vi.noticeLine;
  it("words a host pin from typed data and keeps the product name as original text", () => {
    expect(line("observed", { action: "pinned", product: "Cargo Pants" })).toEqual({ lead: "Host đã ghim", original: "Cargo Pants", tail: "trên nền tảng." });
  });
  it("returns null without data, so the original sentence is shown instead", () => {
    expect(line("observed", undefined)).toBeNull();
    expect(line("platform_problem", { message: "x" })).toBeNull();
  });
  it("English builds nothing: it shows the stored sentence", () => {
    expect(labCopy.en.noticeLine("observed", { action: "pinned", product: "Cargo Pants" })).toBeNull();
  });
});

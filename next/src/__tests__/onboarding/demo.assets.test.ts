import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseProductRows, toProductSnapshots } from "@/lib/domain";
import { PRODUCT_LIBRARY } from "@/fixtures/library";

const DEMO_DIR = path.resolve(__dirname, "../../../../docs/competition/v3-demo");
const read = (name: string): string => readFileSync(path.join(DEMO_DIR, name), "utf8");
const libraryCodes = PRODUCT_LIBRARY.map((p) => p.code);

describe("competition demo assets go through the supported import, unchanged", () => {
  it.each(["sample-products.csv", "sample-products.tsv"])("%s: every row is valid in Prepare → Import", (file) => {
    const rows = parseProductRows(read(file), libraryCodes);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.status !== "valid")).toEqual([]);
  });

  it("the CSV and the TSV describe the same products", () => {
    const csv = parseProductRows(read("sample-products.csv"), []).map(({ code, name, price, currency }) => ({ code, name, price, currency }));
    const tsv = parseProductRows(read("sample-products.tsv"), []).map(({ code, name, price, currency }) => ({ code, name, price, currency }));
    expect(csv).toEqual(tsv);
  });

  it("sample codes never collide with the shipped library, and a missing price stays 'Not entered', never 0", () => {
    const rows = parseProductRows(read("sample-products.csv"), []);
    expect(rows.some((r) => libraryCodes.includes(r.code))).toBe(false);
    const snapshots = toProductSnapshots(rows, "Imported");
    expect(snapshots.some((p) => p.price === null)).toBe(true);
    expect(snapshots.some((p) => p.price === 0)).toBe(false);
  });

  it("has no header row (Import would reject it) and no analytics-looking columns", () => {
    for (const file of ["sample-products.csv", "sample-products.tsv"]) {
      const first = read(file).split(/\r?\n/)[0];
      expect(first).not.toMatch(/^code\b/i);
      expect(read(file)).not.toMatch(/views|viewers|gmv|orders|revenue|conversion/i);
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estimateState, summaryLines } from "../desk";
import { BaoCaoSchema } from "../types";

/**
 * Contract with the Python core: a REAL `GET /sessions/{id}/bao-cao` response (golden demo, sample data, captured
 * 15/10/2026 from `POST /demo/seed-vang`) must parse and feed every desk mapping. The recap once rendered an empty
 * summary card because the schema read `cau` while the server sends `text` — a schema written from memory, never
 * checked against the wire. Recapture this file whenever livelift.api.routes.reports changes its shape.
 */
const raw = JSON.parse(readFileSync(join(__dirname, "fixtures", "bao-cao-demo-vang-duong.json"), "utf-8")) as unknown;

describe("hợp đồng /bao-cao với lõi Python", () => {
  const report = BaoCaoSchema.parse(raw);

  it("parses the server's report as is", () => {
    expect(report.loai_phien).toBe("thi_nghiem");
    expect(report.ket_qua_thi_nghiem?.estimable).toBe(true);
  });

  it("renders the three-sentence summary with its evidence badge", () => {
    const lines = summaryLines(report);
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l.text.length).toBeGreaterThan(20);
    expect(lines[0].badge).toBe("Bốc thăm");
  });

  it("feeds the estimate card from the same payload", () => {
    const s = estimateState(report);
    expect(s.kind).toBe("estimate");
  });
});

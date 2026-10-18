import { describe, expect, it } from "vitest";
import { isAllowed } from "@/lib/livelift-api/allowlist";
import type { Session } from "@/lib/livelift-api/types";
import { groupSessions } from "../PhienList";

function s(id: string, status: string, start: string | null): Session {
  return { session_id: id, platform: "youtube", title: id, mode: "auto", status, planned_duration_min: 90, start_ts: start, end_ts: null, dry_run: false, is_demo: false };
}

describe("trang Thí nghiệm — danh sách phiên", () => {
  it("groups live first, then planned, then ended; newest first; empty groups dropped", () => {
    const g = groupSessions([
      s("a", "ended", "2026-10-14T10:00:00Z"),
      s("b", "live", "2026-10-15T09:00:00Z"),
      s("c", "ended", "2026-10-15T08:00:00Z"),
    ]);
    expect(g.map(x => x.title)).toEqual(["Đang phát", "Đã kết thúc"]);
    expect(g[1].items.map(x => x.session_id)).toEqual(["c", "a"]);
  });

  it("only uses calls the server-side proxy allows", () => {
    expect(isAllowed("GET", "sessions")).toBe(true);
    expect(isAllowed("POST", "demo/seed")).toBe(true);
    expect(isAllowed("POST", "demo/seed-vang")).toBe(true);
  });
});

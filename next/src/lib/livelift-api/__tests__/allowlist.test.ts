import { describe, expect, it } from "vitest";
import { filterQuery, isAllowed } from "../allowlist";

const SID = "3f2b8c1e-1d2a-4c5b-9e8f-0a1b2c3d4e5f";

describe("desk proxy allowlist", () => {
  it.each([
    ["GET", `sessions/${SID}`],
    ["GET", `sessions/${SID}/state`],
    ["GET", `sessions/${SID}/schedule`],
    ["GET", `sessions/${SID}/bao-cao`],
    ["POST", `sessions/${SID}/actions/execute`],
    ["POST", `sessions/${SID}/phong-xem`],
    ["POST", "demo/seed-vang"],
  ])("forwards %s %s", (method, path) => {
    expect(isAllowed(method, path)).toBe(true);
  });

  it.each([
    ["DELETE", `sessions/${SID}`],
    ["GET", "sessions/not-a-uuid/state"],
    ["POST", `sessions/${SID}/comments`],
    ["POST", `sessions/${SID}/ticks`],
    ["POST", "replays/youtube"],
    ["GET", `sessions/${SID}/../../etc/passwd`],
    ["GET", `sessions/${SID}%2fstate`],
    ["GET", "https://evil.example/x"],
    ["GET", "xem-api/abc/trang-thai"],
    ["GET", ""],
  ])("refuses %s %s", (method, path) => {
    expect(isAllowed(method, path)).toBe(false);
  });

  it("passes through only known query keys", () => {
    expect(filterQuery(new URLSearchParams("role=host&token=x&env=demo"))).toBe("?role=host&env=demo");
    expect(filterQuery(new URLSearchParams("a=1"))).toBe("");
  });
});

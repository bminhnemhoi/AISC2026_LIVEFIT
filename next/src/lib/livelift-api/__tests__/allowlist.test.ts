import { describe, expect, it } from "vitest";
import { filterQuery, isAllowed, isJsonContentType, isSameOrigin, isWriteMethod } from "../allowlist";

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
    // /report shows the raw ON/OFF difference mid-session with no §7 lock; the desk reads bao-cao.
    ["GET", `sessions/${SID}/report`],
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

describe("desk proxy write guard", () => {
  it("treats everything but GET/HEAD/OPTIONS as a write", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(isWriteMethod(m)).toBe(true);
    for (const m of ["GET", "HEAD", "OPTIONS"]) expect(isWriteMethod(m)).toBe(false);
  });

  it.each<[string, Record<string, string>]>([
    ["localhost", { origin: "http://localhost:3130", host: "localhost:3130" }],
    ["127.0.0.1", { origin: "http://127.0.0.1:3130", host: "127.0.0.1:3130" }],
    ["case-insensitive host", { origin: "http://localhost:3130", host: "LocalHost:3130" }],
    ["behind a proxy", { origin: "https://abc.trycloudflare.com", host: "127.0.0.1:3130", "x-forwarded-host": "abc.trycloudflare.com" }],
    ["first forwarded host", { origin: "https://abc.trycloudflare.com", "x-forwarded-host": "abc.trycloudflare.com, 127.0.0.1:8088" }],
  ])("accepts a same-origin write (%s)", (_name, h) => {
    expect(isSameOrigin(new Headers(h))).toBe(true);
  });

  it.each<[string, Record<string, string>]>([
    ["foreign origin", { origin: "https://evil.example", host: "localhost:3130" }],
    ["other port", { origin: "http://localhost:3000", host: "localhost:3130" }],
    ["no origin", { host: "localhost:3130" }],
    ["opaque origin", { origin: "null", host: "localhost:3130" }],
    ["not a URL", { origin: "localhost:3130", host: "localhost:3130" }],
    ["no host at all", { origin: "http://localhost:3130" }],
    ["forwarded host wins over Host", { origin: "http://localhost:3130", host: "localhost:3130", "x-forwarded-host": "abc.trycloudflare.com" }],
  ])("refuses a cross-origin write (%s)", (_name, h) => {
    expect(isSameOrigin(new Headers(h))).toBe(false);
  });

  it("accepts only a JSON content type", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("Application/JSON; charset=utf-8")).toBe(true);
    expect(isJsonContentType("text/plain;charset=UTF-8")).toBe(false);
    expect(isJsonContentType("application/x-www-form-urlencoded")).toBe(false);
    expect(isJsonContentType("multipart/form-data; boundary=x")).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});

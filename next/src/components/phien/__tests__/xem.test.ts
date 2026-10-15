import { describe, expect, it } from "vitest";
import { HEARTBEAT_MS, XEM_API, consentKey, getViewerId, newEventId } from "../XemRoom";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const m = new Map<string, string>();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("phòng xem — client helpers", () => {
  it("viewer id is random, matches the server pattern, and is stable on one phone", () => {
    const s = memoryStorage();
    const a = getViewerId(s);
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(getViewerId(s)).toBe(a);
    expect(getViewerId(memoryStorage())).not.toBe(a);
  });

  it("a malformed stored id is replaced", () => {
    const s = memoryStorage();
    s.setItem("livelift.xem.viewer", "<bad>");
    expect(getViewerId(s)).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });

  it("consent is per room AND per consent version", () => {
    expect(consentKey("abc", "v1")).not.toBe(consentKey("abc", "v2"));
    expect(consentKey("abc", "v1")).not.toBe(consentKey("xyz", "v1"));
  });

  it("event ids are unique and within the server's 64-char pattern", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newEventId("nhip")));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("talks only to the public room API and beats every 15 s", () => {
    expect(XEM_API.endsWith("/xem-api")).toBe(true);
    expect(HEARTBEAT_MS).toBe(15_000);
  });
});

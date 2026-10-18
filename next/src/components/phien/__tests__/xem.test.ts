import { describe, expect, it } from "vitest";
import { HEARTBEAT_MS, SEND_ATTEMPTS, XEM_API, consentKey, forgetViewerEverywhere, getViewerId, newEventId, postEvent, storedViewerId, withdrawNote } from "../XemRoom";

/** A fetch double that answers from a script: a number is an HTTP status, "drop" is a reset connection. */
function scriptedFetch(script: Array<number | "drop">): { fetchImpl: typeof fetch; bodies: string[] } {
  const bodies: string[] = [];
  let i = 0;
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    bodies.push(String(init?.body));
    const step = script[Math.min(i++, script.length - 1)];
    if (step === "drop") throw new TypeError("fetch failed: ECONNRESET");
    return new Response("{}", { status: step });
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies };
}

describe("phòng xem — gửi sự kiện chịu được rớt kết nối (G2, 15/10/2026)", () => {
  it("retries a dropped connection and a proxy 502 with the very same body", async () => {
    const { fetchImpl, bodies } = scriptedFetch(["drop", 502, 200]);
    const out = await postEvent("/xem-api/x/su-kien", '{"event_id":"bam-1"}', fetchImpl, 3, 0);
    expect(out).toEqual({ ok: true, status: 200 });
    expect(bodies).toEqual(Array(3).fill('{"event_id":"bam-1"}'));
  });

  it("never retries a 4xx: consent missing, withdrawn and rate limits are final answers", async () => {
    for (const status of [403, 410, 422, 429]) {
      const { fetchImpl, bodies } = scriptedFetch([status, 200]);
      const out = await postEvent("/xem-api/x/su-kien", "{}", fetchImpl, 3, 0);
      expect(out).toEqual({ ok: false, status });
      expect(bodies).toHaveLength(1);
    }
  });

  it("gives up after the attempt budget", async () => {
    const { fetchImpl, bodies } = scriptedFetch(["drop"]);
    const out = await postEvent("/xem-api/x/su-kien", "{}", fetchImpl, SEND_ATTEMPTS, 0);
    expect(out).toEqual({ ok: false, status: null });
    expect(bodies).toHaveLength(SEND_ATTEMPTS);
  });
});

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

describe("phòng xem: rút lui (V3-xem-ui, 19/10/2026)", () => {
  it("reading the stored id never creates one", () => {
    const s = memoryStorage();
    expect(storedViewerId(s)).toBeNull();
    expect(s.getItem("livelift.xem.viewer")).toBeNull();
    s.setItem("livelift.xem.viewer", "<bad>");
    expect(storedViewerId(s)).toBeNull();
    const id = getViewerId(memoryStorage());
    s.setItem("livelift.xem.viewer", id);
    expect(storedViewerId(s)).toBe(id);
  });

  it("forgetting removes the shared id and the consent marks of EVERY room, nothing else", () => {
    const m = new Map<string, string>([
      ["livelift.xem.viewer", "abcdef0123456789"],
      [consentKey("ABC", "v1"), "1"],
      [consentKey("ABC", "v2"), "1"],
      [consentKey("ABCD", "v1"), "1"],
      [consentKey("XYZ", "v1"), "1"],
      ["unrelated", "x"],
    ]);
    const storage = {
      get length() {
        return m.size;
      },
      key: (i: number) => Array.from(m.keys())[i] ?? null,
      removeItem: (k: string) => void m.delete(k),
    };
    forgetViewerEverywhere(storage);
    // Mọi dấu đồng ý trỏ tới mã chung vừa xoá, nên giữ lại dấu nào cũng gây bẫy 403 (G3-xem-ui, 19/10/2026).
    expect([...m.keys()]).toEqual(["unrelated"]);
  });

  it("every failure says the data is NOT deleted; 403/404 say there is nothing here to delete", () => {
    for (const status of [null, 400, 409, 422, 429, 500, 502, 503]) {
      const n = withdrawNote(status);
      expect(n.kind).toBe("loi");
      expect(n.text).toContain("chưa bị xoá");
    }
    for (const status of [403, 404]) {
      const n = withdrawNote(status);
      expect(n.kind).toBe("tin");
      expect(n.text).toContain("không có gì để xoá");
    }
  });

  it("the messages are plain Vietnamese: no long dash, no claim of a deletion", () => {
    for (const status of [null, 403, 404, 409, 429, 500]) {
      const { text } = withdrawNote(status);
      expect(text).not.toMatch(/[\u2014\u2013]/);
      expect(text).not.toMatch(/đã (được )?xoá/);
    }
  });
});

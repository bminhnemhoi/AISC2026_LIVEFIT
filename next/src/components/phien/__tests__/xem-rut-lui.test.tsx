import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HEARTBEAT_MS, XemRoom, consentKey } from "../XemRoom";

/**
 * Rút lui trên điện thoại (V3-xem-ui, 19/10/2026): quyền rút lui sống lâu hơn phòng. Khi phòng đã tắt (trang-thai 404)
 * máy còn giữ mã ngẫu nhiên vẫn thấy nút; thất bại được báo ngay trong trang, không qua window.alert; thành công thì
 * xoá mã trên máy và báo đã xoá. Máy chưa từng vào phòng nào không được để lại mã mới.
 *
 * G3-xem-ui (19/10/2026): mã ngẫu nhiên là MỘT mã chung cho mọi phòng, nên rút lui thành công xoá cả dấu đồng ý của
 * MỌI phòng trên máy (dấu nào để lại cũng trỏ tới mã đã xoá). Thêm các ca khoá: phòng tắt giữa chừng thì nhịp tim dừng
 * và nút vẫn còn; máy chặn bộ nhớ thì trang không vỡ; mọi lần rút lui thất bại báo bằng tiếng Việt ngay trong trang.
 */

const VIEWER_KEY = "livelift.xem.viewer";
const ID = "abcdef0123456789abcdef0123456789";
const CODE = "ABC123";

/** An HTTP status, a reset connection, or "trung": 200 for a withdrawal the server had already recorded. */
type Answer = number | "drop" | "trung";
/** A trang-thai answer: an HTTP status (404 = room switched off), or the room state served with 200. */
type Room = number | object;

/**
 * A fetch double. trang-thai answers `room`, or the list in order with the last answer repeating (a room switched off
 * mid-session); rut_lui answers from `events` in order; any other kind answers 200. `posted`/`urls` keep the
 * withdrawals, `sent` keeps every su-kien body (heartbeats and consent included).
 */
function stubFetch(
  room: Room | Room[],
  events: Answer[] = [200],
): { posted: Array<Record<string, unknown>>; urls: string[]; sent: Array<Record<string, unknown>> } {
  const rooms = Array.isArray(room) ? room : [room];
  const posted: Array<Record<string, unknown>> = [];
  const urls: string[] = [];
  const sent: Array<Record<string, unknown>> = [];
  let i = 0;
  let r = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/trang-thai")) {
        const now = rooms[Math.min(r++, rooms.length - 1)];
        if (typeof now === "number") return new Response(JSON.stringify({ detail: "Phòng xem không tồn tại hoặc đã tắt." }), { status: now });
        return new Response(JSON.stringify(now), { status: 200, headers: { "content-type": "application/json" } });
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      sent.push(body);
      if (body.kind !== "rut_lui") return new Response("{}", { status: 200 }); // consent and heartbeats of the open room
      posted.push(body);
      urls.push(url);
      const step = events[Math.min(i++, events.length - 1)];
      if (step === "drop") throw new TypeError("fetch failed: ECONNRESET");
      if (step === "trung") return new Response(JSON.stringify({ accepted: false, duplicate: true }), { status: 200 });
      return new Response(JSON.stringify({ accepted: step < 300, duplicate: false }), { status: step });
    }),
  );
  return { posted, urls, sent };
}

const OPEN_ROOM = {
  room: { title: "Phòng thử", status: "dang_mo", video_url: null, consent_version: "v1", source_label: "PHÒNG DÀN DỰNG" },
  pinned: null,
  products: [],
  server_time_ms: 0,
  poll_after_ms: 60_000,
  source_code_url: "https://example.org/src",
};

let alertSpy: ReturnType<typeof vi.fn>;
let confirmSpy: ReturnType<typeof vi.fn>;
/** Puts the setup's in-memory localStorage back after a test that blocked it. */
let restoreStorage: (() => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  alertSpy = vi.fn();
  confirmSpy = vi.fn(() => true);
  vi.stubGlobal("alert", alertSpy);
  vi.stubGlobal("confirm", confirmSpy);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  restoreStorage?.();
  restoreStorage = null;
  vi.unstubAllGlobals();
});

async function confirmWithdraw(label: string): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận rút lui" }));
}

describe("phòng đã tắt (trang-thai 404)", () => {
  it("a phone that never joined a room sees no button and is left with no id", async () => {
    stubFetch(404);
    render(<XemRoom code={CODE} />);
    expect(await screen.findByTestId("xem-gone")).toHaveTextContent("Phòng không tồn tại hoặc đã tắt.");
    expect(screen.queryByRole("button")).toBeNull();
    expect(localStorage.getItem(VIEWER_KEY)).toBeNull();
  });

  it("a phone that still holds its id gets the minimal withdraw button", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    stubFetch(404);
    render(<XemRoom code={CODE} />);
    expect(await screen.findByRole("button", { name: "Rút lui và xoá dữ liệu của tôi" })).toBeInTheDocument();
    // Nothing is sent before the viewer confirms in the page.
    expect(vi.mocked(fetch).mock.calls.every(([u]) => String(u).endsWith("/trang-thai"))).toBe(true);
  });

  it("Huỷ goes back to the button without sending anything", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    const { posted } = stubFetch(404);
    render(<XemRoom code={CODE} />);
    fireEvent.click(await screen.findByRole("button", { name: "Rút lui và xoá dữ liệu của tôi" }));
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(screen.getByRole("button", { name: "Rút lui và xoá dữ liệu của tôi" })).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it("success: sends only the random id, clears it and the consent marks of EVERY room, and says the data is deleted", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    localStorage.setItem(consentKey(CODE, "v1"), "1");
    localStorage.setItem(consentKey(CODE, "v2"), "1");
    localStorage.setItem(consentKey("XYZ999", "v1"), "1");
    localStorage.setItem(consentKey("XYZ999", "v3"), "1");
    localStorage.setItem("livelift.desk.che-do", "toi"); // not ours to clear
    const { posted, urls } = stubFetch(404, [200]);
    render(<XemRoom code={CODE} />);
    await confirmWithdraw("Rút lui và xoá dữ liệu của tôi");

    const done = await screen.findByTestId("xem-withdrawn");
    expect(done).toHaveTextContent("Bạn đã rút lui");
    expect(done).toHaveTextContent("đã được xoá khỏi nghiên cứu");
    expect(done).toHaveTextContent("Mã ngẫu nhiên lưu trên máy này cũng đã được xoá.");

    expect(urls).toEqual([`/xem-api/${CODE}/su-kien`]);
    expect(posted).toHaveLength(1);
    expect(Object.keys(posted[0]).sort()).toEqual(["client_time_ms", "event_id", "kind", "viewer_id"]);
    expect(posted[0]).toMatchObject({ viewer_id: ID, kind: "rut_lui" });

    expect(localStorage.getItem(VIEWER_KEY)).toBeNull();
    expect(localStorage.getItem(consentKey(CODE, "v1"))).toBeNull();
    expect(localStorage.getItem(consentKey(CODE, "v2"))).toBeNull();
    // The id was one for all rooms: a mark left in another room would reopen it under a new id that never agreed (403).
    expect(localStorage.getItem(consentKey("XYZ999", "v1"))).toBeNull();
    expect(localStorage.getItem(consentKey("XYZ999", "v3"))).toBeNull();
    expect(localStorage.getItem("livelift.desk.che-do")).toBe("toi");
    expect(localStorage.length).toBe(1);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("failure (429): a Vietnamese alert in the page, nothing cleared, the button comes back", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    stubFetch(404, [429]);
    render(<XemRoom code={CODE} />);
    await confirmWithdraw("Rút lui và xoá dữ liệu của tôi");

    const msg = await screen.findByRole("alert");
    expect(msg).toHaveTextContent("Dữ liệu của bạn chưa bị xoá.");
    expect(msg).toHaveClass("xem2-bao--loi");
    expect(screen.getByRole("button", { name: "Rút lui và xoá dữ liệu của tôi" })).toBeEnabled();
    expect(localStorage.getItem(VIEWER_KEY)).toBe(ID);
    expect(screen.queryByTestId("xem-withdrawn")).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("failure (connection lost after every retry): says nothing was deleted, keeps the id", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    const { posted } = stubFetch(404, ["drop"]);
    render(<XemRoom code={CODE} />);
    await confirmWithdraw("Rút lui và xoá dữ liệu của tôi");

    const msg = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(msg).toHaveTextContent("mất mạng");
    expect(msg).toHaveTextContent("chưa bị xoá");
    expect(posted.length).toBeGreaterThan(1); // retried with the same body
    expect(new Set(posted.map(p => p.event_id)).size).toBe(1);
    expect(localStorage.getItem(VIEWER_KEY)).toBe(ID);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it.each([403, 404])("%s on the withdrawal (this phone never took part here): information, not an error, id kept", async status => {
    localStorage.setItem(VIEWER_KEY, ID);
    stubFetch(404, [status]);
    render(<XemRoom code={CODE} />);
    await confirmWithdraw("Rút lui và xoá dữ liệu của tôi");

    const msg = await screen.findByRole("status");
    expect(msg).toHaveTextContent("không có gì để xoá");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(localStorage.getItem(VIEWER_KEY)).toBe(ID);
    expect(screen.queryByTestId("xem-withdrawn")).toBeNull();
  });
});

describe("phòng đang mở", () => {
  it("a failed withdrawal is reported in the page; window.confirm and window.alert are never used", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    localStorage.setItem(consentKey(CODE, "v1"), "1");
    stubFetch(OPEN_ROOM, [503]);
    render(<XemRoom code={CODE} />);
    await screen.findByTestId("xem-room");
    await confirmWithdraw("Rút lui khỏi nghiên cứu");

    const msg = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(msg).toHaveTextContent("chưa bị xoá");
    expect(screen.getByTestId("xem-room")).toBeInTheDocument();
    expect(localStorage.getItem(VIEWER_KEY)).toBe(ID);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("a confirmed withdrawal clears the phone and shows the withdrawn screen", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    localStorage.setItem(consentKey(CODE, "v1"), "1");
    localStorage.setItem(consentKey("XYZ999", "v1"), "1");
    const { posted } = stubFetch(OPEN_ROOM, [200]);
    render(<XemRoom code={CODE} />);
    await screen.findByTestId("xem-room");
    await confirmWithdraw("Rút lui khỏi nghiên cứu");

    expect(await screen.findByTestId("xem-withdrawn")).toHaveTextContent("Mã ngẫu nhiên lưu trên máy này cũng đã được xoá.");
    expect(posted[0]).toMatchObject({ viewer_id: ID, kind: "rut_lui" });
    await waitFor(() => expect(localStorage.getItem(VIEWER_KEY)).toBeNull());
    expect(localStorage.getItem(consentKey(CODE, "v1"))).toBeNull();
    expect(localStorage.getItem(consentKey("XYZ999", "v1"))).toBeNull();
  });
});

/** The open room, polled again after 20 s: one heartbeat at once, one at 15 s, then the next poll can switch it off. */
const OPEN_ROOM_20S = { ...OPEN_ROOM, poll_after_ms: 20_000 };

/** Fake clock for the timeline tests; fetch answers and React updates settle inside act. */
function useClock(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
}

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Clicks the withdraw button, then "Xác nhận rút lui", and lets the answer (and any retry backoff) arrive. */
async function withdrawNow(label: string, settleMs = 0): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận rút lui" }));
  await tick(settleMs);
}

const beats = (sent: Array<Record<string, unknown>>): number => sent.filter(b => b.kind === "nhip").length;

/** Storage that refuses every use, as a phone with blocked site data or a strict private mode does. */
function blockStorage(mode: "truy-cap" | "moi-phuong-thuc"): void {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (!saved) throw new Error("vitest.setup.ts should install localStorage on globalThis");
  restoreStorage = () => Object.defineProperty(globalThis, "localStorage", saved);
  const refuse = (): never => {
    throw new DOMException("The operation is insecure.", mode === "truy-cap" ? "SecurityError" : "QuotaExceededError");
  };
  if (mode === "truy-cap") {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: refuse });
  } else {
    const refusing = {
      get length(): number {
        return refuse();
      },
      key: refuse,
      getItem: refuse,
      setItem: refuse,
      removeItem: refuse,
      clear: refuse,
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: refusing });
  }
}

describe("G3-xem-ui: phòng tắt giữa chừng, bộ nhớ bị chặn, lời báo khi thất bại", () => {
  it("a room switched off mid-session stops the heartbeat, keeps the withdraw button, and withdraws with the stored id", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    localStorage.setItem(consentKey(CODE, "v1"), "1");
    useClock();
    const { posted, sent } = stubFetch([OPEN_ROOM_20S, 404], [200]);
    render(<XemRoom code={CODE} />);

    await tick(0);
    expect(screen.getByTestId("xem-room")).toBeInTheDocument();
    expect(beats(sent)).toBe(1); // one beat as soon as the room opens
    await tick(HEARTBEAT_MS);
    expect(beats(sent)).toBe(2);

    await tick(20_000 - HEARTBEAT_MS); // the next poll answers 404: the room was switched off
    expect(screen.getByTestId("xem-gone")).toHaveTextContent("Phòng không tồn tại hoặc đã tắt.");
    const beforeOff = beats(sent);
    await tick(HEARTBEAT_MS * 4);
    expect(beats(sent)).toBe(beforeOff); // no POST nhip once the room is gone
    expect(sent.filter(b => b.kind !== "nhip")).toHaveLength(0);

    await withdrawNow("Rút lui và xoá dữ liệu của tôi");
    expect(screen.getByTestId("xem-withdrawn")).toHaveTextContent("Mã ngẫu nhiên lưu trên máy này cũng đã được xoá.");
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ viewer_id: ID, kind: "rut_lui" });
    expect(new Set(sent.map(b => b.viewer_id))).toEqual(new Set([ID]));
    expect(localStorage.getItem(VIEWER_KEY)).toBeNull();
    expect(localStorage.getItem(consentKey(CODE, "v1"))).toBeNull();

    await tick(HEARTBEAT_MS * 2); // the poll goes on answering 404; nothing else is sent and no id is minted
    expect(sent).toHaveLength(beforeOff + 1);
    expect(localStorage.getItem(VIEWER_KEY)).toBeNull();
  });

  it.each(["truy-cap", "moi-phuong-thuc"] as const)(
    "storage blocked (%s): the page still opens, agrees and beats, and after a mid-session switch-off withdraws with its own id",
    async mode => {
      useClock();
      const { posted, sent } = stubFetch([OPEN_ROOM_20S, 404], [200]);
      blockStorage(mode);
      expect(() => window.localStorage.getItem(VIEWER_KEY)).toThrow();
      render(<XemRoom code={CODE} />);

      await tick(0);
      fireEvent.click(screen.getByRole("button", { name: "Tôi đồng ý và vào phòng" }));
      await tick(0);
      expect(screen.getByTestId("xem-room")).toBeInTheDocument();
      const agreed = sent.find(b => b.kind === "dong_y");
      expect(agreed?.viewer_id).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
      expect(beats(sent)).toBe(1);

      await tick(20_000); // switched off: storage holds nothing, so the page offers the id it used itself
      expect(screen.getByTestId("xem-gone")).toBeInTheDocument();
      const beforeOff = beats(sent);
      await tick(HEARTBEAT_MS * 2);
      expect(beats(sent)).toBe(beforeOff);

      await withdrawNow("Rút lui và xoá dữ liệu của tôi");
      const done = screen.getByTestId("xem-withdrawn");
      expect(done).toHaveTextContent("Bạn đã rút lui");
      // Nothing could be stored, so the page does not claim it deleted a stored id.
      expect(done).not.toHaveTextContent("Mã ngẫu nhiên lưu trên máy này");
      expect(posted).toHaveLength(1);
      expect(posted[0]).toMatchObject({ viewer_id: agreed?.viewer_id, kind: "rut_lui" });
      expect(new Set(sent.map(b => b.viewer_id)).size).toBe(1);
      expect(alertSpy).not.toHaveBeenCalled();
    },
  );

  it.each([400, 409, 422, 500, 502, 503])(
    "a withdrawal that fails with %s is reported in plain Vietnamese in the page; the id and every mark stay",
    async status => {
      localStorage.setItem(VIEWER_KEY, ID);
      localStorage.setItem(consentKey(CODE, "v1"), "1");
      localStorage.setItem(consentKey("XYZ999", "v1"), "1");
      useClock();
      const { posted } = stubFetch(404, [status]);
      render(<XemRoom code={CODE} />);
      await tick(0);

      await withdrawNow("Rút lui và xoá dữ liệu của tôi", 2_000); // covers the retry backoff of a 5xx
      const msg = screen.getByRole("alert");
      expect(msg).toHaveClass("xem2-bao--loi");
      expect(msg).toHaveTextContent("Dữ liệu của bạn chưa bị xoá.");
      const text = msg.textContent ?? "";
      expect(text).toMatch(/[ạảãàáâầấậẩẫăằắặẳẵđẹẻẽèéêềếệểễịỉĩìíọỏõòóôồốộổỗơờớợởỡụủũùúưừứựửữỵỷỹỳý]/);
      expect(text).not.toMatch(/error|failed|fetch|undefined|null|NaN/i);
      expect(text.includes(String.fromCharCode(0x2014)) || text.includes(String.fromCharCode(0x2013))).toBe(false); // no long dash
      expect(text).not.toMatch(/đã (được )?xoá/);
      expect(screen.getByRole("button", { name: "Rút lui và xoá dữ liệu của tôi" })).toBeEnabled();
      expect(screen.queryByTestId("xem-withdrawn")).toBeNull();
      expect(posted[0]).toMatchObject({ viewer_id: ID, kind: "rut_lui" });
      expect(localStorage.getItem(VIEWER_KEY)).toBe(ID);
      expect(localStorage.getItem(consentKey(CODE, "v1"))).toBe("1");
      expect(localStorage.getItem(consentKey("XYZ999", "v1"))).toBe("1");
      expect(alertSpy).not.toHaveBeenCalled();
    },
  );

  it("a 2xx for a withdrawal the server had already recorded (duplicate) clears the phone like a fresh one", async () => {
    localStorage.setItem(VIEWER_KEY, ID);
    localStorage.setItem(consentKey(CODE, "v1"), "1");
    localStorage.setItem(consentKey("XYZ999", "v1"), "1");
    const { posted } = stubFetch(404, ["trung"]);
    render(<XemRoom code={CODE} />);
    await confirmWithdraw("Rút lui và xoá dữ liệu của tôi");

    expect(await screen.findByTestId("xem-withdrawn")).toHaveTextContent("Mã ngẫu nhiên lưu trên máy này cũng đã được xoá.");
    expect(posted).toHaveLength(1);
    expect(localStorage.length).toBe(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/* ---------- U7 · đường bấm của người xem, làm mù, nhãn (soát đợt 2: ĐỎ 2, VÀNG 7, 9, 10, 11) ---------- */

const MON = [
  { product_id: "LAB-1", name: "Áo thun cotton basic", price_vnd: 129_000, image_url: null },
  { product_id: "LAB-3", name: "Bình giữ nhiệt inox 750ml", price_vnd: 159_000, image_url: null },
];
const PHONG_TAT = { ...OPEN_ROOM, products: MON };
const PHONG_BAT = { ...PHONG_TAT, pinned: MON[1] };

/** Vào phòng với dấu đồng ý có sẵn (không bấm đồng ý), trả các body đã gửi. */
async function vaoPhong(room: object): Promise<Array<Record<string, unknown>>> {
  localStorage.setItem(VIEWER_KEY, ID);
  localStorage.setItem(consentKey(CODE, "v1"), "1");
  const { sent } = stubFetch(room);
  render(<XemRoom code={CODE} />);
  await screen.findByTestId("xem-room");
  return sent;
}

/** Mọi body trừ nhịp tim. */
const thaoTac = (sent: Array<Record<string, unknown>>): Array<Record<string, unknown>> => sent.filter(b => b.kind !== "nhip");

/** Khung điện thoại bỏ thẻ ghim: phần còn lại phải giống hệt nhau giữa khối BẬT và khối TẮT. */
function khungTruGhim(): string {
  const goc = screen.getByTestId("dien-thoai-live").cloneNode(true) as HTMLElement;
  goc.querySelector("[data-testid='dien-thoai-ghim']")?.remove();
  return goc.outerHTML;
}

describe("U7 · đường bấm của người xem", () => {
  it("màn đồng ý: chưa gửi gì; 4 ý gồm mục đích và hạn xoá; dòng phiên bản nằm ngoài phần thu gọn", async () => {
    const { sent } = stubFetch(PHONG_BAT);
    render(<XemRoom code={CODE} />);
    const the = await screen.findByTestId("xem-consent");
    expect(the.querySelectorAll(".xem2-ba-y > li")).toHaveLength(4);
    const tomTat = the.querySelector(".xem2-ba-y")?.textContent ?? "";
    expect(tomTat).toContain("31/12/2026");
    expect(tomTat).toContain("không liên quan điểm số");
    expect(tomTat).not.toContain("nghiên cứu sinh viên");
    const phienBan = screen.getByText(/Phiên bản lời đồng ý: v1/);
    expect(phienBan.closest("details")).toBeNull();
    expect(sent).toHaveLength(0);
    expect(screen.queryByTestId("dien-thoai-ghim")).toBeNull();
  });

  it("thẻ ghim chỉ hiện khi trang-thai có pinned", async () => {
    await vaoPhong(PHONG_TAT);
    expect(screen.queryByTestId("dien-thoai-ghim")).toBeNull();
    cleanup();
    await vaoPhong(PHONG_BAT);
    expect(screen.getByTestId("dien-thoai-ghim")).toHaveTextContent("Bình giữ nhiệt inox 750ml");
  });

  it("Xem ngay gửi đúng 1 bam kèm món ghim; Mua (tiền ảo) gửi đúng 1 mua", async () => {
    const sent = await vaoPhong(PHONG_BAT);
    fireEvent.click(screen.getByRole("button", { name: "Xem ngay" }));
    await waitFor(() => expect(thaoTac(sent)).toHaveLength(1));
    expect(thaoTac(sent)[0]).toMatchObject({ kind: "bam", product_id: "LAB-3" });
    fireEvent.click(screen.getByRole("button", { name: "Mua (tiền ảo)" }));
    await waitFor(() => expect(thaoTac(sent)).toHaveLength(2));
    expect(thaoTac(sent)[1]).toMatchObject({ kind: "mua", product_id: "LAB-3" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Giỏ hàng, 1 món" })).toBeInTheDocument());
  });

  it("mở giỏ không gửi gì; Thêm giỏ gửi them_gio của đúng món", async () => {
    const sent = await vaoPhong(PHONG_TAT);
    fireEvent.click(screen.getByRole("button", { name: "Giỏ hàng, 0 món" }));
    await screen.findByText("Sản phẩm trong phòng");
    expect(thaoTac(sent)).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Thêm giỏ" })[0]);
    await waitFor(() => expect(thaoTac(sent)).toHaveLength(1));
    expect(thaoTac(sent)[0]).toMatchObject({ kind: "them_gio", product_id: "LAB-1" });
  });

  it("bình luận gửi qua form (Enter hay nút Gửi) thành một binh_luan", async () => {
    const sent = await vaoPhong(PHONG_TAT);
    const o = screen.getByLabelText("Bình luận", { selector: "input" });
    fireEvent.change(o, { target: { value: "Áo có size L không ạ?" } });
    fireEvent.submit(o.closest("form") as HTMLFormElement);
    await waitFor(() => expect(thaoTac(sent)).toHaveLength(1));
    expect(thaoTac(sent)[0]).toMatchObject({ kind: "binh_luan", text: "Áo có size L không ạ?" });
  });

  it("làm mù: ngoài thẻ ghim, khung giống hệt nhau ở khối BẬT và khối TẮT (người dẫn vẽ tay không cầm món ghim)", async () => {
    await vaoPhong(PHONG_TAT);
    const tat = khungTruGhim();
    const veTat = screen.getByTestId("dien-thoai-live").querySelector(".dt-ve-tay")?.outerHTML;
    expect(veTat).toBeTruthy();
    cleanup();
    await vaoPhong(PHONG_BAT);
    expect(screen.getByTestId("dien-thoai-live").querySelector(".dt-ve-tay")?.outerHTML).toBe(veTat);
    expect(khungTruGhim()).toBe(tat);
  });

  it("lời dặn cạnh khung không nhắc tới thẻ ghim", async () => {
    await vaoPhong(PHONG_BAT);
    const ben = screen.getByRole("complementary", { name: "Ghi chú về phòng" });
    expect(ben.textContent ?? "").not.toMatch(/ghim/i);
  });

  it("nút xác nhận rút lui mang data-chup-bam qua prop của Hop", async () => {
    await vaoPhong(PHONG_TAT);
    fireEvent.click(screen.getByRole("button", { name: "Rút lui khỏi nghiên cứu" }));
    expect(screen.getByRole("button", { name: "Xác nhận rút lui" })).toHaveAttribute("data-chup-bam", "xac-nhan-rut-lui");
  });

  it("nhãn THỬ NỘI BỘ theo cờ dry_run của máy chủ, không theo tên phòng", async () => {
    await vaoPhong({ ...PHONG_TAT, room: { ...PHONG_TAT.room, title: "Phòng giám khảo", dry_run: true } });
    expect(screen.getByRole("complementary", { name: "Ghi chú về phòng" }).textContent).toContain("THỬ NỘI BỘ");
    expect(screen.getByTestId("dien-thoai-live").textContent).toContain("THỬ NỘI BỘ");
  });

  it("phòng đã đóng: chip trên khung ghi ĐÃ KẾT THÚC, không còn LIVE", async () => {
    await vaoPhong({ ...PHONG_TAT, room: { ...PHONG_TAT.room, status: "da_dong" } });
    expect(screen.queryByText("LIVE")).toBeNull();
    expect(screen.getByText("ĐÃ KẾT THÚC")).toBeInTheDocument();
  });
});

describe("U7 · huy hiệu NGƯỜI DẪN AI theo video", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, writable: true, value: vi.fn(() => Promise.resolve()) });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, writable: true, value: vi.fn() });
  });

  it("video YouTube: không data-nguoi-dan-ai, không huy hiệu", async () => {
    await vaoPhong({ ...PHONG_TAT, room: { ...PHONG_TAT.room, video_url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" } });
    const khung = screen.getByTestId("dien-thoai-live");
    await waitFor(() => expect(khung.getAttribute("data-che-do")).toBe("youtube"));
    expect(khung).not.toHaveAttribute("data-nguoi-dan-ai");
    expect(screen.queryByText("NGƯỜI DẪN AI · GIỌNG TỔNG HỢP")).toBeNull();
  });

  it("video người dẫn AI chuẩn: có data-nguoi-dan-ai và huy hiệu", async () => {
    await vaoPhong({ ...PHONG_TAT, room: { ...PHONG_TAT.room, video_url: "/xem/nguoi-dan-ai.mp4" } });
    const khung = screen.getByTestId("dien-thoai-live");
    await waitFor(() => expect(khung).toHaveAttribute("data-nguoi-dan-ai"));
    expect(screen.getByText("NGƯỜI DẪN AI · GIỌNG TỔNG HỢP")).toBeInTheDocument();
  });
});

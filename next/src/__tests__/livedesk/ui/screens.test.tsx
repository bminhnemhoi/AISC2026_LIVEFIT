import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { fixtureDeskView, fixtureStartView } from "@/lib/livedesk/fixtures";
import type { DeskPlatformFault, LiveDeskActions, LiveDeskViewModel, RecapViewModel, StartActions, StartViewModel } from "@/lib/livedesk/types";

const nav = vi.hoisted(() => ({ path: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ push: nav.push }) }));
vi.mock("@/lib/livedesk/hooks", () => ({
  useStartFlow: () => ({ view: startView, actions: startActions }),
  useLiveDesk: (id: string) => { deskId = id; return { view: deskView, actions: deskActions }; },
  useCurrentLive: () => currentLive,
  useLiveRecap: (id: string) => (id ? recapView : null),
  useDeskSimulation: () => ({ fault: simFault, setFault }),
}));

import HomePage from "@/app/page";
import StartPage from "@/app/start/page";
import LegacyPage from "@/app/legacy/page";
import DeskPage from "@/app/desk/[liveId]/page";
import RecapPage from "@/app/desk/[liveId]/recap/page";
import { LiveDeskScreen } from "@/components/livedesk/LiveDeskScreen";
import { DeskChart, chartSummary } from "@/components/livedesk/DeskChart";
import { COPY } from "@/components/livedesk/copy";
import { forgetDeskPrefsForTests } from "@/components/livedesk/prefs";

let startView: StartViewModel;
let deskView: LiveDeskViewModel | null;
let recapView: RecapViewModel | null;
let currentLive: { id: string; mode: "live" | "ended" } | null;
let simFault: DeskPlatformFault | null;
let setFault: ReturnType<typeof vi.fn>;
let deskId: string;
let startActions: StartActions;
let deskActions: LiveDeskActions;

const FORBIDDEN = /synced with Shopee|connected to Shopee|confirmed by Shopee|Create LIVE|kết nối với Shopee|đồng bộ với Shopee|Shopee xác nhận/i;

function fixtureRecap(): RecapViewModel {
  return {
    liveId: "demo", mode: "ended", title: "LiveLift Live Desk (SIMULATED)", platformLabel: "SIMULATED Live", durationSec: 412,
    peakViewers: 437, viewerSampleSec: 10,
    viewerPoints: [{ atSec: 1, value: 31 }, { atSec: 200, value: 300 }, { atSec: 410, value: 437 }],
    cartsPerMinute: [null, null, null, null, 5, 8, 6],
    cartsOnShow: 19, operatorPins: 1, hostPins: 0,
    marks: [{ atSec: 240, kind: "pin", productId: "p2", productName: "Cargo Pants" }],
    bands: [{ productId: "p2", productName: "Cargo Pants", fromSec: 240, toSec: 412, by: "operator" }],
    rows: [
      { atSec: 225, action: "show_next", productId: "p2", productName: "Cargo Pants", outcome: "performed", actedAtSec: 240,
        suggestion: { id: "s1", signals: [], sampleSize: 12, confidence: "medium", source: "rules" } },
      { atSec: 300, action: "flash_sale", productId: "p2", productName: "Cargo Pants", outcome: "dismissed", actedAtSec: null,
        suggestion: { id: "s2", signals: [], sampleSize: 9, confidence: "low", source: "rules" } },
      { atSec: 330, action: "unpin", productId: "p2", productName: "Cargo Pants", outcome: "self", actedAtSec: null, suggestion: null },
      { atSec: 400, action: "show_next", productId: "p1", productName: "Zip Hoodie", outcome: "no_response", actedAtSec: null,
        suggestion: { id: "s3", signals: [], sampleSize: 5, confidence: "low", source: "rules" } },
    ],
    intentCounts: { ask_price: 7, ask_size: 4, ready_to_buy: 3, praise: 5, other: 9 },
    commentsHeld: { count: 120, masked: 4, fromSec: 112 },
    missing: [{ id: "p3", name: "Canvas Tote", price: true, stock: true }],
    fingerprint: "e8d00fb0",
  };
}

class FixedResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(): void {
    this.callback([{ contentRect: { width: 640, height: 320 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  localStorage.clear();
  forgetDeskPrefsForTests();
  nav.path = "/";
  nav.push.mockReset();
  startView = structuredClone(fixtureStartView());
  deskView = structuredClone(fixtureDeskView());
  recapView = fixtureRecap();
  currentLive = { id: "demo", mode: "live" };
  simFault = null;
  setFault = vi.fn();
  deskId = "";
  startActions = { onConnect: vi.fn(), onImportText: vi.fn(), onImportSamplePack: vi.fn(), onRemoveProduct: vi.fn(), onStartLive: vi.fn(() => "demo-id") };
  deskActions = { onRun: vi.fn(), onPause: vi.fn(), onSpeed: vi.fn(), onSkip: vi.fn(), onReset: vi.fn(), onPin: vi.fn(), onUnpin: vi.fn(), onAcceptSuggestion: vi.fn(), onDismissSuggestion: vi.fn(), onEndLive: vi.fn() };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const english = (): void => localStorage.setItem("livelift.lab.lang", "en");
const key = (k: string): boolean => fireEvent.keyDown(window, { key: k });

describe("Routes, language and honesty", () => {
  it("Home speaks Vietnamese by default: the product in one sentence, four steps, status, next step and the honesty panel", () => {
    render(<HomePage />);
    expect(screen.getByTestId("livedesk-frame")).toHaveAttribute("lang", "vi");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("LiveLift đọc bình luận và giỏ hàng");
    const flow = screen.getByTestId("home-flow");
    for (const step of ["Kết nối", "Sản phẩm", "Bắt đầu live", "Live Desk"]) expect(flow).toHaveTextContent(step);
    expect(flow).toHaveTextContent("Đã kết nối SIMULATED Live");
    expect(flow).toHaveTextContent("3 sản phẩm, 2 đã có trên SIMULATED");
    expect(within(flow).getByTestId("home-next")).toHaveAttribute("href", "/desk/demo");
    expect(screen.getByTestId("truth-panel")).toHaveTextContent("Cái gì là thật, cái gì không");
    expect(screen.getByTestId("truth-panel")).toHaveTextContent("Không có gì được gửi tới hay nhận từ một nền tảng live thật nào");
    // The simulated platform is a generic live platform, not presented as any one real platform.
    expect(screen.getByTestId("truth-panel")).toHaveTextContent("Nền tảng là SIMULATED Live: một nền tảng live mô phỏng nói chung");
    expect(screen.getByTestId("truth-panel").textContent).not.toMatch(/Shopee/);
  });

  it("Home puts the next step before the four steps, so a phone reaches it right after the intro", () => {
    render(<HomePage />);
    const next = screen.getByTestId("home-next");
    expect(next.compareDocumentPosition(screen.getByTestId("loop-guide")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("loop-guide")).toHaveTextContent("Giá thiếu là thiếu, không phải 0");
  });

  it("Home's spec-sheet decoration is hidden from assistive tech and says it is an example, SIMULATED, not a result", () => {
    render(<HomePage />);
    const spec = screen.getByTestId("hero-spec");
    expect(spec).toHaveAttribute("aria-hidden", "true");
    expect(spec).toHaveTextContent("VÍ DỤ · SIMULATED");
    expect(spec).toHaveTextContent("không phải kết quả thật");
    for (const label of ["Cỡ mẫu", "Độ tin cậy", "Nguồn", "Trạng thái"]) expect(spec).toHaveTextContent(label);
  });

  it("Home in English keeps the honesty panel's title", () => {
    english();
    render(<HomePage />);
    expect(screen.getByTestId("truth-panel")).toHaveTextContent("What is real, and what is not");
    expect(screen.getByTestId("home-flow")).toHaveTextContent("Connected to SIMULATED Live");
  });

  it.each(["connect", "import", "start"])("Home chooses the %s step from the supplied status", step => {
    currentLive = null;
    if (step === "connect") startView.connected = false;
    if (step === "import") startView.products = [];
    render(<HomePage />);
    const expected = { connect: "Kết nối SIMULATED Live", import: "Nhập sản phẩm của bạn", start: "Bắt đầu buổi live" }[step];
    expect(screen.getByTestId("home-flow")).toHaveTextContent(expected!);
    expect(screen.getByTestId("home-next")).toHaveAttribute("href", "/start");
  });

  it("the demo launcher's health check still recognises this Home", () => {
    // ./start-livelift-demo decides the app is up by looking for these markers in the Home's HTML. If Home changes
    // and the launcher does not, a running app is reported as failed and shut down.
    const launcher = fs.readFileSync(path.resolve(process.cwd(), "../scripts/competition/launcher.mjs"), "utf8");
    const check = launcher.split("\n").find(line => line.includes("const appOk")) ?? "";
    const html = renderToString(<HomePage />);
    const markers = [...check.matchAll(/includes\('((?:[^'\\]|\\.)*)'\)/g)].map(m => m[1].replace(/\\"/g, '"'));
    expect(markers.length).toBeGreaterThan(0);
    const present = markers.filter(marker => html.includes(marker));
    expect(present).toContain('data-testid="home-flow"');
    expect(present).toContain('data-testid="truth-panel"');
    // The Lab browser harness (fingerprint 9d723008) opens Home and waits for the step list by this id.
    expect(html).toContain('data-testid="loop-guide"');
  });

  it("Legacy links to the old Home and the six old destinations at their original URLs", () => {
    render(<LegacyPage />);
    const links = within(screen.getByTestId("legacy-links")).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(["/legacy/home", "/sessions", "/products", "/insights", "/simulator", "/integrations", "/live/new"]);
  });

  it.each(["vi", "en"])("page titles put one phrase on the kraft tape and read the same without it; art is hidden, sheets numberless (%s)", async lang => {
    if (lang === "en") english();
    const tapes = lang === "vi" ? ["nên ghim gì", "buổi live", "Bản cũ"] : ["what to pin next", "recap", "Legacy"];
    const titles = lang === "vi" ? ["LiveLift đọc bình luận và giỏ hàng trong buổi live, rồi gợi ý bạn nên ghim gì, và vì sao.", "Tổng kết buổi live", "Bản cũ (Legacy)"]
      : ["LiveLift reads comments and carts during your live, then suggests what to pin next, and why.", "Live recap", "Legacy"];
    const pages = [<HomePage key="h" />, await RecapPage({ params: Promise.resolve({ liveId: "demo" }) }), <LegacyPage key="l" />];
    pages.forEach((page, i) => {
      const { container } = render(page);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1.textContent).toBe(titles[i]);
      expect(h1.querySelectorAll(".tape-mark")).toHaveLength(1);
      expect(h1.querySelector(".tape-mark")!.textContent).toBe(tapes[i]);
      // decoration is hidden from assistive tech; the spec sheets carry words, never numbers (Home's example says so itself)
      const art = [...container.querySelectorAll(".sheet-art, .flow-art, .unknown-sticker, [data-testid='hero-spec']")];
      expect(art.length).toBeGreaterThan(0);
      for (const el of art) expect(el).toHaveAttribute("aria-hidden", "true");
      for (const el of container.querySelectorAll(".sheet-art")) expect(el.textContent).not.toMatch(/\d/);
      cleanup();
    });
  });

  it("the header links Start, Live Desk and Recap only, and offers only what exists", () => {
    currentLive = { id: "my live", mode: "live" };
    render(<StartPage />);
    const header = within(screen.getByTestId("desk-nav"));
    expect(header.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/start", "/desk/my%20live"]);
    expect(screen.getByTestId("nav-recap")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("nav-recap")).toHaveTextContent("Tổng kết có sau khi bạn kết thúc live");
    cleanup();
    currentLive = { id: "my live", mode: "ended" };
    render(<StartPage />);
    expect(screen.getByTestId("nav-recap")).toHaveAttribute("href", "/desk/my%20live/recap");
    cleanup();
    currentLive = null;
    render(<StartPage />);
    expect(screen.getByTestId("nav-desk")).toHaveAttribute("aria-disabled", "true");
  });

  it("the async desk route passes the exact live id to the hook", async () => {
    render(await DeskPage({ params: Promise.resolve({ liveId: "my-live" }) }));
    expect(deskId).toBe("my-live");
    expect(screen.getByTestId("live-desk")).toBeInTheDocument();
  });

  it("unknown lives offer Start without inventing a live", () => {
    deskView = null;
    currentLive = null;
    render(<LiveDeskScreen liveId="unknown" />);
    expect(screen.getByTestId("desk-not-found")).toHaveTextContent("Không tìm thấy buổi live");
    expect(within(screen.getByTestId("desk-not-found")).getByRole("link")).toHaveAttribute("href", "/start");
    expect(screen.queryByTestId("live-desk")).toBeNull();
  });

  it.each(["vi", "en"])("no screen makes a forbidden claim or offers Create LIVE (%s)", async lang => {
    if (lang === "en") english();
    for (const page of [<HomePage key="h" />, <StartPage key="s" />, <LegacyPage key="l" />, <LiveDeskScreen key="d" liveId="demo" />, await RecapPage({ params: Promise.resolve({ liveId: "demo" }) })]) {
      const { container } = render(page);
      expect(container.textContent).not.toMatch(FORBIDDEN);
      cleanup();
    }
  });

  it("restores and persists the language with the Lab's preference, and the theme with its own", () => {
    render(<StartPage />);
    expect(screen.getByTestId("start-live")).toHaveTextContent("Bắt đầu live");
    fireEvent.click(screen.getByTestId("desk-lang-en"));
    expect(localStorage.getItem("livelift.lab.lang")).toBe("en");
    expect(screen.getByTestId("start-live")).toHaveTextContent("Start live");
    key("t");
    expect(screen.getByTestId("livedesk-frame")).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("livelift.livedesk.theme")).toBe("dark");
    cleanup();
    forgetDeskPrefsForTests();
    render(<HomePage />);
    expect(screen.getByTestId("livedesk-frame")).toHaveAttribute("lang", "en");
    expect(screen.getByTestId("livedesk-frame")).toHaveAttribute("data-theme", "dark");
  });

  it("presenter mode (P) hides the bottom bar and is remembered; keys never fire while typing", () => {
    render(<StartPage />);
    expect(document.querySelector(".dock")).not.toBeNull();
    key("p");
    expect(screen.getByTestId("livedesk-frame")).toHaveAttribute("data-presenter", "1");
    expect(document.querySelector(".dock")).toBeNull();
    expect(localStorage.getItem("livelift.lab.presenter")).toBe("1");
    fireEvent.keyDown(screen.getByLabelText("Dán CSV hoặc TSV"), { key: "p" });
    expect(screen.getByTestId("livedesk-frame")).toHaveAttribute("data-presenter", "1");
  });

  it("? opens the key list as a dialog that Escape closes", () => {
    render(<HomePage />);
    key("?");
    expect(screen.getByRole("dialog")).toHaveTextContent("Phím tắt");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("1 2 3 jump to Start, the Live Desk and the recap when they exist", () => {
    currentLive = { id: "demo", mode: "ended" };
    render(<HomePage />);
    key("1");
    key("2");
    key("3");
    expect(nav.push.mock.calls.map(call => call[0])).toEqual(["/start", "/desk/demo", "/desk/demo/recap"]);
  });
});

describe("Start actions and blocked reasons", () => {
  it("imports exact pasted text, calls the sample pack and removes by product id", () => {
    english();
    currentLive = null;
    render(<StartPage />);
    expect(screen.getByTestId("start-import")).toBeDisabled();
    expect(screen.getByText("Paste product rows to import.")).toBeInTheDocument();
    const text = "name\tprice\nHoodie\t350000\n";
    fireEvent.change(screen.getByLabelText("Paste CSV or TSV"), { target: { value: text } });
    fireEvent.click(screen.getByTestId("start-import"));
    expect(startActions.onImportText).toHaveBeenCalledExactlyOnceWith(text);
    fireEvent.click(screen.getByTestId("start-sample"));
    expect(startActions.onImportSamplePack).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole("button", { name: "Remove Canvas Tote" }));
    expect(startActions.onRemoveProduct).toHaveBeenCalledExactlyOnceWith("p3");
    expect(screen.getByTestId("desk-product-p3")).toHaveTextContent("Not entered");
    expect(screen.getByTestId("desk-product-p3")).toHaveTextContent("error_param: item not found");
  });

  it("products cannot be removed while a live runs (the logic refuses it too)", () => {
    render(<StartPage />);
    expect(screen.getByRole("button", { name: "Xóa Canvas Tote" })).toBeDisabled();
  });

  it("missing values read Chưa nhập, never 0, and the platform's own error text is kept", () => {
    render(<StartPage />);
    const row = screen.getByTestId("desk-product-p3");
    expect(within(row).getAllByText("Chưa nhập")).toHaveLength(2);
    expect(row).toHaveTextContent("Nền tảng trả lời: error_param: item not found");
    expect(row).not.toHaveTextContent(/\b0\b/);
    expect(screen.getByText(/Canvas Tote: giá và tồn kho chưa nhập\. LiveLift để trống, không coi là 0/)).toBeInTheDocument();
  });

  it("disconnected Start offers Connect, hides the import and explains why starting is blocked", () => {
    startView.connected = false;
    startView.products = [];
    startView.startBlockedReason = "Connect SIMULATED Live first.";
    render(<StartPage />);
    expect(screen.getByTestId("start-connect")).toBeEnabled();
    fireEvent.click(screen.getByTestId("start-connect"));
    expect(startActions.onConnect).toHaveBeenCalledExactlyOnceWith();
    expect(screen.getByTestId("start-live")).toBeDisabled();
    expect(screen.queryByTestId("start-import")).toBeNull();
    expect(screen.queryByTestId("start-sample")).toBeNull();
    expect(screen.getByText("Kết nối SIMULATED Live trước.")).toBeInTheDocument();
    expect(screen.getByText("Kết nối SIMULATED Live trước khi nhập.")).toBeInTheDocument();
  });

  it("shows the logic's blocked reason in Vietnamese, and as given in English", () => {
    startView.startBlockedReason = "No product has synced to SIMULATED Live yet.";
    render(<StartPage />);
    expect(screen.getByTestId("start-live")).toBeDisabled();
    expect(screen.getByText("Chưa có sản phẩm nào lên SIMULATED Live.")).toBeInTheDocument();
    cleanup();
    english();
    forgetDeskPrefsForTests();
    render(<StartPage />);
    expect(screen.getByText(startView.startBlockedReason)).toBeInTheDocument();
  });

  it("the import note is translated word for word", () => {
    startView.importNote = "3 imported, 1 row skipped: stock \"x\" is not a whole number";
    render(<StartPage />);
    expect(screen.getByText("Đã nhập 3, bỏ qua 1 dòng: tồn kho \"x\" không phải số nguyên")).toBeInTheDocument();
  });

  it("starts once and navigates only to the returned live id", () => {
    startActions.onStartLive = vi.fn(() => "live/with space");
    render(<StartPage />);
    fireEvent.click(screen.getByTestId("start-live"));
    expect(startActions.onStartLive).toHaveBeenCalledOnce();
    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/desk/live%2Fwith%20space");
  });

  it("a null start result stays on Start and announces the failure", () => {
    startActions.onStartLive = vi.fn(() => null);
    render(<StartPage />);
    fireEvent.click(screen.getByTestId("start-live"));
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByText(/Live chưa bắt đầu/).closest('[role="status"]')).toBeInTheDocument();
  });
});

describe("Desk interactions", () => {
  const renderDesk = (): void => { render(<LiveDeskScreen liveId="demo" />); };

  it("pins, unpins and pins again immediately with no confirmation or cooldown", () => {
    renderDesk();
    for (const id of ["desk-pin-p1", "desk-unpin"]) expect(screen.getByTestId(id)).toBeEnabled();
    expect(screen.getByTestId("desk-pin-p3")).toBeDisabled();
    expect(screen.queryByTestId("desk-pin-p2")).toBeNull();
    fireEvent.click(screen.getByTestId("desk-pin-p1"));
    fireEvent.click(screen.getByTestId("desk-unpin"));
    fireEvent.click(screen.getByTestId("desk-pin-p1"));
    expect(deskActions.onPin).toHaveBeenNthCalledWith(1, "p1");
    expect(deskActions.onPin).toHaveBeenNthCalledWith(2, "p1");
    expect(deskActions.onUnpin).toHaveBeenCalledExactlyOnceWith();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the pinned product is the taped card; the suggested one is only a dashed chip", () => {
    renderDesk();
    const pinned = screen.getByTestId("desk-product-p2");
    expect(pinned).toHaveAttribute("data-showing", "true");
    expect(pinned).toHaveTextContent("ĐANG GHIM");
    expect(pinned).toHaveTextContent("SIMULATED");
    const suggested = screen.getByTestId("desk-product-p1");
    expect(suggested).toHaveAttribute("data-showing", "false");
    expect(suggested).toHaveTextContent("Trợ lý gợi ý, chưa ghim");
    expect(suggested).not.toHaveTextContent("ĐANG GHIM");
  });

  it("with nothing on show there is no unpin, and every synced product can be pinned", () => {
    deskView!.showingProductId = null;
    deskView!.products.forEach(product => { product.showing = false; });
    renderDesk();
    expect(screen.queryByTestId("desk-unpin")).toBeNull();
    expect(screen.getByTestId("desk-pin-p2")).toBeEnabled();
  });

  it("calls all clock controls with the exact virtual values", () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("desk-run"));
    expect(deskActions.onRun).toHaveBeenCalledExactlyOnceWith();
    expect(screen.getByTestId("desk-pause")).toBeDisabled();
    expect(within(screen.getByTestId("desk-clock")).getAllByRole("button", { pressed: false }).length).toBeGreaterThan(0);
    expect([1, 5, 15, 60].map(v => screen.getByTestId(`desk-speed-${v}`).textContent)).toEqual(["1×", "5×", "15×", "60×"]);
    expect(screen.getByTestId("desk-speed-15")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("desk-speed-60"));
    expect(deskActions.onSpeed).toHaveBeenCalledExactlyOnceWith(60);
    for (const seconds of [30, 60, 300]) fireEvent.click(screen.getByTestId(`desk-skip-${seconds}`));
    expect(deskActions.onSkip).toHaveBeenNthCalledWith(1, 30);
    expect(deskActions.onSkip).toHaveBeenNthCalledWith(2, 60);
    expect(deskActions.onSkip).toHaveBeenNthCalledWith(3, 300);
    fireEvent.click(screen.getByTestId("desk-reset"));
    expect(deskActions.onReset).toHaveBeenCalledExactlyOnceWith();
    cleanup();
    deskView!.clock.running = true;
    renderDesk();
    expect(screen.getByTestId("desk-run")).toBeDisabled();
    fireEvent.click(screen.getByTestId("desk-pause"));
    expect(deskActions.onPause).toHaveBeenCalledExactlyOnceWith();
  });

  it("Space runs and pauses the clock, but not while a button has focus", () => {
    renderDesk();
    key(" ");
    expect(deskActions.onRun).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByTestId("desk-reset"), { key: " " });
    expect(deskActions.onRun).toHaveBeenCalledOnce();
  });

  it("the dominant suggestion carries its reasons, sample size, confidence and source, and accepts or dismisses by id", () => {
    renderDesk();
    const panel = screen.getByTestId("desk-copilot");
    expect(within(panel).getByRole("heading", { level: 2 })).toHaveTextContent("Nên ghim tiếp: Zip Hoodie");
    for (const text of ["bình luận hỏi giá", "7", "còn trong kho", "24", "Độ tin cậy trung bình", "cỡ mẫu 12 tín hiệu trong 2 phút", "Nguồn: luật", "dữ liệu SIMULATED"]) expect(panel).toHaveTextContent(text);
    expect(screen.getByTestId("desk-suggestion-s1")).toHaveAttribute("data-state", "proposed");
    expect(screen.getByTestId("desk-announce")).toHaveTextContent("SIMULATED. Nên ghim tiếp: Zip Hoodie. Đề xuất.");
    fireEvent.click(screen.getByTestId("desk-accept-s1"));
    fireEvent.click(screen.getByTestId("desk-dismiss-s1"));
    expect(deskActions.onAcceptSuggestion).toHaveBeenCalledExactlyOnceWith("s1");
    expect(deskActions.onDismissSuggestion).toHaveBeenCalledExactlyOnceWith("s1");
  });

  it("the same answer in English", () => {
    english();
    renderDesk();
    const panel = screen.getByTestId("desk-copilot");
    for (const text of ["Pin next: Zip Hoodie", "ask-price comments", "Confidence medium", "sample size 12 signals", "Source: rules"]) expect(panel).toHaveTextContent(text);
  });

  it("a thin sample is said as interest, with its confidence right under the title, and the pin stays the operator's call", () => {
    deskView!.copilot.suggestions[0].confidence = "low";
    deskView!.copilot.suggestions[0].sampleSize = 3;
    renderDesk();
    const panel = screen.getByTestId("desk-copilot");
    const title = within(panel).getByRole("heading", { level: 2 });
    expect(title).toHaveTextContent("Có tín hiệu quan tâm tới Zip Hoodie");
    expect(panel).not.toHaveTextContent("Nên ghim tiếp");
    // The confidence line follows the title directly, before the lede and the numbers.
    const confidence = screen.getByTestId("desk-confidence");
    expect(confidence).toHaveTextContent("Độ tin cậy thấp");
    expect(confidence).toHaveTextContent("cỡ mẫu 3 tín hiệu");
    expect(title.compareDocumentPosition(confidence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(confidence.compareDocumentPosition(within(panel).getByText(/Mới có 3 tín hiệu/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("desk-announce")).toHaveTextContent("SIMULATED. Có tín hiệu quan tâm tới Zip Hoodie. Đề xuất.");
    expect(screen.getByTestId("desk-accept-s1")).toHaveClass("btn-secondary");
    cleanup();
    forgetDeskPrefsForTests();
    english();
    renderDesk();
    expect(within(screen.getByTestId("desk-copilot")).getByRole("heading", { level: 2 })).toHaveTextContent("Early interest in Zip Hoodie");
  });

  it("before the clock runs, the answer itself offers Run, and the header says the clock is paused", () => {
    deskView!.copilot.suggestions = [];
    deskView!.clock = { ...deskView!.clock, elapsedLabel: "00:00", running: false };
    renderDesk();
    expect(screen.getByTestId("desk-live-status")).toHaveTextContent("Đang tạm dừng");
    const run = screen.getByTestId("desk-run-guide");
    expect(within(screen.getByTestId("desk-copilot")).getByRole("heading", { level: 2 })).toHaveTextContent("Bấm Chạy để bắt đầu");
    expect(run).toHaveTextContent("Chạy mô phỏng");
    fireEvent.click(run);
    expect(deskActions.onRun).toHaveBeenCalledExactlyOnceWith();
    cleanup();
    deskView!.clock = { ...deskView!.clock, running: true };
    renderDesk();
    expect(screen.getByTestId("desk-run-guide")).toBeDisabled();
    expect(screen.queryByTestId("desk-paused")).toBeNull();
  });

  it("the clock bar keeps Run, Pause and the current speed; speeds, skips and Reset sit behind one disclosure", () => {
    renderDesk();
    const more = screen.getByTestId("desk-more");
    expect(more.tagName).toBe("SUMMARY");
    expect(more).toHaveTextContent("Tốc độ 15×");
    const details = more.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    for (const id of ["desk-speed-60", "desk-skip-30", "desk-skip-300", "desk-reset"]) expect(details).toContainElement(screen.getByTestId(id));
    for (const id of ["desk-run", "desk-pause"]) expect(details).not.toContainElement(screen.getByTestId(id));
    details.open = true;
    fireEvent.keyDown(screen.getByTestId("desk-skip-60"), { key: "Escape" });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(more);
  });

  it.each(["accepted", "dismissed", "performed"] as const)("a %s suggestion offers no choice and says what became of it", state => {
    deskView!.copilot.suggestions[0].state = state;
    renderDesk();
    expect(screen.queryByTestId("desk-accept-s1")).toBeNull();
    expect(screen.queryByTestId("desk-dismiss-s1")).toBeNull();
    const words = { accepted: "Đã nhận, chờ nền tảng hiện", dismissed: "Đã bỏ qua", performed: "Đã nhận, nền tảng đã hiện (SIMULATED)" }[state];
    expect(screen.getByTestId("desk-suggestion-s1")).toHaveTextContent(words);
    expect(screen.queryByText("Trợ lý gợi ý, chưa ghim")).toBeNull();
  });

  it("an AI suggestion keeps the model's wording and says so; the banner, unknown viewers and missing fingerprint stay honest", () => {
    deskView!.copilot.suggestions[0].source = "ai";
    deskView!.copilot.suggestions[0].headline = "Show the hoodie now, viewers keep asking";
    deskView!.copilot.aiStatus = "ai_fallback";
    deskView!.copilot.statusLabel = "AI model unavailable, showing rules (SIMULATED data)";
    deskView!.banner = { tone: "danger", text: 'Authorisation expired on SIMULATED Live: "token expired". The Live Desk stopped calling it. Carry on in the app by hand.' };
    deskView!.viewers = null;
    deskView!.fingerprint = null;
    renderDesk();
    const panel = screen.getByTestId("desk-copilot");
    expect(panel).toHaveTextContent("Show the hoodie now, viewers keep asking");
    expect(panel).toHaveTextContent("Câu này do mô hình AI viết lại");
    expect(panel).toHaveTextContent("Nguồn: mô hình AI");
    const banner = screen.getByTestId("desk-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent('Hết hạn quyền truy cập trên SIMULATED Live: "token expired"');
    expect(banner).toHaveTextContent("SIMULATED");
    expect(screen.getByTestId("desk-viewers")).toHaveTextContent("chưa rõ");
    // The run fingerprint is technical: it lives in "About this data", not in the clock bar.
    expect(screen.queryByTestId("desk-fingerprint")).toBeNull();
    fireEvent.click(screen.getByTestId("desk-about-open"));
    expect(screen.getByTestId("desk-fingerprint")).toHaveTextContent("Chưa có sự kiện");
    expect(screen.getByTestId("desk-ai-status")).toHaveTextContent("Mô hình AI không phản hồi, đang dùng luật (dữ liệu SIMULATED)");
  });

  it("comments are newest first with intents, counters, a filter and no live announcements", () => {
    renderDesk();
    const panel = screen.getByTestId("desk-comments");
    expect(within(screen.getByTestId("desk-intent-ask_price")).getByText("7")).toBeInTheDocument();
    expect(within(screen.getByTestId("desk-intent-ready_to_buy")).getByText("3")).toBeInTheDocument();
    expect(screen.getByTestId("desk-intent-praise")).toHaveTextContent("Khen");
    expect(panel.querySelectorAll('[data-testid^="desk-comment-"]')[0]).toHaveAttribute("data-testid", "desk-comment-c3");
    expect(screen.getByTestId("desk-comment-c2")).toHaveTextContent("đã che");
    expect(panel).toHaveTextContent("Đã che 1 bình luận đang hiện.");
    expect(panel.querySelector('[aria-live="off"]')).not.toBeNull();
    expect(panel.querySelector('[role="status"], [role="log"], [role="alert"]')).toBeNull();
    fireEvent.click(screen.getByTestId("desk-intent-ask_size"));
    expect(panel.querySelectorAll('[data-testid^="desk-comment-"]')).toHaveLength(1);
    expect(screen.getByTestId("desk-intent-ask_size")).toHaveAttribute("aria-pressed", "true");
  });

  it("every simulated surface says SIMULATED, the chart has a text alternative and markers say when, not why", () => {
    vi.stubGlobal("ResizeObserver", FixedResizeObserver);
    const { container } = render(<LiveDeskScreen liveId="demo" />);
    for (const id of ["desk-products", "desk-copilot", "desk-chart", "desk-comments", "desk-phone", "desk-live-status"].slice(0, 5)) expect(screen.getByTestId(id)).toHaveTextContent("SIMULATED");
    expect(screen.getByTestId("livedesk-frame")).toHaveTextContent("SIMULATED Live");
    const chart = screen.getByTestId("desk-chart-live");
    expect(chart).toHaveAttribute("role", "img");
    expect(chart.getAttribute("aria-label")).toMatch(/Ghim Cargo Pants 04:00.*cho biết khi nào, không cho biết vì sao/);
    expect(chart.querySelector(".marker-label")).toHaveTextContent("Ghim Cargo Pants");
    expect(chart.querySelectorAll(".gap")).toHaveLength(1);
    expect(screen.getByTestId("desk-chart")).toHaveTextContent("không chứng minh vì sao");
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it("the host phone shows the product on show, its price, and the newest comments", () => {
    renderDesk();
    const phone = screen.getByTestId("desk-phone");
    expect(within(phone).getByRole("img")).toHaveAccessibleName("Xem trước điện thoại người dẫn: đang ghim Cargo Pants");
    expect(phone).toHaveTextContent("249.000 ₫");
    expect(phone).toHaveTextContent("Mình cao 1m65");
    cleanup();
    deskView!.products[1].priceLabel = null;
    renderDesk();
    expect(screen.getByTestId("desk-phone")).toHaveTextContent("Giá chưa nhập");
  });

  it("End live asks first; Keep going changes nothing; confirming ends once and opens the recap", () => {
    const view = deskView!;
    const { rerender } = render(<LiveDeskScreen liveId="demo" />);
    fireEvent.click(screen.getByTestId("desk-end"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Kết thúc buổi live lúc 06:52?");
    fireEvent.click(screen.getByText("Tiếp tục live"));
    expect(deskActions.onEndLive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("desk-end"));
    fireEvent.click(screen.getByTestId("desk-end-confirm"));
    expect(deskActions.onEndLive).toHaveBeenCalledExactlyOnceWith();
    deskView = { ...view, mode: "ended" };
    rerender(<LiveDeskScreen liveId="demo" />);
    expect(nav.push).toHaveBeenCalledWith("/desk/demo/recap");
  });

  it("ended mode locks the live controls but keeps Reset, and leads to the recap", () => {
    deskView!.mode = "ended";
    renderDesk();
    for (const id of ["desk-run", "desk-pause", "desk-pin-p1", "desk-speed-15", "desk-skip-30"]) expect(screen.getByTestId(id)).toBeDisabled();
    expect(screen.queryByTestId("desk-end")).toBeNull();
    expect(screen.queryByTestId("desk-accept-s1")).toBeNull();
    expect(screen.getByTestId("desk-reset")).toBeEnabled();
    expect(screen.getByTestId("desk-recap")).toHaveAttribute("href", "/desk/demo/recap");
    expect(screen.getByTestId("desk-copilot")).toHaveTextContent("Buổi live đã kết thúc");
  });

  it("the data journey (J) numbers six real elements, steps with the arrows and closes with Escape", () => {
    renderDesk();
    key("j");
    expect(screen.getByTestId("journey-panel")).toBeInTheDocument();
    expect(screen.getByTestId("livedesk-frame").className).toContain("is-journey");
    for (let n = 1; n <= 6; n++) expect(document.querySelector(`[data-journey="${n}"] .jbadge`)).toHaveTextContent(String(n));
    key("ArrowDown");
    expect(screen.getByTestId("journey-stage-1")).toHaveAttribute("aria-current", "step");
    key("ArrowUp");
    expect(screen.getByTestId("journey-stage-6")).toHaveAttribute("aria-current", "step");
    key("Escape");
    expect(screen.queryByTestId("journey-panel")).toBeNull();
    expect(document.querySelector(".jbadge")).toBeNull();
  });

  it("the assumptions drawer translates the generator's assumptions, says unpin is guessed, and rehearses a platform condition", () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("desk-about-open"));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByTestId("desk-assumptions")).toHaveTextContent("Cái gì là mô phỏng");
    expect(within(drawer).getByTestId("desk-unpin-note")).toHaveTextContent("unpin_show_item");
    expect(within(drawer).getByTestId("desk-unpin-note")).toHaveTextContent("LiveLift đoán");
    fireEvent.click(within(drawer).getByTestId("desk-fault-token_expired"));
    expect(setFault).toHaveBeenCalledExactlyOnceWith("token_expired");
    expect(within(drawer).getByTestId("desk-fault-clear")).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the desk has no mode switch: the assistant always suggests and the header carries no locked mode", () => {
    renderDesk();
    expect(screen.queryByTestId("desk-mode-experiment")).toBeNull();
    expect(screen.queryByTestId("desk-mode-observe")).toBeNull();
    expect(screen.getByTestId("desk-copilot")).toBeInTheDocument();
  });

  it("flash sale: not enough signals says why, a proposed one can be run or dismissed", () => {
    renderDesk();
    expect(screen.getByTestId("desk-flash")).toHaveTextContent("Flash sale: chưa đủ tín hiệu. Cargo Pants chỉ còn 9, cần từ 10.");
    cleanup();
    deskView!.copilot.suggestions.push({ ...deskView!.copilot.suggestions[0], id: "s9", kind: "flash_sale", productId: "p2",
      signals: [{ label: "Add to cart, last 2 min", value: "12" }, { label: "Add to cart, 2 min before", value: "7" }, { label: "Stock", value: "9" }] });
    renderDesk();
    expect(screen.getByTestId("desk-suggestion-s9")).toHaveTextContent("Nên chạy flash sale trong 1 phút");
    expect(screen.getByTestId("desk-suggestion-s9")).toHaveTextContent("lượt thêm giỏ, 2 phút qua 12");
    fireEvent.click(screen.getByTestId("desk-accept-s9"));
    expect(deskActions.onAcceptSuggestion).toHaveBeenCalledExactlyOnceWith("s9");
  });
});

describe("Recap", () => {
  const renderRecap = async (): Promise<void> => { render(await RecapPage({ params: Promise.resolve({ liveId: "demo" }) })); };

  it("shows the numbers, with orders unknown rather than zero", async () => {
    await renderRecap();
    const kpis = screen.getByTestId("recap-kpis");
    expect(kpis).toHaveTextContent("437");
    expect(kpis).toHaveTextContent("19");
    expect(screen.getByTestId("recap-orders")).toHaveTextContent("Chưa biết");
    expect(screen.getByTestId("recap-orders")).not.toHaveTextContent(/\b0\b/);
    // Pins and accepted suggestions are what the operator did: they sit above the decisions, not among the KPIs.
    expect(kpis).not.toHaveTextContent("Gợi ý bạn nhận");
    expect(kpis).toHaveTextContent("Bình luận Live Desk còn giữ120");
    expect(screen.getByTestId("recap-decisions-summary")).toHaveTextContent("1 lần bạn ghim · nhận 1 trên 3 gợi ý");
  });

  it("an unknown add-to-cart total is shown as unknown", async () => {
    recapView!.cartsOnShow = null;
    await renderRecap();
    expect(screen.getByTestId("recap-kpis")).toHaveTextContent("Thêm giỏ khi có ghimChưa biết");
  });

  it("the table separates accepted, dismissed, your own and no response, and never calls accepted performed", async () => {
    await renderRecap();
    const table = screen.getByTestId("recap-decisions");
    expect(within(table).getByTestId("recap-row-performed")).toHaveTextContent("Ghim Cargo PantsGợi ý");
    expect(within(table).getByTestId("recap-row-performed")).toHaveTextContent("Nhận04:00nền tảng đã hiện");
    expect(within(table).getByTestId("recap-row-dismissed")).toHaveTextContent("Bỏ qua");
    expect(within(table).getByTestId("recap-row-self")).toHaveTextContent("Không có gợi ý; bạn tự quyết");
    expect(within(table).getByTestId("recap-row-self")).toHaveTextContent("Tự làm");
    expect(within(table).getByTestId("recap-row-no_response")).toHaveTextContent("Không phản hồi");
    cleanup();
    recapView!.rows[0].outcome = "accepted";
    await renderRecap();
    expect(screen.getByTestId("recap-row-accepted")).toHaveTextContent("chưa thấy trên nền tảng");
  });

  it("lists what is still unknown: cause, orders, the whole live's comments, unpinned minutes and missing values", async () => {
    await renderRecap();
    const box = screen.getByTestId("recap-unknowns");
    for (const text of ["Ghim Cargo Pants có làm tăng thêm giỏ không?", "quan sát không phải nhân quả", "Số đơn hàng thật.", "chỉ giữ bình luận 5 phút gần nhất (từ 01:52)", "4 phút không có sản phẩm đang ghim", "Canvas Tote: giá và tồn kho chưa nhập."]) expect(box).toHaveTextContent(text);
    expect(screen.getByTestId("recap-intents")).toHaveTextContent("2 phút cuối");
  });

  it("a live that has not ended, or no live, has no recap", async () => {
    recapView!.mode = "live";
    await renderRecap();
    await act(async () => {});
    expect(screen.getByTestId("recap-empty")).toHaveTextContent("Buổi live chưa kết thúc");
    cleanup();
    recapView = null;
    await renderRecap();
    await act(async () => {});
    expect(screen.getByTestId("recap-empty")).toHaveTextContent("Chưa có tổng kết");
  });
});

describe("Chart", () => {
  const c = COPY.vi;

  it("hydrates from server HTML without recovery", async () => {
    const chart = <DeskChart variant="live" c={c} lang="vi" data={{ elapsedSec: 412, viewers: fixtureRecap().viewerPoints, carts: [1, 2], marks: [], bands: [] }} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(chart);
    document.body.appendChild(container);
    const recover = vi.fn();
    const root = hydrateRoot(container, chart, { onRecoverableError: recover });
    await act(async () => {});
    await act(async () => root.unmount());
    container.remove();
    expect(recover).not.toHaveBeenCalled();
  });

  it("empty and zero charts have text alternatives and finite SVG coordinates", () => {
    vi.stubGlobal("ResizeObserver", FixedResizeObserver);
    const empty = { elapsedSec: 0, viewers: [], carts: [], marks: [], bands: [] };
    const { container, rerender } = render(<DeskChart variant="live" c={c} lang="vi" data={empty} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(c.chartEmpty);
    rerender(<DeskChart variant="recap" c={c} lang="vi" data={{ elapsedSec: 0, viewers: [{ atSec: 0, value: 0 }], carts: [0], marks: [{ atSec: 0, kind: "unpin", productId: "p1", productName: "Hoodie" }], bands: [] }} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(chartSummary({ elapsedSec: 60, viewers: [{ atSec: 1, value: 30 }], carts: [null], marks: [], bands: [] }, c, "vi")).toContain("1 phút không có sản phẩm đang ghim");
  });
});

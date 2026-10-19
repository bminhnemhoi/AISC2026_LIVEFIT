import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

let intersect: IntersectionObserverCallback;
const disconnect = vi.fn();

beforeEach(() => {
  disconnect.mockClear();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {}
    disconnect = disconnect;
  });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LiveLift landing", () => {
  it("introduces the product and keeps demo and workspace destinations distinct", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Trải nghiệm bản demo" })).toHaveAttribute("href", "/start");
    expect(screen.getByRole("link", { name: "Mở LiveLift" })).toHaveAttribute("href", "/home");
    expect(screen.getByText(/Chưa có thí nghiệm ngẫu nhiên thật/)).toBeInTheDocument();
  });

  it("changes the preview without navigating or implying that a pin was executed", () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Bằng chứng" }));
    expect(screen.getByRole("heading", { name: "Thấy cả lý do lẫn giới hạn." })).toBeInTheDocument();
    expect(screen.getByText("Chưa phải bằng chứng nhân quả")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nhật ký phiên" }));
    expect(screen.getByRole("heading", { name: "Mỗi thao tác đều có dấu vết." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gợi ý ghim" }));
    expect(screen.getByText("Gợi ý hiện tại · Chưa thực hiện")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gợi ý ghim" })).toHaveAttribute("aria-pressed", "true");
  });

  it("follows the visible story and disconnects its observer when leaving", () => {
    const { container, unmount } = render(<HomePage />);
    const scene = container.querySelector('[data-scene="2"]')!;
    act(() => intersect([{ target: scene, isIntersecting: true, intersectionRatio: .5 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(container.querySelector(".lp-story-visual")).toHaveClass("lp-scene-2");
    const previous = container.querySelector('[data-scene="1"]')!;
    act(() => intersect([{ target: previous, isIntersecting: true, intersectionRatio: .1 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(container.querySelector(".lp-story-visual")).toHaveClass("lp-scene-2");
    act(() => intersect([], {} as IntersectionObserver));
    expect(container.querySelector(".lp-story-visual")).toHaveClass("lp-scene-2");
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  HostApp,
  ViewerPill,
  ConditionBanner,
  PromotionBanner,
  PinnedCard,
  BagDrawer,
  CommentStream,
  fixtureIdle,
  fixtureLiveStandard,
  fixtureLiveEdgeCases,
  fixtureEnded,
  type HostAppActions,
  type HostAppBagItem,
} from "../index";

afterEach(cleanup);

const mockActions: HostAppActions = {
  onGoLive: vi.fn(),
  onEndLive: vi.fn(),
  onPin: vi.fn(),
  onUnpin: vi.fn(),
  onAddItem: vi.fn(),
  onRemoveItem: vi.fn(),
};

describe("HostApp: Simulation Honesty & Evidence Invariants", () => {
  it("always displays permanent SIMULATED Live badge across all modes", () => {
    // 1. Idle mode
    const { rerender } = render(<HostApp viewModel={fixtureIdle} actions={mockActions} />);
    expect(screen.getByTestId("host-app-simulated-badge")).toHaveTextContent(/SIMULATED SHOPEE LIVE/i);

    // 2. Live mode
    rerender(<HostApp viewModel={fixtureLiveStandard} actions={mockActions} />);
    expect(screen.getByTestId("host-app-simulated-badge")).toHaveTextContent(/SIMULATED SHOPEE LIVE/i);

    // 3. Ended mode
    rerender(<HostApp viewModel={fixtureEnded} actions={mockActions} />);
    expect(screen.getByTestId("host-app-simulated-badge")).toHaveTextContent(/SIMULATED SHOPEE LIVE/i);
  });

  it("unknown price shows 'Price not set', never 0 or empty string", () => {
    render(<HostApp viewModel={fixtureLiveEdgeCases} actions={mockActions} />);

    // Item 201 has priceLabel: null
    const pinnedPrice = screen.getByTestId("pinned-card-price");
    expect(pinnedPrice).toHaveTextContent("Price not set");
    expect(pinnedPrice.textContent).not.toContain("0");
  });

  it("renders pure view-model without clock or randomness", () => {
    render(<HostApp viewModel={fixtureLiveStandard} actions={mockActions} />);
    expect(screen.getByText("Đại Tiệc Săn Deal Công Nghệ & Thời Trang")).toBeInTheDocument();
    expect(screen.getByTestId("elapsed-label")).toHaveTextContent("00:14:32");
  });
});

describe("HostApp: Mode transitions & Controls", () => {
  it("renders idle mode with pre-live setup and triggers onGoLive", () => {
    render(<HostApp viewModel={fixtureIdle} actions={mockActions} />);
    expect(screen.getByTestId("host-app-mode-idle")).toBeInTheDocument();

    const goLiveBtn = screen.getByRole("button", { name: /Go Live/i });
    fireEvent.click(goLiveBtn);
    expect(mockActions.onGoLive).toHaveBeenCalledTimes(1);
  });

  it("renders live mode and triggers onEndLive", () => {
    render(<HostApp viewModel={fixtureLiveStandard} actions={mockActions} />);
    expect(screen.getByTestId("host-app-mode-live")).toBeInTheDocument();

    const endBtn = screen.getByRole("button", { name: /End/i });
    fireEvent.click(endBtn);
    expect(mockActions.onEndLive).toHaveBeenCalledTimes(1);
  });

  it("renders ended mode with stream summary", () => {
    render(<HostApp viewModel={fixtureEnded} actions={mockActions} />);
    expect(screen.getByTestId("host-app-mode-ended")).toBeInTheDocument();
    expect(screen.getByText(/Live Stream Ended/i)).toBeInTheDocument();
    expect(screen.getByText("01:32:45")).toBeInTheDocument();
  });
});

describe("ViewerPill Component", () => {
  it("renders simulated viewer count formatted with SIM tag", () => {
    render(<ViewerPill viewers={1420} />);
    const pill = screen.getByTestId("viewer-pill");
    expect(pill).toHaveTextContent("1,420");
    expect(pill).toHaveTextContent("SIM");
    expect(pill).toHaveAttribute("role", "status");
    expect(pill).toHaveAttribute("aria-label", "Simulated live viewers: 1,420");
  });

  it("renders 'Not simulated' when viewers is null", () => {
    render(<ViewerPill viewers={null} />);
    const pill = screen.getByTestId("viewer-pill");
    expect(pill).toHaveTextContent("Not simulated");
    expect(pill).toHaveAttribute("role", "status");
    expect(pill).toHaveAttribute("aria-label", "Viewer count not simulated");
  });
});

describe("PinnedCard Component", () => {
  const samplePinnedItem: HostAppBagItem = {
    itemId: 101,
    name: "Sản phẩm thử nghiệm",
    priceLabel: "150.000 ₫",
    initials: "SP",
    pinned: true,
  };

  it("renders pinned item details and triggers onUnpin", () => {
    const onUnpin = vi.fn();
    render(<PinnedCard item={samplePinnedItem} onUnpin={onUnpin} />);

    expect(screen.getByTestId("pinned-card")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Pinned product: Sản phẩm thử nghiệm" })
    ).toBeInTheDocument();
    // Rule: heading order violation fix - item name must be a paragraph, not h4
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Sản phẩm thử nghiệm")).toBeInTheDocument();
    expect(screen.getByText("150.000 ₫")).toBeInTheDocument();

    const unpinBtn = screen.getByRole("button", { name: /Unpin/i });
    fireEvent.click(unpinBtn);
    expect(onUnpin).toHaveBeenCalledTimes(1);
  });

  it("displays 'Price not set' when priceLabel is null", () => {
    const itemWithoutPrice: HostAppBagItem = {
      ...samplePinnedItem,
      priceLabel: null,
    };
    render(<PinnedCard item={itemWithoutPrice} onUnpin={vi.fn()} />);
    expect(screen.getByTestId("pinned-card-price")).toHaveTextContent("Price not set");
  });

  it("returns null when item is null", () => {
    const { container } = render(<PinnedCard item={null} onUnpin={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("PromotionBanner Component", () => {
  it("renders active flash sale with countdown", () => {
    render(
      <PromotionBanner
        promotion={{
          name: "Flash Sale 20:12",
          status: "active",
          countdownLabel: "ends in 04:30",
        }}
      />
    );
    expect(screen.getByTestId("promotion-banner")).toHaveTextContent("Flash Sale 20:12");
    expect(screen.getByText("ends in 04:30")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders scheduled promotion", () => {
    render(
      <PromotionBanner
        promotion={{
          name: "Flash Sale Sắp Diễn Ra",
          status: "scheduled",
          countdownLabel: "in 02:10",
        }}
      />
    );
    expect(screen.getByText("in 02:10")).toBeInTheDocument();
    expect(screen.getByText("scheduled")).toBeInTheDocument();
  });

  it("returns null when promotion is null", () => {
    const { container } = render(<PromotionBanner promotion={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ConditionBanner Component", () => {
  it("renders info, warn, and danger banners with accessible alert role", () => {
    const { rerender } = render(
      <ConditionBanner banner={{ tone: "info", text: "Connected info" }} />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Connected info");
    expect(screen.getByText("INFO")).toBeInTheDocument();

    rerender(<ConditionBanner banner={{ tone: "warn", text: "Warning condition" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Warning condition");
    expect(screen.getByText("WARNING")).toBeInTheDocument();

    rerender(<ConditionBanner banner={{ tone: "danger", text: "Danger condition" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Danger condition");
    expect(screen.getByText("DANGER")).toBeInTheDocument();
  });

  it("returns null when banner is null", () => {
    const { container } = render(<ConditionBanner banner={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("BagDrawer Component", () => {
  it("renders bag items and dispatches pin, unpin, and remove", () => {
    const onPin = vi.fn();
    const onUnpin = vi.fn();
    const onRemoveItem = vi.fn();
    const onAddItem = vi.fn();
    const onClose = vi.fn();

    const items: HostAppBagItem[] = [
      { itemId: 1, name: "Item One", priceLabel: "100.000 ₫", initials: "I1", pinned: true },
      { itemId: 2, name: "Item Two", priceLabel: null, initials: "I2", pinned: false },
    ];

    render(
      <BagDrawer
        bag={items}
        isOpen={true}
        onClose={onClose}
        onPin={onPin}
        onUnpin={onUnpin}
        onAddItem={onAddItem}
        onRemoveItem={onRemoveItem}
      />
    );

    // Check item 2 price is 'Price not set'
    expect(screen.getByTestId("bag-item-price-2")).toHaveTextContent("Price not set");

    // Click Unpin on Item 1
    const unpinBtn = screen.getByRole("button", { name: "Unpin Item One" });
    fireEvent.click(unpinBtn);
    expect(onUnpin).toHaveBeenCalledTimes(1);

    // Click Pin on Item 2
    const pinBtn = screen.getByRole("button", { name: "Pin Item Two" });
    fireEvent.click(pinBtn);
    expect(onPin).toHaveBeenCalledWith(2);

    // Click Remove on Item 1
    const removeBtn = screen.getByRole("button", { name: "Remove Item One from bag" });
    fireEvent.click(removeBtn);
    expect(onRemoveItem).toHaveBeenCalledWith(1);
  });
});

describe("CommentStream Component", () => {
  it("renders synthetic comments with aria-live='polite' without stealing focus", () => {
    const comments = [
      { id: "c1", user: "user_a", text: "Xin chào shop" },
      { id: "c2", user: "user_b", text: "Có freeship không?" },
    ];
    render(<CommentStream comments={comments} />);

    expect(screen.getByTestId("comment-stream")).toBeInTheDocument();
    expect(screen.getByText(/SYNTHETIC CHAT/i)).toBeInTheDocument();

    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("tabindex", "0");
    expect(log).toHaveAttribute("aria-label", "Synthetic live stream comments");
    expect(screen.getByText("Xin chào shop")).toBeInTheDocument();
    expect(screen.getByText("Có freeship không?")).toBeInTheDocument();
  });
});

describe("HostApp: L05 Focus Management & Contract Stability", () => {
  it("after pinning from the phone with keyboard/click, focus lands on the enabled Unpin control", () => {
    let items: HostAppBagItem[] = [
      { itemId: 101, name: "Product A", priceLabel: "100.000 ₫", initials: "PA", pinned: false },
      { itemId: 102, name: "Product B", priceLabel: "200.000 ₫", initials: "PB", pinned: false },
    ];

    const onPin = vi.fn((id: number) => {
      items = items.map((i) => (i.itemId === id ? { ...i, pinned: true } : i));
      rerender(
        <BagDrawer
          bag={items}
          isOpen={true}
          onClose={() => undefined}
          onPin={onPin}
          onUnpin={onUnpin}
          onAddItem={() => undefined}
          onRemoveItem={() => undefined}
        />
      );
    });

    const onUnpin = vi.fn();

    const { rerender } = render(
      <BagDrawer
        bag={items}
        isOpen={true}
        onClose={() => undefined}
        onPin={onPin}
        onUnpin={onUnpin}
        onAddItem={() => undefined}
        onRemoveItem={() => undefined}
      />
    );

    const pinBtn = screen.getByTestId("host-app-pin-101");
    pinBtn.focus();
    expect(document.activeElement).toBe(pinBtn);

    // Trigger pin via Enter / click
    fireEvent.click(pinBtn);
    expect(onPin).toHaveBeenCalledWith(101);

    // L05: Focus must now land on the enabled Unpin control
    const unpinBtn = screen.getByTestId("host-app-unpin-101");
    expect(document.activeElement).toBe(unpinBtn);
    expect(unpinBtn).not.toBeDisabled();
  });

  it("after unpinning from BagDrawer with keyboard/click, focus lands on the enabled Pin control", () => {
    let items: HostAppBagItem[] = [
      { itemId: 101, name: "Product A", priceLabel: "100.000 ₫", initials: "PA", pinned: true },
    ];

    const onPin = vi.fn();
    const onUnpin = vi.fn(() => {
      items = items.map((i) => ({ ...i, pinned: false }));
      rerender(
        <BagDrawer
          bag={items}
          isOpen={true}
          onClose={() => undefined}
          onPin={onPin}
          onUnpin={onUnpin}
          onAddItem={() => undefined}
          onRemoveItem={() => undefined}
        />
      );
    });

    const { rerender } = render(
      <BagDrawer
        bag={items}
        isOpen={true}
        onClose={() => undefined}
        onPin={onPin}
        onUnpin={onUnpin}
        onAddItem={() => undefined}
        onRemoveItem={() => undefined}
      />
    );

    const unpinBtn = screen.getByTestId("host-app-unpin-101");
    unpinBtn.focus();
    expect(document.activeElement).toBe(unpinBtn);

    // Trigger unpin
    fireEvent.click(unpinBtn);
    expect(onUnpin).toHaveBeenCalledTimes(1);

    // Focus lands back on the enabled Pin button
    const pinBtn = screen.getByTestId("host-app-pin-101");
    expect(document.activeElement).toBe(pinBtn);
    expect(pinBtn).not.toBeDisabled();
  });

  it("unrelated phone updates (comments, viewers, timers) never move or steal focus", () => {
    let vm = { ...fixtureLiveStandard };
    const { rerender } = render(<HostApp viewModel={vm} actions={mockActions} />);

    // Focus on the End button
    const endBtn = screen.getByTestId("host-app-end");
    endBtn.focus();
    expect(document.activeElement).toBe(endBtn);

    // 1. Unrelated comment stream update
    vm = {
      ...vm,
      comments: [
        ...vm.comments,
        { id: "c_new", user: "viewer99", text: "New incoming live comment!" },
      ],
    };
    rerender(<HostApp viewModel={vm} actions={mockActions} />);
    expect(document.activeElement).toBe(endBtn);

    // 2. Unrelated viewer count increment
    vm = {
      ...vm,
      viewers: 2500,
    };
    rerender(<HostApp viewModel={vm} actions={mockActions} />);
    expect(document.activeElement).toBe(endBtn);

    // 3. Unrelated elapsed timer tick
    vm = {
      ...vm,
      elapsedLabel: "00:15:00",
    };
    rerender(<HostApp viewModel={vm} actions={mockActions} />);
    expect(document.activeElement).toBe(endBtn);
  });

  it("unpinning from PinnedCard returns focus to bag button", () => {
    let vm = { ...fixtureLiveStandard };
    const actions: HostAppActions = {
      ...mockActions,
      onUnpin: vi.fn(() => {
        vm = {
          ...vm,
          bag: vm.bag.map((i) => ({ ...i, pinned: false })),
        };
        rerender(<HostApp viewModel={vm} actions={actions} />);
      }),
    };

    const { rerender } = render(<HostApp viewModel={vm} actions={actions} />);

    const unpinBtn = screen.getByTestId("host-app-unpin");
    unpinBtn.focus();
    expect(document.activeElement).toBe(unpinBtn);

    fireEvent.click(unpinBtn);
    expect(actions.onUnpin).toHaveBeenCalledTimes(1);

    // PinnedCard is now unmounted; focus must return to bag button
    const bagBtn = screen.getByTestId("host-app-bag-button");
    expect(document.activeElement).toBe(bagBtn);
  });

  it("preserves contract data-testids across idle, live, and ended modes", () => {
    // 1. Idle mode contracts
    const { rerender } = render(<HostApp viewModel={fixtureIdle} actions={mockActions} />);
    expect(screen.getByTestId("host-app")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-viewers")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-bag")).toBeInTheDocument();

    // 2. Live mode contracts
    rerender(<HostApp viewModel={fixtureLiveStandard} actions={mockActions} />);
    expect(screen.getByTestId("host-app")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-viewers")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-bag")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-bag-button")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-pinned")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-unpin")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-banner")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-promotion")).toBeInTheDocument();

    // 3. Ended mode contracts
    rerender(<HostApp viewModel={fixtureEnded} actions={mockActions} />);
    expect(screen.getByTestId("host-app")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-viewers")).toBeInTheDocument();
    expect(screen.getByTestId("host-app-bag")).toBeInTheDocument();
  });
});

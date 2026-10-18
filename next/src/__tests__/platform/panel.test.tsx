import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SCENARIO_START_MS, applyCommand, createScenarioSession, currentPlan, type CommandBody } from "@/lib/domain";
import type { Session } from "@/contracts";
import { PlatformSyncPanel } from "@/components/platform/PlatformSyncPanel";
import { SupportTabs } from "@/components/ops/SupportTabs";

const T = SCENARIO_START_MS;

function started(): Session {
  const r = applyCommand(createScenarioSession("buffered"), { type: "start_live", nowMs: 0 });
  return r.session;
}

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

function mount(session: Session = started(), onRecord: (c: CommandBody) => void = () => undefined) {
  return render(<PlatformSyncPanel session={session} nowMs={T} onRecord={onRecord} />);
}

describe("the platform panel", () => {
  it("says plainly that it is a simulation, and opens the live when the show is running", () => {
    mount();
    const panel = screen.getByTestId("platform-panel");
    expect(within(panel).getByText("SIMULATED Live")).toBeTruthy();
    expect(within(panel).getByText(/Nothing is sent to any real live platform/)).toBeTruthy();
    const linked = screen.getByTestId("platform-linked").textContent ?? "";
    expect(linked).toMatch(/Platform session \d+ · ongoing · opened by LiveLift/);
    const calls = screen.getAllByTestId("ledger-api").map((n) => n.textContent ?? "");
    expect(calls.join("|")).toContain("create_session");
    expect(calls.join("|")).toContain("start_session");
  });

  it("does nothing before the show starts", () => {
    mount(createScenarioSession("buffered"));
    expect(screen.getByTestId("platform-linked").textContent).toMatch(/No live is linked yet/);
    expect(screen.queryAllByTestId("ledger-api")).toHaveLength(0);
  });

  it("a pin from LiveLift reaches Shopee and is recorded in the show as performed, with the request id", () => {
    const record = vi.fn();
    const session = started();
    mount(session, record);
    const productId = currentPlan(session).cues.find((c) => c.action === "pin_product")!.productId!;
    fireEvent.click(screen.getByTestId(`pin-${productId}`));
    expect(record).toHaveBeenCalledTimes(1);
    const command = record.mock.calls[0][0] as CommandBody;
    expect(command).toMatchObject({ report: "performed", reason: expect.stringContaining("SIMULATED Live accepted the request · request_id") });
    expect(screen.getAllByTestId("ledger-api")[0].textContent).toContain("update_show_item");
    expect(screen.getByTestId(`pin-${productId}`).textContent).toBe("Pinned");
  });

  it("a pin the host makes in the app is picked up automatically and recorded as provider observed", () => {
    const record = vi.fn();
    mount(started(), record);
    fireEvent.click(screen.getByTestId("host-new-product"));
    const addButtons = screen.getAllByTestId(/^host-add-/);
    fireEvent.click(addButtons[0]);
    const pinButtons = screen.getAllByTestId(/^host-pin-/);
    fireEvent.click(pinButtons[0]);
    const commands = record.mock.calls.map((c) => c[0] as CommandBody);
    expect(commands.some((c) => "reason" in c && String(c.reason).includes("Provider observed (SIMULATED)"))).toBe(true);
    expect(screen.getByTestId("platform-notices").textContent).toMatch(/Host pinned/);
  });

  it("unpin is honest: no endpoint, so the operator keeps it", () => {
    mount();
    fireEvent.click(screen.getByTestId("platform-unpin"));
    expect(screen.getByTestId("platform-notices").textContent).toMatch(/No endpoint clears the pinned product/);
  });

  it("an injected fault is told to the operator once and shown with Shopee's own words", () => {
    mount();
    fireEvent.change(screen.getByTestId("platform-fault"), { target: { value: "token_expired" } });
    fireEvent.click(screen.getByTestId("platform-sync-now"));
    fireEvent.click(screen.getByTestId("platform-sync-now"));
    expect(screen.getByTestId("platform-problem").textContent).toContain("You are not authorized");
    const mentions = (screen.getByTestId("platform-notices").textContent ?? "").match(/You are not authorized/g) ?? [];
    expect(mentions).toHaveLength(1);
  });

  it("survives a reload: the rehearsal's platform is restored from the browser", () => {
    const session = started();
    const first = mount(session);
    const linked = screen.getByTestId("platform-linked").textContent;
    first.unmount();
    mount(session);
    expect(screen.getByTestId("platform-linked").textContent).toBe(linked);
  });

  it("the auto-sync toggle stops reading until Sync now is pressed", () => {
    mount();
    fireEvent.click(screen.getByTestId("platform-auto"));
    expect((screen.getByTestId("platform-auto") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId("host-new-product"));
    expect(screen.getAllByTestId("ledger-host").length).toBeGreaterThan(0);
  });
});

describe("the Platform tab", () => {
  it("keeps the panel mounted while another tab is showing, so auto-sync never pauses", () => {
    const session = started();
    render(
      <SupportTabs session={session} products={session.products} tz={session.timezone} platform={<PlatformSyncPanel session={session} nowMs={T} onRecord={() => undefined} />} />
    );
    expect(screen.getByTestId("platform-tab-content").hasAttribute("hidden")).toBe(true);
    expect(screen.getByTestId("platform-panel")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByTestId("support-tab-platform"));
    });
    expect(screen.getByTestId("platform-tab-content").hasAttribute("hidden")).toBe(false);
  });

  it("has no Platform tab without a platform", () => {
    const session = started();
    render(<SupportTabs session={session} products={session.products} tz={session.timezone} />);
    expect(screen.queryByTestId("support-tab-platform")).toBeNull();
  });
});
